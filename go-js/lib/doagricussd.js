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
// * supporter
// * <countrycode>.supporter
// * <countrycode>.ussd.supporter
// * <countrycode>.ussd.sessions
// * <countrycode>.ussd.unique_users
// * <countrycode>.ussd.session_new_in.<state-name>
// * <countrycode>.ussd.session_closed_in.<state-name>
// * <countrycode>.ussd.possible_timeout_in.<state-name>
// * <countrycode>.ussd.state_entered.<state-name>
// * <countrycode>.ussd.state_exited.<state-name>
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

function DoAgricUSSDError(msg) {
     var self = this;
     self.msg = msg;
 
     self.toString = function() {
         return "<DoAgricUSSDError: " + self.msg + ">";
     };
 }

function DoAgricUSSD() {
    var self = this;
    var _ = new jed({});

    StateCreator.call(self, 'main_menu');

    // Session metrics helper

    self.incr_metric = function(im, metric) {
        var p = im.api_request('kv.incr', {
            key: 'metrics.' + metric,
            amount: 1
        });
        p.add_callback(function (result) {
            if(!result.success) {
                // fail very fast
                throw new DoAgricUSSDError(result.reason);
            }
            return result.value;
        });
        p.add_callback(function (value) {
            return im.metrics.fire_max(metric, value);
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
        p.add_callback(function (result) {
            if(!result.success) {
                // fail very fast
                throw new DoAgricUSSDError(result.reason);
            }
            return result.contact;
        });
        return p;
    };

    self.save_contact_extras = function(im, contact, fields) {
        var p = im.api_request('contacts.update_extras', {
            key: contact.key,
            fields: fields
        });
        p.add_callback(function (result) {
            if (!result.success) {
                // fail very fast
                throw new DoAgricUSSDError(result.reason);
            }
            return result.contact;
        });
    };

    self.save_survey_results = function(im, answer_state, extra_key){
        var p_c = self.get_contact(im);
        p_c.add_callback(function(contact) {
            var to_save = {};
            to_save[extra_key] = im.get_user_answer(answer_state);
            return self.save_contact_extras(im, contact, to_save);
        });
        return p_c;
    };

    self.save_audio_request = function(im, audio_type){
        var p_c = self.get_contact(im);
        p_c.add_callback(function(contact) {
            var to_save = {};
            to_save['download'] = audio_type;
            return self.save_contact_extras(im, contact, to_save);
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
                    " Add your support & get a FREE D'banj track"),
            [
                new Choice('support_menu', _.gettext("Say YES & get the track!"))
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
                new Choice('mp3', _.gettext("MP3"))
            ],
            null,
            {
                on_enter: function() {
                    var p = self.incr_metric(im, "supporter");
                    p.add_callback(function(result){
                        return self.incr_metric(im, im.config.country + ".supporter");
                    });
                    p.add_callback(function(result){
                        return self.incr_metric(im, im.config.metric_prefix + "supporter");
                    });
                    return p;
                }
            }
        );
    });

    self.add_state(new ChoiceState(
        'ringback',
        function(choice) {
            return choice.value;
        },
        _.gettext("ONE is a campaigning and advocacy organization taking action to end extreme poverty and preventable disease."),
        [
            new Choice('generic_end', _.gettext("Finish")),
        ],
        null,
        {
            on_enter: function() {
                var p = self.incr_metric(
                    im, im.config.metric_prefix + 'request.ringback');
                p.add_callback(function (result) {
                    return self.send_sms(im, _.gettext(
                        "Thank you for adding your voice and supporting smallholder " +
                        "farmers across Africa. Download our free ringtone here: ") +
                        im.config.download_ringback);
                });
                p.add_callback(function() {
                    return self.save_survey_results(im, "support_menu", "download");
                });
                return p;
            }
        }
    ));

    self.add_state(new ChoiceState(
        'mp3',
        function(choice) {
            return choice.value;
        },
        _.gettext("ONE is a campaigning and advocacy organization taking action to end extreme poverty and preventable disease."),
        [
            new Choice('generic_end', _.gettext("Finish")),
        ],
        null,
        {
            on_enter: function() {
                var p = self.incr_metric(
                    im, im.config.metric_prefix + 'request.mp3');
                p.add_callback(function (result) {
                    return self.send_sms(im, _.gettext(
                        "Thank you for adding your voice and supporting smallholder " +
                        "farmers across Africa. Download our song for free track here: ") +
                        im.config.download_mp3);
                });
                p.add_callback(function() {
                    return self.save_survey_results(im, "support_menu", "download");
                });
                return p;
            }
        }
    ));

    self.add_creator("generic_end", function(state_name, im) {
        return new EndState(
            state_name,
            _.gettext("Thanks for adding your voice & supporting African farmers. " +
                "Ask your friends & family to join you by dialing *120*646#. It's " +
                "time to Do Agric & transform lives!"),
            'start'
        );
    });
}

// launch app
var states = new DoAgricUSSD();
var im = new InteractionMachine(api, states);
im.attach();
