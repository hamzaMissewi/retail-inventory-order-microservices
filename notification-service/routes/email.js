const express = require('express');
const nodemailer = require('nodemailer');
const { sendSuccess, sendError } = require('../shared/lib/response');

function createTransport() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) return null;

    return nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
    });
}

module.exports = function (logger) {
    const router = express.Router();

    /**
     * @openapi
     * /email/send:
     *   post:
     *     tags: [Email]
     *     summary: Send an email
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               to: { type: string }
     *               subject: { type: string }
     *               text: { type: string }
     *               html: { type: string }
     *     responses:
     *       200:
     *         description: Email sent
     */
    router.post('/send', async (req, res, next) => {
        try {
            const transporter = createTransport();
            if (!transporter) {
                return sendError(res, 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS', 503);
            }

            const { to, subject, text, html } = req.body;
            if (!to || !subject || (!text && !html)) {
                return sendError(res, 'to, subject, and text/html are required');
            }

            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to,
                subject,
                text: text || '',
                html: html || '',
            });

            logger.info({ messageId: info.messageId, to }, 'Email sent');
            sendSuccess(res, { messageId: info.messageId, message: 'Email sent' });
        } catch (err) {
            logger.error({ err: err.message }, 'Email send failed');
            sendError(res, `Failed to send email: ${err.message}`, 502);
        }
    });

    /**
     * @openapi
     * /email/order-confirmation:
     *   post:
     *     tags: [Email]
     *     summary: Send order confirmation email
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               to: { type: string }
     *               customerName: { type: string }
     *               orderNumber: { type: string }
     *               items: { type: array }
     *               total: { type: number }
     *     responses:
     *       200:
     *         description: Order confirmation sent
     */
    router.post('/order-confirmation', async (req, res, next) => {
        try {
            const transporter = createTransport();
            if (!transporter) {
                return sendError(res, 'SMTP not configured', 503);
            }

            const { to, customerName, orderNumber, items, total } = req.body;
            if (!to || !customerName || !orderNumber) {
                return sendError(res, 'to, customerName, and orderNumber are required');
            }

            const itemsHtml = (items || []).map(i =>
                `<tr><td>${i.productName || i.name}</td><td>x${i.quantity}</td><td>$${((i.price || 0) * i.quantity).toFixed(2)}</td></tr>`
            ).join('');

            const html = `
<h2>Order Confirmed!</h2>
<p>Hi <strong>${customerName}</strong>,</p>
<p>Your order <strong>${orderNumber}</strong> has been confirmed.</p>
<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;max-width:500px">
<tr style="background:#f5f5f5"><th>Item</th><th>Qty</th><th>Total</th></tr>
${itemsHtml}
<tr><td colspan="2"><strong>Total</strong></td><td><strong>$${(total || 0).toFixed(2)}</strong></td></tr>
</table>
<p>Thank you for your purchase!</p>
<hr><small>Retail Platform - Microservices on Kubernetes</small>`;

            const info = await transporter.sendMail({
                from: process.env.SMTP_FROM || process.env.SMTP_USER,
                to,
                subject: `Order Confirmed - ${orderNumber}`,
                text: `Order ${orderNumber} confirmed. Total: $${(total || 0).toFixed(2)}`,
                html,
            });

            logger.info({ messageId: info.messageId, orderNumber, to }, 'Order confirmation email sent');
            sendSuccess(res, { messageId: info.messageId, message: 'Order confirmation sent' });
        } catch (err) {
            logger.error({ err: err.message }, 'Order confirmation email failed');
            sendError(res, `Failed to send: ${err.message}`, 502);
        }
    });

    return router;
};
