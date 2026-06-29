const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendSuccess, sendError } = require('../shared/lib/response');

function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return sendError(res, 'Authentication required', 401);
    try {
        req.user = jwt.verify(header.split(' ')[1], req.jwtSecret);
        next();
    } catch (err) {
        return sendError(res, 'Invalid or expired token', 401);
    }
}

module.exports = function (Customer, logger, JWT_SECRET) {
    const router = express.Router();

    router.use((req, res, next) => { req.jwtSecret = JWT_SECRET; next(); });

    /**
     * @openapi
     * /customers/me:
     *   get:
     *     tags: [Customers]
     *     summary: Get current customer profile
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Customer profile
     */
    router.get('/me', authenticate, async (req, res, next) => {
        try {
            const customer = await Customer.findById(req.user.id);
            if (!customer) return sendError(res, 'Customer not found', 404);
            sendSuccess(res, customer);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /customers/me:
     *   put:
     *     tags: [Customers]
     *     summary: Update customer profile
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               name: { type: string }
     *               phone: { type: string }
     *               avatarUrl: { type: string }
     *     responses:
     *       200:
     *         description: Profile updated
     */
    router.put('/me', authenticate, async (req, res, next) => {
        try {
            const { name, phone, avatarUrl } = req.body;
            const updates = {};
            if (name) updates.name = name;
            if (phone !== undefined) updates.phone = phone;
            if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

            const customer = await Customer.findByIdAndUpdate(req.user.id, updates, { new: true });
            if (!customer) return sendError(res, 'Customer not found', 404);
            logger.info({ customerId: customer._id }, 'Profile updated');
            sendSuccess(res, customer);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /customers/me/password:
     *   put:
     *     tags: [Customers]
     *     summary: Change password
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               currentPassword: { type: string }
     *               newPassword: { type: string }
     *     responses:
     *       200:
     *         description: Password changed
     */
    router.put('/me/password', authenticate, async (req, res, next) => {
        try {
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) return sendError(res, 'Current and new password required');
            if (newPassword.length < 6) return sendError(res, 'Password must be at least 6 characters');

            const customer = await Customer.findById(req.user.id);
            if (!customer) return sendError(res, 'Customer not found', 404);

            const valid = await bcrypt.compare(currentPassword, customer.password);
            if (!valid) return sendError(res, 'Current password is incorrect', 401);

            customer.password = await bcrypt.hash(newPassword, 12);
            await customer.save();
            logger.info({ customerId: customer._id }, 'Password changed');
            sendSuccess(res, { message: 'Password updated' });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /customers/me/addresses:
     *   get:
     *     tags: [Customers]
     *     summary: List addresses
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Address list
     */
    router.get('/me/addresses', authenticate, async (req, res, next) => {
        try {
            const customer = await Customer.findById(req.user.id);
            if (!customer) return sendError(res, 'Customer not found', 404);
            sendSuccess(res, customer.addresses || []);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /customers/me/addresses:
     *   post:
     *     tags: [Customers]
     *     summary: Add an address
     *     security:
     *       - bearerAuth: []
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               label: { type: string }
     *               line1: { type: string }
     *               city: { type: string }
     *               zip: { type: string }
     *               isDefault: { type: boolean }
     *     responses:
     *       200:
     *         description: Address added
     */
    router.post('/me/addresses', authenticate, async (req, res, next) => {
        try {
            const { label, line1, line2, city, state, zip, country, isDefault } = req.body;
            if (!line1 || !city || !zip) return sendError(res, 'line1, city, and zip are required');

            const customer = await Customer.findById(req.user.id);
            if (!customer) return sendError(res, 'Customer not found', 404);

            if (isDefault) {
                customer.addresses.forEach(a => a.isDefault = false);
            }

            customer.addresses.push({
                label: label || 'Home',
                line1, line2: line2 || '', city, state: state || '', zip, country: country || 'US',
                isDefault: isDefault || customer.addresses.length === 0,
            });
            await customer.save();
            logger.info({ customerId: customer._id }, 'Address added');
            sendSuccess(res, customer.addresses, 201);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /customers/me/addresses/{addressId}:
     *   delete:
     *     tags: [Customers]
     *     summary: Delete an address
     *     security:
     *       - bearerAuth: []
     *     parameters:
     *       - in: path
     *         name: addressId
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Address deleted
     */
    router.delete('/me/addresses/:addressId', authenticate, async (req, res, next) => {
        try {
            const customer = await Customer.findById(req.user.id);
            if (!customer) return sendError(res, 'Customer not found', 404);

            customer.addresses = customer.addresses.filter(a => a._id.toString() !== req.params.addressId);
            await customer.save();
            sendSuccess(res, customer.addresses);
        } catch (err) { next(err); }
    });

    return router;
};
