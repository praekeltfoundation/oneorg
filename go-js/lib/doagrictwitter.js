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


function DoAgricTwitterError(msg) {
    var self = this;
    self.msg = msg;

    self.toString = function() {
        return "<DoAgricTwitterError: " + self.msg + ">";
    };
}


function DoAgricTwitter() {
    var self = this;
    var _ = new jed({});

    StateCreator.call(self, 'initial_state');

    // Session metrics helper

    self.incr_metric = function(im, metric) {
        var p = im.api_request('kv.incr', {
            key: 'metrics.' + metric,
            amount: 1
        });
        p.add_callback(function (result) {
            if(!result.success) {
                // fail very fast
                throw new DoAgricTwitterError(result.reason);
            }
            return result.value;
        });
        p.add_callback(function (value) {
            return im.metrics.fire_max(metric, value);
        });

        return p;
    };

    // Contact stuff

    self.get_contact = function(im){
        var p = im.api_request('contacts.get_or_create', {
            delivery_class: 'twitter',
            addr: im.user_addr
        });
        p.add_callback(function (result) {
            if(!result.success) {
                // fail very fast
                throw new DoAgricTwitterError(result.reason);
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
                throw new DoAgricTwitterError(result.reason);
            }
            return result.contact;
        });
    };

    self.save_new_supporter = function(im){
        var p = self.get_contact(im);
        p.add_callback(function (contact) {
            return self.save_contact_extras(im, contact, {
                oneorg_supporter: "1"
            });
        });
        return p;
    };

    // States

    self.add_creator('initial_state', function(state_name, im) {
        var p = self.get_contact(im);
        p.add_callback(function(contact) {
            if (contact["extras-oneorg_supporter"] === undefined) {
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
            'this should never be sent',
            'initial_state');
    });

    self.add_creator('new_supporter', function(state_name, im) {
        return new SilentEndState(
            state_name,
            'this should never be sent',
            'initial_state',
            {
                on_enter: function(){
                    var p = self.incr_metric(
                        im, im.config.metric_prefix + 'supporter');
                    p.add_callback(function (result) {
                        return self.save_new_supporter(im);
                    });
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
