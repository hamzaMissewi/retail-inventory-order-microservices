function sendSuccess(res, data, statusCode = 200) {
    return res.status(statusCode).json({
        success: true,
        data,
        timestamp: new Date().toISOString(),
    });
}

function sendError(res, message, statusCode = 400, details = null) {
    const body = {
        success: false,
        error: message,
        timestamp: new Date().toISOString(),
    };
    if (details) body.details = details;
    return res.status(statusCode).json(body);
}

module.exports = { sendSuccess, sendError };
