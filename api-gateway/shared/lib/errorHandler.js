function errorHandler(err, req, res, next) {
    const logger = req.log || console;
    logger.error({ err, requestId: req.requestId }, 'Unhandled error');

    const statusCode = err.statusCode || 500;
    const message = err.expose ? err.message : 'Internal server error';

    res.status(statusCode).json({
        success: false,
        error: message,
        requestId: req.requestId,
        timestamp: new Date().toISOString(),
    });
}

module.exports = { errorHandler };
