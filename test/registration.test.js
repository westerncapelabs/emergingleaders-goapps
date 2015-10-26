var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures');
var assert = require('assert');
var _ = require('lodash');
var AppTester = vumigo.AppTester;


describe("emergingleaders app", function() {
    describe("for ussd training session registration use", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoApp();
            tester = new AppTester(app);

            tester
                .setup.char_limit(160)
                .setup.config.app({
                    name: 'emergingleaders',
                    channel: '*120*8864*0000#',
                    metric_store: 'emergingleaders_test',  // _env at the end
                    el_api: {
                        username: "test_api_user",
                        api_key: "test_api_key",
                        base_url: "http://127.0.0.1:8000/api/v1/"
                    },
                    endpoints: {
                        "sms": {"delivery_class": "sms"}
                    },
                    testing_today: '2015-03-03T15:08:08.000',
                })
                .setup(function(api) {
                    fixtures().forEach(function(d) {
                        api.http.fixtures.add(d);
                    });
                })
                .setup(function(api) {
                    api.metrics.stores = {'emergingleaders_test': {}};
                })
                .setup(function(api) {
                    // new user 1
                    api.contacts.add({
                        msisdn: '+082111',
                        extra: {},
                        key: "contact_key_082111",
                        user_account: "contact_user_account"
                    });
                })
                .setup(function(api) {
                    // returning user all details completed
                    api.contacts.add({
                        msisdn: '+082222',
                        extra: {
                            lang: "af",
                            full_name: "Pete Pompey",
                            id_type: 'sa_id',
                            sa_id: '5101025009086',
                            dob: '1951-01-02',
                            gender: 'male',
                            details_completed: "v1",
                            participant_id: "222",
                            last_training_code: "2",
                            last_feedback_code: "2"
                        },
                        key: "contact_key_082222",
                        user_account: "contact_user_account"
                    });
                })
                .setup(function(api) {
                    // returning user only some details completed
                    api.contacts.add({
                        msisdn: '+082333',
                        extra: {
                            lang: "af",
                            full_name: "susan"
                        },
                        key: "contact_key_082333",
                        user_account: "contact_user_account"
                    });
                })
            ;
        });


        // TEST REGISTRATION

        describe("Registration testing", function() {

            describe("starting session", function() {
                it("should ask for their language if they are a new user", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.interaction({
                            state: 'state_language',
                            reply: [
                                "Choose your preferred language:",
                                "1. isiZulu",
                                "2. isiXhosa",
                                "3. Afrikaans",
                                "4. English",
                                "5. Sesotho sa Leboa",
                                "6. Setswana",
                                "7. Sesotho",
                                "8. Xitsonga",
                                "9. siSwati",
                                "10. More"
                            ].join('\n')
                        })
                        .run();
                });

                it("should show more language options on next page", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '10'  // more
                        )
                        .check.interaction({
                            state: 'state_language',
                            reply: [
                                "Choose your preferred language:",
                                "1. Tshivenda",
                                "2. isiNdebele",
                                "3. Back"
                            ].join('\n')
                        })
                        .run();
                });

                it("should set their language, present options if they are a returning " +
                   "fully registered user", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.user.properties({lang: 'af'})
                        .check.interaction({
                            state: 'state_returning_user',
                            reply: [
                                "Welcome back Pete Pompey.",
                                "1. Register attendance at training session",
                                "2. I am not Pete Pompey",
                                "3. Help!"
                            ].join('\n')
                        })
                        .run();
                });

                it("should set their language, ask for training code if they are a " +
                   "returning user with incomplete information", function() {
                    return tester
                        .setup.user.addr('082333')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.user.properties({lang: 'af'})
                        .check.interaction({
                            state: 'state_training_code',
                            reply: "What is your training session code?"
                        })
                        .run();
                });

                it("should fire metrics", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check(function(api) {
                            var metrics = api.metrics.stores.emergingleaders_test;
                            assert.equal(Object.keys(metrics).length, 4);
                            assert.deepEqual(metrics['total.ussd.unique_users'].values, [1]);
                            assert.deepEqual(metrics['total.ussd.unique_users.transient'].values, [1]);
                            assert.deepEqual(metrics['total.ussd.sessions'].values, [1]);
                            assert.deepEqual(metrics['total.ussd.sessions.transient'].values, [1]);
                        })
                        .run();
                });
            });

            describe("upon language selection", function() {
                it("should set their language, ask for their training code", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                        )
                        .check.user.properties({lang: 'af'})
                        .check.interaction({
                            state: 'state_training_code',
                            reply: "What is your training session code?"
                        })
                        .run();
                });
            });

            describe("upon retuning user option selection", function() {
                it("should ask for their training code if they want to register " +
                   "attendance", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_returning_user - register attendance
                        )
                        .check.interaction({
                            state: 'state_training_code'
                        })
                        .run();
                });

                it("should reset extras, language, ask for language if they indicate " +
                   "that they are not the contact", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '2'  // state_returning_user - not the contact
                        )
                        .check.user.properties({lang: 'en'})
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082222'
                            });
                            assert.equal(Object.keys(contact.extra).length, 0);
                        })
                        .check.interaction({
                            state: 'state_language'
                        })
                        .run();
                });

                it("should offer choices on selecting help", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_returning_user - help
                        )
                        .check.interaction({
                            state: 'state_help',
                            reply: [
                                "You have reached the Emerging Leaders training registration line.",
                                "1. Start from scratch",
                                "2. Ok, register a training session",
                                "3. Exit"
                            ].join('\n')
                        })
                        .run();
                });
            });

            describe("upon entering a choice state_help", function() {
                it("should reset if chosen", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_returning_user - help
                            , '1'  // state_help - reset
                        )
                        .check.user.properties({lang: 'en'})
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082222'
                            });
                            assert.equal(Object.keys(contact.extra).length, 0);
                        })
                        .check.interaction({
                            state: 'state_language'
                        })
                        .run();
                });

                it("should continue if chosen", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_returning_user - help
                            , '2'  // state_help - continue
                        )
                        .check.user.properties({lang: 'af'})
                        .check.interaction({
                            state: 'state_training_code'
                        })
                        .run();
                });

                it("should exit if chosen", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_returning_user - help
                            , '3'  // state_help - exit
                        )
                        .check.interaction({
                            state: 'state_abort',
                            reply: 'Goodbye!'
                        })
                        .run();
                });
            });

            describe("upon training code entry", function() {
                it("should loop back if the training code is invalid - not a number", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , 'abc'  // state_training_code - not numeric only
                        )
                        .check.interaction({
                            state: 'state_training_code',
                            reply: "Sorry, the training session code you entered does not exist. " +
                                   "Please try again"
                        })
                        .run();
                });

                it("should loop back if the training code is invalid - no event", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '999'  // state_training_code - event doesn't exist
                        )
                        .check.interaction({
                            state: 'state_training_code',
                            reply: "Sorry, the training session code you entered does not exist. " +
                                   "Please try again"
                        })
                        .run();
                });

                it("should go to state_name if it is a new user", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                        )
                        .check.interaction({
                            state: 'state_name',
                            reply: "Please enter your full name"
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082111'
                            });
                            assert.equal(Object.keys(contact.extra).length, 3);
                            assert.equal(contact.extra.last_training_code, '111');
                            assert.equal(contact.extra.participant_id, '111');
                            assert.equal(contact.extra.lang, 'af');
                        })
                        .run();
                });

                it("should go to state_end if it is a fully registered user", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_returning_user - register attendance
                            , '222'  // state_training_code
                        )
                        .check.interaction({
                            state: 'state_end',
                            reply: "Thank you for registering your training session!"
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082222'
                            });
                            assert.equal(Object.keys(contact.extra).length, 10);
                            assert.equal(contact.extra.last_training_code, '222');
                            assert.equal(contact.extra.last_feedback_code, '2');
                            assert.equal(contact.extra.participant_id, '222');
                            assert.equal(contact.extra.full_name, 'Pete Pompey');
                            assert.equal(contact.extra.id_type, 'sa_id');
                            assert.equal(contact.extra.sa_id, '5101025009086');
                            assert.equal(contact.extra.dob, '1951-01-02');
                            assert.equal(contact.extra.gender, 'male');
                            assert.equal(contact.extra.lang, 'af');
                            assert.equal(contact.extra.details_completed, 'v1');
                        })
                        .check.reply.ends_session()
                        .run();
                });
            });

            describe("upon name entry", function() {
                it("should go to state_id_type", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                        )
                        .check.interaction({
                            state: 'state_id_type',
                            reply: [
                                "What kind of identification do you have?",
                                "1. SA ID",
                                "2. Passport",
                                "3. None"
                            ].join('\n')
                        })
                        .run();
                });
            });

            describe("upon id type entry", function() {
                it("should go to state_sa_id if SA ID chosen", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '1'  // state_id_type - sa_id
                        )
                        .check.interaction({
                            state: 'state_sa_id',
                            reply: 'Please enter your SA ID number:'
                        })
                        .run();
                });

                it("should go to state_passport_origin if passport chosen", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '2'  // state_id_type - passport
                        )
                        .check.interaction({
                            state: 'state_passport_origin',
                            reply: [
                                'What is the country of origin of the passport?',
                                '1. Zimbabwe',
                                '2. Mozambique',
                                '3. Malawi',
                                '4. Nigeria',
                                '5. DRC',
                                '6. Somalia',
                                '7. Other'
                            ].join('\n')
                        })
                        .run();
                });

                it("should go to state_birth_year if None chosen", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                        )
                        .check.interaction({
                            state: 'state_birth_year',
                            reply: 'Please enter the year that you were born (for example: 1981)'
                        })
                        .run();
                });
            });

            describe("upon id number entry", function() {
                it("should loop back if invalid id", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '1'  // state_id_type - sa_id
                            , '99999'  // state_sa_id
                        )
                        .check.interaction({
                            state: 'state_sa_id',
                            reply: 'Sorry, your ID number did not validate. ' +
                                   'Please re-enter your SA ID number:'
                        })
                        .run();
                });

                it("should go to state_end, save extras if id validates, update participant info",
                function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '1'  // state_id_type - sa_id
                            , '5002285000007'  // state_sa_id
                        )
                        .check.interaction({
                            state: 'state_end',
                            reply: "Thank you for registering your training session!"
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082111'
                            });
                            assert.equal(contact.extra.id_type, 'sa_id');
                            assert.equal(contact.extra.sa_id, '5002285000007');
                            assert.equal(contact.extra.dob, '1950-02-28');
                            assert.equal(contact.extra.gender, 'male');
                            assert.equal(contact.extra.details_completed, 'v1');
                        })
                        // participant info checked via fixture
                        .run();
                });
            });

            describe("upon state_passport_origin entry", function() {
                it("should go to state_passport_no", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '2'  // state_id_type - passport
                            , '4'  // state_passport_origin - Nigeria
                        )
                        .check.interaction({
                            state: 'state_passport_no',
                            reply: 'Please enter your Passport number:'
                        })
                        .run();
                });
            });

            describe("upon passport number entry", function() {
                it("should loop back if invalid passport no", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '2'  // state_id_type - passport
                            , '4'  // state_passport_origin - Nigeria
                            , '#1234'  // state_passport_no
                        )
                        .check.interaction({
                            state: 'state_passport_no',
                            reply: 'There was an error in your entry. Please ' +
                                   'carefully enter the passport number again.'
                        })
                        .run();
                });

                it("should go to state_birth_year, save passport extras", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '2'  // state_id_type - passport
                            , '4'  // state_passport_origin - Nigeria
                            , 'AB1234'  // state_passport_no
                        )
                        .check.interaction({
                            state: 'state_birth_year'
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082111'
                            });
                            assert.equal(contact.extra.id_type, 'passport');
                            assert.equal(contact.extra.passport_origin, 'ng');
                            assert.equal(contact.extra.passport_no, 'AB1234');
                        })
                        .run();
                });
            });

            describe("upon birth year entry", function() {
                it("should loop back if invalid year", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '2010'  // state_birth_year (too young)
                        )
                        .check.interaction({
                            state: 'state_birth_year',
                            reply: 'There was an error in your entry. Please carefully enter ' +
                                   'your year of birth again (for example: 2001)'
                        })
                        .run();
                });

                it("should go to state_birth_month", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                        )
                        .check.interaction({
                            state: 'state_birth_month',
                            reply: [
                                'Please enter the month that you were born',
                                '1. Jan',
                                '2. Feb',
                                '3. Mar',
                                '4. Apr',
                                '5. May',
                                '6. Jun',
                                '7. Jul',
                                '8. Aug',
                                '9. Sep',
                                '10. Oct',
                                '11. Nov',
                                '12. Dec'
                            ].join('\n')
                        })
                        .run();
                });
            });

            describe("upon birth month entry", function() {
                it("should go to state_birth_day", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                            , '7'  // state_birth_month - July
                        )
                        .check.interaction({
                            state: 'state_birth_day',
                            reply: 'Please enter the day that you were born (for example: 14).'
                        })
                        .run();
                });
            });

            describe("upon birth day entry", function() {
                it("should loop back if unrealistic day", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                            , '7'  // state_birth_month - July
                            , '32'  // state_birth_day
                        )
                        .check.interaction({
                            state: 'state_birth_day',
                            reply: 'There was an error in your entry. Please carefully ' +
                                   'enter your day of birth again (for example: 8)'
                        })
                        .run();
                });

                it("should go to state_invalid_dob if date doesn't exist", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                            , '2'  // state_birth_month - February
                            , '30'  // state_birth_day - 30th Feb doesn't exist
                        )
                        .check.interaction({
                            state: 'state_invalid_dob',
                            reply: [
                                'The date you entered (1995-02-30) is not a real date. ' +
                                'Please try again.',
                                "1. Continue"
                            ].join('\n')
                        })
                        .run();
                });

                it("should go to state_gender, save dob extra", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                            , '7'  // state_birth_month - July
                            , '18'  // state_birth_day
                        )
                        .check.interaction({
                            state: 'state_gender',
                            reply: [
                                "What is your gender?",
                                "1. Male",
                                "2. Female"
                            ].join('\n')
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082111'
                            });
                            assert.equal(contact.extra.id_type, 'none');
                            assert.equal(contact.extra.dob, '1995-07-18');
                        })
                        .run();
                });
            });

            describe("upon state_invalid_dob entry", function() {
                it("should go back to state_birth_year", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                            , '2'  // state_birth_month - February
                            , '30'  // state_birth_day - 30th Feb doesn't exist
                            , '1'
                        )
                        .check.interaction({
                            state: 'state_birth_year',
                        })
                        .run();
                });
            });

            describe("upon gender entry", function() {
                it("should go to state_end, save gender extra, update participant info",
                function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_language - afrikaans
                            , '111'  // state_training_code
                            , 'Jan Mopiso'  // state_name
                            , '3'  // state_id_type - none
                            , '1995'  // state_birth_year
                            , '7'  // state_birth_month - July
                            , '18'  // state_birth_day
                            , '1'  // state_end - male
                        )
                        .check.interaction({
                            state: 'state_end'
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082111'
                            });
                            assert.equal(contact.extra.gender, 'male');
                            assert.equal(contact.extra.details_completed, 'v1');
                        })
                        // participant info checked via fixture
                        .run();
                });
            });

        });

    });
});
