var couchutils = require('./utils/couchdb');

/**
 * Writes the data to the backing system of choice
 * @param {Object} data The data to write
 * @returns {undefined}
 */
function writeRecord(data) {
    if (couchutils.hasCredentials()) {
        var db = couchutils.getDatabase();
        db.insert(data, data.id);
    }
}

module.exports = { write: writeRecord };