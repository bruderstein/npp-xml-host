
var Crypto = require('crypto');
var Hapi = require('hapi');
var Boom = require('boom');
var Joi = require('joi');
var Glue = require('glue');
var Manifest = require('./manifest');

Glue.compose(Manifest(), {
    relativeTo: __dirname
}, function (err, server) {

    if (err) {
        return console.error('Error creating server', err);
    }

    server.start(function (err) {
        if (err) {
            return console.error('Error starting server', err);
        }
        console.log('Server started');
    });
});


