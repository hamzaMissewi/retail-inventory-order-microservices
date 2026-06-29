const pino = require('pino');

function createLogger(name) {
    return pino({
        name,
        level: process.env.LOG_LEVEL || 'info',
        transport: process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
        formatters: {
            level(label) { return { level: label }; },
        },
        serializers: {
            req: (req) => ({
                method: req.method,
                url: req.url,
                requestId: req.requestId,
            }),
            err: pino.stdSerializers.err,
        },
    });
}

module.exports = { createLogger };
