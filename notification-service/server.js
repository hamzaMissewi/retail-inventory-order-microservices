const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { createLogger } = require('./shared/lib/logger');
const { setupMetrics } = require('./shared/lib/metrics');
const { sendSuccess } = require('./shared/lib/response');
const { errorHandler } = require('./shared/lib/errorHandler');
const { requestId } = require('./shared/lib/requestId');
const { setupSwagger } = require('./shared/lib/swagger');

const linkedinRoutes = require('./routes/linkedin');
const emailRoutes = require('./routes/email');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const logger = createLogger('notification-service');
const PORT = process.env.PORT || 3004;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestId);
app.use((req, res, next) => { req.log = logger; next(); });

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

setupMetrics(app, 'notification_service');
setupSwagger(app, {
    title: 'Notification Service API',
    version: '1.0.0',
    description: 'Multi-channel notifications: LinkedIn, Email, and Webhooks',
    serverUrl: `http://localhost:${PORT}`,
    serviceName: 'notification-service',
});

app.get('/health', (req, res) => {
    sendSuccess(res, {
        service: 'notification-service',
        status: 'healthy',
        uptime: process.uptime(),
        linkedinConfigured: !!(process.env.LINKEDIN_ACCESS_TOKEN && process.env.LINKEDIN_PERSON_ID),
        emailConfigured: !!(process.env.SMTP_HOST && process.env.SMTP_USER),
    });
});

app.use('/linkedin', linkedinRoutes(logger));
app.use('/email', emailRoutes(logger));
app.use('/webhooks', webhookRoutes(logger));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`Notification service running on port ${PORT}`));

module.exports = app;
