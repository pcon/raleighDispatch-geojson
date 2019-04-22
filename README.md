# Wake County Dispatch GeoJSON
[![Build Status](https://travis-ci.org/pcon/raleighDispatch-geojson.svg?branch=master)](https://travis-ci.org/pcon/raleighDispatch-geojson)

This application streams the [WakeDispatch](https://twitter.com/WakeDispatch) and converts the data in it's tweets to GeoJSON.  This then allows you to use automation software like [Home Assistant](https://www.home-assistant.io/components/geo_json_events/) to alert on this data or to use [Leaflet](https://leafletjs.com/examples/geojson/) to display the data online.  The WakeDispatch account handles EMS and fire for Raleigh, NC and the greater Wake County area.

# Usage
The application is written in NodeJS and provides an API endpoint to get the GeoJSON as well as a service to stream the feed and write it to a database.

The current supported backing databases are:
*   CouchDB

## Requirements
### Database
*   CouchDB - An instance of CouchDB with permissions to read, write and create views

### NodeJS
Developed against NodeJS v8, the application should run on newer versions as well

## Setup
### Credentials
#### Twitter
You will need to create a new application for Twitter.  This will require you to go through their developer process to [apply for access](https://developer.twitter.com/en/apply-for-access.html).  Once you have an application you will need the consumer key / secret and the access token key / secret.
#### Environment Variables
The credentials and configuration are stored in environment variables

##### By Hand
Export the following environment variables using the `export` command

| Variable Name | Value Example |
| ------------- | ----------------- |
| TWITTER_CONSUMER_KEY | ABC123 |
| TWITTER_CONSUMER_SECRET | def456 |
| TWITTER_ACCESS_TOKEN_KEY | hij789 |
| TWITTER_ACCESS_TOKEN_SECRET | klm012 |
| COUCHDB_URL | <https://user:pasword@example.com:443> |
| COUCHDB_DATABASE | wakedispatch |
| PORT | 5000 |

##### Using pm2
If you are using [pm2](http://pm2.keymetrics.io/) to manage your applications, simply copy the `ecosystem.config.example.js` file to `ecosystem.config.js` and fill in the values.  Then start the application by running

```bash
pm2 start ecosystem.config.js
```

## Usage
After the application is setup run it by calling `node index.js` or with starting it with pm2.  After starting it will connect to Twitter and start monitoring the stream.  When a new tweet with address details comes in, it will be written to the database.

### GeoJSON Endpoints
To retrieve the GeoJSON, the following endpoints are provided.

*   `/geojson` - This endpoint gets **ALL** of the data known about in the system.  This will typically be pretty slow once the data set grows.  It primarily exists for debugging purposes.
*   `/last24` - This endpoint gets the data for the last 24 hours.
*   `/latest` - This endpoint gets the most recent entry.  Useful for checking if the data is fresh.
*   `/latest/:type/:amount` - This endpoint gets the data for a speficied amount of time.  Example: `/latest/minutes/50` will get results for the last 50 minutes.