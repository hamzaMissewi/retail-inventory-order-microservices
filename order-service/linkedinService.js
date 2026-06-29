const axios = require('axios');

const LINKEDIN_POST_API = 'https://api.linkedin.com/rest/posts';

function getConfig() {
    const token = process.env.LINKEDIN_ACCESS_TOKEN;
    const personId = process.env.LINKEDIN_PERSON_ID;
    if (!token || !personId) return null;
    return { token, personId };
}

function buildPostMessage(order) {
    const date = new Date(order.createdAt).toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric',
    });

    const itemsList = order.items.map(i => `  • ${i.productName} x${i.quantity} — $${(i.price * i.quantity).toFixed(2)}`).join('\n');

    return [
        `🛒 **New Order Confirmed — #${order.orderNumber}**`,
        ``,
        `**Customer:** ${order.customer.name}`,
        `**Items:**`,
        itemsList,
        `**Total:** $${order.total.toFixed(2)} (incl. tax & shipping)`,
        `**Status:** ${order.status.toUpperCase()}`,
        `**Date:** ${date}`,
        ``,
        `This order was processed in real-time by our microservices platform running on Kubernetes.`,
        ``,
        `Built with #NodeJS #Express #MongoDB #Docker #Kubernetes #Microservices`,
    ].join('\n');
}

async function postToLinkedIn(order) {
    const config = getConfig();
    if (!config) {
        console.log('[LinkedIn] Skipping post - credentials not configured');
        return null;
    }

    const text = buildPostMessage(order);

    const body = {
        author: `urn:li:person:${config.personId}`,
        commentary: text,
        visibility: 'PUBLIC',
        distribution: {
            feedDistribution: 'MAIN_FEED',
            targetEntities: [],
            thirdPartyDistributionChannels: [],
        },
        lifecycleState: 'PUBLISHED',
        isReshareDisabledByAuthor: false,
    };

    try {
        const res = await axios.post(LINKEDIN_POST_API, body, {
            headers: {
                'Authorization': `Bearer ${config.token}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
                'LinkedIn-Version': '202304',
            },
        });
        console.log(`[LinkedIn] Post created: ${res.status}`);
        return res.data;
    } catch (err) {
        const detail = err.response?.data?.message || err.message;
        console.error(`[LinkedIn] Failed to post: ${detail}`);
        if (err.response?.status === 401) {
            console.error('[LinkedIn] Token expired or invalid. Generate a new one at https://www.linkedin.com/developers/');
        }
        return null;
    }
}

module.exports = { postToLinkedIn };
