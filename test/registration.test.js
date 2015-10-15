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
            ;
        });


        // TEST REGISTRATION

        describe("Registration testing", function() {

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
                            reply: "Thank you for registering your training session!"
                        })
                        .check.reply.ends_session()
                        .run();
                });
            });

        });

    });
});
