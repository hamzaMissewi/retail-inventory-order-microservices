const express = require('express');
const { sendSuccess, sendError } = require('../shared/lib/response');

module.exports = function (Product, Review, logger) {
    const router = express.Router();

    /**
     * @openapi
     * /products:
     *   get:
     *     tags: [Products]
     *     summary: List products with filters
     *     parameters:
     *       - in: query
     *         name: category
     *         schema: { type: string }
     *       - in: query
     *         name: search
     *         schema: { type: string }
     *       - in: query
     *         name: minPrice
     *         schema: { type: number }
     *       - in: query
     *         name: maxPrice
     *         schema: { type: number }
     *       - in: query
     *         name: inStock
     *         schema: { type: boolean }
     *       - in: query
     *         name: page
     *         schema: { type: integer, default: 1 }
     *       - in: query
     *         name: limit
     *         schema: { type: integer, default: 20 }
     *       - in: query
     *         name: sort
     *         schema: { type: string, enum: [price, -price, name, -name, rating, -rating, createdAt, -createdAt] }
     *     responses:
     *       200:
     *         description: List of products
     */
    router.get('/', async (req, res, next) => {
        try {
            const { category, search, minPrice, maxPrice, inStock, page = 1, limit = 20, sort = '-createdAt' } = req.query;
            const filter = { isActive: true };

            if (category) filter.category = category;
            if (minPrice || maxPrice) {
                filter.price = {};
                if (minPrice) filter.price.$gte = parseFloat(minPrice);
                if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
            }
            if (inStock === 'true') filter.stock = { $gt: 0 };
            if (search) filter.$text = { $search: search };

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const sortObj = {};
            const sortField = sort.startsWith('-') ? sort.slice(1) : sort;
            sortObj[sortField] = sort.startsWith('-') ? -1 : 1;

            const [products, total] = await Promise.all([
                Product.find(filter).sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
                Product.countDocuments(filter),
            ]);

            sendSuccess(res, {
                products,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / parseInt(limit)),
                },
            });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/low-stock:
     *   get:
     *     tags: [Products]
     *     summary: Get products below low stock threshold
     *     responses:
     *       200:
     *         description: Low stock products
     */
    router.get('/low-stock', async (req, res, next) => {
        try {
            const products = await Product.find({ isActive: true, $expr: { $lte: ['$stock', '$lowStockThreshold'] } }).lean();
            sendSuccess(res, { products, count: products.length });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}:
     *   get:
     *     tags: [Products]
     *     summary: Get product by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Product details
     *       404:
     *         description: Product not found
     */
    router.get('/:id', async (req, res, next) => {
        try {
            const product = await Product.findById(req.params.id).lean();
            if (!product) return sendError(res, 'Product not found', 404);
            sendSuccess(res, product);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products:
     *   post:
     *     tags: [Products]
     *     summary: Create a new product
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, price, stock]
     *             properties:
     *               name: { type: string }
     *               price: { type: number }
     *               stock: { type: integer }
     *               category: { type: string }
     *               description: { type: string }
     *     responses:
     *       201:
     *         description: Created product
     */
    router.post('/', async (req, res, next) => {
        try {
            const product = await Product.create(req.body);
            logger.info({ productId: product._id, name: product.name }, 'Product created');
            sendSuccess(res, product, 201);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}:
     *   put:
     *     tags: [Products]
     *     summary: Update a product
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *     responses:
     *       200:
     *         description: Updated product
     */
    router.put('/:id', async (req, res, next) => {
        try {
            const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
            if (!product) return sendError(res, 'Product not found', 404);
            logger.info({ productId: product._id }, 'Product updated');
            sendSuccess(res, product);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}:
     *   delete:
     *     tags: [Products]
     *     summary: Soft-delete a product
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Product deactivated
     */
    router.delete('/:id', async (req, res, next) => {
        try {
            const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
            if (!product) return sendError(res, 'Product not found', 404);
            logger.info({ productId: product._id }, 'Product deactivated');
            sendSuccess(res, { message: 'Product deactivated' });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}/deduct:
     *   put:
     *     tags: [Products]
     *     summary: Deduct stock (called by order service)
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [quantity]
     *             properties:
     *               quantity: { type: integer }
     *     responses:
     *       200:
     *         description: Stock deducted
     *       409:
     *         description: Insufficient stock
     */
    router.put('/:id/deduct', async (req, res, next) => {
        try {
            const { quantity } = req.body;
            if (!quantity || quantity <= 0) return sendError(res, 'Quantity must be positive');
            const product = await Product.findById(req.params.id);
            if (!product) return sendError(res, 'Product not found', 404);
            if (product.stock < quantity) return sendError(res, 'Insufficient stock', 409);
            product.stock -= quantity;
            await product.save();
            logger.info({ productId: product._id, deducted: quantity, remaining: product.stock }, 'Stock deducted');
            sendSuccess(res, product);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}/restock:
     *   put:
     *     tags: [Products]
     *     summary: Add stock to a product
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [quantity]
     *             properties:
     *               quantity: { type: integer }
     *     responses:
     *       200:
     *         description: Stock updated
     */
    router.put('/:id/restock', async (req, res, next) => {
        try {
            const { quantity } = req.body;
            if (!quantity || quantity <= 0) return sendError(res, 'Quantity must be positive');
            const product = await Product.findByIdAndUpdate(
                req.params.id,
                { $inc: { stock: quantity } },
                { new: true }
            );
            if (!product) return sendError(res, 'Product not found', 404);
            logger.info({ productId: product._id, added: quantity, total: product.stock }, 'Stock restocked');
            sendSuccess(res, product);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}/reviews:
     *   get:
     *     tags: [Reviews]
     *     summary: Get reviews for a product
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: List of reviews
     */
    router.get('/:id/reviews', async (req, res, next) => {
        try {
            const reviews = await Review.find({ productId: req.params.id }).sort('-createdAt').lean();
            sendSuccess(res, reviews);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /products/{id}/reviews:
     *   post:
     *     tags: [Reviews]
     *     summary: Add a review to a product
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [rating]
     *             properties:
     *               rating: { type: integer, min: 1, max: 5 }
     *               title: { type: string }
     *               comment: { type: string }
     *               customerName: { type: string }
     *     responses:
     *       201:
     *         description: Review created
     */
    router.post('/:id/reviews', async (req, res, next) => {
        try {
            const product = await Product.findById(req.params.id);
            if (!product) return sendError(res, 'Product not found', 404);

            const review = await Review.create({
                productId: req.params.id,
                customerId: req.body.customerId || 'anonymous',
                customerName: req.body.customerName || 'Anonymous',
                rating: req.body.rating,
                title: req.body.title || '',
                comment: req.body.comment || '',
            });

            const stats = await Review.aggregate([
                { $match: { productId: product._id } },
                { $group: { _id: null, avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
            ]);

            if (stats.length > 0) {
                product.rating = Math.round(stats[0].avgRating * 10) / 10;
                product.numReviews = stats[0].count;
                await product.save();
            }

            logger.info({ productId: product._id, reviewId: review._id, rating: req.body.rating }, 'Review added');
            sendSuccess(res, review, 201);
        } catch (err) { next(err); }
    });

    return router;
};
