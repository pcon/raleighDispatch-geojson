var lodash = require('lodash');
var Q = require('q');

var couchutils = require('./utils/couchdb');

var nano;

var couchdb_views = [
    {
        _id: '_design/geojson',
        views: { timestamp: { map: 'function(doc) { emit(doc.properties.time, doc); }' } }
    }
];

/**
 * Handle the failures from all settled
 * @param {Object[]} results The promise results
 * @param {Object} deferred The promise to resolve or reject
 * @returns {undefined}
 */
function handleFailures(results, deferred) {
    var failures = [];

    lodash.forEach(results, function (result) {
        if (result.state !== 'fulfilled') {
            failures.push(result.reason);
        }
    });

    if (lodash.isEmpty(failures)) {
        deferred.resolve();
    } else {
        deferred.reject(new Error(lodash.join(failures, '\n')));
    }
}

/**
 * Gets an array of view names
 * @returns {String[]} An array of view names
 */
function couchdb_getViewNames() {
    return lodash.map(couchdb_views, '_id');
}

/**
 * Query all the views
 * @param {Object} db  The database to use
 * @returns {Promse} A promise for when the views are queried
 */
function couchdb_queryViews(db) {
    var deferred = Q.defer();

    db.fetch({ keys: couchdb_getViewNames() })
        .then(function (data) {
            deferred.resolve(data);
        }).catch(function (error) {
            deferred.reject(error);
        });

    return deferred.promise;
}

/**
 * Create the views in the database
 * @param {Object} db The database to use
 * @param {Promise} deferred The promise
 * @returns {undefined}
 */
function couchdb_createViews(db, deferred) {
    var correct_views = [];
    var promises = [];
    var view_map = lodash.keyBy(couchdb_views, '_id');

    couchdb_queryViews(db)
        .then(function (views) {
            lodash.forEach(views.rows, function (view) {
                // This happens if you delete a view
                if (view.doc === null) {
                    return;
                }

                if (lodash.isEqual(lodash.omit(view.doc, '_rev'), lodash.get(view_map, view.doc._id))) {
                    correct_views.push(view.doc._id);
                }
            });

            var views_to_add = lodash.omit(view_map, correct_views);

            lodash.forEach(lodash.values(views_to_add), function (view) {
                promises.push(couchutils.insert(db, view));
            });

            Q.allSettled(promises)
                .then(function (results) {
                    handleFailures(results, deferred);
                });

            deferred.resolve();
        }).catch(function (error) {
            deferred.reject(error);
        });
}

/**
 * Sets up couchdb
 * @returns {Promise} Returns a promise for when the couchdb is setup
 */
function couchdb() {
    var deferred = Q.defer();

    if (!couchutils.hasCredentials()) {
        deferred.resolve();
        return deferred.promise;
    }

    nano = require('nano')(couchutils.getCouchConfig()); // eslint-disable-line global-require
    nano.db.create(couchutils.getDatabaseName()).then(function () {
        couchdb_createViews(nano.db.use(couchutils.getDatabaseName()), deferred);
    }).catch(function () {
        couchdb_createViews(nano.db.use(couchutils.getDatabaseName()), deferred);
    });

    return deferred.promise;
}

/**
 * Run all the setup steps
 * @returns {Promise} A promise for when all the setup steps have been done
 */
function run() {
    var deferred = Q.defer();
    var promises = [];

    promises.push(couchdb());

    Q.allSettled(promises)
        .then(function (results) {
            handleFailures(results, deferred);
        });

    return deferred.promise;
}

module.exports = {
    couchdb: couchdb,
    run: run
};