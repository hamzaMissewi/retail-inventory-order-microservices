const express = require('express');
const axios = require('axios');
const { sendSuccess, sendError } = require('../shared/lib/response');

const LINKEDIN_POST_API = 'https://api.linkedin.com/rest/posts';
const LINKEDIN_ME_API = 'https://api.linkedin.com/v2/me';

function getConfig() {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const personId = process.env.LINKEDIN_PERSON_ID;
    if (!token || !personId) return null;
    return { token, personId };
}

module.exports = function (logger) {
    const router = express.Router();

    /**
     * @openapi
     * /linkedin/post:
     *   post:
     *     tags: [LinkedIn]
     *     summary: Post to LinkedIn
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               text: { type: string }
     *               visibility: { type: string, enum: [PUBLIC, CONNECTIONS], default: PUBLIC }
     *     responses:
     *       200:
     *         description: Posted successfully
     */
    router.post('/post', async (req, res, next) => {
        try {
            const config = getConfig();
            if (!config) return sendError(res, 'LinkedIn not configured. Set LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_ID', 503);

            const { text, visibility = 'PUBLIC' } = req.body;
            if (!text) return sendError(res, 'Text is required');

            const body = {
                author: `urn:li:person:${config.personId}`,
                commentary: text,
                visibility,
                distribution: {
                    feedDistribution: 'MAIN_FEED',
                    targetEntities: [],
                    thirdPartyDistributionChannels: [],
                },
                lifecycleState: 'PUBLISHED',
                isReshareDisabledByAuthor: false,
            };

            const response = await axios.post(LINKEDIN_POST_API, body, {
                headers: {
                    'Authorization': `Bearer ${config.token}`,
                    'Content-Type': 'application/json',
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202304',
                },
            });

            logger.info({ status: response.status }, 'LinkedIn post created');
            sendSuccess(res, { status: response.status, message: 'Posted to LinkedIn' });
        } catch (err) {
            const detail = err.response?.data?.message || err.message;
            logger.error({ err: detail }, 'LinkedIn post failed');
            if (err.response?.status === 401) {
                return sendError(res, 'LinkedIn token expired or invalid. Generate a new one.', 401);
            }
            sendError(res, `LinkedIn post failed: ${detail}`, 502);
        }
    });

    /**
     * @openapi
     * /linkedin/status:
     *   get:
     *     tags: [LinkedIn]
     *     summary: Check LinkedIn API status
     *     responses:
     *       200:
     *         description: LinkedIn status
     */
    router.get('/status', async (req, res, next) => {
        try {
            const config = getConfig();
            if (!config) {
                return sendSuccess(res, { configured: false, message: 'LinkedIn not configured' });
            }

            const response = await axios.get(LINKEDIN_ME_API, {
                headers: { 'Authorization': `Bearer ${config.token}` },
            });

            sendSuccess(res, {
                configured: true,
                linkedinUser: response.data,
                message: 'LinkedIn API is accessible',
            });
        } catch (err) {
            sendSuccess(res, {
                configured: true,
                accessible: false,
                message: 'Token may be invalid or expired',
            });
        }
    });

    return router;
};
