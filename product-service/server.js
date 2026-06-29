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

const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');

const app = express();
const logger = createLogger('product-service');
const PORT = process.env.PORT || 3001;
const mongoURI = process.env.MONGO_URI || 'mongodb://mongo-products:27017/products';

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestId);
app.use((req, res, next) => { req.log = logger; next(); });

const limiter = rateLimit({ windowMs: 60 * 1000, max: 200, message: { success: false, error: 'Too many requests' } });
app.use(limiter);

setupMetrics(app, 'product_service');
setupSwagger(app, {
    title: 'Product Service API',
    version: '2.0.0',
    description: 'Product catalog, inventory management, categories, and reviews',
    serverUrl: `http://localhost:${PORT}`,
    serviceName: 'product-service',
});

mongoose.connect(mongoURI).then(() => logger.info('MongoDB connected'))
    .catch(err => logger.error({ err }, 'MongoDB connection failed'));

const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true, index: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    category: { type: String, index: true, default: 'Uncategorized' },
    tags: [{ type: String }],
    imageUrl: { type: String, default: '' },
    stock: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, default: 10 },
    rating: { type: Number, default: 0, min: 0, max: 5 },
    numReviews: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});
ProductSchema.index({ name: 'text', description: 'text', tags: 'text' });
ProductSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

const Product = mongoose.model('Product', ProductSchema);

const ReviewSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, default: 'Anonymous' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, default: '' },
    comment: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});
const Review = mongoose.model('Review', ReviewSchema);

async function seedDatabase() {
    const count = await Product.countDocuments();
    if (count === 0) {
        logger.info('Seeding sample products...');
        const products = await Product.insertMany([
            { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with 6 buttons', price: 29.99, category: 'Electronics', tags: ['mouse', 'wireless', 'ergonomic'], stock: 50, lowStockThreshold: 10, imageUrl: 'https://picsum.photos/seed/mouse/400/400' },
            { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with blue switches', price: 89.99, category: 'Electronics', tags: ['keyboard', 'mechanical', 'rgb'], stock: 30, lowStockThreshold: 5, imageUrl: 'https://picsum.photos/seed/keyboard/400/400' },
            { name: 'USB-C Cable', description: 'Fast charging USB-C to USB-C cable, 2m', price: 12.49, category: 'Accessories', tags: ['cable', 'usb-c', 'charging'], stock: 100, lowStockThreshold: 20, imageUrl: 'https://picsum.photos/seed/usbc/400/400' },
            { name: 'Gaming Monitor', description: '27-inch 4K 144Hz gaming monitor', price: 499.99, category: 'Electronics', tags: ['monitor', 'gaming', '4k'], stock: 15, lowStockThreshold: 5, imageUrl: 'https://picsum.photos/seed/monitor/400/400' },
            { name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand', price: 34.99, category: 'Accessories', tags: ['stand', 'laptop', 'aluminum'], stock: 75, lowStockThreshold: 15, imageUrl: 'https://picsum.photos/seed/stand/400/400' },
            { name: 'Noise Cancelling Headphones', description: 'Bluetooth over-ear headphones with ANC', price: 249.99, category: 'Audio', tags: ['headphones', 'bluetooth', 'anc'], stock: 25, lowStockThreshold: 5, imageUrl: 'https://picsum.photos/seed/headphones/400/400' },
            { name: 'Webcam 4K', description: '4K ultra HD webcam with built-in microphone', price: 79.99, category: 'Electronics', tags: ['webcam', '4k', 'video'], stock: 40, lowStockThreshold: 10, imageUrl: 'https://picsum.photos/seed/webcam/400/400' },
            { name: 'Desk Lamp', description: 'LED desk lamp with adjustable brightness', price: 45.99, category: 'Home Office', tags: ['lamp', 'led', 'desk'], stock: 60, lowStockThreshold: 10, imageUrl: 'https://picsum.photos/seed/lamp/400/400' },
        ]);
        logger.info({ count: products.length }, 'Sample products seeded');
    }
}

app.get('/health', (req, res) => {
    sendSuccess(res, {
        service: 'product-service',
        status: 'healthy',
        uptime: process.uptime(),
        dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    });
});

app.use('/products', productRoutes(Product, Review, logger));
app.use('/categories', categoryRoutes(Product, logger));

app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`Product service running on port ${PORT}`);
    seedDatabase();
});

module.exports = app;
