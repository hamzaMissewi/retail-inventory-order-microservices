const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

const { createLogger } = require('./shared/lib/logger');
const { setupMetrics } = require('./shared/lib/metrics');
const { sendSuccess, sendError } = require('./shared/lib/response');
const { errorHandler } = require('./shared/lib/errorHandler');
const { requestId } = require('./shared/lib/requestId');
const { setupSwagger } = require('./shared/lib/swagger');

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');

const app = express();
const logger = createLogger('customer-service');
const PORT = process.env.PORT || 3003;
const mongoURI = process.env.MONGO_URI || 'mongodb://mongo-customers:27017/customers';
const JWT_SECRET = process.env.JWT_SECRET || 'retail-dev-secret-change-in-production';

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestId);
app.use((req, res, next) => { req.log = logger; next(); });

const limiter = rateLimit({ windowMs: 60 * 1000, max: 100 });
app.use(limiter);

setupMetrics(app, 'customer_service');
setupSwagger(app, {
    title: 'Customer Service API',
    version: '1.0.0',
    description: 'Customer management, authentication, and addresses',
    serverUrl: `http://localhost:${PORT}`,
    serviceName: 'customer-service',
});

mongoose.connect(mongoURI).then(() => logger.info('MongoDB connected'))
    .catch(err => logger.error({ err }, 'MongoDB connection failed'));

const CustomerSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true, lowercase: true, index: true },
    password: { type: String, required: true },
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    avatarUrl: { type: String, default: '' },
    addresses: [{
        label: { type: String, default: 'Home' },
        line1: { type: String, required: true },
        line2: { type: String, default: '' },
        city: { type: String, required: true },
        state: { type: String, default: '' },
        zip: { type: String, required: true },
        country: { type: String, default: 'US' },
        isDefault: { type: Boolean, default: false },
    }],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
CustomerSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });
CustomerSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const Customer = mongoose.model('Customer', CustomerSchema);

app.get('/health', (req, res) => {
    sendSuccess(res, {
        service: 'customer-service',
        status: 'healthy',
        uptime: process.uptime(),
        dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

app.use('/auth', authRoutes(Customer, logger, JWT_SECRET));
app.use('/customers', customerRoutes(Customer, logger, JWT_SECRET));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`Customer service running on port ${PORT}`));

module.exports = app;
