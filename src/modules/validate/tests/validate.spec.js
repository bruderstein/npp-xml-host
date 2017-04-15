var Os = require('os');
var Path = require('path');
var Hapi = require('hapi');
var Promise = require('bluebird');
var Fs = Promise.promisifyAll(require('fs'));
var Rimraf = require('rimraf');

var Unexpected = require('unexpected');
var ValidatePlugin = require('../');

var expect = Unexpected.clone();

// TODO: This should go to unexpected!
expect.addAssertion('<date> [not] to be within', function (expect, subject, start, timeOf, finish) {
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

describe('ValidatePlugin', function () {

    var server;
    var tempDir, xmlDir;
    var inject;

    beforeEach(function (done) {

        server = new Hapi.Server();
        // Dummy port, but hapi needs at least one connection to inject
        server.connection({port: 5555});
        inject = function (args) {
            return new Promise(function (resolve, reject) {
                server.inject(args, resolve);
            });
        };

        tempDir = Path.join(Os.tmpdir(), 'validate-test-' + new Date().getTime());

        Fs.mkdirAsync(tempDir)
            .then(function () {
                return Fs.writeFileAsync(Path.join(tempDir, 'validate.json'),
                    JSON.stringify({
                        '12345678123456781234567812345678': 'ok',
                        aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: 'bad'
                    }));
            })
            .then(function () {
              return Fs.writeFileAsync(Path.join(tempDir, 'validate64.json'),
                JSON.stringify({
                  '64646464646464646464646464646464': 'ok',
                  '6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a': 'bad'
                }));
            })
            .then(function () {
                var pluginOptions = {
                    relativeTo: tempDir,
                    validateFile: 'validate.json',
                    validate64File: 'validate64.json',
                };

                server.register({
                    register: ValidatePlugin,
                    options: pluginOptions
                }, function () {
                    done();
                });
            });
    });

    afterEach(function (done) {

        server.plugins['nppxmlhost-validate-plugin'].watcher.close();

        // Closing the watcher seems to hang around a bit, timeout of 500ms seems to fix it.
        // Ugly, but works.
        setTimeout(function () {
            Rimraf(tempDir, function () {
                done();
            });
        }, 500);
    });

    it('returns a `bad` result', function () {

        return inject({
            method: 'get',
            url: '/pm/validate?md5=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
        }).then(function (response) {
            expect(response.statusCode, 'to equal', 200);
            expect(response.payload, 'to equal', 'bad');
        });
    });

    it('returns a `ok` result', function () {

        return inject({
            method: 'get',
            url: '/pm/validate?md5=12345678123456781234567812345678'
        }).then(function (response) {
            expect(response.statusCode, 'to equal', 200);
            expect(response.payload, 'to equal', 'ok');
        });
    });

    it('returns an `unknown` result for an unknown md5', function () {

        return inject({
            method: 'get',
            url: '/pm/validate?md5=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        }).then(function (response) {
            expect(response.statusCode, 'to equal', 200);
            expect(response.payload, 'to equal', 'unknown');
        });
    });

    it('returns a Bad Response (400) result for a bad md5', function () {

        return inject({
            method: 'get',
            url: '/pm/validate?md5=ghi'
        }).then(function (response) {
            expect(response.statusCode, 'to equal', 400);
            expect(response.result, 'to satisfy', { statusCode: 400 });
        });
    });
    
    it('returns an ok response for an md5 in the validate64.json', function () {
      
      return inject({
        method: 'get',
        url: '/pm/validate?md5=64646464646464646464646464646464'
      }).then(function (response) {
        expect(response.statusCode, 'to equal', 200);
        expect(response.result, 'to equal', 'ok');
      });
    });

    describe('after update to validate.json', function () {

        beforeEach(function (done) {

            Fs.unlinkAsync(Path.join(tempDir, 'validate.json'))
                .then(function () {
                    return Fs.writeFileAsync(Path.join(tempDir, 'validate.json'),
                        JSON.stringify({
                            '12345678123456781234567812345678': 'bad',
                            aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa: 'bad',
                            bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb: 'ok'
                        }));
                }).then(function () {
                    server.plugins['nppxmlhost-validate-plugin'].events.on('changed', function () { done(); });
                });
        });

        it('returns a `ok` response for the entry changed from unknown to ok', function () {

            return inject({
                method: 'get',
                url: '/pm/validate?md5=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
            }).then(function (response) {
                expect(response.statusCode, 'to equal', 200);
                expect(response.result, 'to equal', 'ok');
            });

        });
    });
    
  describe('after update to validate64.json', function () {
    
    beforeEach(function (done) {
      
      Fs.unlinkAsync(Path.join(tempDir, 'validate64.json'))
        .then(function () {
          return Fs.writeFileAsync(Path.join(tempDir, 'validate64.json'),
            JSON.stringify({
              '64646464646464646464646464646464': 'bad',
              '65656565656565656565656565656565': 'ok',
              '6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a6a': 'ok',
            }));
        }).then(function () {
        server.plugins['nppxmlhost-validate-plugin'].events.on('changed', function () { done(); });
      });
    });
    
    it('returns a `ok` response for the entry changed from unknown to ok', function () {
      
      return inject({
        method: 'get',
        url: '/pm/validate?md5=65656565656565656565656565656565'
      }).then(function (response) {
        expect(response.statusCode, 'to equal', 200);
        expect(response.result, 'to equal', 'ok');
      });
    });
    
    it('returns a `bad` response for the entry changed from ok to bad', function () {
    
      return inject({
        method: 'get',
        url: '/pm/validate?md5=64646464646464646464646464646464'
      }).then(function (response) {
        expect(response.statusCode, 'to equal', 200);
        expect(response.result, 'to equal', 'bad');
      });
    });
  });

});
