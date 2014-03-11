var describe = global.describe,
  it = global.it,
  beforeEach = global.beforeEach;

var fs = require("fs");
var assert = require("assert");
var app = require("../lib/doagrictwitter");
var vumigo = require("vumigo_v01");


describe('DoAgricTwitter', function () {

  var tester;
  var fixtures = [];
  var config_global = 'test/fixtures/config_twitter.global.dev.json';

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


  describe('when tweet is received from new supporter', function() {

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

    it('should log new users supporter', function (done) {
      tester.check_state({
        from_addr: "@testuser",
        user: null,
        content: 'I support #doagric',
        next_state: 'initial_state',
        response: null,
        continue_session: false  // we expect the session to end here
      }).then(function() {
         assert.equal(get_metric_value("test.twitter.supporter"), 1);
         assert.equal(get_contact_value("extras-oneorg_supporter"), "1");
      }).then(done, done);
    });
  });

  describe('when tweet is received from old supporter', function() {

    beforeEach(function () {
      tester = new vumigo.test_utils.ImTester(app.api, {
        custom_setup: function (api) {
          var config = JSON.parse(fs.readFileSync(config_global));
          api.config_store.config = JSON.stringify(config);

          var dummy_contact = {
              key: "f953710a2472447591bd59e906dc2c26",
              surname: "Trotter",
              user_account: "test-0-user",
              bbm_pin: null,
              msisdn: "+1234567",
              created_at: "2013-04-24 14:01:41.803693",
              gtalk_id: null,
              dob: null,
              groups: null,
              facebook_id: null,
              twitter_handle: '@testuser',
              email_address: null,
              name: "Rodney"
          };

          api.add_contact(dummy_contact);
          api.update_contact_extras(dummy_contact, {
              "oneorg_supporter": "1"
          });

          fixtures.forEach(function (f) {
            api.load_http_fixture(f);
          });
        },
        async: true
      });
    });

    it('should not log support', function (done) {
      tester.check_state({
        from_addr: "@testuser",
        user: null,
        content: 'I support #doagric again',
        next_state: 'initial_state',
        response: null,
        continue_session: false  // we expect the session to end here
      }).then(function() {
         assert.equal(get_metric_value("test.twitter.supporter"), null);
         assert.equal(get_contact_value("extras-oneorg_supporter"), "1");
      }).then(done, done);
    });
  });

});
