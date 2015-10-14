go.app = function() {
    var vumigo = require('vumigo_v02');
    var MetricsHelper = require('go-jsbox-metrics-helper');
    var App = vumigo.App;
    var Choice = vumigo.states.Choice;
    var ChoiceState = vumigo.states.ChoiceState;
    var FreeText = vumigo.states.FreeText;
    var EndState = vumigo.states.EndState;


    var GoApp = App.extend(function(self) {
        App.call(self, 'state_start');
        var $ = self.$;
        var interrupt = true;

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


    // TIMEOUT STATES

        // override normal state adding
        self.add = function(name, creator) {
            self.states.add(name, function(name, opts) {
                if (!interrupt || !go.utils.timed_out(self.im))
                    return creator(name, opts);

                interrupt = false;
                opts = opts || {};
                opts.name = name;
                return self.states.create('state_timed_out', opts);
            });
        };

        self.states.add('state_timed_out', function(name, creator_opts) {
            return new ChoiceState(name, {
                question: $("Welcome back! Please select:"),
                choices: [
                    new Choice('continue', $("Return to where I left off")),
                    new Choice('reset', $("Start over")),
                ],

                next: function(choice) {
                    if (choice.value === 'continue') {
                        return {
                            name: creator_opts.name,
                            creator_opts: creator_opts
                        };
                    } else if (choice.value === 'reset') {
                        return 'state_start';
                    }
                }
            });
        });


    // ROUTING STATES

        self.add('state_start', function(name) {
            return go.utils
                .set_language(self.im, self.contact)
                .then(function() {
                    return self.states.create('state_language');
                });
        });


    // CONTENT STATES

        self.add('state_language', function(name) {
            return new ChoiceState(name, {
                question: $("Choose your preferred language:"),
                choices: [
                    new Choice('en', $("English")),
                    new Choice('zu', $("Zulu")),
                    new Choice('xh', $("Xhosa")),
                    new Choice('af', $("Afrikaans")),
                ],
                next: function(choice) {
                    return go.utils
                        .save_language(self.im, self.contact, choice.value)
                        .then(function() {
                            return 'state_name';
                        });
                }
            });
        });

        self.add('state_name', function(name) {
            return new FreeText(name, {
                question: "What is your full name?",
                next: function(choice) {
                    return 'state_end';
                }
            });
        });

        self.add('state_end', function(name) {
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
