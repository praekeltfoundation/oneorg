var describe = global.describe,
  it = global.it,
  beforeEach = global.beforeEach;

var fs = require("fs");
var assert = require("assert");
var app = require("../lib/doagricussd");
var vumigo = require("vumigo_v01");

var locale_data = {
    'en_za': fs.readFileSync('config/translation_ussd.en_za.json')
};

describe('DoAgricUSSD', function () {

  var tester;
  var fixtures = [];
  var config_global = 'test/fixtures/config_ussd.global.dev.json';
  var config_za = 'test/fixtures/config_ussd.za.dev.json';

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
        response: /Output: Welcome text\n1. Output - option - support\n2. Output - option - quiz\n3. Output - option - about/
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
});