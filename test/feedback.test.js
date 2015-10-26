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
                    name: 'emergingleaders_feedback',
                    channel: '*120*8864*0002#',
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

            describe("upon answering q1", function() {
                it("should go to q2", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                        )
                        .check.interaction({
                            state: 'state_q2',
                            reply: "How many people have you shared the training with?"
                        })
                        .run();
                });
            });

            describe("upon answering q2", function() {
                it("should go to q3 if the number is valid", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                            , '44'  // state_q2
                        )
                        .check.interaction({
                            state: 'state_q3',
                            reply: [
                                "Favourite mindset?",
                                "1. Lift up head",
                                "2. See self as leader",
                                "3. Proactive",
                                "4. See & take responsibility",
                                "5. Change something",
                                "6. Focus",
                                "7. Appreciative thinking"
                            ].join("\n")
                        })
                        .run();
                });

                it("should loop back if the number is invalid", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                            , 'blah'  // state_q2
                        )
                        .check.interaction({
                            state: 'state_q2',
                            reply: "Sorry, that is not a valid number. Please enter the number " +
                                   "of people you've shared the training with:"
                        })
                        .run();
                });
            });

            describe("upon answering q3", function() {
                it("should go to q4", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                            , '44'  // state_q2
                            , '3'  // state_q3 - proactive
                        )
                        .check.interaction({
                            state: 'state_q4',
                            reply: [
                                "What project have you decided to start when you leave the training?",
                                "1. Community project",
                                "2. Income generating project",
                                "3. Both income & community",
                                "4. None",
                            ].join("\n")
                        })
                        .run();
                });
            });

            describe("upon answering q4", function() {
                it("should go to q5", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                            , '44'  // state_q2
                            , '3'  // state_q3 - proactive
                            , '1'  // state_q4 - community project
                        )
                        .check.interaction({
                            state: 'state_q5',
                            reply: [
                                "How long did you travel to get to the training?",
                                "1. Less than 30 min",
                                "2. 30 min - 1 hour",
                                "3. 1 hour - 2 hours",
                                "4. More than 2 hours",
                            ].join("\n")
                        })
                        .run();
                });
            });

            describe("upon answering q5", function() {
                it("should thank them, update extras, and exit", function() {
                    return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                            , '44'  // state_q2
                            , '3'  // state_q3 - proactive
                            , '1'  // state_q4 - community project
                            , '2'  // state_q5 - 30 min - 1 hour
                        )
                        .check.interaction({
                            state: 'state_end',
                            reply: "Thank you for your feedback!"
                        })
                        .check(function(api) {
                            var contact = _.find(api.contacts.store, {
                              msisdn: '+082222'
                            });
                            assert.equal(contact.extra.last_feedback_code, 2);
                        })
                        .check.reply.ends_session()
                        .run();
                });

                it("should send an sms", function() {
                   return tester
                        .setup.user.addr('082222')
                        .inputs(
                            {session_event: 'new'}  // dial in
                            , '1'  // state_q1 - great_change
                            , '44'  // state_q2
                            , '3'  // state_q3 - proactive
                            , '1'  // state_q4 - community project
                            , '2'  // state_q5 - 30 min - 1 hour
                        )
                        .check(function(api) {
                            var smses = _.where(api.outbound.store, {
                                endpoint: 'sms'
                            });
                            var sms = smses[0];
                            assert.equal(smses.length,1);
                            assert.equal(sms.content,
                                "Testify! by sending an sms reply with your success story " +
                                "to this number."
                            );
                            assert.equal(sms.to_addr,'+082222');
                        })
                        .run();
                    });
            });


        });

    });
});
