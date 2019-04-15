var lodash = require('lodash');
var request = require('request');
var Twitter = require('twitter-lite');
var Q = require('q');
var url = require('url');

var recorder = require('./recorder');
var statics = require('./utils/statics');

/**
 * Error type when text is not formatted as we expect
 */
class TextFormatError extends Error {}

// EMS Codes https://www.legeros.com/scanner/ems.shtml

/**
 * Splits the latlon query string into numbers
 * @param {String} latlon_query The query parameter for latlong
 * @returns {Object} The lat and lon values
 */
function split_latlon(latlon_query) {
    var latlon_string = latlon_query.split('=')[1];

    return {
        lat: parseFloat(latlon_string.split(',')[0]),
        lon: parseFloat(latlon_string.split(',')[1])
    };
}

/**
 * Converts a url to a lat and lon
 * @param {String} uri The url
 * @param {Promise} deferred The promise for when we get data back
 * @return {Promise} A promise for the lat and lon
 */
function urlToGeo(uri, deferred) {
    if (!deferred) {
        deferred = Q.defer();
    }

    request({
        uri: uri,
        followRedirect: false
    }, function (error, response) {
        if (error) {
            deferred.reject(error);
        }

        if (response.headers.location) {
            urlToGeo(response.headers.location, deferred);
        } else {
            var data = {
                lat: 0,
                lon: 0
            };

            var url_parsed = url.parse(uri);
            lodash.assign(data, split_latlon(url_parsed.query));
            deferred.resolve(data);
        }
    });

    return deferred.promise;
}

/**
 * Gets the tweet URL
 * @param {String} id The tweet id
 * @param {String} handle The tweet handle
 * @returns {String} The twitter URL
 */
function getTweetURL(id, handle) {
    return 'https://twitter.com/' + handle + '/status' + id;
}

/**
 * Parse the tweet data
 * @param {Object} data The tweet data
 * @returns {Promise} A promise for the handled call data
 */
function parse(data) {
    var deferred = Q.defer();

    // 03/26 13:01 / 9600 Falls of Neuse Rd, RA https://t.co/afz1yPj1vV / Cardiac (FHEART) / T17 / 028V / RFE22
    var text_parts = data.text.split(' / ');

    // Isn't formatted how we expect.  This happens with the welcome messages.
    if (text_parts.length <= 1) {
        deferred.reject(new TextFormatError(statics.TWITTER_STREAM.INVALID_FORMAT));
    }

    var tweet_info = {
        datetime: lodash.trim(lodash.get(text_parts, 0)),
        address: lodash.trim(lodash.get(text_parts, 1)),
        type: lodash.trim(lodash.get(text_parts, 2)),
        who: lodash.trim(lodash.get(text_parts, 5))
    };

    var call_info = {
        id: data.id_str,
        url: getTweetURL(data.id_str, data.user.screen_name),
        time: Number(data.timestamp_ms),
        updated: Number(data.timestamp_ms),
        who: tweet_info.who
    };

    var type_regex = /^(.*) \((.*)\)/;
    var type_match = tweet_info.type.match(type_regex);

    if (type_match) {
        call_info.type_long = lodash.trim(lodash.get(type_match, 1));
        call_info.type = lodash.trim(lodash.get(type_match, 2));
    }

    var url_index = tweet_info.address.indexOf('https');
    if (url_index === -1) {
        call_info.place = tweet_info.address;
    } else {
        call_info.place = tweet_info.address.substring(0, url_index);
        call_info.map_url = tweet_info.address.substring(url_index);
    }

    call_info.title = call_info.type_long + ' (' + call_info.type + ') - ' + call_info.place;

    if (call_info.map_url) {
        urlToGeo(call_info.map_url).then(function (latlon_data) {
            lodash.assign(call_info, latlon_data);

            deferred.resolve(call_info);
        }).catch(function (error) {
            deferred.reject(error);
        });
    } else {
        // TO-DO: Parse the address field and try to find the location
        deferred.reject(new Error(statics.TWITTER_STREAM.UNKNOWN_COORDS));
    }

    return deferred.promise;
}

/**
 * Convert call info into geo JSON data
 * @param {Object} call_info The call information
 * @returns {Object} geo json data
 */
function convertToGeodata(call_info) {
    var fields = [
        'place',
        'time',
        'title',
        'type_long',
        'type',
        'updated',
        'url',
        'who'
    ];

    var properties = lodash.pick(call_info, fields);

    var geometry = {
        type: 'Point',
        coordinates: [
            call_info.lon,
            call_info.lat,
            0
        ]
    };

    var geojson = {
        type: 'Feature',
        properties: properties,
        geometry: geometry,
        id: call_info.id
    };

    return geojson;
}

/**
 * Do something with the data
 * @param {Object} data The tweet data
 * @returns {undefined}
 */
function handle(data) {
    parse(data)
        .then(function (call_info) {
            var geojson_data = convertToGeodata(call_info);
            recorder.write(geojson_data);
        }).catch(function (error) {
            if (lodash.includes(statics.DEBUG_ERROR_TEXT, error.message)) {
                global.logger.debug(error);
            } else {
                global.logger.error(error);
            }
        });
}

/**
 * Gets the Twitter credentials
 * @return {Object} The Twitter credentials
 */
function getTwitterCredentials() {
    return {
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
    };
}

/**
 * Watches the twitter stream and inserts data into the database
 * @returns {undefined}
 */
function watchStream() {
    var client = new Twitter(getTwitterCredentials());
    var parameters = { follow: statics.TWITTER_STREAM.WAKE_DISPATCH_ID };

    client.stream('statuses/filter', parameters)
        .on('data', handle)
        .on('error', function (error) {
            global.logger.error(error);
        });
}

module.exports = { watchStream: watchStream };