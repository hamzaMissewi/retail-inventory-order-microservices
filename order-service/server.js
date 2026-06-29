const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const { createLogger } = require('./shared/lib/logger');
const { setupMetrics } = require('./shared/lib/metrics');
const { sendSuccess, sendError } = require('./shared/lib/response');
const { errorHandler } = require('./shared/lib/errorHandler');
const { requestId } = require('./shared/lib/requestId');
const { setupSwagger } = require('./shared/lib/swagger');

const orderRoutes = require('./routes/orders');
const invoiceRoutes = require('./routes/invoices');

const app = express();
const logger = createLogger('order-service');
const PORT = process.env.PORT || 3002;
const mongoURI = process.env.MONGO_URI || 'mongodb://mongo-orders:27017/orders';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestId);
app.use((req, res, next) => { req.log = logger; next(); });

const limiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use(limiter);

setupMetrics(app, 'order_service');
setupSwagger(app, {
    title: 'Order Service API',
    version: '2.0.0',
    description: 'Order management, lifecycle, invoicing, and LinkedIn auto-posting',
    serverUrl: `http://localhost:${PORT}`,
    serviceName: 'order-service',
});

mongoose.connect(mongoURI).then(() => logger.info('MongoDB connected'))
    .catch(err => logger.error({ err }, 'MongoDB connection failed'));

const OrderSchema = new mongoose.Schema({
    orderNumber: { type: String, unique: true, index: true },
    customer: {
        customerId: { type: String, default: '' },
        name: { type: String, required: true },
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
    },
    shippingAddress: {
        line1: { type: String, default: '' },
        line2: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        zip: { type: String, default: '' },
        country: { type: String, default: 'US' },
    },
    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        productName: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: true },
    }],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    shippingCost: { type: Number, default: 0 },
    total: { type: Number, required: true },
    currency: { type: String, default: 'USD' },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
        default: 'pending',
    },
    statusHistory: [{
        status: String,
        timestamp: { type: Date, default: Date.now },
        note: String,
    }],
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded'], default: 'unpaid' },
    notes: { type: String, default: '' },
    linkedinPosted: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
OrderSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

const Order = mongoose.model('Order', OrderSchema);

app.get('/health', (req, res) => {
    sendSuccess(res, {
        service: 'order-service',
        status: 'healthy',
        uptime: process.uptime(),
        dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

app.use('/orders', orderRoutes(Order, logger));
app.use('/invoices', invoiceRoutes(Order, logger));

app.use(errorHandler);

app.listen(PORT, () => logger.info(`Order service running on port ${PORT}`));

module.exports = app;
