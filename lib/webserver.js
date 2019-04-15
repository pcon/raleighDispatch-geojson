var express = require('express');

var routes = require('./routes');
var statics = require('./utils/statics');

/**
 * Returns the host
 * @returns {String} The host
 */
function getHost() {
    if (process.env.HOST) {
        return process.env.HOST;
    }

    return statics.SERVER.HOST;
}

/**
 * Returns the port
 * @returns {String} The port
 */
function getPort() {
    if (process.env.PORT) {
        return process.env.PORT;
    }

    return statics.SERVER.PORT;
}

/**
 * Starts the express server
 * @returns {undefined}
 */
function start() {
    var app = express();
    app.use('/geojson', routes.geojson);
    app.listen(getPort(), getHost(), function () {
        global.logger.info('Webserver started at ' + getHost() + ':' + getPort());
    });
}

module.exports = { start: start };