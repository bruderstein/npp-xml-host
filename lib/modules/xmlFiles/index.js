var Path = require('path');
var Crypto = require('crypto');
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs'));
var Boom = require('boom');
var EventEmitter = require('events').EventEmitter;
var Watcher = require('chokidar');

var files = {};

function loadFiles(fromPath) {
    return Fs.readdirAsync(fromPath)
        .then(function (files) {
            return Promise.all(files.map(function (file) {

                return Promise.props({
                    contents: Fs.readFileAsync(Path.join(fromPath, file)),
                    stat: Fs.statAsync(Path.join(fromPath, file))
                })
                    .then(function (results) {
                        return { file: file, contents: results.contents, lastModified: results.stat.mtime.toISOString() };
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
                    lastModified: file.lastModified
                }
            });
            return nextFilesMap;
        });
}

function refresh(path, emitter) {
    return loadFiles(path).then(function (nextFiles) {
        files = nextFiles;
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
    watchFiles(xmlPath, eventEmitter);

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