// WARNING: This is a generated file.
//          If you edit it you will be sad.
//          Edit src/app.js instead.

var go = {};
go;

/*jshint -W083 */
var Q = require('q');
var moment = require('moment');
var vumigo = require('vumigo_v02');
var JsonApi = vumigo.http.api.JsonApi;
var vumigo = require('vumigo_v02');
var Choice = vumigo.states.Choice;


// override moment default century switch at '68 with '49
// ie. 48 becomes 2048, 50 becomes 1950
moment.parseTwoDigitYear = function (input) {
    return +input + (+input > 49 ? 1900 : 2000);
};

// Shared utils lib
go.utils = {

    save_set_language: function(im, contact, lang) {
        contact.extra.lang = lang;
        return Q.all([
            im.user.set_lang(lang),
            im.contacts.save(contact)
        ]);
    },

    set_language: function(im, contact) {
        if (contact.extra.lang !== undefined) {
            return im.user.set_lang(contact.extra.lang);
        } else {
            return Q();
        }
    },

    reset_contact: function(im, contact) {
        contact.extra = {};
        return Q.all([
            im.contacts.save(contact),
            im.user.set_lang('en'),
        ]);
    },

    validate_training_code: function(im, training_code) {
        // First check if training code is numeric before making api call
        if (!go.utils.check_valid_number(training_code)) {
            return Q()  // A promise is expected
                .then(function() {
                    return false;
                });
        } else {
            // Check via api call if number is valid
            var endpoint = "events/" + training_code + "/";
            return go.utils
                .el_api_call(endpoint, "get", {}, {}, im)
                .then(function(response) {
                    return response.code === 200;
                })
                .catch(function(error) {
                    return false;
                });
        }
    },

    get_participant_id_by_msisdn: function(participant_msisdn, im) {
        var params = {msisdn: participant_msisdn};
        return go.utils
            .el_api_call("participants/", "get", params, {}, im)
            .then(function(response) {
                var participants_found = response.data.results;
                // Return the first participant's id
                return (participants_found.length > 0)
                    ? participants_found[0].id
                    : null;
            });
    },

    create_participant: function(contact, im) {
        var payload = {"msisdn": contact.msisdn,
                       "lang": im.user.lang};
        return go.utils
            .el_api_call("participants/", "post", {}, payload, im)
            .then(function(response) {
                var participant_created = response.data;
                // Return the participants's id
                contact.extra.participant_id = (participant_created.id).toString();
                return im.contacts
                    .save(contact)
                    .then(function() {
                        return participant_created.id;
                    });
            });
    },

    get_or_create_participant: function(im, contact) {
        if (contact.extra.participant_id !== undefined) {
            return Q()
                .then(function() {
                    return contact.extra.participant_id;
                });
        } else {
            return go.utils
                .get_participant_id_by_msisdn(contact.msisdn, im)
                .then(function(participant_id) {
                    if (participant_id !== null) {
                        // Participant exists - return the id
                        return participant_id;
                    } else {
                        // Participant doesn't exist - create it
                        return go.utils
                            .create_participant(contact, im)
                            .then(function(participant_id) {
                                return participant_id;
                            });
                    }
                });
        }
    },

    register_attendance: function(im, contact, training_code) {
        contact.extra.last_training_code = training_code;
        return im.contacts
            .save(contact)
            .then(function() {
                return go.utils
                    .get_or_create_participant(im, contact)
                    .then(function(participant_id) {
                        var attendee_data = {
                            "event": "/api/v1/events/" + training_code + "/",
                            "participant": "/api/v1/participants/" + participant_id + "/"
                        };
                        return go.utils
                            .el_api_call("attendees/", "post", {}, attendee_data, im);
                    });
            });
    },

    validate_id_sa: function(id) {
        var i, c,
            even = '',
            sum = 0,
            check = id.slice(-1);

        if (id.length != 13 || id.match(/\D/)) {
            return false;
        }
        if (!moment(id.slice(0,6), 'YYMMDD', true).isValid()) {
            return false;
        }
        id = id.substr(0, id.length - 1);
        for (i = 0; id.charAt(i); i += 2) {
            c = id.charAt(i);
            sum += +c;
            even += id.charAt(i + 1);
        }
        even = '' + even * 2;
        for (i = 0; even.charAt(i); i++) {
            c = even.charAt(i);
            sum += +c;
        }
        sum = 10 - ('' + sum).charAt(1);
        return ('' + sum).slice(-1) == check;
    },

    extract_id_dob: function(id) {
        return moment(id.slice(0,6), 'YYMMDD').format('YYYY-MM-DD');
    },

    extract_id_gender: function(id) {
        return parseInt(id.slice(6,7), 10) >= 5 ? 'male' : 'female';
    },

    update_participant: function(im, contact, payload) {
        return go.utils
            .get_or_create_participant(im, contact)
            .then(function(participant_id) {
                var endpoint = "participants/" + participant_id + "/";
                return go.utils
                    .el_api_call(endpoint, "patch", {}, payload, im);
            });
    },

    save_participant_dob_gender: function(im, contact, gender) {
        contact.extra.gender = gender;
        contact.extra.details_completed = "v1";
        return im.contacts
            .save(contact)
            .then(function() {
                payload = {
                    "dob": contact.extra.dob,
                    "gender": contact.extra.gender
                };
                return go.utils
                    .update_participant(im, contact, payload);
            });
    },

    save_participant_passport: function(im, contact, passport_no) {
        contact.extra.passport_origin = im.user.answers.state_passport_origin;
        contact.extra.passport_no = passport_no;
        return im.contacts
            .save(contact)
            .then(function() {
                payload = {
                    "full_name": contact.extra.full_name,
                    "id_type": contact.extra.id_type,
                    "id_no": contact.extra.passport_no,
                    "passport_origin": contact.extra.passport_origin
                };
                return go.utils
                    .update_participant(im, contact, payload);
            });
    },

    save_participant_sa_id: function(im, contact, id) {
        contact.extra.sa_id = id;
        contact.extra.dob = go.utils.extract_id_dob(id);
        contact.extra.gender = go.utils.extract_id_gender(id);
        contact.extra.details_completed = "v1";
        return im.contacts
            .save(contact)
            .then(function() {
                payload = {
                    "full_name": contact.extra.full_name,
                    "gender": contact.extra.gender,
                    "id_type": contact.extra.id_type,
                    "id_no": contact.extra.sa_id,
                    "dob": contact.extra.dob
                };
                return go.utils
                    .update_participant(im, contact, payload);
            });
    },

    is_alpha_numeric_only: function(input) {
        alpha_numeric = new RegExp('^[A-Za-z0-9]+$');
        return alpha_numeric.test(input);
    },

    check_valid_number: function(input) {
        // an attempt to solve the insanity of JavaScript numbers
        var numbers_only = new RegExp('^\\d+$');
        if (input !== '' && numbers_only.test(input) && !Number.isNaN(Number(input))){
            return true;
        } else {
            return false;
        }
    },

    check_number_in_range: function(input, start, end) {
        return go.utils.check_valid_number(input)
                && (parseInt(input, 10) >= start)
                && (parseInt(input, 10) <= end);
    },

    make_month_choices: function($, start, limit) {
        // start should be 0 for Jan - array position
        var choices = [
                new Choice('01', $('Jan')),
                new Choice('02', $('Feb')),
                new Choice('03', $('Mar')),
                new Choice('04', $('Apr')),
                new Choice('05', $('May')),
                new Choice('06', $('Jun')),
                new Choice('07', $('Jul')),
                new Choice('08', $('Aug')),
                new Choice('09', $('Sep')),
                new Choice('10', $('Oct')),
                new Choice('11', $('Nov')),
                new Choice('12', $('Dec'))
            ];

        var choices_show = [];
        var choices_show_count = 0;
        var end = start + limit;

        for (var i=start; i<end; i++) {
            var val = (i >= 12 ? (i-12) : i);
            choices_show[choices_show_count] = choices[val];
            choices_show_count++;
        }

        return choices_show;
    },

    el_api_call: function (endpoint, method, params, payload, im) {
        var http = new JsonApi(im, {
            headers: {
                'Authorization': ['Token ' + im.config.el_api.api_key]
            }
        });
        switch (method) {
            case "post":
                return http.post(im.config.el_api.base_url + endpoint, {
                    data: payload
                });
            case "get":
                return http.get(im.config.el_api.base_url + endpoint, {
                    params: params
                });
            case "patch":
                return http.patch(im.config.el_api.base_url + endpoint, {
                    data: payload
                });
            case "put":
                return http.put(im.config.el_api.base_url + endpoint, {
                    params: params,
                  data: payload
                });
            case "delete":
                return http.delete(im.config.el_api.base_url + endpoint);
            }
    },

    get_clean_first_word: function(user_message) {
        return user_message
            .split(" ")[0]          // split off first word
            .replace(/\W/g, '')     // remove non letters
            .toUpperCase();         // capitalise
    },

    get_today: function(config) {
        var today;
        if (config.testing_today) {
            today = new moment(config.testing_today);
        } else {
            today = new moment();
        }
        return today;
    },

    double_digit_day: function(input) {
        input_num = parseInt(input, 10);
        return input_num < 10 ? "0" + input_num.toString() : input;
    },

    get_entered_birth_date: function(year, month, day) {
      return year + '-' + month + '-' + go.utils.double_digit_day(day);
    },

    is_valid_date: function(date, format) {
        // implements strict validation with 'true' below
        return moment(date, format, true).isValid();
    },

    post_feedback: function(im, contact, q_id, q_text, answer_text, answer_value) {
        var payload = {"event": "/api/v1/events/" + contact.extra.last_training_code + "/",
                       "participant": "/api/v1/participants/" + contact.extra.participant_id + "/",
                       "question_id": q_id,
                       "question_text": q_text,
                       "answer_text": answer_text,
                       "answer_value": answer_value};
        return go.utils.el_api_call("feedback/", "post", {}, payload, im);
    },

    opt_out: function(im, contact) {
        contact.extra.optout_last_attempt = go.utils
            .get_today(im.config).format('YYYY-MM-DD hh:mm:ss.SSS');

        return Q.all([
            im.contacts.save(contact),
            im.api_request('optout.optout', {
                address_type: "msisdn",
                address_value: contact.msisdn,
                message_id: im.msg.message_id
            })
        ]);
    },

    opt_in: function(im, contact) {
        contact.extra.optin_last_attempt = go.utils
            .get_today(im.config).format('YYYY-MM-DD hh:mm:ss.SSS');
        return Q.all([
            im.contacts.save(contact),
            im.api_request('optout.cancel_optout', {
                address_type: "msisdn",
                address_value: contact.msisdn
            }),
        ]);
    },

    "commas": "commas"
};

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
            var error = $("Sorry, the training session code you entered does not exist. " +
                          "Please try again");
            return new FreeText(name, {
                question: $("What is your training session code?"),
                check: function(content) {
                    return go.utils
                        .validate_training_code(self.im, content)
                        .then(function(validates) {
                            if (!validates) {
                                return error;
                            }
                        });
                },
                next: function(content) {
                    return go.utils
                        .register_attendance(self.im, self.contact, content)
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
                        .save_participant_sa_id(self.im, self.contact, content)
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
                next: 'state_passport_no'
            });
        });

        self.states.add('state_passport_no', function(name) {
            var error = $('There was an error in your entry. Please ' +
                        'carefully enter the passport number again.');
            var question = $('Please enter your Passport number:');

            return new FreeText(name, {
                question: question,
                check: function(content) {
                    if (!go.utils.is_alpha_numeric_only(content) || content.length <= 4) {
                        return error;
                    }
                },
                next: function(content) {
                    return go.utils
                        .save_participant_passport(self.im, self.contact, content)
                        .then(function() {
                            return 'state_birth_year';
                        });
                }
            });
        });

        self.states.add('state_birth_year', function(name, opts) {
            var error = $('There was an error in your entry. Please carefully enter your ' +
                          'year of birth again (for example: 2001)');
            var question = $('Please enter the year that you were born (for example: 1981)');

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
            var error = $('There was an error in your entry. Please carefully ' +
                        'enter your day of birth again (for example: 8)');
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
                    return go.utils
                        .save_participant_dob_gender(self.im, self.contact, choice.value)
                        .then(function() {
                            return 'state_end';
                        });
                }
            });
        });

        self.states.add('state_help', function(name) {
            return new ChoiceState(name, {
                question: "You have reached the Emerging Leaders training registration line.",
                choices: [
                    new Choice('reset', 'Start from scratch'),
                    new Choice('continue', 'Ok, register a training session'),
                    new Choice('exit', 'Exit'),
                ],
                next: function(choice) {
                    if (choice.value == 'reset') {
                        return go.utils
                            .reset_contact(self.im, self.contact)
                            .then(function() {
                                return 'state_language';
                            });
                    } else if (choice.value == 'continue') {
                        return 'state_training_code';
                    } else {
                        return 'state_abort';
                    }
                }
            });
        });

        self.states.add('state_end', function(name) {
            return new EndState(name, {
                text: $("Thank you for registering your training session!"),
                next: 'state_start'
            });
        });

        self.states.add('state_abort', function(name) {
            return new EndState(name, {
                text: "Goodbye!",
                next: 'state_start'
            });
        });
    });

    return {
        GoApp: GoApp
    };
}();

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoApp = go.app.GoApp;

    return {
        im: new InteractionMachine(api, new GoApp())
    };
}();
