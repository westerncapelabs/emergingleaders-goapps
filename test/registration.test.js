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
                    // returning user
                    api.contacts.add({
                        msisdn: '+082222',
                        extra: {
                            lang: "af"
                        },
                        key: "contact_key_082222",
                        user_account: "contact_user_account"
                    });
                })
            ;
        });


        // TEST REGISTRATION

        describe("Registration testing", function() {

            describe("starting session", function() {
                it("should ask for their language if they are a new user",
                function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.interaction({
                            state: 'state_language',
                            reply: [
                                "Choose your preferred language:",
                                "1. English",
                                "2. Zulu",
                                "3. Xhosa",
                                "4. Afrikaans"
                            ].join('\n')
                        })
                        .run();
                });

                it("should set their language, ask for training code if they are a " +
                   "returning user", function() {
                    return tester
                        .setup.user.addr('082222')
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
                            , '4'  // state_language - afrikaans
                        )
                        .check.user.properties({lang: 'af'})
                        .check.interaction({
                            state: 'state_training_code',
                            reply: "What is your training session code?"
                        })
                        .run();
                });
            });

            describe("upon training code entry", function() {
                it("should go to state_end", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '4'  // state_language - afrikaans
                            , '1'  // state_training_code
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
