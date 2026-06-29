const express = require('express');
const axios = require('axios');
const { sendSuccess, sendError } = require('../shared/lib/response');

const webhooks = [];

module.exports = function (logger) {
    const router = express.Router();

    /**
     * @openapi
     * /webhooks/register:
     *   post:
     *     tags: [Webhooks]
     *     summary: Register a webhook URL
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               url: { type: string }
     *               events: { type: array, items: { type: string } }
     *     responses:
     *       201:
     *         description: Webhook registered
     */
    router.post('/register', async (req, res, next) => {
        try {
            const { url, events = ['order.created'] } = req.body;
            if (!url) return sendError(res, 'URL is required');

            const webhook = { id: webhooks.length + 1, url, events, createdAt: new Date() };
            webhooks.push(webhook);

            logger.info({ webhookId: webhook.id, url }, 'Webhook registered');
            sendSuccess(res, webhook, 201);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /webhooks/trigger:
     *   post:
     *     tags: [Webhooks]
     *     summary: Trigger a webhook event
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               event: { type: string }
     *               payload: { type: object }
     *     responses:
     *       200:
     *         description: Webhooks triggered
     */
    router.post('/trigger', async (req, res, next) => {
        try {
            const { event, payload } = req.body;
            if (!event || !payload) return sendError(res, 'event and payload are required');

            const matching = webhooks.filter(w => w.events.includes(event));
            const results = [];

            for (const webhook of matching) {
                try {
                    await axios.post(webhook.url, { event, payload, timestamp: new Date().toISOString() }, {
                        timeout: 5000,
                        headers: { 'Content-Type': 'application/json' },
                    });
                    results.push({ webhookId: webhook.id, url: webhook.url, status: 'delivered' });
                } catch (err) {
                    results.push({ webhookId: webhook.id, url: webhook.url, status: 'failed', error: err.message });
                }
            }

            logger.info({ event, delivered: results.filter(r => r.status === 'delivered').length }, 'Webhooks triggered');
            sendSuccess(res, { event, results });
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /webhooks:
     *   get:
     *     tags: [Webhooks]
     *     summary: List registered webhooks
     *     responses:
     *       200:
     *         description: List of webhooks
     */
    router.get('/', (req, res) => {
        sendSuccess(res, webhooks);
    });

    return router;
};
