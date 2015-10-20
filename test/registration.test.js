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
                    registration_api: {
                        username: "test_user",
                        api_key: "test_key",
                        url: "http://127.0.0.1:8000/registration/"
                    },
                    endpoints: {
                        "sms": {"delivery_class": "sms"}
                    },
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
                            details_completed: "v1"
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

                it("should tell them there's no hope if they ask for help", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '3'  // state_returning_user - help
                        )
                        .check.interaction({
                            state: 'state_help',
                            reply: "Sorry, it's a lost cause."
                        })
                        .run();
                });
            });

            describe("upon training code entry", function() {
                it("should go to state_end if it is a new user", function() {
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
                        .check.reply.ends_session()
                        .run();
                });
            });

        });

    });
});
