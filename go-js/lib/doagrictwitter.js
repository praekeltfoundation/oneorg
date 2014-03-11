// Possible configuration items:
//
//
// * config:
//     * metric_store:
//         Name of the metric store to use. If omitted, metrics are sent
//         to the metric store named 'default'.
//     * metric_prefix: 
//         String to append before metrics. E.g. global.twitter.
//
// Metrics produced:
//
// * global.twitter.supporter


var vumigo = require("vumigo_v01");
var jed = require("jed");

if (api === undefined) {
  // testing hook (supplies api when it is not passed in by the real sandbox)
  var api = this.api = new vumigo.dummy_api.DummyApi();
}

var FreeText = vumigo.states.FreeText;
var EndState = vumigo.states.EndState;
var InteractionMachine = vumigo.state_machine.InteractionMachine;
var StateCreator = vumigo.state_machine.StateCreator;
var Promise = vumigo.promise.Promise;

function SilentEndState(name, text, next, handlers) {
    // State that mimicks the USSD behaviour when a USSD session ends
    // it fast forwards to the start of the InteractionMachine.
    // We need to do this because SMS/Twitter doesn't have the Session capabities
    // that provide us this functionality when using USSD.
    var self = this;
    handlers = handlers || {};
    if(handlers.on_enter === undefined) {
        handlers.on_enter = function() {
            self.input_event('', function() {});
        };
    }
    self.send_reply = function(){
        return false;
    };
    EndState.call(self, name, text, next, handlers);
}

function DoAgricTwitter() {
    var self = this;
    var _ = new jed({});

    StateCreator.call(self, 'initial_state');

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

    // Contact stuff

    self.get_contact = function(im){
         var p = im.api_request('contacts.get_or_create', {
            delivery_class: 'twitter',
            addr: im.user_addr
        });
        return p;
    };

    self.save_new_supporter = function(im){
        var p_c = self.get_contact(im);
        p_c.add_callback(function(result) {
            var contact = result.contact;
            var p_extra = im.api_request('contacts.update_extras', {
                    key: contact.key,
                    fields: {
                        "oneorg_supporter": "1"
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

    self.add_creator('initial_state', function(state_name, im) {
        var p = self.get_contact(im);
        p.add_callback(function(result) {
            if (result.contact["extras-oneorg_supporter"] === undefined) {
                return new FreeText(
                    state_name,
                    'new_supporter',
                    "new supporter non-response");
            } else {
                return new FreeText(
                    state_name,
                    'old_supporter',
                    "old supporter non-response");
            }
        });
        return p;
    });

    self.add_creator('old_supporter', function(state_name, im) {
        return new SilentEndState(
            state_name,
            'None',
            'initial_state');
    });

    self.add_creator('new_supporter', function(state_name, im) {
        return new SilentEndState(
            state_name,
            'None',
            'initial_state',
                {
                    on_enter: function(){
                        var p = new Promise();
                        p.add_callback(self.incr_metric(im, im.config.metric_prefix + "supporter"));
                        p.add_callback(self.save_new_supporter(im));
                        p.callback;
                        return p;
                    }
                }
            );
    });

}

// launch app
var states = new DoAgricTwitter();
var im = new InteractionMachine(api, states);
im.attach();
