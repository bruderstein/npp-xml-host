const promClient = require('prom-client');
const metrics = require('./metrics');

function metricsPlugin(server, options, next) {
    server.expose('prom', promClient);

    server.ext('onRequest', (request, reply) => {
        request.plugins.metrics = {
            start: process.hrtime()
        };
        return reply.continue();
    });

    server.on('response', (request) => {
        metrics.observe(request.method, request.path, request.response.statusCode, request.plugins.metrics.start);
    });

    return next();
}

metricsPlugin.attributes = {
    pkg: require('./package.json')
};

module.exports = metricsPlugin;

