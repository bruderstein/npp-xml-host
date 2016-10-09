var Path = require('path');
var Crypto = require('crypto');
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs'));
var Boom = require('boom');
var EventEmitter = require('events').EventEmitter;
var Watcher = require('chokidar');
var promClient = require('prom-client');

var files = {};
var filesUpdateGauge = new promClient.Gauge('file_last_modified_seconds',
    'Last modified stamp of content was updated, in seconds since epoch', ['file']);

var refreshGuage = new promClient.Gauge('file_refresh_seconds',
    'Last time the content files were checked and updated, in seconds since epoch');

function loadFiles(fromPath) {
    return Fs.readdirAsync(fromPath)
        .then(function (files) {
            return Promise.all(files.map(function (file) {

                return Promise.props({
                    contents: Fs.readFileAsync(Path.join(fromPath, file)),
                    stat: Fs.statAsync(Path.join(fromPath, file))
                })
                    .then(function (results) {
                        return { file: file, contents: results.contents, lastModified: results.stat.mtime };
                    });

            }));
        })
        .then(function (fileContents) {
            var nextFilesMap = {};
            fileContents.forEach(function (file) {
                var hash = Crypto.createHash('sha1');
                hash.update(file.contents);
                nextFilesMap[file.file] = {
                    contents: file.contents,
                    eTag: hash.digest('hex'),
                    lastModified: file.lastModified.toISOString()
                };
                filesUpdateGauge.labels(file.file).set(file.lastModified.getTime() / 1000);
            });
            return nextFilesMap;
        });
}

function refresh(path, emitter) {
    return loadFiles(path).then(function (nextFiles) {
        files = nextFiles;
        refreshGuage.set(Date.now() / 1000);
        emitter.emit('changed');
    });
}
function watchFiles(path, emitter) {
    var timeout = null;
    return Watcher.watch(path, {})
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

function xmlFiles(server, options, next) {


    server.path(options.relativeTo);


    server.route({
        method: 'GET',
        path: '/pm/xml/{file}',
        config: {
            cache: {
                privacy: 'public',
                expiresIn: 1000 * 60 * 60 * 24
            },
            handler: function (request, reply) {

                var file = files[request.params.file];
                if (!file) {
                    return reply(Boom.notFound());
                }
                var response = reply(file.contents);
                response.etag(file.eTag);
                response.header('last-modified', file.lastModified);
                response.type(response.request.server.mime.path(request.params.file).type);
                return response;
            }
        }
    });

    var xmlPath = Path.join(options.relativeTo, options.filePath);
    var eventEmitter = new EventEmitter();
    server.expose('events', eventEmitter);
    server.expose('watcher', watchFiles(xmlPath, eventEmitter));

    loadFiles(xmlPath)
        .then(function (nextFiles) {
            files = nextFiles;
            next();
        });
}

xmlFiles.attributes = {
    pkg: require('./package.json')
};

module.exports = xmlFiles;