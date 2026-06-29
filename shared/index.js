const { createLogger } = require('./lib/logger');
const { setupMetrics } = require('./lib/metrics');
const { sendSuccess, sendError } = require('./lib/response');
const { errorHandler } = require('./lib/errorHandler');
const { requestId } = require('./lib/requestId');
const { authenticate, optionalAuth } = require('./lib/auth');

module.exports = {
    createLogger,
    setupMetrics,
    sendSuccess,
    sendError,
    errorHandler,
    requestId,
    authenticate,
    optionalAuth,
};
