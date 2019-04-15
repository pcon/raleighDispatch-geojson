var nano;
var lodash = require('lodash');
var Q = require('q');

/**
 * If we have valid couchdb credentials
 * @returns {Boolean} If there are valid couchdb credentials
 */
function hasCredentials() {
    return !lodash.isEmpty(process.env.COUCHDB_URL);
}

/**
 * Gets the couch URL
 * @returns {String} The couchdb connection URL
 */
function getCouchConfig() {
    return process.env.COUCHDB_URL;
}

/**
 * Gets the db
 * @returns {Object} The database
 */
function getDatabase() {
    nano = require('nano')(getCouchConfig()); // eslint-disable-line global-require
    return nano.use(getDatabaseName());
}

/**
 * Insert data in the database
 * @param {Object} db The db to use
 * @param {Object} data The data to insert
 * @param {Promise} deferred The promise to reject or resolve
 * @returns {undefined}
 */
function insertPromise(db, data, deferred) {
    db.insert(data)
        .then(function (results) {
            deferred.resolve(results);
        }).catch(function (error) {
            deferred.resolve(error);
        });
}

/**
 * Insert data in the database
 * @param {Object} db The db to use
 * @param {Object} data The data to insert
 * @returns {undefined}
 */
function insert(db, data) {
    var deferred = Q.defer();

    insertPromise(db, data, deferred);

    return deferred.promise;
}

/**
 * Calls a view
 * @param {Object} db The database
 * @param {String} design_name The design name
 * @param {String} view_name The view name
 * @param {Object} options View options
 * @param {Promise} deferred The promise
 * @returns {undefined}
 */
function viewPromise(db, design_name, view_name, options, deferred) {
    db.view(design_name, view_name, options).then(function (data) {
        deferred.resolve(lodash.get(data, 'rows'));
    }).catch(function (error) {
        deferred.reject(error);
    });
}

/**
 * Calls a view
 * @param {Object} db The database
 * @param {String} design_name The design name
 * @param {String} view_name The view name
 * @param {Object} options View options
 * @returns {Promise} A promise for the view's data
 */
function view(db, design_name, view_name, options) {
    var deferred = Q.defer();

    viewPromise(db, design_name, view_name, options, deferred);

    return deferred.promise;
}

/**
 * Gets the database name
 * @returns {String} The database name
 */
function getDatabaseName() {
    return process.env.COUCHDB_DATABASE;
}

module.exports = {
    getCouchConfig: getCouchConfig,
    getDatabaseName: getDatabaseName,
    getDatabase: getDatabase,
    hasCredentials: hasCredentials,
    insert: insert,
    insertPromise: insertPromise,
    view: view,
    viewPromise: viewPromise
};