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

    register_attendance: function(im, contact, training_code) {
        // TODO: api post attendance
        contact.extra.last_training_code = training_code;
        im.contacts.save(contact);
        return Q();
    },

    registration_api_call: function (method, params, payload, endpoint, im) {
        var http = new JsonApi(im, {
            headers: {
                'Authorization': ['Token ' + im.config.registration_api.api_key]
            }
        });
        switch (method) {
            case "post":
                return http.post(im.config.registration_api.url + endpoint, {
                    data: payload
                });
            case "get":
                return http.get(im.config.registration_api.url + endpoint, {
                    params: params
                });
            case "patch":
                return http.patch(im.config.registration_api.url + endpoint, {
                    data: payload
                });
            case "put":
                return http.put(im.config.registration_api.url + endpoint, {
                    params: params,
                  data: payload
                });
            case "delete":
                return http.delete(im.config.registration_api.url + endpoint);
            }
    },


    // SMSINBOUND ONLY

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
        return today.format('YYYY-MM-DD hh:mm:ss.SSS');
    },

    opt_out: function(im, contact) {
        contact.extra.optout_last_attempt = go.utils.get_today(im.config);

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
        contact.extra.optin_last_attempt = go.utils.get_today(im.config);
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
                        .register_attendance(self.im, self.contact, choice.value)
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

go.init = function() {
    var vumigo = require('vumigo_v02');
    var InteractionMachine = vumigo.InteractionMachine;
    var GoApp = go.app.GoApp;

    return {
        im: new InteractionMachine(api, new GoApp())
    };
}();
