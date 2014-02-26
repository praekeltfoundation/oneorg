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

    it('should show the opening welcome', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start',
        response: /Output: Welcome text\n1. Output - option - add your voice/,
        session_event: 'new'
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.unique_users"), 1);
          assert.equal(get_metric_value("test.ussd.sessions"), 1);
          assert.equal(get_metric_value("test.ussd.session_new_in.start"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.start"), 1);
      }).then(done, done);
    });

    it('should go to the main menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '1',
        next_state: 'main_menu',
        response: "^Output: Main menu intro[^]" +
            "1. Output - option - ringback[^]" +
            "2. Output - option - MP3[^]" +
            "3. Output - option - quiz[^]" +
            "4. Output - option - about$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.start"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.supporter"), 1);
      }).then(done, done);
    });

    it('should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '4',
        next_state: 'about',
        response: /Output: About one.org/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.about"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.about"), 1);
      }).then(done, done);
    });

    it('should go to the ringback tone page, send SMS and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '1',
        next_state: 'ringback',
        response: /Output: Ringback thank you/,
        teardown: assert_single_sms(
                "SMS Output: Ringback link"
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.ringback"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.ringback"), 1);
          assert.equal(get_metric_value("test.ussd.request.ringback"), 1);
      }).then(done, done);
    });

    it('should go to the MP3 page, send SMS and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '2',
        next_state: 'mp3',
        response: /Output: MP3 thank you/,
        teardown: assert_single_sms(
                "SMS Output: MP3 link"
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.mp3"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.mp3"), 1);
          assert.equal(get_metric_value("test.ussd.request.mp3"), 1);
      }).then(done, done);
    });

    it('should go to the quiz start', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '3',
        next_state: 'quiz_start',
        response: "^Output: quiz Q1[^]" +
            "1. quiz Q1A1[^]" +
            "2. quiz Q1A2$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.quiz_start"), 1);
      }).then(done, done);
    });

    it('should go to the quiz question 2 - for farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_start',
          answers: {
              start: 'quiz_start'
          }
        },
        content: '1',
        next_state: 'quiz_isfarmer_2',
        response: "^Output: quiz farmer Q2[^]" +
            "1. quiz farmer Q2A1[^]" +
            "2. quiz farmer Q2A2[^]" +
            "3. quiz farmer Q2A3[^]" +
            "4. quiz farmer Q2A4$"
      }).then(done, done);
    });

    it('should go to the quiz question 3 - for farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_isfarmer_2',
          answers: {
              start: 'quiz_start'
          }
        },
        content: '1',
        next_state: 'quiz_isfarmer_3',
        response: "^Output: quiz farmer Q3[^]" +
            "1. quiz farmer Q3A1[^]" +
            "2. quiz farmer Q3A2[^]" +
            "3. quiz farmer Q3A3[^]" +
            "4. quiz farmer Q3A4$"
      }).then(done, done);
    });

    it('should go to the quiz question 4 - for farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_isfarmer_3',
          answers: {
              start: 'quiz_start',
              quiz_isfarmer_2: '1-5'
          }
        },
        content: '2',
        next_state: 'quiz_isfarmer_4',
        response: "^Output: quiz farmer Q4[^]" +
            "1. quiz farmer Q4A1[^]" +
            "2. quiz farmer Q4A2[^]" +
            "3. quiz farmer Q4A3[^]" +
            "4. quiz farmer Q4A4[^]" +
            "5. quiz farmer Q4A5[^]" +
            "6. quiz farmer Q4A6$"
      }).then(done, done);
    });

    it('should go to the quiz question 5 - for farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_isfarmer_4',
          answers: {
              start: 'quiz_start',
              quiz_isfarmer_2: '1-5',
              quiz_isfarmer_3: '5-10'
          }
        },
        content: '2',
        next_state: 'quiz_isfarmer_5',
        response: "^Output: quiz farmer Q5[^]" +
            "1. quiz farmer Q5A1[^]" +
            "2. quiz farmer Q5A2$"
      }).then(done, done);
    });

    it('should go to the quiz question 6 - for farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_isfarmer_5',
          answers: {
              start: 'quiz_start',
              quiz_isfarmer_2: '1-5',
              quiz_isfarmer_3: '5-10',
              quiz_isfarmer_4: 'jobs'
          }
        },
        content: '1',
        next_state: 'quiz_isfarmer_6',
        response: "^Output: quiz farmer Q6[^]" +
            "1. quiz farmer Q6A1[^]" +
            "2. quiz farmer Q6A2[^]" +
            "3. quiz farmer Q6A3[^]" +
            "4. quiz farmer Q6A4[^]" +
            "5. quiz farmer Q6A5[^]" +
            "6. quiz farmer Q6A6$"
      }).then(done, done);
    });

    it('should go to the quiz thanks page for farmer and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_isfarmer_6',
          answers: {
              start: 'quiz_start',
              quiz_isfarmer_2: '1-5',
              quiz_isfarmer_3: '5-10',
              quiz_isfarmer_4: 'jobs',
              quiz_isfarmer_5: 'male'
          }
        },
        content: '1',
        next_state: 'quiz_end',
        response: /Output: quiz end/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.quiz_isfarmer_6"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.quiz_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.quiz_end"), 1);
      }).then(done, done);
    });

    it('should go to the quiz question 2 - for not farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_start',
          answers: {
              start: 'quiz_start'
          }
        },
        content: '2',
        next_state: 'quiz_notfarmer_2',
        response: "^Output: quiz notfarm Q2[^]" +
            "1. quiz notfarm Q2A1[^]" +
            "2. quiz notfarm Q2A2[^]" +
            "3. quiz notfarm Q2A3[^]" +
            "4. quiz notfarm Q2A4$"
      }).then(done, done);
    });

    it('should go to the quiz question 3 - for not farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_notfarmer_2',
          answers: {
              start: 'quiz_start'
          }
        },
        content: '1',
        next_state: 'quiz_notfarmer_3',
        response: "^Output: quiz notfarm Q3[^]" +
            "1. quiz notfarm Q3A1[^]" +
            "2. quiz notfarm Q3A2[^]" +
            "3. quiz notfarm Q3A3[^]" +
            "4. quiz notfarm Q3A4$"
      }).then(done, done);
    });

    it('should go to the quiz question 4 - for not farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_notfarmer_3',
          answers: {
              start: 'quiz_start',
              quiz_notfarmer_2: '1-5'
          }
        },
        content: '2',
        next_state: 'quiz_notfarmer_4',
        response: "^Output: quiz notfarm Q4[^]" +
            "1. quiz notfarm Q4A1[^]" +
            "2. quiz notfarm Q4A2[^]" +
            "3. quiz notfarm Q4A3[^]" +
            "4. quiz notfarm Q4A4[^]" +
            "5. quiz notfarm Q4A5[^]" +
            "6. quiz notfarm Q4A6$"
      }).then(done, done);
    });

    it('should go to the quiz question 5 - for not farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_notfarmer_4',
          answers: {
              start: 'quiz_start',
              quiz_notfarmer_2: '1-5',
              quiz_notfarmer_3: '5-10'
          }
        },
        content: '2',
        next_state: 'quiz_notfarmer_5',
        response: "^Output: quiz notfarm Q5[^]" +
            "1. quiz notfarm Q5A1[^]" +
            "2. quiz notfarm Q5A2$"
      }).then(done, done);
    });

    it('should go to the quiz question 6 - for not farmer', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_notfarmer_5',
          answers: {
              start: 'quiz_start',
              quiz_notfarmer_2: '1-5',
              quiz_notfarmer_3: '5-10',
              quiz_notfarmer_4: 'jobs'
          }
        },
        content: '1',
        next_state: 'quiz_notfarmer_6',
        response: "^Output: quiz notfarm Q6[^]" +
            "1. quiz notfarm Q6A1[^]" +
            "2. quiz notfarm Q6A2[^]" +
            "3. quiz notfarm Q6A3[^]" +
            "4. quiz notfarm Q6A4[^]" +
            "5. quiz notfarm Q6A5[^]" +
            "6. quiz notfarm Q6A6$"
      }).then(done, done);
    });

    it('should go to the quiz thanks page for not farmer and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'quiz_notfarmer_6',
          answers: {
              start: 'quiz_start',
              quiz_notfarmer_2: '1-5',
              quiz_notfarmer_3: '5-10',
              quiz_notfarmer_4: 'jobs',
              quiz_notfarmer_5: 'male'
          }
        },
        content: '1',
        next_state: 'quiz_end',
        response: /Output: quiz end/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.quiz_notfarmer_6"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.quiz_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.quiz_end"), 1);
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

    it('should show the opening welcome', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start',
        response: "^Investing in agriculture could help lift millions out of " +
                  "extreme poverty[^]" +
                  "Add your support and get a FREE track featuring D'banj and others[^]" +
                  "1. Add your voice$",
        session_event: 'new'
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.unique_users"), 1);
          assert.equal(get_metric_value("za.ussd.sessions"), 1);
          assert.equal(get_metric_value("za.ussd.session_new_in.start"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.start"), 1);
      }).then(done, done);
    });

    it('should go to the main menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '1',
        next_state: 'main_menu',
        response: "^Thanks for adding your voice & supporting smallholder " +
            "farmers across Africa. Download the FREE track:[^]" +
            "1. Ringback tone[^]" +
            "2. MP3[^]" +
            "3. Take the quiz[^]" +
            "4. About one.org$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.start"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.supporter"), 1);
      }).then(done, done);
    });

    it('should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '4',
        next_state: 'about',
        response: "^Thanks for adding your voice & supporting farmers across Africa.[^]" +
            "Now ask your friends & family to join you.[^]" +
            "It's time to DO AGRIC & transform lives.$",
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.about"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.about"), 1);
      }).then(done, done);
    });

    it('should go to the ringback tone page, send SMS and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '1',
        next_state: 'ringback',
        response: "^Thanks for your support[^]" +
            "We just sent you the link via SMS.[^]" +
            "It's time to DO AGRIC & transform lives.$",
        teardown: assert_single_sms(
                "Thanks for adding your voice & supporting farmers across Africa.\n"+
                "Your ringback tone can be found at http://example.com\n" +
                "It's time to DO AGRIC & transform lives."
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.ringback"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.ringback"), 1);
          assert.equal(get_metric_value("za.ussd.request.ringback"), 1);
      }).then(done, done);
    });

    it('should go to the MP3 page, send SMS and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '2',
        next_state: 'mp3',
        response: "^Thanks for your support[^]" +
            "We just sent you the link via SMS.[^]" +
            "It's time to DO AGRIC & transform lives.$",
        teardown: assert_single_sms(
                "Thanks for adding your voice & supporting farmers across Africa.\n"+
                "Your MP3 can be found at http://example.com\n" +
                "It's time to DO AGRIC & transform lives."
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.mp3"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.mp3"), 1);
          assert.equal(get_metric_value("za.ussd.request.mp3"), 1);
      }).then(done, done);
    });

  it('should go to the quiz start', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '3',
        next_state: 'quiz_start',
        response: "^Are you a farmer\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.quiz_start"), 1);
      }).then(done, done);
    });


  });
});
