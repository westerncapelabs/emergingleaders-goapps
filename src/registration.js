go.app = function() {
    var vumigo = require('vumigo_v02');
    var MetricsHelper = require('go-jsbox-metrics-helper');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
    var FreeText = vumigo.states.FreeText;
    var EndState = vumigo.states.EndState;


    var GoApp = App.extend(function(self) {
        App.call(self, 'state_start');
        var $ = self.$;

        self.init = function() {

            // Use the metrics helper to add some metrics
            mh = new MetricsHelper(self.im);
            mh
                // Total unique users
                .add.total_unique_users('total.ussd.unique_users')
                // Total sessions
                .add.total_sessions('total.ussd.sessions')
            ;

            // Load self.contact
            return self.im.contacts
                .for_user()
                .then(function(user_contact) {
                   self.contact = user_contact;
                });
        };


    // ROUTING STATES

        self.states.add('state_start', function(name) {
            if (self.contact.extra.lang === undefined) {
                return self.states.create('state_language');
            } else {
                return go.utils
                    .set_language(self.im, self.contact)
                    .then(function() {
                        if (self.contact.extra.details_completed === "v1") {
                            return self.states.create('state_returning_user');
                        } else {
                            return self.states.create('state_training_code');
                        }
                    });
            }
        });


    // CONTENT STATES

        self.states.add('state_returning_user', function(name) {
            return new ChoiceState(name, {
                question: $("Welcome back {{name}}.").context({
                    name: self.contact.extra.full_name}),
                choices: [
                    new Choice('training', $("Register attendance at training session")),
                    new Choice('reset', $("I am not {{name}}").context({
                        name: self.contact.extra.full_name})),
                    new Choice('help', ("Help!"))
                ],
                next: function(choice) {
                    if (choice.value == 'training') {
                        return 'state_training_code';
                    } else if (choice.value === 'reset') {
                        return go.utils
                            .reset_contact(self.im, self.contact)
                            .then(function() {
                                return 'state_language';
                            });
                    } else if (choice.value === 'help') {
                        return 'state_help';
                    }
                }
            });
        });

        self.states.add('state_language', function(name) {
            return new PaginatedChoiceState(name, {
                question: $('Choose your preferred language:'),
                options_per_page: null,
                choices: [
                    new Choice('zu', 'isiZulu'),
                    new Choice('xh', 'isiXhosa'),
                    new Choice('af', 'Afrikaans'),
                    new Choice('en', 'English'),
                    new Choice('nso', 'Sesotho sa Leboa'),
                    new Choice('tn', 'Setswana'),
                    new Choice('st', 'Sesotho'),
                    new Choice('ts', 'Xitsonga'),
                    new Choice('ss', 'siSwati'),
                    new Choice('ve', 'Tshivenda'),
                    new Choice('nr', 'isiNdebele'),
                ],
                next: function(choice) {
                    return go.utils
                        .save_set_language(self.im, self.contact, choice.value)
                        .then(function() {
                            return 'state_training_code';
                        });
                }
            });
        });

        self.states.add('state_training_code', function(name) {
            return new FreeText(name, {
                question: $("What is your training session code?"),
                next: function(choice) {
                    // TODO: validate entered clinic code
                    return go.utils
                        .register_attendance(self.im, self.contact, choice)
                        .then(function() {
                            if (self.contact.extra.details_completed === "v1") {
                                return 'state_end';
                            } else {
                                return 'state_name';
                            }
                        });
                }
            });
        });

        self.states.add('state_name', function(name) {
            return new FreeText(name, {
                question: $("Please enter your full name"),
                next: function(content) {
                    self.contact.extra.full_name = content;
                    return self.im.contacts
                        .save(self.contact)
                        .then(function() {
                            return 'state_id_type';
                        });
                }
            });
        });

        self.states.add('state_id_type', function(name) {
            return new ChoiceState(name, {
                question: $("What kind of identification do you have?"),
                choices: [
                    new Choice('sa_id', $('SA ID')),
                    new Choice('passport', $('Passport')),
                    new Choice('none', $('None'))
                ],
                next: function(choice) {
                    self.contact.extra.id_type = choice.value;

                    return self.im.contacts
                        .save(self.contact)
                        .then(function() {
                            return {
                                sa_id: 'state_sa_id',
                                passport: 'state_passport_origin',
                                none: 'state_birth_year'
                            } [choice.value];
                        });
                }
            });
        });

        self.states.add('state_sa_id', function(name) {
            var error = $('Sorry, your ID number did not validate. ' +
                          'Please re-enter your SA ID number:');
            var question = $('Please enter your SA ID number:');

            return new FreeText(name, {
                question: question,
                check: function(content) {
                    if (!go.utils.validate_id_sa(content)) {
                        return error;
                    }
                },
                next: function(content) {
                    return go.utils
                        .save_id_dob_gender_extras(self.im, self.contact, content)
                        .then(function() {
                            return 'state_end';
                        });
                }
            });
        });

        self.states.add('state_passport_origin', function(name) {
            return new ChoiceState(name, {
                question: $('What is the country of origin of the passport?'),
                choices: [
                    new Choice('zw', $('Zimbabwe')),
                    new Choice('mz', $('Mozambique')),
                    new Choice('mw', $('Malawi')),
                    new Choice('ng', $('Nigeria')),
                    new Choice('cd', $('DRC')),
                    new Choice('so', $('Somalia')),
                    new Choice('other', $('Other'))
                ],
                next: function(choice) {
                    self.contact.extra.passport_origin = choice.value;
                    return self.im.contacts
                        .save(self.contact)
                        .then(function() {
                            return 'states_passport_no';
                        });
                }
            });
        });

        self.states.add('state_birth_year', function(name, opts) {
            var error = $('There was an error in your entry. Please carefully enter your ' +
                          'year of birth again (for example: 2001)');
            var question = $('Please enter the year that the pregnant mother was born' +
                             '(for example: 1981)');

            return new FreeText(name, {
                question: question,
                check: function(content) {
                    if (!go.utils.check_number_in_range(content, 1900,
                        go.utils.get_today(self.im.config).year() - 6)) {
                        // assumes youngest possible participant age is 6 years old
                        return error;
                    }
                },
                next: 'state_birth_month'
            });
        });

        self.states.add('state_birth_month', function(name) {
            return new ChoiceState(name, {
                question: $('Please enter the month that you were born'),
                choices: go.utils.make_month_choices($, 0, 12),
                next: 'state_birth_day'
            });
        });

        self.states.add('state_birth_day', function(name) {
            var error = $('There was an error in your entry. Please ' +
                        'carefully enter the mother\'s day of birth again ' +
                        '(for example: 8)');
            var question = $('Please enter the day that you were born (for example: 14).');

            return new FreeText(name, {
                question: question,
                check: function(content) {
                    if (!go.utils.check_number_in_range(content, 1, 31)) {
                        return error;
                    }
                },
                next: function(content) {
                    var dob = go.utils.get_entered_birth_date(
                                  self.im.user.answers.state_birth_year,
                                  self.im.user.answers.state_birth_month,
                                  content);

                    if (go.utils.is_valid_date(dob, 'YYYY-MM-DD')) {
                        self.contact.extra.dob = dob;
                        return self.im.contacts
                            .save(self.contact)
                            .then(function() {
                                return 'state_gender';
                            });
                    } else {
                        return {
                            name: 'state_invalid_dob',
                            creator_opts: {dob: dob}
                        };
                    }
                }
            });
        });

        self.states.add('state_invalid_dob', function(name, opts) {
            return new ChoiceState(name, {
                question:
                    $('The date you entered ({{dob}}) is not a real date. Please try again.'
                     ).context({ dob: opts.dob }),
                choices: [
                    new Choice('continue', $('Continue'))
                ],
                next: 'state_birth_year'
            });
        });

        self.states.add('state_gender', function(name, opts) {
            return new ChoiceState(name, {
                question: $("What is your gender?"),
                choices: [
                    new Choice('male', $('Male')),
                    new Choice('female', $('Female'))
                ],
                next: function(choice) {
                    self.contact.extra.gender = choice.value;
                    return self.im.contacts
                        .save(self.contact)
                        .then(function() {
                            return 'state_end';
                        });
                }
            });
        });

        self.states.add('state_help', function(name) {
            return new EndState(name, {
                text: $("Sorry, it's a lost cause."),
                next: 'state_start'
            });
        });

        self.states.add('state_end', function(name) {
            return new EndState(name, {
                text: $("Thank you for registering your training session!"),
                next: 'state_start'
            });
        });

    });

    return {
        GoApp: GoApp
    };
}();
