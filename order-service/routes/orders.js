const express = require('express');
const axios = require('axios');
const { sendSuccess, sendError } = require('../shared/lib/response');
const { postToLinkedIn } = require('../linkedinService');

const PRODUCT_SERVICE_URL = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';

function generateOrderNumber() {
    const date = new Date();
    const ts = date.getFullYear().toString().slice(-2) +
        (date.getMonth() + 1).toString().padStart(2, '0') +
        date.getDate().toString().padStart(2, '0');
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${ts}-${rand}`;
}

module.exports = function (Order, logger) {
    const router = express.Router();

    /**
     * @openapi
     * /orders:
     *   post:
     *     tags: [Orders]
     *     summary: Create a new order
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [items, customer]
     *             properties:
     *               items:
     *                 type: array
     *                 items:
     *                   type: object
     *                   properties:
     *                     productId: { type: string }
     *                     quantity: { type: integer }
     *               customer:
     *                 type: object
     *                 properties:
     *                   name: { type: string }
     *                   email: { type: string }
     *     responses:
     *       201:
     *         description: Order created
     */
    router.post('/', async (req, res, next) => {
        try {
            const { items, customer, shippingAddress, notes } = req.body;
            if (!items || !items.length) return sendError(res, 'At least one item is required');
            if (!customer || !customer.name) return sendError(res, 'Customer name is required');

            const orderItems = [];
            let subtotal = 0;

            for (const item of items) {
                const prodRes = await axios.get(`${PRODUCT_SERVICE_URL}/products/${item.productId}`);
                const product = prodRes.data.data || prodRes.data;
                const productData = product.data || product;

                await axios.put(`${PRODUCT_SERVICE_URL}/products/${item.productId}/deduct`, { quantity: item.quantity });

                const lineTotal = productData.price * item.quantity;
                orderItems.push({
                    productId: item.productId,
                    productName: productData.name,
                    price: productData.price,
                    quantity: item.quantity,
                });
                subtotal += lineTotal;
            }

            const tax = Math.round(subtotal * 0.08 * 100) / 100;
            const shippingCost = subtotal > 100 ? 0 : 9.99;
            const total = Math.round((subtotal + tax + shippingCost) * 100) / 100;

            const order = await Order.create({
                orderNumber: generateOrderNumber(),
                customer,
                shippingAddress: shippingAddress || {},
                items: orderItems,
                subtotal: Math.round(subtotal * 100) / 100,
                tax,
                shippingCost,
                total,
                status: 'confirmed',
                statusHistory: [{ status: 'confirmed', note: 'Order placed and stock deducted' }],
                notes: notes || '',
            });

            postToLinkedIn(order);

            logger.info({ orderNumber: order.orderNumber, total: order.total, items: orderItems.length }, 'Order created');
            sendSuccess(res, order, 201);
        } catch (err) {
            if (err.response?.status === 409) return sendError(res, 'Insufficient stock for one or more items', 409);
            if (err.response?.status === 404) return sendError(res, 'Product not found', 404);
            next(err);
        }
    });

    /**
     * @openapi
     * /orders:
     *   get:
     *     tags: [Orders]
     *     summary: List orders with filters
     *     parameters:
     *       - in: query
     *         name: status
     *         schema: { type: string }
     *       - in: query
     *         name: customerId
     *         schema: { type: string }
     *       - in: query
     *         name: page
     *         schema: { type: integer }
     *       - in: query
     *         name: limit
     *         schema: { type: integer }
     *     responses:
     *       200:
     *         description: List of orders
     */
    router.get('/', async (req, res, next) => {
        try {
            const { status, customerId, page = 1, limit = 20 } = req.query;
            const filter = {};
            if (status) filter.status = status;
            if (customerId) filter['customer.customerId'] = customerId;

            const skip = (parseInt(page) - 1) * parseInt(limit);
            const [orders, total] = await Promise.all([
                Order.find(filter).sort('-createdAt').skip(skip).limit(parseInt(limit)).lean(),
                Order.countDocuments(filter),
            ]);

            sendSuccess(res, {
                orders,
                pagination: { page: parseInt(page), limit: parseInt(limit), total, pages: Math.ceil(total / parseInt(limit)) },
            });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /orders/{id}:
     *   get:
     *     tags: [Orders]
     *     summary: Get order by ID
     *     parameters:
     *       - in: path
     *         name: id
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Order details
     */
    router.get('/:id', async (req, res, next) => {
        try {
            const order = await Order.findById(req.params.id).lean();
            if (!order) return sendError(res, 'Order not found', 404);
            sendSuccess(res, order);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /orders/{id}/status:
     *   put:
     *     tags: [Orders]
     *     summary: Update order status
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
     *             properties:
     *               status: { type: string, enum: [confirmed, processing, shipped, delivered, cancelled, refunded] }
     *               note: { type: string }
     *     responses:
     *       200:
     *         description: Status updated
     */
    router.put('/:id/status', async (req, res, next) => {
        try {
            const { status, note } = req.body;
            const validTransitions = {
                pending: ['confirmed', 'cancelled'],
                confirmed: ['processing', 'cancelled'],
                processing: ['shipped', 'cancelled'],
                shipped: ['delivered'],
                delivered: ['refunded'],
                cancelled: [],
                refunded: [],
            };

            const order = await Order.findById(req.params.id);
            if (!order) return sendError(res, 'Order not found', 404);

            if (!validTransitions[order.status]?.includes(status)) {
                return sendError(res, `Cannot transition from ${order.status} to ${status}`, 400);
            }

            order.status = status;
            order.statusHistory.push({ status, note: note || `Status changed to ${status}`, timestamp: new Date() });
            await order.save();

            logger.info({ orderNumber: order.orderNumber, status }, 'Order status updated');
            sendSuccess(res, order);
        } catch (err) { next(err); }
    });

    return router;
};
