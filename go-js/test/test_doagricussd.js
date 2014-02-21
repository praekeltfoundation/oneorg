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

  function getMetricValue(metric){
    var config = JSON.parse(tester.api.config_store.config);
    var metricobj = tester.api.metrics[config.metric_store][metric];
    return metricobj.values;
  }

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

    it('should show the opening menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start',
        response: /Output: Welcome text\n1. Output - option - support\n2. Output - option - quiz\n3. Output - option - about/,
        session_event: 'new'
      }).then(function() {
          assert.equal(getMetricValue("unique_users"), 1);
          assert.equal(getMetricValue("ussd_sessions"), 1);
          assert.equal(getMetricValue("session_new_in.start"), 1);
          assert.equal(getMetricValue("state_entered.start"), 1);
      }).then(done, done);
    });

    it('should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '3',
        next_state: 'about',
        response: /Output: About one.org/,
        continue_session: false  // we expect the session to end here
      }).then(function() {
          assert.equal(getMetricValue("state_exited.start"), 1);
          assert.equal(getMetricValue("state_entered.about"), 1);
          assert.equal(getMetricValue("session_closed_in.about"), 1);
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

    it('should show the opening menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start',
        response: /Output: Welcome text ZA\n1. Output - option - support\n2. Output - option - quiz\n3. Output - option - about/
      }).then(done, done);
    });

    it('should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '3',
        next_state: 'about',
        response: /Output: About one.org/,
        continue_session: false  // we expect the session to end here
      }).then(done, done);
    });
  });

  describe('when using the app in NG', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        custom_setup: function (api) {
          var config = JSON.parse(fs.readFileSync(config_ng));
          api.config_store.config = JSON.stringify(config);
          api.config_store["translation.en_ng"] = locale_data.en_ng;
          fixtures.forEach(function (f) {
            api.load_http_fixture(f);
          });
        },
        async: true
      });
    });

    it('should show the opening menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start',
        response: /Output: Welcome text NG\n1. Output - option - support\n2. Output - option - quiz\n3. Output - option - about/
      }).then(done, done);
    });

    it('should go to the about page and end session', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '3',
        next_state: 'about',
        response: /Output: About one.org/,
        continue_session: false  // we expect the session to end here
      }).then(done, done);
    });

  });
});
