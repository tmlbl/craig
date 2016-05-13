var api_key = 'key-038f63fc12ab2c26d91d59be212ed88e';
var domain = 'sandbox881942db2e044f05a24b34350717b555.mailgun.org';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});

module.exports.sendmail = function (opts, cb) {
  opts.from = 'Craigslist Monitor <me@samples.mailgun.org>';
  mailgun.messages().send(opts, cb);
}
