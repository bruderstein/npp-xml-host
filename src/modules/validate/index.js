var Path = require('path');
var Crypto = require('crypto');
var EventEmitter = require('events').EventEmitter;
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs'));
var Joi = require('joi');
var Boom = require('boom');
var Watcher = require('chokidar');
var promClient = require('prom-client');

var validationDateGauge = new promClient.Gauge('validation_file_changed_seconds', 
    'Time the last validation file was updated, in seconds since epoch');

var validate = {};
var validateEtag = '';
var validateLastModified = '';

function loadFiles(validateXmlFiles) {
    return Promise.all(validateXmlFiles.map(validateXmlFile => {
  
      if (!validateXmlFile) {
        return {};
      }
  
      return Fs.readFileAsync(validateXmlFile)
        .then(function (content) {
          return JSON.parse(content);
        });
    })).then(results => {
      var allResults = results.reduce((all, result) =>
          Object.assign(all, result)
        , {});
      return allResults;
    });
}

function refresh(validatePaths, emitter) {
    return loadFiles(validatePaths).then(function (nextValidate) {
        validate = nextValidate;
        var sha1 = Crypto.createHash('sha1');
        sha1.update(JSON.stringify(nextValidate));
        validateEtag = sha1.digest('hex');
        validateLastModified = new Date().toISOString();
        validationDateGauge.set(Date.now() / 1000);
        emitter.emit('changed');
    });
}

function watchFiles(paths, emitter) {
    var timeout = null;
    return Watcher.watch(paths, {})
        .on('all', function (event, changedFile) {
            if (timeout !== null) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(function () {
                timeout = null;
                refresh(paths, emitter);
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

    var validatePaths = [ Path.join(options.relativeTo, options.validateFile) ];
    if (options.validate64File) {
        validatePaths.push(Path.join(options.relativeTo, options.validate64File));
    }
    var eventEmitter = new EventEmitter();
    server.expose('events', eventEmitter);
    server.expose('watcher', watchFiles(validatePaths, eventEmitter));

    refresh(validatePaths, eventEmitter)
        .then(function () {
            next();
        });
}

validatePlugin.attributes = {
    pkg: require('./package.json')
};

module.exports = validatePlugin;
