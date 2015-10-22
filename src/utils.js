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
        var endpoint = "events/" + training_code + "/";
        return go.utils
            .el_api_call(endpoint, "get", {}, {}, im)
            .then(function(response) {
                return response.code === 200;
            })
            .catch(function(error) {
                return false;
            });
    },

    register_attendance: function(im, contact, training_code) {
        // TODO #6: api post attendance
        contact.extra.last_training_code = training_code;
        return im.contacts
            .save(contact)
            .then(function() {
                return Q();
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
        return im.contacts.save(contact);
    },

    is_alpha_numeric_only: function(input) {
        alpha_numeric = new RegExp('^[A-Za-z0-9]+$');
        return alpha_numeric.test(input);
    },

    check_valid_number: function(input){
        // an attempt to solve the insanity of JavaScript numbers
        var numbers_only = new RegExp('^\\d+$');
        if (input !== '' && numbers_only.test(input) && !Number.isNaN(Number(input))){
            return true;
        } else {
            return false;
        }
    },

    check_number_in_range: function(input, start, end){
        return go.utils.check_valid_number(input)
                && (parseInt(input, 10) >= start)
                && (parseInt(input, 10) <= end);
    },

    // make choices options with options
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
