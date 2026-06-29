const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendSuccess, sendError } = require('../shared/lib/response');

module.exports = function (Customer, logger, JWT_SECRET) {
    const router = express.Router();

    /**
     * @openapi
     * /auth/register:
     *   post:
     *     tags: [Auth]
     *     summary: Register a new customer
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required: [name, email, password]
     *             properties:
     *               name: { type: string }
     *               email: { type: string }
     *               password: { type: string, minLength: 6 }
     *     responses:
     *       201:
     *         description: Customer registered
     */
    router.post('/register', async (req, res, next) => {
        try {
            const { name, email, password } = req.body;
            if (!name || !email || !password) return sendError(res, 'Name, email, and password are required');
            if (password.length < 6) return sendError(res, 'Password must be at least 6 characters');

            const existing = await Customer.findOne({ email: email.toLowerCase() });
            if (existing) return sendError(res, 'Email already registered', 409);

            const hashedPassword = await bcrypt.hash(password, 12);
            const customer = await Customer.create({ name, email: email.toLowerCase(), password: hashedPassword });

            const token = jwt.sign({ id: customer._id, email: customer.email, name: customer.name }, JWT_SECRET, { expiresIn: '7d' });

            logger.info({ customerId: customer._id, email: customer.email }, 'Customer registered');
            sendSuccess(res, { customer, token }, 201);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /auth/login:
     *   post:
     *     tags: [Auth]
     *     summary: Login
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               email: { type: string }
     *               password: { type: string }
     *     responses:
     *       200:
     *         description: Login successful
     */
    router.post('/login', async (req, res, next) => {
        try {
            const { email, password } = req.body;
            if (!email || !password) return sendError(res, 'Email and password are required');

            const customer = await Customer.findOne({ email: email.toLowerCase() });
            if (!customer) return sendError(res, 'Invalid credentials', 401);

            const valid = await bcrypt.compare(password, customer.password);
            if (!valid) return sendError(res, 'Invalid credentials', 401);

            const token = jwt.sign({ id: customer._id, email: customer.email, name: customer.name }, JWT_SECRET, { expiresIn: '7d' });

            logger.info({ customerId: customer._id }, 'Customer logged in');
            sendSuccess(res, { customer, token });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /auth/verify:
     *   get:
     *     tags: [Auth]
     *     summary: Verify a token
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Token is valid
     */
    router.get('/verify', async (req, res, next) => {
        try {
            const header = req.headers.authorization;
            if (!header || !header.startsWith('Bearer ')) return sendError(res, 'No token provided', 401);

            const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
            const customer = await Customer.findById(decoded.id);
            if (!customer) return sendError(res, 'Customer not found', 404);

            sendSuccess(res, { customer, valid: true });
        } catch (err) {
            if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
                return sendError(res, 'Invalid or expired token', 401);
            }
            next(err);
        }
    });

    return router;
};
