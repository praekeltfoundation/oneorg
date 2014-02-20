var describe = global.describe,
  it = global.it,
  beforeEach = global.beforeEach;

var fs = require("fs");
var assert = require("assert");
var app = require("../lib/doagricussd");
var vumigo = require("vumigo_v01");

describe('DoAgricUSSD', function () {

  var tester;
  var fixtures = [];
  // var config_za = 'test/fixtures/config_ussd.za.dev.json';

  describe('when using the app in ZA', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        custom_setup: function (api) {
          api.config_store.config = JSON.stringify({
            user_store: "oneorg_ussd_dev",
            metric_store: "oneorg_ussd_dev",
            default_lang: "en_za"
          });

          fixtures.forEach(function (f) {
            api.load_http_fixture(f);
          });
        },
        async: true
      });
    });

    it.only('should show the opening menu', function (done) {
      tester.check_state({
        user: null,
        content: null,
        next_state: 'start',
        response: /Hi there en_za! What do you want to do\?\n1. Show this menu again.\n2. Exit/
      }).then(done, done);
    });

    it('should return to the opening menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '1',
        next_state: 'start',
        response: /Hi there en_za! What do you want to do\?\n1. Show this menu again.\n2. Exit/
      }).then(done, done);
    });

    it('should go to the end menu', function (done) {
      tester.check_state({
        user: {
          current_state: 'start'
        },
        content: '2',
        next_state: 'end',
        response: /Thanks, cheers!/,
        continue_session: false  // we expect the session to end here
      }).then(done, done);
    });

  });
});