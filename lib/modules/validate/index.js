var Path = require('path');
var Crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs'));
var Joi = require('joi');
var Boom = require('boom');
var Watcher = require('chokidar');

var validate = {};
var validateEtag = '';
var validateLastModified = '';


function loadFile(validateXmlFile) {
    return Fs.readFileAsync(validateXmlFile)
        .then(function (content) {
            return JSON.parse(content);
        });
}

function refresh(validatePath, emitter) {
    return loadFile(validatePath).then(function (nextValidate) {
        validate = nextValidate;
        var sha1 = Crypto.createHash('sha1');
        sha1.update(JSON.stringify(nextValidate));
        validateEtag = sha1.digest('hex');
        validateLastModified = new Date().toISOString();
        emitter.emit('changed');
    });
}

function watchFiles(path, emitter) {
    var timeout = null;
    Watcher.watch(path, {})
        .on('all', function (event, changedFile) {
            if (timeout !== null) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(function () {
                timeout = null;
                refresh(path, emitter);
            }, 500);
        });
}

function validatePlugin(server, options, next) {

    server.path(options.relativeTo);


    server.route({
        method: 'GET',
        path: '/pm/validate',
        config: {
            validate: {
                query: {
                    md5: Joi.string().length(32)
                }
            },
            cache: {
                privacy: 'public',
                expiresIn: 1000 * 60 * 60 * 4
            },
            handler: function (request, reply) {


                var response = reply(validate[request.query.md5] || 'unknown');
                response.etag(validateEtag);
                response.header('last-modified', validateLastModified);
                response.type('text/plain');
                return response;
            }
        }
    });

    var validatePath = Path.join(options.relativeTo, options.validateFile);
    var eventEmitter = new EventEmitter();
    server.expose('events', eventEmitter);
    watchFiles(validatePath, eventEmitter);

    refresh(validatePath, eventEmitter)
        .then(function () {
            next();
        });
}

validatePlugin.attributes = {
    pkg: require('./package.json')
};

module.exports = validatePlugin;
