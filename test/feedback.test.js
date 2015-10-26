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
                            last_feedback_code: "1"
                        },
                        key: "contact_key_082222",
                        user_account: "contact_user_account"
                    });
                })
                .setup(function(api) {
                    // returning user all details completed
                    api.contacts.add({
                        msisdn: '+082333',
                        extra: {
                            lang: "af",
                            full_name: "Dude Perfect",
                            id_type: 'sa_id',
                            sa_id: '5101025009086',
                            dob: '1951-01-02',
                            gender: 'male',
                            details_completed: "v1",
                            participant_id: "333",
                            last_training_code: "2",
                            last_feedback_code: "2"
                        },
                        key: "contact_key_082333",
                        user_account: "contact_user_account"
                    });
                })
            ;
        });


        // TEST FEEDBACK

        describe("Feedback testing", function() {

            describe("starting session", function() {
                it("should fire metrics", function() {
                    return tester
                        .setup.user.addr('082222')
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

                it("should ask q1 if contact has training code, hasn't completed feedback " +
                   "for that code", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.interaction({
                            state: 'state_q1',
                            reply: [
                                "How much do you feel the training will change your life?",
                                "1. Great change",
                                "2. Medium change",
                                "3. Little change",
                                "4. No change"
                            ].join('\n')
                        })
                        .check.user.properties({lang: 'af'})
                        .run();
                });

                it("should show them away if they don't have a training code saved", function() {
                    return tester
                        .setup.user.addr('082111')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.interaction({
                            state: 'state_not_registered',
                            reply: "You have reached Emerging Leaders Feedback, but you don't " +
                                   "have a valid training code stored. Please contact your " +
                                   "trainer for help."
                        })
                        .run();
                });

                it("should show them away if they've already provided feedback", function() {
                    return tester
                        .setup.user.addr('082333')
                        .inputs(
                            {session_event: 'new'}  // dial in
                        )
                        .check.interaction({
                            state: 'state_feedback_given',
                            reply: "You have already provided feedback for your last training " +
                                   "session. Thank you!"
                        })
                        .run();
                });
            });


        });

    });
});
