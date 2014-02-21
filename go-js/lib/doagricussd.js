// Possible configuration items:
//
// * translation.<lang>:
//     Jed translation JSON for language (e.g. sw). Optional. If ommitted,
//     untranslated strings are used.
//
// * config:
//     * default_lang:
//         Default language. Default is 'en'.
//     * metric_store:
//         Name of the metric store to use. If omitted, metrics are sent
//         to the metric store named 'default'.
//
// Metrics produced:
//
// * ussd_sessions
// * unique_users
// * session_new_in.<state-name>
// * session_closed_in.<state-name>
// * possible_timeout_in.<state-name>
// * state_entered.<state-name>
// * state_exited.<state-name>

var vumigo = require("vumigo_v01");
var jed = require("jed");

if (api === undefined) {
  // testing hook (supplies api when it is not passed in by the real sandbox)
  var api = this.api = new vumigo.dummy_api.DummyApi();
}

var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var ChoiceState = vumigo.states.ChoiceState;
var PaginatedChoiceState = vumigo.states.PaginatedChoiceState;
var Choice = vumigo.states.Choice;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;
var HttpApi = vumigo.http_api.HttpApi;
var Promise = vumigo.promise.Promise;


function DoAgricUSSD() {
    var self = this;
    var _ = new jed({});

    StateCreator.call(self, 'start');

    // Session metrics helper

    self.incr_metric = function(im, metric) {
        var p = new Promise();
        p.add_callback(function (value) {
            im.metrics.fire_max(metric, value);
        });
        im.api.request(
            "kv.incr", {key: "metrics." + metric, amount: 1},
            function(reply) {
                if (reply.success) {
                    p.callback(reply.value);
                }
                else {
                    im.log("Failed to increment metric " + metric + ": " +
                           reply.reason);
                    p.callback(0);
                }
            });
        return p;
    };

    // Session handling

    self.get_user_item = function(user, item, default_value) {
        var custom = user.custom || {};
        var value = custom[item];
        return (typeof value != 'undefined') ? value : default_value;
    };

    self.set_user_item = function(user, item, value) {
        if (typeof user.custom == 'undefined') {
            user.custom = {};
        }
        user.custom[item] = value;
    };

    self.inc_user_item = function(user, item) {
        var value = self.get_user_item(user, item, 0) + 1;
        self.set_user_item(user, item, value);
        return value;
    };

    // IM event callbacks

    self.on_session_new = function(event) {
        var p = self.incr_metric(event.im, 'ussd_sessions');
        p.add_callback(function () {
            return event.im.metrics.fire_inc('session_new_in.' +
                                             event.im.current_state.name);
        });
        p.add_callback(function () {
            return self.inc_user_item(event.im.user, 'ussd_sessions');
        });
        return p;
    };

    self.on_session_close = function(event) {
        var p = event.im.metrics.fire_inc('session_closed_in.' +
                                          event.im.current_state.name);
        if (event.data.possible_timeout) {
            p.add_callback(function () {
                return event.im.metrics.fire_inc('possible_timeout_in.' +
                                                 event.im.current_state.name);
            });
            var timeouts = self.inc_user_item(event.im.user,
                                              'possible_timeouts');
        }
        return p;
    };

    self.on_new_user = function(event) {
        return self.incr_metric(event.im, 'unique_users');
    };

    self.on_state_enter = function(event) {
        return event.im.metrics.fire_inc('state_entered.' + event.data.state.name);
    };

    self.on_state_exit = function(event) {
        return event.im.metrics.fire_inc('state_exited.' + event.data.state.name);
    };


    self.add_creator("start", function(state_name, im) {
        _ = im.i18n;
        return new ChoiceState(
            state_name,
            function(choice) {
                return choice.value;
            },
            _.gettext("Output: Welcome text"),
            [
                new Choice('support', _.gettext("Output - option - support")),
                new Choice('quiz_start', _.gettext("Output - option - quiz")),
                new Choice('about', _.gettext("Output - option - about")),

            ]
        );
    });

    self.add_state(new EndState(
        'about',
        _.gettext("Output: About one.org"),
        'start'
    ));
}

// launch app
var states = new DoAgricUSSD();
var im = new InteractionMachine(api, states);
im.attach();
