module.exports = { apps: [ {
    name: 'WakeDispatch',
    script: './index.js',
    watch: true,
    env: {
        TWITTER_CONSUMER_KEY: '',
        TWITTER_CONSUMER_SECRET: '',
        TWITTER_ACCESS_TOKEN_KEY: '',
        TWITTER_ACCESS_TOKEN_SECRET: '',
        COUCHDB_URL: 'https://user:pasword@example.com:443',
        COUCHDB_DATABASE: 'wakedispatch',
        PORT: 5000,
        NODE_ENV: 'production'
    }
} ] };
