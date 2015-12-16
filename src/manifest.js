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
        connections: [ { port: 5000 }],
        plugins: {
            './modules/validate': { validateFile: Path.join(Config.contentBase, 'validate/validate.json'), relativeTo: basePathRelativeTo },
            './modules/xmlFiles': { filePath: Path.join(Config.contentBase, 'xml'), relativeTo: basePathRelativeTo },
            'good': {

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
                    },
                    {
                        reporter: GoodFile,
                        events: {
                            ops: '*'
                        },
                        config: {
                            path: Path.join(Config.log.path, Config.instance),
                            prefix: 'ops',
                            rotate: 'daily'
                        }
                    }
                ]
            }
        }
    };
};
