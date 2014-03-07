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

    self.save_survey_results = function(im, answer_state, extra_key){
        var p_c = self.get_contact(im);
        p_c.add_callback(function(result) {
            var contact = result.contact;
            var to_save = {};
            to_save[extra_key] = im.get_user_answer(answer_state);
            var p_extra = im.api_request('contacts.update_extras', {
                    key: contact.key,
                    fields: to_save
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
            _.gettext("Investing in agriculture can lift millions out of poverty." +
                    " Add your support & get a FREE track feat D'banj"),
            [
                new Choice('support_menu', _.gettext("I support!")),
                new Choice('survey_start', _.gettext("Take survey")),
                new Choice('about', _.gettext("About ONE"))
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
            _.gettext("Thank you very much for supporting smallholder farmers across Africa. Download your FREE track here:"),
            [
                new Choice('ringback', _.gettext("Ringback tone")),
                new Choice('mp3', _.gettext("MP3")),
                new Choice('survey_start', _.gettext("Take the survey")),
                new Choice('main_menu', _.gettext("Main Menu")),
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
        _.gettext("A download link has been sent to you via SMS. " +
                  "Thanks again for adding your voice & supporting smallholder farmers across Africa!"),
        'start',
        {
            on_enter: function() {
                var p = new Promise();
                p.add_callback(function(){
                    return self.send_sms(im, _.gettext(
                        "Find your sound file at XXXXXX. " +
                        "Thanks again for adding your voice & supporting smallholder farmers across Africa!"));
                });
                p.add_callback(function(){ return self.incr_metric(im, im.config.metric_prefix + "request.ringback");});
                p.callback();
                return p;
            }
        }

    ));

    self.add_state(new EndState(
        'mp3',
        _.gettext("A download link has been sent to you via SMS. " +
                  "Thanks again for adding your voice & supporting smallholder farmers across Africa!"),
        'start',
        {
            on_enter: function() {
                var p = new Promise();
                p.add_callback(function(){
                    return self.send_sms(im, _.gettext(
                        "Find your sound file at XXXXXX. " +
                        "Thanks again for adding your voice & supporting smallholder farmers across Africa!"));
                });
                p.add_callback(function(){ return self.incr_metric(im, im.config.metric_prefix + "request.mp3");});
                p.callback();
                return p;
            }
        }

    ));

    self.add_state(new ChoiceState(
        'about',
        function(choice) {
            return choice.value;
        },
        _.gettext("ONE is a campaigning and advocacy organization taking action to end " +
            "extreme poverty and preventable disease. Find out more at www.one.org"),
        [
           new Choice('main_menu', _.gettext("Main Menu"))
        ]
    ));

    self.add_state(new ChoiceState(
        'survey_start',
        'survey_2',
        _.gettext("Are you a farmer?"),
        [
            new Choice('1', _.gettext("Yes")),
            new Choice('0', _.gettext("No")),
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
        _.gettext("Do you think your government invests enough in agriculture?"),
        [
            new Choice('1', _.gettext("Yes")),
            new Choice('0', _.gettext("No")),
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
        _.gettext("How much of the national budget do you think your government spends on agriculture?"),
        [
            new Choice('1-5', _.gettext("1-5%")),
            new Choice('5-10', _.gettext("5-10%")),
            new Choice('10-20', _.gettext("10-20%")),
            new Choice('20+', _.gettext("More than 20%")),
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
        _.gettext("How much do you think your government should spend?"),
        [
            new Choice('1-5', _.gettext("1-5%")),
            new Choice('5-10', _.gettext("5-10%")),
            new Choice('10-20', _.gettext("10-20%")),
            new Choice('20+', _.gettext("More than 20%")),
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
        _.gettext("Are you male or female?"),
        [
            new Choice('male', _.gettext("Male")),
            new Choice('female', _.gettext("Female")),
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
        _.gettext("How old are you?"),
        [
            new Choice('0-15', _.gettext("0-15 years")),
            new Choice('16-20', _.gettext("16-20 years")),
            new Choice('21-30', _.gettext("21-30 years")),
            new Choice('31-40', _.gettext("31-40 years")),
            new Choice('41-50', _.gettext("41-50 years")),
            new Choice('51+', _.gettext("Older than 50 years")),
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
        _.gettext("Thanks for adding your voice & supporting African farmers. " +
            "Ask your friends & family to join you by dialing *120*646#. It's " +
            "time to Do Agric & transform lives!"),
        'start'
    ));

}

// launch app
var states = new DoAgricUSSD();
var im = new InteractionMachine(api, states);
im.attach();
