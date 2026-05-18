require('dotenv').config();

const { loadEnv } = require('./env');

const env = loadEnv();

module.exports = { env };
