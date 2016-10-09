const promClient = require('prom-client');
const Boom = require('boom');

function metricsPlugin(server, options, next) {
    server.route({
        method: 'GET',
        path: options && options.path || '/metrics',
        config: {
            handler: function (request, reply) {
                // We're skipping doing a proper auth strategy for brevity
                // We only want to check the token matches the one provided in the config
                if (typeof request.headers.authorization !== 'string') {
                    return reply(Boom.unauthorized())
                }

                const authHeader = request.headers.authorization.split(' ');
                if (authHeader[0].toLowerCase() !== 'bearer' || authHeader[1] !== options.bearerToken) {
                    return reply(Boom.unauthorized())
                }
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
