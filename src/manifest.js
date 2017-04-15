'use strict';
const Path = require('path');
const Config = require('./config');
const GoodFile = require('good-file');
module.exports = function () {


    let basePathRelativeTo = '/';
    if (!Path.isAbsolute(Config.contentBase)) {
        basePathRelativeTo = Path.join(__dirname, '..');
    }

    return {
        connections: [
            { port: 5000, labels: ['api', 'metrics'] },
            { port: 5001, labels: ['telemetry'] }
        ],
        registrations: [
            {
                plugin: './modules/metrics',
                options: { select: ['metrics'] }
            },
            {
                plugin: {
                    register: './modules/metricsEndpoint',
                    options: {
                        bearerToken: process.env.METRICS_TOKEN
                    }
                },
                options: {select: ['telemetry']}
            },
            {
                plugin: {
                    register: './modules/validate',
                    options: {
                        validateFile: Path.join(Config.contentBase, 'validate/validate.json'),
                        validate64File: Path.join(Config.contentBase, 'validate/validate64.json'),
                        relativeTo: basePathRelativeTo
                    }
                },
                options: { select: ['api'] }
            },
            {
                plugin: {
                    register: './modules/xmlFiles',
                    options: {filePath: Path.join(Config.contentBase, 'xml'), relativeTo: basePathRelativeTo}
                },
                options: {select: ['api']}
            },
            {
                plugin: {
                    register: 'good',
                    options: {
                        reporters: [
                            {
                                reporter: GoodFile,
                                events: {
                                    log: '*',
                                    response: '*'
                                },
                                config: {
                                    path: Path.join(Config.log.path, Config.instance),
                                    prefix: 'nppxml',
                                    rotate: 'daily'
                                }
                            }
                        ]
                    }
                },
                options: {select: ['api']}
            }
        ]
    };
};
