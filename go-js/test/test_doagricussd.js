var describe = global.describe,
  it = global.it,
  beforeEach = global.beforeEach;

var fs = require("fs");
var assert = require("assert");
var app = require("../lib/doagricussd");
var vumigo = require("vumigo_v01");

var locale_data = {
    'en_za': fs.readFileSync('config/translation_ussd.en_za.json'),
    'en_ng': fs.readFileSync('config/translation_ussd.en_ng.json'),
};

describe('DoAgricUSSD', function () {

  var tester;
  var fixtures = [];
  var config_global = 'test/fixtures/config_ussd.global.dev.json';
  var config_za = 'test/fixtures/config_ussd.za.dev.json';
  var config_ng = 'test/fixtures/config_ussd.ng.dev.json';

  var get_metric_value = function (metric){
    var config = JSON.parse(tester.api.config_store.config);
    var metricobj = tester.api.metrics[config.metric_store][metric];
    return metricobj.values;
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
        response: "^Output: main menu intro[^]" +
            "1. Output - option - add your voice[^]" +
            "2. Output - option - survey[^]" +
            "3. Output - option - about$",
        session_event: 'new'
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.unique_users"), 1);
          assert.equal(get_metric_value("test.ussd.sessions"), 1);
          assert.equal(get_metric_value("test.ussd.session_new_in.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.main_menu"), 1);
      }).then(done, done);
    });

    it('should go to the main menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '1',
        next_state: 'support_menu',
        response: "^Output: support menu intro[^]" +
            "1. Output - option - ringback[^]" +
            "2. Output - option - MP3[^]" +
            "3. Output - option - survey[^]" +
            "4. Output - option - main menu$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.supporter"), 1);
      }).then(done, done);
    });

    it('from main menu should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '3',
        next_state: 'about',
        response: /Output: About one.org/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.about"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.about"), 1);
      }).then(done, done);
    });

    it('from support menu should go to the main menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'support_menu',
          answers: {
              main_menu: 'support_menu'
          }
        },
        content: '4',
        next_state: 'main_menu',
        response: "^Output: main menu intro[^]" +
            "1. Output - option - add your voice[^]" +
            "2. Output - option - survey[^]" +
            "3. Output - option - about$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.main_menu"), 1);
      }).then(done, done);
    });

    it('should go to the ringback tone page, send SMS and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'support_menu',
          answers: {
              main_menu: 'support_menu'
          }
        },
        content: '1',
        next_state: 'ringback',
        response: /Output: Ringback thank you/,
        teardown: assert_single_sms(
                "SMS Output: Ringback link"
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.ringback"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.ringback"), 1);
          assert.equal(get_metric_value("test.ussd.request.ringback"), 1);
      }).then(done, done);
    });

    it('should go to the MP3 page, send SMS and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'support_menu',
          answers: {
              main_menu: 'support_menu'
          }
        },
        content: '2',
        next_state: 'mp3',
        response: /Output: MP3 thank you/,
        teardown: assert_single_sms(
                "SMS Output: MP3 link"
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.mp3"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.mp3"), 1);
          assert.equal(get_metric_value("test.ussd.request.mp3"), 1);
      }).then(done, done);
    });

    it('should go to the survey start from main menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '2',
        next_state: 'survey_start',
        response: "^Output: survey Q1[^]" +
            "1. survey Q1A1[^]" +
            "2. survey Q1A2$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.survey_start"), 1);
      }).then(done, done);
    });

    it('should go to the survey start from support menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'support_menu',
          answers: {
              main_menu: 'support_menu'
          }
        },
        content: '3',
        next_state: 'survey_start',
        response: "^Output: survey Q1[^]" +
            "1. survey Q1A1[^]" +
            "2. survey Q1A2$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.survey_start"), 1);
      }).then(done, done);
    });

    it('should go to the survey question 2', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_start',
          answers: {
              main_menu: 'survey_start'
          }
        },
        content: '1',
        next_state: 'survey_2',
        response: "^Output: survey Q2[^]" +
            "1. survey Q2A1[^]" +
            "2. survey Q2A2$"
      }).then(done, done);
    });

    it('should go to the survey question 3', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_2',
          answers: {
              main_menu: 'survey_start',
              survey_start: '1'
          }
        },
        content: '1',
        next_state: 'survey_3',
        response: "^Output: survey Q3[^]" +
            "1. survey Q3A1[^]" +
            "2. survey Q3A2[^]" +
            "3. survey Q3A3[^]" +
            "4. survey Q3A4$"
      }).then(done, done);
    });

    it('should go to the survey question 4', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_3',
          answers: {
              main_menu: 'survey_start',
              survey_start: '1',
              survey_2: '1'
          }
        },
        content: '2',
        next_state: 'survey_4',
        response: "^Output: survey Q4[^]" +
            "1. survey Q4A1[^]" +
            "2. survey Q4A2[^]" +
            "3. survey Q4A3[^]" +
            "4. survey Q4A4$"
      }).then(done, done);
    });

    it('should go to the survey question 5', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_4',
          answers: {
              main_menu: 'survey_start',
              survey_start: '1',
              survey_2: '1',
              survey_3: '5-10'
          }
        },
        content: '3',
        next_state: 'survey_5',
        response: "^Output: survey Q5[^]" +
            "1. survey Q5A1[^]" +
            "2. survey Q5A2$"
      }).then(done, done);
    });

    it('should go to the survey question 6', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_5',
          answers: {
              main_menu: 'survey_start',
              survey_start: '1',
              survey_2: '1',
              survey_3: '5-10',
              survey_4: '10-20'
          }
        },
        content: '2',
        next_state: 'survey_6',
        response: "^Output: survey Q6[^]" +
            "1. survey Q6A1[^]" +
            "2. survey Q6A2[^]" +
            "3. survey Q6A3[^]" +
            "4. survey Q6A4[^]" +
            "5. survey Q6A5[^]" +
            "6. survey Q6A6$"
      }).then(done, done);
    });

    it('should go to the survey thanks page for farmer and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_6',
          answers: {
              main_menu: 'survey_start',
              survey_start: '1',
              survey_2: '1',
              survey_3: '5-10',
              survey_4: '10-20',
              survey_5: 'male'
          }
        },
        content: '1',
        next_state: 'survey_end',
        response: /Output: survey end/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.survey_6"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.survey_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.survey_end"), 1);
      }).then(done, done);
    });

    it('should go to the survey thanks page for not farmer and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'survey_6',
          answers: {
              main_menu: 'survey_start',
              survey_start: '0',
              survey_2: '1',
              survey_3: '5-10',
              survey_4: '10-20',
              survey_5: 'male'
          }
        },
        content: '1',
        next_state: 'survey_end',
        response: /Output: survey end/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.survey_6"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.survey_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.survey_end"), 1);
      }).then(done, done);
    });

  });

  describe('when using the app in ZA', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        custom_setup: function (api) {
          var config = JSON.parse(fs.readFileSync(config_za));
          api.config_store.config = JSON.stringify(config);
          api.config_store["translation.en_za"] = locale_data.en_za;
          fixtures.forEach(function (f) {
            api.load_http_fixture(f);
          });
        },
        async: true
      });
    });

    


  });
});
