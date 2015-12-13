
module.exports = function (wallaby) { // eslint-disable-line no-unused-vars
    return {
        files: ['lib/**/*.js', 'lib/**/*.json',
            {
                pattern: 'lib/**/tests/*.spec.js',
                ignore: true
            }],
        tests: ['lib/**/*.spec.js'],
        env: {
            type: 'node',
            runner: 'node',
            workers: {
                initial: 1,
                regular: 1,
                recycle: false
            }
        }

    };
};