go.app = function() {
    var vumigo = require('vumigo_v02');
    var MetricsHelper = require('go-jsbox-metrics-helper');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var EndState = vumigo.states.EndState;
    var FreeText = vumigo.states.FreeText;


    var GoApp = App.extend(function(self) {
        App.call(self, 'state_start');
        var $ = self.$;

        self.init = function() {

            // Use the metrics helper to add some metrics
            mh = new MetricsHelper(self.im);
            mh
                // Total unique users
                .add.total_unique_users('total.ussd.unique_users')
                // Total sessions
                .add.total_sessions('total.ussd.sessions')
            ;

            // Load self.contact
            return self.im.contacts
                .for_user()
                .then(function(user_contact) {
                   self.contact = user_contact;
                });
        };


    // ROUTING STATES

        self.states.add('state_start', function(name) {
            var tr_code = self.contact.extra.last_training_code;
            if (tr_code === undefined) {
                return self.states.create('state_not_registered');
            } else if (tr_code === self.contact.extra.last_feedback_code) {
                return self.states.create('state_feedback_given');
            } else {
                return go.utils
                    .set_language(self.im, self.contact)
                    .then(function() {
                        return self.states.create('state_q1');
                    });
            }

        });


    // QUESTION STATES

        self.states.add('state_q1', function(name) {
            var q_id = 1;
            var q_text_en = "How much do you feel the training will change your life?";
            return new ChoiceState(name, {
                question: $(q_text_en),
                choices: [
                    new Choice('great_change', $("Great change")),
                    new Choice('medium_change', $("Medium change")),
                    new Choice('little_change', $("Little change")),
                    new Choice('no_change', $("No change")),
                ],
                next: function(choice) {
                    return go.utils
                        .post_feedback(self.im, q_id, q_text_en, choice.label, choice.value)
                        .then(function() {
                            return 'state_q2';
                        });
                }
            });
        });

        self.states.add('state_q2', function(name) {
            var q_id = 2;
            var q_text_en = "How many people have you shared the training with?";
            var error_text_en = "Sorry, that is not a valid number. Please enter the number " +
                                "of people you've shared the training with:";
            return new FreeText(name, {
                question: $(q_text_en),
                check: function(content) {
                    if (!go.utils.check_valid_number(content)) {
                        return $(error_text_en);
                    }
                },
                next: function(choice) {
                    return go.utils
                        .post_feedback(self.im, q_id, q_text_en, choice.label, choice.value)
                        .then(function() {
                            return 'state_q3';
                        });
                }
            });
        });

        self.states.add('state_q3', function(name) {
            var q_id = 3;
            var q_text_en = "Favourite mindset?";
            return new ChoiceState(name, {
                question: $(q_text_en),
                choices: [
                    new Choice('lift_head', $("Lift up head")),
                    new Choice('see_self_leader', $("See self as leader")),
                    new Choice('proactive', $("Proactive")),
                    new Choice('take_responsibility', $("See & take responsibility")),
                    new Choice('change_something', $("Change something")),
                    new Choice('focus', $("Focus")),
                    new Choice('appreciative_thinking', $("Appreciative thinking"))
                ],
                next: function(choice) {
                    return go.utils
                        .post_feedback(self.im, q_id, q_text_en, choice.label, choice.value)
                        .then(function() {
                            return 'state_q4';
                        });
                }
            });
        });


    // END STATES

        self.states.add('state_not_registered', function(name) {
            return new EndState(name, {
                text: $("You have reached Emerging Leaders Feedback, but you don't " +
                        "have a valid training code stored. Please contact your " +
                        "trainer for help."),
                next: 'state_start'
            });
        });

        self.states.add('state_feedback_given', function(name) {
            return new EndState(name, {
                text: $("You have already provided feedback for your last training " +
                        "session. Thank you!"),
                next: 'state_start'
            });
        });

        self.states.add('state_end', function(name) {
            return new EndState(name, {
                text: $("Thank you for your feedback!"),
                next: 'state_start'
            });
        });

    });

    return {
        GoApp: GoApp
    };
}();
