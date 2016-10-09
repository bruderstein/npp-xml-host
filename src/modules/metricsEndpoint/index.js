const promClient = require('prom-client');

function metricsPlugin(server, options, next) {
    server.route({
        method: 'GET',
        path: options && options.path || '/metrics',
        config: {
            handler: function (request, reply) {
                const response = reply(promClient.register.metrics());
                response.type('text/plain');
                return response;
            }
        }
    });

    return next();
}

metricsPlugin.attributes = {
    pkg: require('./package.json')
};

module.exports = metricsPlugin;
