const Path = require('path');
process.env.NODE_CONFIG_DIR = Path.join(__dirname, '../config');
const Config = require('config');

module.exports = Config;