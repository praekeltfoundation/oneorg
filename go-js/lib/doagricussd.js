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
// * <countrycode>.ussd.sessions
// * <countrycode>.ussd.unique_users
// * <countrycode>.ussd.session_new_in.<state-name>
// * <countrycode>.ussd.session_closed_in.<state-name>
// * <countrycode>.ussd.possible_timeout_in.<state-name>
// * <countrycode>.ussd.state_entered.<state-name>
// * <countrycode>.ussd.state_exited.<state-name>
// * <countrycode>.ussd.supporter
// * <countrycode>.ussd.request.ringback
// * <countrycode>.ussd.request.mp3

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

    StateCreator.call(self, 'main_menu');

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
        var p = self.incr_metric(event.im, event.im.config.metric_prefix + 'sessions');
        p.add_callback(function () {
            return event.im.metrics.fire_inc(event.im.config.metric_prefix + 'session_new_in.' +
                                             event.im.current_state.name);
        });
        p.add_callback(function () {
            return self.inc_user_item(event.im.user, 'ussd_sessions');
        });
        return p;
    };

    self.on_session_close = function(event) {
        var p = event.im.metrics.fire_inc(event.im.config.metric_prefix + 'session_closed_in.' +
                                          event.im.current_state.name);
        if (event.data.possible_timeout) {
            p.add_callback(function () {
                return event.im.metrics.fire_inc(event.im.config.metric_prefix + 'possible_timeout_in.' +
                                                 event.im.current_state.name);
            });
            var timeouts = self.inc_user_item(event.im.user,
                                              'possible_timeouts');
        }
        return p;
    };

    self.on_new_user = function(event) {
        return self.incr_metric(event.im, event.im.config.metric_prefix + 'unique_users');
    };

    self.on_state_enter = function(event) {
        return event.im.metrics.fire_inc(event.im.config.metric_prefix + 'state_entered.' + event.data.state.name);
    };

    self.on_state_exit = function(event) {
        return event.im.metrics.fire_inc(event.im.config.metric_prefix + 'state_exited.' + event.data.state.name);
    };

    // SMS 

    self.send_sms = function(im, content) {
        var sms_tag = im.config.sms_tag;
        if (!sms_tag) return success(true);
        var p = new Promise();
        im.api.request("outbound.send_to_tag", {
            to_addr: im.user_addr,
            content: content,
            tagpool: sms_tag[0],
            tag: sms_tag[1]
        }, function(reply) {
            p.callback(reply.success);
        });
        return p;
    };

    // Contact stuff

    self.get_contact = function(im){
         var p = im.api_request('contacts.get_or_create', {
            delivery_class: 'ussd',
            addr: im.user_addr
        });
        return p;
    };

    self.build_survey_results = function(im){
        var farmer = im.get_user_answer('survey_start');
        var results;
        if (farmer == 'survey_isfarmer_2'){
            results = {
                "farmer": "1",
                "budget_think": im.get_user_answer('survey_isfarmer_2'),
                "budget_should": im.get_user_answer('survey_isfarmer_3'),
                "agri_means": im.get_user_answer('survey_isfarmer_4'),
                "sex": im.get_user_answer('survey_isfarmer_5'),
                "age": im.get_user_answer('survey_isfarmer_6')
            };
        } else {
            results = {
                "farmer": "0",
                "budget_think": im.get_user_answer('survey_notfarmer_2'),
                "budget_should": im.get_user_answer('survey_notfarmer_3'),
                "agri_means": im.get_user_answer('survey_notfarmer_4'),
                "sex": im.get_user_answer('survey_notfarmer_5'),
                "age": im.get_user_answer('survey_notfarmer_6')
            };
        }
        return results;
    };

    self.save_survey_results = function(im, answer_state, extra_key){
        var p_c = self.get_contact(im);
        p_c.add_callback(function(result) {
            var contact = result.contact;
            var p_extra = im.api_request('contacts.update_extras', {
                    key: contact.key,
                    fields: {
                        extra_key: im.get_user_answer(answer_state)
                    }
                });
            p_extra.add_callback(function(result){
                if (result.success === true) {
                    return true;
                } else {
                    return im.log(result);
                }
            });
            return p_extra;
        });
        return p_c;
    };

    // States

    self.add_creator("main_menu", function(state_name, im) {
        _ = im.i18n;
        return new ChoiceState(
            state_name,
            function(choice) {
                return choice.value;
            },
            _.gettext("Output: main menu intro"),
            [
                new Choice('support_menu', _.gettext("Output - option - add your voice")),
                new Choice('survey_start', _.gettext("Output - option - survey")),
                new Choice('about', _.gettext("Output - option - about"))
            ]
        );
    });


    self.add_creator("support_menu", function(state_name, im) {
        _ = im.i18n;
        return new ChoiceState(
            state_name,
            function(choice) {
                return choice.value;
            },
            _.gettext("Output: support menu intro"),
            [
                new Choice('ringback', _.gettext("Output - option - ringback")),
                new Choice('mp3', _.gettext("Output - option - MP3")),
                new Choice('survey_start', _.gettext("Output - option - survey")),
                new Choice('main_menu', _.gettext("Output - option - main menu")),
            ],
            null,
            {
                on_enter: function() {
                    return self.incr_metric(im, im.config.metric_prefix + "supporter");
                }
            }
        );
    });

    self.add_state(new EndState(
        'ringback',
        _.gettext("Output: Ringback thank you"),
        'start',
        {
            on_enter: function() {
                var p = new Promise();
                p.add_callback(function(){ return self.send_sms(im, _.gettext("SMS Output: Ringback link"));});
                p.add_callback(function(){ return self.incr_metric(im, im.config.metric_prefix + "request.ringback");});
                p.callback();
                return p;
            }
        }

    ));

    self.add_state(new EndState(
        'mp3',
        _.gettext("Output: MP3 thank you"),
        'start',
        {
            on_enter: function() {
                var p = new Promise();
                p.add_callback(function(){ return self.send_sms(im, _.gettext("SMS Output: MP3 link"));});
                p.add_callback(function(){ return self.incr_metric(im, im.config.metric_prefix + "request.mp3");});
                p.callback();
                return p;
            }
        }

    ));

    self.add_state(new EndState(
        'about',
        _.gettext("Output: About one.org"),
        'start'
    ));

    self.add_state(new ChoiceState(
        'survey_start',
        'survey_2',
        _.gettext("Output: survey Q1"),
        [
            new Choice('1', _.gettext("survey Q1A1")),
            new Choice('0', _.gettext("survey Q1A2")),
        ],
        null,
        {
            on_exit: function() {
                return self.save_survey_results(im, "survey_start", "farmer");
            }
        }
    ));

    self.add_state(new ChoiceState(
        'survey_2',
        'survey_3',
        _.gettext("Output: survey Q2"),
        [
            new Choice('1', _.gettext("survey Q2A1")),
            new Choice('0', _.gettext("survey Q2A2")),
        ],
        null,
        {
            on_exit: function() {
                return self.save_survey_results(im, "survey_2", "budget_enough");
            }
        }
    ));

    self.add_state(new ChoiceState(
        'survey_3',
        'survey_4',
        _.gettext("Output: survey Q3"),
        [
            new Choice('1-5', _.gettext("survey Q3A1")),
            new Choice('5-10', _.gettext("survey Q3A2")),
            new Choice('10-20', _.gettext("survey Q3A3")),
            new Choice('20+', _.gettext("survey Q3A4")),
        ],
        null,
        {
            on_exit: function() {
                return self.save_survey_results(im, "survey_3", "budget_think");
            }
        }
    ));

    self.add_state(new ChoiceState(
        'survey_4',
        'survey_5',
        _.gettext("Output: survey Q4"),
        [
            new Choice('1-5', _.gettext("survey Q4A1")),
            new Choice('5-10', _.gettext("survey Q4A2")),
            new Choice('10-20', _.gettext("survey Q4A3")),
            new Choice('20+', _.gettext("survey Q4A4")),
        ],
        null,
        {
            on_exit: function() {
                return self.save_survey_results(im, "survey_4", "budget_should");
            }
        }
    ));

    self.add_state(new ChoiceState(
        'survey_5',
        'survey_6',
        _.gettext("Output: survey Q5"),
        [
            new Choice('male', _.gettext("survey Q5A1")),
            new Choice('female', _.gettext("survey Q5A2")),
        ],
        null,
        {
            on_exit: function() {
                return self.save_survey_results(im, "survey_5", "sex");
            }
        }
    ));

    self.add_state(new ChoiceState(
        'survey_6',
        'survey_end',
        _.gettext("Output: survey Q6"),
        [
            new Choice('0-15', _.gettext("survey Q6A1")),
            new Choice('16-20', _.gettext("survey Q6A2")),
            new Choice('21-30', _.gettext("survey Q6A3")),
            new Choice('31-40', _.gettext("survey Q6A4")),
            new Choice('41-50', _.gettext("survey Q6A5")),
            new Choice('51+', _.gettext("survey Q6A6")),
        ],
        null,
        {
            on_exit: function() {
                return self.save_survey_results(im, "survey_6", "age");
            }
        }
    ));

    self.add_state(new EndState(
        'survey_end',
        _.gettext("Output: survey end"),
        'start'
    ));

}

// launch app
var states = new DoAgricUSSD();
var im = new InteractionMachine(api, states);
im.attach();
