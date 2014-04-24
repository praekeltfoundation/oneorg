var describe = global.describe,
  it = global.it,
  beforeEach = global.beforeEach;

var fs = require("fs");
var assert = require("assert");
var app = require("../lib/doagricussd");
var vumigo = require("vumigo_v01");

var locale_data = {
    'en_za': fs.readFileSync('config/translation_ussd.en_za.json'),
};

describe('DoAgricUSSD', function () {

  var tester;
  var fixtures = [];
  var config_global = 'test/fixtures/config_ussd.global.dev.json';
  var config_za = 'test/fixtures/config_ussd.za.dev.json';

  var get_metric_value = function (metric){
    var config = JSON.parse(tester.api.config_store.config);
    var metricobj = tester.api.metrics[config.metric_store][metric];
    return metricobj.values;
  };

  var get_contact_value = function (key){
    var contacts = [];
    for (var k in tester.api.contact_store) {
      contacts.push(tester.api.contact_store[k]);
    }
    return contacts[0][key];
  };

  

  var assert_single_sms = function(content) {
      var teardown = function(api) {
          var sms = api.outbound_sends[0];
          assert.equal(api.outbound_sends.length, 1);
          assert.equal(sms.content, content);
      };
      return teardown;
  };

  describe('when using the app in test strings mode', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        custom_setup: function (api) {
          var config = JSON.parse(fs.readFileSync(config_global));
          api.config_store.config = JSON.stringify(config);

          fixtures.forEach(function (f) {
            api.load_http_fixture(f);
          });
        },
        async: true
      });
    });

    it('should show the main menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'main_menu',
        response: "^Investing in agriculture can lift millions out of poverty. Add your support & get a FREE D'banj track[^]" +
            "1. Say YES & get the track!$",
        session_event: 'new'
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.unique_users"), 1);
          assert.equal(get_metric_value("test.ussd.sessions"), 1);
          assert.equal(get_metric_value("test.ussd.session_new_in.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.main_menu"), 1);
      }).then(done, done);
    });

    it('should go to the support menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '1',
        next_state: 'support_menu',
        response: "^Thank you very much for supporting smallholder farmers across Africa. Download your FREE track here:[^]" +
            "1. Ringback tone[^]" +
            "2. MP3$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.supporter"), 1);
          assert.equal(get_metric_value("test.supporter"), 1);
          assert.equal(get_metric_value("supporter"), 1);
      }).then(done, done);
    });

    it('should go to the ringback tone page, send SMS and give option to survey or exit', function (done) {
      tester.check_state({
        user: {
          current_state: 'support_menu',
          answers: {
              main_menu: 'support_menu'
          }
        },
        content: '1',
        next_state: 'ringback',
        response: "ONE is a campaigning and advocacy organization taking action to end extreme poverty and preventable disease.[^]" +
            "1. Finish$",
        teardown: assert_single_sms(
                "Thank you for adding your voice and supporting smallholder farmers across Africa. " +
                "Download our free ringtone here: http://www.shorturl.com/8unm"
            )
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.ringback"), 1);
          assert.equal(get_metric_value("test.ussd.request.ringback"), 1);
      }).then(done, done);
    });

    it('choosing to exit from ringback should thank and exit', function (done) {
      tester.check_state({
        user: {
          current_state: 'ringback',
          answers: {
              main_menu: 'support_menu',
              support_menu: 'ringback'
          }
        },
        content: '1',
        next_state: 'generic_end',
        response: "^Thanks for adding your voice & supporting African farmers. " +
            "Ask your friends & family to join you by dialing \\*120\\*646\\#. It's " +
            "time to Do Agric & transform lives!$",
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.ringback"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.generic_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.generic_end"), 1);
      }).then(done, done);
    });

    it('should go to the MP3 page, send SMS and give option to survey or exit', function (done) {
      tester.check_state({
        user: {
          current_state: 'support_menu',
          answers: {
              main_menu: 'support_menu'
          }
        },
        content: '2',
        next_state: 'mp3',
        response: "ONE is a campaigning and advocacy organization taking action to end extreme poverty and preventable disease.[^]" +
            "1. Finish$",
        teardown: assert_single_sms(
                "Thank you for adding your voice and supporting smallholder farmers across Africa. " +
                "Download our song for free track here: http://www.shorturl.com/8unm"
            )
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.mp3"), 1);
          assert.equal(get_metric_value("test.ussd.request.mp3"), 1);
      }).then(done, done);
    });

    it('choosing to exit from mp3 should thank and exit', function (done) {
      tester.check_state({
        user: {
          current_state: 'mp3',
          answers: {
              main_menu: 'support_menu',
              support_menu: 'mp3'
          }
        },
        content: '1',
        next_state: 'generic_end',
        response: "^Thanks for adding your voice & supporting African farmers. " +
            "Ask your friends & family to join you by dialing \\*120\\*646\\#. It's " +
            "time to Do Agric & transform lives!$",
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.mp3"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.generic_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.generic_end"), 1);
      }).then(done, done);
    });

  });
});
