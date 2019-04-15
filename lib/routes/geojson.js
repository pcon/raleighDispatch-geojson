var express = require('express');
var lodash = require('lodash');
var moment = require('moment');
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
 * Gets the GEO json data
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_all(req, res) {
    if (couchutils.hasCredentials()) {
        var options = {
            couchdb: {
                sorted: true,
                descending: true
            },
            server: { title: 'All Wake County dispatches' }
        };
        couchdb_getdata(options, req, res);
    }
}

/**
 * Gets the GEO json data for the last 24 hours
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_last24(req, res) {
    var timestamp = moment().subtract(1, 'days').valueOf();

    if (couchutils.hasCredentials()) {
        var options = {
            couchdb: {
                sorted: true,
                descending: true,
                endkey: timestamp
            },
            server: { title: 'All Wake County dispatches, Past Day' }
        };
        couchdb_getdata(options, req, res);
    }
}

/**
 * Gets the latest GEO json data
 * @param {Object} req The request
 * @param {Object} res The response
 * @returns {undefined}
 */
function get_latest(req, res) {
    if (couchutils.hasCredentials()) {
        var options = {
            couchdb: {
                sorted: true,
                descending: true,
                limit: 1
            },
            server: { title: 'All Wake County dispatches, Latest' }
        };
        couchdb_getdata(options, req, res);
    }
}

router.get('/', get_all);
router.get('/last24', get_last24);
router.get('/latest', get_latest);

module.exports = router;