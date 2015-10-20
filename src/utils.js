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
