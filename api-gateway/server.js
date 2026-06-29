const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { createProxyMiddleware } = require('http-proxy-middleware');

const { createLogger } = require('./shared/lib/logger');
const { setupMetrics } = require('./shared/lib/metrics');
const { sendSuccess } = require('./shared/lib/response');
const { errorHandler } = require('./shared/lib/errorHandler');
const { requestId } = require('./shared/lib/requestId');

const app = express();
const logger = createLogger('api-gateway');
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'] }));
app.use(express.json());
app.use(requestId);
app.use((req, res, next) => { req.log = logger; next(); });

const limiter = rateLimit({ windowMs: 60 * 1000, max: 500 });
app.use(limiter);

setupMetrics(app, 'api_gateway');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://order-service:3002';
const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'http://customer-service:3003';
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3004';

const proxyOptions = {
    changeOrigin: true,
    onProxyReq: (proxyReq, req) => {
        if (req.requestId) proxyReq.setHeader('X-Request-Id', req.requestId);
        logger.info({ target: proxyReq.host, method: req.method, path: req.path }, 'Proxy request');
    },
    onError: (err, req, res) => {
        logger.error({ err: err.message, path: req.path }, 'Proxy error');
        res.status(502).json({
            success: false,
            error: 'Service unavailable',
            requestId: req.requestId,
            timestamp: new Date().toISOString(),
        });
    },
};

app.get('/health', (req, res) => {
    sendSuccess(res, {
        service: 'api-gateway',
        status: 'healthy',
        uptime: process.uptime(),
        routes: {
            products: PRODUCT_SERVICE_URL,
            orders: ORDER_SERVICE_URL,
            customers: CUSTOMER_SERVICE_URL,
            notifications: NOTIFICATION_SERVICE_URL,
        },
    });
});

app.use('/api/products', createProxyMiddleware({ target: PRODUCT_SERVICE_URL, ...proxyOptions }));
app.use('/api/orders', createProxyMiddleware({ target: ORDER_SERVICE_URL, ...proxyOptions }));
app.use('/api/customers', createProxyMiddleware({ target: CUSTOMER_SERVICE_URL, ...proxyOptions }));
app.use('/api/auth', createProxyMiddleware({ target: CUSTOMER_SERVICE_URL, ...proxyOptions }));
app.use('/api/invoices', createProxyMiddleware({ target: ORDER_SERVICE_URL, ...proxyOptions }));
app.use('/api/categories', createProxyMiddleware({ target: PRODUCT_SERVICE_URL, ...proxyOptions }));
app.use('/api/notifications', createProxyMiddleware({ target: NOTIFICATION_SERVICE_URL, ...proxyOptions }));
app.use('/api/linkedin', createProxyMiddleware({ target: NOTIFICATION_SERVICE_URL, ...proxyOptions }));
app.use('/api/email', createProxyMiddleware({ target: NOTIFICATION_SERVICE_URL, ...proxyOptions }));
app.use('/api/webhooks', createProxyMiddleware({ target: NOTIFICATION_SERVICE_URL, ...proxyOptions }));

app.get('/api', (req, res) => {
    sendSuccess(res, {
        name: 'Retail Microservices Platform',
        version: '2.0.0',
        endpoints: {
            docs_products: '/api/products/api-docs',
            docs_orders: '/api/orders/api-docs',
            docs_customers: '/api/customers/api-docs',
            docs_notifications: '/api/notifications/api-docs',
            health: '/health',
            metrics: '/metrics',
        },
    });
});

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`);
    logger.info({ products: PRODUCT_SERVICE_URL, orders: ORDER_SERVICE_URL, customers: CUSTOMER_SERVICE_URL, notifications: NOTIFICATION_SERVICE_URL }, 'Routes configured');
});

module.exports = app;
