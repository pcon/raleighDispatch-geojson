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

    var server = app.listen(getPort(), getHost(), function () {
        global.logger.info('Webserver started at ' + getHost() + ':' + getPort());
    });

    /**
     * Shutdown handler
     * Done "inline" to allow access to server variable without making it global
     * @returns {undefined}
     */
    var onShutdown = function () {
        server.close(function () {
            global.logger.info('Cleanup finished, server is shutting down');
        });
    };

    process.on('SIGTERM', onShutdown);
    process.on('SIGINT', onShutdown);
}

module.exports = { start: start };