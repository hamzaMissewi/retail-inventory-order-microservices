const client = require('prom-client');

function setupMetrics(app, serviceName) {
    const register = new client.Registry();
    client.collectDefaultMetrics({ register });

    const httpRequestDuration = new client.Histogram({
        name: `${serviceName}_http_request_duration_seconds`,
        help: 'Duration of HTTP requests in seconds',
        labelNames: ['method', 'route', 'status'],
        buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        registers: [register],
    });

    const httpRequestsTotal = new client.Counter({
        name: `${serviceName}_http_requests_total`,
        help: 'Total number of HTTP requests',
        labelNames: ['method', 'route', 'status'],
        registers: [register],
    });

    app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
            const duration = (Date.now() - start) / 1000;
            const route = req.route ? req.route.path : req.path;
            httpRequestDuration.labels(req.method, route, res.statusCode).observe(duration);
            httpRequestsTotal.labels(req.method, route, res.statusCode).inc();
        });
        next();
    });

    app.get('/metrics', async (req, res) => {
        res.set('Content-Type', register.contentType);
        res.end(await register.metrics());
    });

    return { register, httpRequestDuration, httpRequestsTotal };
}

module.exports = { setupMetrics };
