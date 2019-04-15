/**
 * Gets the full URL of the request
 * @param {Object} req The request
 * @returns {String} The full url
 */
function getFullUrl(req) {
    return req.protocol + '://' + req.get('host') + req.originalUrl;
}

module.exports = { getFullUrl: getFullUrl };