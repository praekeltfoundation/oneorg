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
        response: "^Investing in agriculture can lift millions out of poverty. Add your support & get a FREE track feat D'banj[^]" +
            "1. I support![^]" +
            "2. Take survey[^]" +
            "3. About ONE$",
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
            "2. MP3[^]" +
            "3. Take the survey[^]" +
            "4. Main Menu$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.support_menu"), 1);
          assert.equal(get_metric_value("test.ussd.supporter"), 1);
      }).then(done, done);
    });

    it('from main menu should go to the about page', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '3',
        next_state: 'about',
        response: "^ONE is a campaigning & advocacy organisation of 3.5m people taking action to end extreme poverty & preventable disease. Find out more at www.one.org[^]" +
            "1. Main Menu$"
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.about"), 1);
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
        response: "^Investing in agriculture can lift millions out of poverty. Add your support & get a FREE track feat D'banj[^]" +
            "1. I support![^]" +
            "2. Take survey[^]" +
            "3. About ONE$"
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
        response: /A download link has been sent to you via SMS. Thanks again for adding your voice & supporting smallholder farmers across Africa!/,
        teardown: assert_single_sms(
                "Find your sound file at XXXXXX. Thanks again for adding your voice & supporting smallholder farmers across Africa!"
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
        response: /A download link has been sent to you via SMS. Thanks again for adding your voice & supporting smallholder farmers across Africa!/,
        teardown: assert_single_sms(
                "Find your sound file at XXXXXX. Thanks again for adding your voice & supporting smallholder farmers across Africa!"
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
        response: "^Are you a farmer\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
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
        response: "^Are you a farmer\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
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
        response: "^Do you think your government invests enough in agriculture\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
      }).then(function() {
          assert.equal(get_contact_value("extras-farmer"), "1");
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
        response: "^How much of the national budget do you think your government spends on agriculture\\?[^]" +
            "1. 1-5%[^]" +
            "2. 5-10%[^]" +
            "3. 10-20%[^]" +
            "4. More than 20%$"
      }).then(function() {
          assert.equal(get_contact_value("extras-budget_enough"), "1");
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
        response: "^How much do you think your government should spend\\?[^]" +
            "1. 1-5%[^]" +
            "2. 5-10%[^]" +
            "3. 10-20%[^]" +
            "4. More than 20%$"
      }).then(function() {
          assert.equal(get_contact_value("extras-budget_think"), "5-10");
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
        response: "^Are you male or female\\?[^]" +
            "1. Male[^]" +
            "2. Female$"
      }).then(function() {
          assert.equal(get_contact_value("extras-budget_should"), "10-20");
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
        response: "^How old are you\\?[^]" +
            "1. 0-15 years[^]" +
            "2. 16-20 years[^]" +
            "3. 21-30 years[^]" +
            "4. 31-40 years[^]" +
            "5. 41-50 years[^]" +
            "6. Older than 50 years$"
      }).then(function() {
          assert.equal(get_contact_value("extras-sex"), "female");
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
        response: /Thanks for adding your voice & supporting farmers across Africa. Ask ur friends & family to join u by dialing XXXXX. It's time to Do Agric & transform lives./,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.survey_6"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.survey_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.survey_end"), 1);
          assert.equal(get_contact_value("extras-age"), "0-15");
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
        response: /Thanks for adding your voice & supporting farmers across Africa. Ask ur friends & family to join u by dialing XXXXX. It's time to Do Agric & transform lives./,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("test.ussd.state_exited.survey_6"), 1);
          assert.equal(get_metric_value("test.ussd.state_entered.survey_end"), 1);
          assert.equal(get_metric_value("test.ussd.session_closed_in.survey_end"), 1);
          assert.equal(get_contact_value("extras-age"), "0-15");
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

    it('should show the main menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'main_menu',
        response: "^Investing in agriculture can lift millions out of poverty. " +
            "Add your support & get a FREE track feat D'banj[^]" +
            "1. I support![^]" +
            "2. Take survey[^]" +
            "3. About ONE$",
        session_event: 'new'
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.unique_users"), 1);
          assert.equal(get_metric_value("za.ussd.sessions"), 1);
          assert.equal(get_metric_value("za.ussd.session_new_in.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.main_menu"), 1);
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
            "2. MP3[^]" +
            "3. Take the survey[^]" +
            "4. Main Menu$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.support_menu"), 1);
          assert.equal(get_metric_value("za.ussd.supporter"), 1);
      }).then(done, done);
    });

    it('from main menu should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '3',
        next_state: 'about',
        response: "^ONE is a campaigning & advocacy organisation of 3.5m people " +
            "taking action to end extreme poverty & preventable disease. Find out more " +
            "at www.one.org[^]" +
            "1. Main Menu$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.about"), 1);
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
        response: "^Investing in agriculture can lift millions out of poverty. " +
            "Add your support & get a FREE track feat D'banj[^]" +
            "1. I support![^]" +
            "2. Take survey[^]" +
            "3. About ONE$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.main_menu"), 1);
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
        response: "^A download link has been sent to you via SMS. Thanks again for adding " +
            "your voice & supporting smallholder farmers across Africa!$",
        teardown: assert_single_sms(
                "Find your sound file at XXXXXX. Thanks again for adding your voice & supporting " +
                "smallholder farmers across Africa!"
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.ringback"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.ringback"), 1);
          assert.equal(get_metric_value("za.ussd.request.ringback"), 1);
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
        response: "^A download link has been sent to you via SMS. Thanks again for adding " +
            "your voice & supporting smallholder farmers across Africa!$",
        teardown: assert_single_sms(
                "Find your sound file at XXXXXX. Thanks again for adding your voice & supporting " +
                "smallholder farmers across Africa!"
            ),
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.mp3"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.mp3"), 1);
          assert.equal(get_metric_value("za.ussd.request.mp3"), 1);
      }).then(done, done);
    });

    it('should go to the survey start from main menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'main_menu'
        },
        content: '2',
        next_state: 'survey_start',
        response: "^Are you a farmer\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.main_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.survey_start"), 1);
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
        response: "^Are you a farmer\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.support_menu"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.survey_start"), 1);
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
        response: "^Do you think your government invests enough in agriculture\\?[^]" +
            "1. Yes[^]" +
            "2. No$"
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
        response: "^How much of the national budget do you think your government " +
            "spends on agriculture\\?[^]" +
            "1. 1-5%[^]" +
            "2. 5-10%[^]" +
            "3. 10-20%[^]" +
            "4. More than 20%$"
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
        response: "^How much do you think your government should spend\\?[^]" +
            "1. 1-5%[^]" +
            "2. 5-10%[^]" +
            "3. 10-20%[^]" +
            "4. More than 20%$"
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
        response: "^Are you male or female\\?[^]" +
            "1. Male[^]" +
            "2. Female$"
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
        response: "^How old are you\\?[^]" +
            "1. 0-15 years[^]" +
            "2. 16-20 years[^]" +
            "3. 21-30 years[^]" +
            "4. 31-40 years[^]" +
            "5. 41-50 years[^]" +
            "6. Older than 50 years$"
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
        response: "^Thanks for adding your voice & supporting farmers across Africa. " +
            "Ask ur friends & family to join u by dialing XXXXX. It's time to Do Agric " +
            "& transform lives.$",
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.survey_6"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.survey_end"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.survey_end"), 1);
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
        response: "^Thanks for adding your voice & supporting farmers across Africa. " +
            "Ask ur friends & family to join u by dialing XXXXX. It's time to Do Agric " +
            "& transform lives.$",
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(get_metric_value("za.ussd.state_exited.survey_6"), 1);
          assert.equal(get_metric_value("za.ussd.state_entered.survey_end"), 1);
          assert.equal(get_metric_value("za.ussd.session_closed_in.survey_end"), 1);
      }).then(done, done);
    });


  });
});
