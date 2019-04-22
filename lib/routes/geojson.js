var express = require('express');
var lodash = require('lodash');
var moment = require('moment');
var numbertowords = require('number-to-words');
var Q = require('q');

var couchutils = require('../utils/couchdb');
var package = require('../../package.json');
var routeutils = require('../utils/route');

var router = express.Router();

var base_data = {
    type: 'FeatureCollection',
    metadata: {
        url: '',
        title: '',
        api: package.version,
        count: 0
    },
    features: [],
    bbox: []
};

var omitted_fields = [
    '_id',
    '_rev'
];

var lon_lat_elev_keys = [
    'lon',
    'lat',
    'elev'
];

var bbox_keys = [
    'min_lon',
    'min_lat',
    'min_elev',
    'max_lon',
    'max_lat',
    'max_elev'
];

var valid_types = [
    'years',
    'year',
    'y',
    'quarters',
    'quarter',
    'Q',
    'months',
    'month',
    'M',
    'days',
    'day',
    'd',
    'hours',
    'hour',
    'h',
    'minutes',
    'minute',
    'm',
    'seconds',
    'second',
    's',
    'milliseconds',
    'millisecond',
    'ms'
];

/**
 * Updates the bbox with min and max lon/lat/elev
 * @param {Object} data The data to update the bbox for
 * @param {Object} row The newest row to compare
 * @returns {undefined}
 */
function updateBbox(data, row) {
    var pos_data = lodash.zipObject(lon_lat_elev_keys, lodash.get(row, 'value.geometry.coordinates'));
    var bbox_data = lodash.zipObject(bbox_keys, lodash.get(data, 'bbox'));

    lodash.forEach(lon_lat_elev_keys, function (key) {
        lodash.set(bbox_data, 'min_' + key, lodash.min([ lodash.get(bbox_data, 'min_' + key), lodash.get(pos_data, key) ]));
        lodash.set(bbox_data, 'max_' + key, lodash.max([ lodash.get(bbox_data, 'max_' + key), lodash.get(pos_data, key) ]));
    });

    lodash.set(data, 'bbox', []);

    lodash.forEach(bbox_keys, function (key) {
        data.bbox.push(lodash.get(bbox_data, key));
    });
}

/**
 * Converts couchdb data into final geojson format
 * @param {Object[]} data The data to convert to geojson
 * @returns {Object} The geojson data
 */
function couchdb_convertData(data) {
    var result = lodash.cloneDeep(base_data);

    lodash.forEach(data, function (row) {
        result.features.push(lodash.omit(lodash.get(row, 'value'), omitted_fields));
        updateBbox(result, row);
    });

    lodash.set(result, 'metadata.count', lodash.size(lodash.get(result, 'features')));

    return result;
}

/**
 * Enriches the server data
 * @param {Object} data The data to enrich
 * @param {Object} options The server options
 * @param {Object} req The request
 * @param {Number} status The request status code
 * @returns {Object} The enriched data
 */
function couchdb_serverData(data, options, req, status) {
    lodash.set(data, 'metadata.url', routeutils.getFullUrl(req));
    lodash.set(data, 'metadata.status', status);
    lodash.set(data, 'metadata.title', options.title);
    return data;
}

/**
 * Gets the data from couchdb
 * @param {Object} options The options for the view
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {Promise} A promise for when the data is gotten
 */
function couchdb_getdata(options, req, res) {
    var deferred = Q.defer();

    var db = couchutils.getDatabase();

    couchutils.view(db, 'geojson', 'timestamp', options.couchdb)
        .then(function (data) {
            var converted_data = couchdb_convertData(data);
            converted_data = couchdb_serverData(converted_data, options.server, req, 200);
            res.json(converted_data);
        }).catch(function (error) {
            global.logger.error(error);
            res.status(500);
            res.json({});
        });

    return deferred.promise;
}

/**
 * Gets the base options
 * @param {String} title The title to use
 * @returns {Object} The base options
 */
function get_base_options(title) {
    return {
        couchdb: {
            sorted: true,
            descending: true
        },
        server: { title: title }
    };
}

/**
 * Gets the GEO json data for the last 24 hours
 * @param {Object} req The request
 * @param {Object} res The response
 * @param {Object} options The options
 * @returns {undefined}
 */
function get_data(req, res, options) {
    if (couchutils.hasCredentials()) {
        couchdb_getdata(options, req, res);
    }
}

/**
 * Gets all the GEO json data
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_all(req, res) {
    var options = get_base_options('All Wake County dispatches');

    get_data(req, res, options);
}

/**
 * Gets the GEO json from now minus a set amount of time
 * @param {Object} req The request
 * @param {Object} res The response
 * @param {Number} amount The interval of time
 * @param {String} type The unit of time
 * @returns {undefined}
 */
function get_time_difference(req, res, amount, type) {
    var timestamp = moment().subtract(amount, type).valueOf();
    var options = get_base_options('All Wake County dispatches, last ' + numbertowords.toWords(amount) + ' ' + type);
    options.couchdb.endkey = timestamp;

    get_data(req, res, options);
}

/**
 * Gets the GEO json data for the last 24 hours
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_last24(req, res) {
    get_time_difference(req, res, 24, 'hours');
}

/**
 * Gets the latest GEO json data
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_latest(req, res) {
    var options = get_base_options('All Wake County dispatches, Latest');
    options.couchdb.limit = 1;
    get_data(req, res, options);
}

/**
 * Gets if the unit is valid
 * @param {String} type The unit of time
 * @returns {Boolean} If the unit is valid
 */
function isValidType(type) {
    return lodash.includes(valid_types, type);
}

/**
 * Gets the latest GEO json data based on router parameters
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_latest_params(req, res) {
    var type = lodash.lowerCase(req.params.type);
    var amount = lodash.toInteger(req.params.amount);

    if (isValidType(type)) {
        get_time_difference(req, res, amount, type);
    } else {
        var result = lodash.cloneDeep(base_data);
        result = couchdb_serverData(result, { title: 'Invalid URL' }, req, 400);
        result.metadata.message = type + ' is not a valid interval';

        res.status(400);
        res.json(result);
    }
}

router.get('/', get_all);
router.get('/last24', get_last24);
router.get('/latest', get_latest);
router.get('/latest/:type/:amount', get_latest_params);

module.exports = router;