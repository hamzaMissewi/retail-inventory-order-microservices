const express = require('express');
const { sendSuccess, sendError } = require('../shared/lib/response');

module.exports = function (Order, logger) {
    const router = express.Router();

    /**
     * @openapi
     * /invoices/{orderId}:
     *   get:
     *     tags: [Invoices]
     *     summary: Generate invoice for an order
     *     parameters:
     *       - in: path
     *         name: orderId
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Invoice data
     */
    router.get('/:orderId', async (req, res, next) => {
        try {
            const order = await Order.findById(req.params.orderId).lean();
            if (!order) return sendError(res, 'Order not found', 404);

            const invoice = {
                invoiceNumber: `INV-${order.orderNumber}`,
                orderNumber: order.orderNumber,
                date: order.createdAt,
                customer: order.customer,
                shippingAddress: order.shippingAddress,
                items: order.items,
                subtotal: order.subtotal,
                tax: order.tax,
                shippingCost: order.shippingCost,
                total: order.total,
                currency: order.currency,
                status: order.status,
                paymentStatus: order.paymentStatus,
                notes: order.notes,
            };

            logger.info({ invoiceNumber: invoice.invoiceNumber, orderNumber: order.orderNumber }, 'Invoice generated');
            sendSuccess(res, invoice);
        } catch (err) { next(err); }
    });

    return router;
};
