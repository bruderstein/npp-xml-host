var Os = require('os');
var Path = require('path');
var Hapi = require('hapi');
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs'));
var Rimraf = require('rimraf');

var Unexpected = require('unexpected');
var XmlFiles = require('../');

var expect = Unexpected.clone();

// TODO: This should go to unexpected!
expect.addAssertion('date', '[not] to be within', function (expect, subject, start, timeOf, finish) {
    if (finish === undefined) {
        this.argsOutput = function (output) {
            output.appendInspected(start).text('..').appendInspected(finish);
        };
        finish = timeOf;
        expect(subject.getTime() >= start.getTime() && subject.getTime() <= finish.getTime(), '[not] to be truthy');
        return
    }

    if (typeof start === 'number') {
        // Assume start is in the form of '[seconds|minutes|hours] of',
        var units = 1;
        switch(timeOf) {
            case 'seconds of':
                units = 1000;
                break;

            case 'minutes of':
                units = 1000 * 60;
                break;

            case 'hours of':
                units = 1000 * 60 * 60;
                break;
            default:
                throw new Error('Unknown units: expecting `seconds of` / `minutes of` / `hours of`');
        }
        this.argsOutput = function (output) {
            output.appendInspected(start).text(' ').text(timeOf).text(' ').appendInspected(finish);
        };
        expect(Math.abs(subject.getTime() - finish.getTime()) / units, 'to be less than', start);
        return;
    }
    throw new Error('Assertion `to be within` for a date expects either a start and finish date, or [number], "seconds of", [date]');
});

describe('XmlFiles', function () {

    var server;
    var tempDir, xmlDir;
    var inject;

    beforeEach(function (done) {

        server = new Hapi.Server();
        // Dummy port, but hapi needs at least one connection to inject
        server.connection({ port: 5555 });
        inject = function (args) {
            return new Promise(function (resolve, reject) {
                server.inject(args, resolve);
            });
        };

        tempDir = Path.join(Os.tmpdir(), 'xmlfiles-test-' + new Date().getTime());

        Fs.mkdirAsync(tempDir)
            .then(function () {
                xmlDir = Path.join(tempDir, 'xml');
                return Fs.mkdirAsync(xmlDir)
            })
            .then(function () {
                return Fs.writeFileAsync(Path.join(xmlDir, 'file1.zip'), 'some zip contents');
            })
            .then(function () {
                return Fs.writeFileAsync(Path.join(xmlDir, 'file2.md5.txt'), 'aabbccdd');
            })
            .then(function () {
                var pluginOptions = {
                    relativeTo: tempDir,
                    filePath: 'xml'
                };

                server.register({
                    register: XmlFiles,
                    options: pluginOptions
                }, function () {
                    done();
                });
            });
    });

    afterEach(function (done) {

        Rimraf(tempDir, function () {
            done();
        });
    });

    it('serves the content of the xml file', function () {

        return inject({
            method: 'get',
            url: '/pm/xml/file1.zip'
        }).then(function (response) {
            expect(response.statusCode, 'to equal', 200);
            expect(response.payload, 'to equal', 'some zip contents');
        });
    });

    it('returns the correct mime-type', function () {

        return inject({
            method: 'get',
            url: '/pm/xml/file1.zip'
        }).then(function (response) {
            expect(response.headers['content-type'], 'to equal', 'application/zip');
        });
    });

    it('returns the correct last modified date', function () {

        return inject({
            method: 'get',
            url: '/pm/xml/file1.zip'
        }).then(function (response) {
            expect(new Date(response.headers['last-modified']), 'to be within', 3, 'seconds of', new Date());
        });
    });

    describe('after deleting a file', function () {

        beforeEach(function () {
            return Fs.unlinkAsync(Path.join(xmlDir, 'file1.zip')).then(function () {
                return new Promise(function (resolve, reject) {
                    server.plugins['nppxmlhost-xmlfiles-plugin'].events.on('changed', function () {
                        resolve();
                    });
                });
            });
        });

        it('no longer serves the file', function () {

            return inject({
                method: 'get',
                url: '/pm/xml/file1.zip'
            }).then(function (response) {
                expect(response.statusCode, 'to equal', 404);
            });
        });
    });

    describe('after adding a new file', function () {

        beforeEach(function () {
            return Fs.writeFileAsync(Path.join(xmlDir, 'file2.zip'), 'some new file').then(function () {
                return new Promise(function (resolve, reject) {
                    server.plugins['nppxmlhost-xmlfiles-plugin'].events.on('changed', function () {
                        resolve();
                    });
                });
            });
        });

        it('serves the new file', function () {

            return inject({
                method: 'get',
                url: '/pm/xml/file2.zip'
            }).then(function (response) {
                expect(response.statusCode, 'to equal', 200);
                expect(response.result, 'to equal', 'some new file');
            });
        });
    });
});