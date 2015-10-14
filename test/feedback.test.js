var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures');
var assert = require('assert');
var _ = require('lodash');
var AppTester = vumigo.AppTester;


describe("emergingleaders app", function() {
    describe("for ussd training session feedback use", function() {
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
                    feedback_api: {
                        username: "test_user",
                        api_key: "test_key",
                        url: "http://127.0.0.1:8000/feedback/"
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
            ;
        });


        // TEST TIMEOUT REDIALING

        describe("Timeout redial testing", function() {
            describe("should not show timeout question for:", function() {
                it("state_end", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in first time
                            , '1'  // state_language - english
                            , 'John'  // state_name
                            , {session_event: 'close'}  // state_end timeout
                            , {session_event: 'new'}  // state_end redial
                        )
                        .check.interaction({
                            state: 'state_language'  // loops back to beginning
                        })
                        .run();
                });
            });

            describe("if the user was busy with feedback and redials", function() {
                it("should display timeout continuation page", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , {session_event: 'close'}  // state_language timeout
                            , {session_event: 'new'}  // state_language redial
                        )
                        .check.interaction({
                            state: 'state_timed_out',
                            reply: [
                                "Welcome back! Please select:",
                                "1. Return to where I left off",
                                "2. Start over",
                            ].join('\n')
                        })
                        .run();
                });

                describe("if they choose to continue", function() {
                    it("should go back to state they timed out", function() {
                        return tester
                            .setup.user.addr('082111')
                            .inputs(
                                {session_event: 'new'}  // dial in
                                , '1'  // state_language english
                                , {session_event: 'close'}  // state_language timeout
                                , {session_event: 'new'}  // state_language redial
                                , '1'  // state_timed_out continue
                            )
                            // check navigation
                            .check.interaction({
                                state: 'state_name',
                                reply: "What is your full name?"
                            })
                            .run();
                    });
                });

                describe("if they choose to start over", function() {
                    it("should go back to state_language", function() {
                        return tester
                            .setup.user.addr('082111')
                            .inputs(
                                {session_event: 'new'}  // dial in
                                , '1' // state_language english
                                , {session_event: 'close'}  // state_language timeout
                                , {session_event: 'new'}  // state_language redial
                                , '2'  // state_timed_out start over
                            )
                            // check navigation
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
                });

            });
        });


        // TEST FEEDBACK

        describe("Feedback testing", function() {

            describe("starting session", function() {
                it("should ask for their language", function() {
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
                it("should ask for their name", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_language - english
                        )
                        .check.interaction({
                            state: 'state_name',
                            reply: "What is your full name?"
                        })
                        .run();
                });

                it("should set their language", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '4'  // state_language - afrikaans
                        )
                        .check.user.properties({lang: 'af'})
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                                msisdn: '+082111'
                            });
                            assert.equal(contact.extra.lang, 'af');
                        })
                        .run();
                });
            });

            describe("upon language selection", function() {
                it("should go to state_end", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_language - english
                            , 'John'  // state_name
                        )
                        .check.interaction({
                            state: 'state_end',
                            reply: "Thank you for your feedback!"
                        })
                        .check.reply.ends_session()
                        .run();
                });
            });

        });

    });
});
