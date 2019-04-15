var bunyan = require('bunyan');

global.logger = bunyan.createLogger({
    name: 'WakeDispatch',
    stream: process.stdout,
    level: 'info'
});

var setup = require('./lib/setup');
var twitterstream = require('./lib/twitterstream');
var webserver = require('./lib/webserver');

setup.run()
    .then(function () {
        twitterstream.watchStream();
        webserver.start();
    }).catch(function (error) {
        global.logger.error(error);
    });