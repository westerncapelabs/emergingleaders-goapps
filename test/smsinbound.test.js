var vumigo = require('vumigo_v02');
var fixtures = require('./fixtures');
var AppTester = vumigo.AppTester;
var assert = require('assert');
var optoutstore = require('./optoutstore');
var DummyOptoutResource = optoutstore.DummyOptoutResource;
var _ = require('lodash');

describe("emergingleaders app", function() {
    describe("for sms use", function() {
        var app;
        var tester;

        beforeEach(function() {
            app = new go.app.GoApp();

            tester = new AppTester(app);

            tester
                .setup.char_limit(160)
                .setup.config.app({
                    name: 'emergingleaders_smsinbound',
                    testing_today: '2015-03-03T15:08:08.000',
                    metric_store: 'emergingleaders_test',  // _env at the end
                    el_api: {
                        username: "test_api_user",
                        api_key: "test_api_key",
                        base_url: "http://127.0.0.1:8000/api/v1/"
                    },
                    sms_story_msg: "Thanks for providing feedback on your training. If " +
                                   "you have a story about how it's changed your life " +
                                   "in some way please reply to this SMS to tell us!",
                })
                .setup(function(api) {
                    api.resources.add(new DummyOptoutResource());
                    api.resources.attach(api);
                })
                .setup(function(api) {
                    api.metrics.stores = {'emergingleaders_test': {}};
                })
                .setup(function(api) {
                    fixtures().forEach(function(d) {
                        api.http.fixtures.add(d);
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
                    api.contacts.add({
                        msisdn: '+064991',
                        key: "contact_key",
                        user_account: "contact_user_account"
                    });
                })
                .setup(function(api) {
                    // opted out contact
                    api.contacts.add({
                        msisdn: '+064999',
                        extra: {
                            optout_last_attempt: '2015-01-01 01:01:01.111'
                        },
                        key: "contact_key",
                        user_account: "contact_user_account"
                    });
                });
        });


        describe("when the user sends a STOP message", function() {
            it("should opt them out", function() {
                // opt-out functionality is also being tested via fixture 01
                return tester
                    .setup.user.addr('064991')
                    .inputs('"stop" in the name of love')
                    // check navigation
                    .check.interaction({
                        state: 'state_opt_out',
                        reply:
                            'Thank you. You will no longer receive messages from us. Reply START to opt back in.'
                    })
                    // check extras
                    .check(function(api) {
                        var contact = _.find(api.contacts.store, {
                                msisdn: '+064991'
                            });
                        assert.equal(contact.extra.optout_last_attempt, '2015-03-03 03:08:08.000');
                        assert.equal(contact.extra.optin_last_attempt, undefined);
                    })
                    // check metrics
                    .check(function(api) {
                        var metrics = api.metrics.stores.emergingleaders_test;
                        assert.equal(Object.keys(metrics).length, 4);
                        assert.deepEqual(metrics['total.sms.unique_users'].values, [1]);
                        assert.deepEqual(metrics['total.sms.unique_users.transient'].values, [1]);
                        assert.deepEqual(metrics['total.optouts'].values, [1]);
                        assert.deepEqual(metrics['total.optouts.transient'].values, [1]);
                    })
                    // check optout_store
                    .check(function(api) {
                        var optout_store = api.resources.resources.optout.optout_store;
                        assert.deepEqual(optout_store.length, 2);
                    })
                    .run();
            });
        });

        describe("when the user sends a BLOCK message", function() {
            it("should opt them out", function() {
                // opt-out functionality is also being tested via fixture 01
                return tester
                    .setup.user.addr('064991')
                    .inputs('BLOCK')
                    // check navigation
                    .check.interaction({
                        state: 'state_opt_out',
                        reply:
                            'Thank you. You will no longer receive messages from us. Reply START to opt back in.'
                    })
                    // check extras
                    .check(function(api) {
                        var contact = _.find(api.contacts.store, {
                                msisdn: '+064991'
                            });
                        assert.equal(contact.extra.optout_last_attempt, '2015-03-03 03:08:08.000');
                        assert.equal(contact.extra.optin_last_attempt, undefined);
                    })
                    // check metrics
                    .check(function(api) {
                        var metrics = api.metrics.stores.emergingleaders_test;
                        assert.equal(Object.keys(metrics).length, 4);
                        assert.deepEqual(metrics['total.sms.unique_users'].values, [1]);
                        assert.deepEqual(metrics['total.sms.unique_users.transient'].values, [1]);
                        assert.deepEqual(metrics['total.optouts'].values, [1]);
                        assert.deepEqual(metrics['total.optouts.transient'].values, [1]);
                    })
                    // check optout_store
                    .check(function(api) {
                        var optout_store = api.resources.resources.optout.optout_store;
                        assert.deepEqual(optout_store.length, 2);
                    })
                    .run();
            });
        });

        describe("when the user sends a START message", function() {
            it("should opt them in", function() {
                // opt-in functionality is also being tested via fixtures
                return tester
                    .setup.user.addr('064999')
                    .inputs('start')
                    // check navigation
                    .check.interaction({
                        state: 'state_opt_in',
                        reply:
                            'Thank you. You will now receive messages from us again. Reply STOP to unsubscribe.'
                    })
                    // check extras
                    .check(function(api) {
                        var contact = _.find(api.contacts.store, {
                                msisdn: '+064999'
                            });
                        assert.equal(contact.extra.optout_last_attempt, '2015-01-01 01:01:01.111');
                        assert.equal(contact.extra.optin_last_attempt, '2015-03-03 03:08:08.000');
                    })
                    // check metrics
                    .check(function(api) {
                        var metrics = api.metrics.stores.emergingleaders_test;
                        assert.equal(Object.keys(metrics).length, 4);
                        assert.deepEqual(metrics['total.sms.unique_users'].values, [1]);
                        assert.deepEqual(metrics['total.sms.unique_users.transient'].values, [1]);
                        assert.deepEqual(metrics['total.optins'].values, [1]);
                        assert.deepEqual(metrics['total.optins.transient'].values, [1]);
                    })
                    // check optout_store
                    .check(function(api) {
                        var optout_store = api.resources.resources.optout.optout_store;
                        assert.deepEqual(optout_store.length, 0);
                    })
                    .run();
            });
        });

        describe("when the user sends a different message", function() {
            it("should save their feedback as a story", function() {
                return tester
                    .setup.user.addr('082222')
                    .inputs('I made everybody in my community rich!')
                    // check navigation
                    .check.interaction({
                        state: 'state_feedback_story',
                        reply:
                            "Thank you for sharing your story! You can send in more stories by " +
                            "replying to this sms."
                    })
                    // check metrics
                    .check(function(api) {
                        var metrics = api.metrics.stores.emergingleaders_test;
                        assert.equal(Object.keys(metrics).length, 4);
                        assert.deepEqual(metrics['total.sms.unique_users'].values, [1]);
                        assert.deepEqual(metrics['total.sms.unique_users.transient'].values, [1]);
                        assert.deepEqual(metrics['total.feedback_stories'].values, [1]);
                        assert.deepEqual(metrics['total.feedback_stories.transient'].values, [1]);
                    })
                    // check they didn't get opted out
                    .check(function(api) {
                        var optout_store = api.resources.resources.optout.optout_store;
                        assert.deepEqual(optout_store.length, 1);
                    })
                    .run();
            });
        });

    });
});
