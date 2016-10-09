const client = require('prom-client');
const metric = {
    http: {
        requests: {
            duration: new client.Summary('http_request_duration_milliseconds', 'request duration in milliseconds', ['method', 'path', 'status']),
            buckets: new client.Histogram('http_request_buckets_milliseconds',
                'request duration buckets in milliseconds.', ['method', 'path', 'status'],
                { buckets: [ 100, 200, 500, 1000, 2000, 5000 ] })
        }
    }
};

function duration(start) {
    var diff = process.hrtime(start);
    return Math.round((diff[0] * 1e9 + diff[1]) / 1000000);
}

module.exports = {
    observe: function (method, path, status, startTime) {
        const value = duration(startTime);
        metric.http.requests.duration.labels(method, path, status).observe(value);
        metric.http.requests.buckets.labels(method, path, status).observe(value);
    }
};
