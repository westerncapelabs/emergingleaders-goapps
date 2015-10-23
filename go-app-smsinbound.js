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

    create_participant: function(participant_msisdn, im) {
        var payload = {"msisdn": participant_msisdn};
        return go.utils
            .el_api_call("participants/", "post", {}, payload, im)
            .then(function(response) {
                var participant_created = response.data;
                // Return the participants's id
                return participant_created.id;
            });
    },

    get_or_create_participant: function(im, contact) {
        return go.utils
            .get_participant_id_by_msisdn(contact.msisdn, im)
            .then(function(participant_id) {
                if (participant_id !== null) {
                    // Participant exists - return the id
                    return participant_id;
                } else {
                    // Participant doesn't exist - create it
                    return go.utils
                        .create_participant(contact.msisdn, im)
                        .then(function(participant_id) {
                            return participant_id;
                        });
                }
            });
    },

    register_attendance: function(im, contact, training_code) {
        // TODO #6: api post attendance
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
                            .el_api_call("attendees/", "post", {}, attendee_data, im)
                            .then(function(response) {
                            });
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

    save_id_dob_gender_extras: function(im, contact, id) {
        contact.extra.sa_id = id;
        contact.extra.dob = go.utils.extract_id_dob(id);
        contact.extra.gender = go.utils.extract_id_gender(id);
        contact.extra.details_completed = "v1";
        return im.contacts.save(contact);
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
    var EndState = vumigo.states.EndState;


    var GoApp = App.extend(function(self) {
        App.call(self, 'state_start');
        var $ = self.$;

        self.init = function() {

            // Use the metrics helper to add some metrics
            mh = new MetricsHelper(self.im);
            mh
                // Total unique users
                .add.total_unique_users('total.sms.unique_users')

                // Total opt-outs
                .add.total_state_actions(
                    {
                        state: 'state_opt_out',
                        action: 'enter'
                    },
                    'total.optouts'
                )

                // Total opt-ins
                .add.total_state_actions(
                    {
                        state: 'state_opt_in',
                        action: 'enter'
                    },
                    'total.optins'
                )

                // Total opt-ins
                .add.total_state_actions(
                    {
                        state: 'state_unrecognised',
                        action: 'enter'
                    },
                    'total.unrecognised_sms'
                );

            // Load self.contact
            return self.im.contacts
                .for_user()
                .then(function(user_contact) {
                   self.contact = user_contact;
                });
        };


        self.states.add('state_start', function() {
            var user_first_word = go.utils.get_clean_first_word(self.im.msg.content);
            switch (user_first_word) {
                case "STOP":
                    return self.states.create("state_opt_out_enter");
                case "BLOCK":
                    return self.states.create("state_opt_out_enter");
                case "START":
                    return self.states.create("state_opt_in_enter");
                default:
                    return self.states.create("state_unrecognised");
            }
        });


    // OPTOUT STATES
        self.states.add('state_opt_out_enter', function(name) {
            return go.utils
                .opt_out(self.im, self.contact)
                .then(function() {
                    return self.states.create('state_opt_out');
                });
        });

        self.states.add('state_opt_out', function(name) {
            return new EndState(name, {
                text: $('Thank you. You will no longer receive messages from us. Reply START to opt back in.'),
                next: 'state_start'
            });
        });


    // OPTIN STATES
        self.states.add('state_opt_in_enter', function(name) {
            return go.utils
                .opt_in(self.im, self.contact)
                .then(function() {
                    return self.states.create('state_opt_in');
                });
        });

        self.states.add('state_opt_in', function(name) {
            return new EndState(name, {
                text: $('Thank you. You will now receive messages from us again. Reply STOP to unsubscribe.'),
                next: 'state_start'
            });
        });


    // UNRECOGNISED
        self.states.add('state_unrecognised', function(name) {
            return new EndState(name, {
                text: $('We do not recognise the message you sent us. Reply STOP to unsubscribe or START to opt in.'),
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
