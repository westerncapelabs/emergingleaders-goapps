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
                    name: 'smsinbound',
                    testing_today: '2015-04-03 06:07:08.999',
                    metric_store: 'emergingleaders_test',  // _env at the end
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
                        d.repeatable = true;
                        api.http.fixtures.add(d);
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
                        assert.equal(contact.extra.optout_last_attempt, '2015-04-03 06:07:08.999');
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
                        assert.equal(contact.extra.optout_last_attempt, '2015-04-03 06:07:08.999');
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
                        assert.equal(contact.extra.optin_last_attempt, '2015-04-03 06:07:08.999');
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
            it("should tell them how to opt out", function() {
                return tester
                    .setup.user.addr('064991')
                    .inputs('lhr')
                    // check navigation
                    .check.interaction({
                        state: 'state_unrecognised',
                        reply:
                            'We do not recognise the message you sent us. Reply STOP to unsubscribe or START to opt in.'
                    })
                    // check extras
                    .check(function(api) {
                        var contact = _.find(api.contacts.store, {
                                msisdn: '+064991'
                            });
                        assert.equal(contact.extra.optout_last_attempt, undefined);
                        assert.equal(contact.extra.optin_last_attempt, undefined);
                    })
                    // check metrics
                    .check(function(api) {
                        var metrics = api.metrics.stores.emergingleaders_test;
                        assert.equal(Object.keys(metrics).length, 4);
                        assert.deepEqual(metrics['total.sms.unique_users'].values, [1]);
                        assert.deepEqual(metrics['total.sms.unique_users.transient'].values, [1]);
                        assert.deepEqual(metrics['total.unrecognised_sms'].values, [1]);
                        assert.deepEqual(metrics['total.unrecognised_sms.transient'].values, [1]);
                    })
                    .check(function(api) {
                        var optout_store = api.resources.resources.optout.optout_store;
                        assert.deepEqual(optout_store.length, 1);
                    })
                    .run();
            });
        });

    });
});
