
module.exports = function (wallaby) { // eslint-disable-line no-unused-vars
    return {
        files: ['src/**/*.js', 'src/**/*.json',
            {
                pattern: 'src/**/tests/*.spec.js',
                ignore: true
            }],
        tests: ['src/**/*.spec.js'],
        env: {
            type: 'node',
            runner: 'node',
            workers: {
                initial: 1,
                regular: 1,
                recycle: false
            }
        },
      
      setup() {
            var promClient = require('prom-client');
            promClient.register.clear();
      }

    };
};