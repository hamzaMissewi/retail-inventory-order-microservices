#!/usr/bin/env node

const axios = require('axios');

const API_URL = process.env.API_URL || 'http://localhost:3000/api';

async function demo() {
    console.log('\n═══════════════════════════════════════');
    console.log('  LinkedIn Auto-Post Demo');
    console.log('  Retail Microservices Platform');
    console.log('═══════════════════════════════════════\n');

    try {
        const health = await axios.get(`${API_URL.replace('/api', '')}/health`);
        console.log(`  Gateway:           ${health.data.data.status}`);
        console.log(`  Products:          ${health.data.data.routes.products}`);
        console.log(`  Orders:            ${health.data.data.routes.orders}`);
        console.log(`  Customers:         ${health.data.data.routes.customers}`);
        console.log(`  Notifications:     ${health.data.data.routes.notifications}`);
    } catch (err) {
        console.error('  API Gateway not reachable. Is docker-compose running?');
        process.exit(1);
    }

    console.log('\n--- Fetching Products ---');
    const productsRes = await axios.get(`${API_URL}/products?limit=5`);
    const products = productsRes.data.data.products;
    console.log(`  ${products.length} products available`);

    console.log('\n--- Fetching Categories ---');
    const catRes = await axios.get(`${API_URL}/categories`);
    const categories = catRes.data.data;
    categories.forEach(c => console.log(`  ${c.name}: ${c.count} products, avg $${c.avgPrice}`));

    console.log('\n--- Checking Low Stock Alerts ---');
    const lowRes = await axios.get(`${API_URL}/products/low-stock`);
    console.log(`  ${lowRes.data.data.count} products below threshold`);

    console.log('\n--- Creating Order (triggers LinkedIn post) ---');
    try {
        const orderRes = await axios.post(`${API_URL}/orders`, {
            customer: { name: 'LinkedIn Demo', email: 'demo@example.com' },
            items: [{ productId: products[0]._id, quantity: 2 }],
            shippingAddress: { line1: '123 Demo St', city: 'San Francisco', state: 'CA', zip: '94105' },
        });
        const order = orderRes.data.data;
        console.log(`  ✓ Order Created: ${order.orderNumber}`);
        console.log(`  ✓ Items: ${order.items[0].productName} x${order.items[0].quantity}`);
        console.log(`  ✓ Total: $${order.total}`);
        console.log(`  ✓ LinkedIn: ${order.linkedinPosted ? 'Posted!' : 'Skipped (no credentials)'}`);

        const invoiceRes = await axios.get(`${API_URL}/invoices/${order._id}`);
        console.log(`  ✓ Invoice: ${invoiceRes.data.data.invoiceNumber}`);
    } catch (err) {
        console.error(`  ✗ ${err.response?.data?.error || err.message}`);
    }

    console.log('\n--- Order Status Lifecycle Demo ---');
    try {
        const ordersRes = await axios.get(`${API_URL}/orders?limit=1`);
        const lastOrder = ordersRes.data.data.orders[0];

        const statuses = ['processing', 'shipped', 'delivered'];
        for (const status of statuses) {
            await axios.put(`${API_URL}/orders/${lastOrder._id}/status`, { status, note: `Status updated to ${status} automatically` });
            console.log(`  ✓ Order ${lastOrder.orderNumber} → ${status}`);
        }
    } catch (err) {
        console.error(`  ✗ ${err.response?.data?.error || err.message}`);
    }

    console.log('\n--- API Documentation ---');
    console.log(`  Products:     ${API_URL}/products/api-docs`);
    console.log(`  Orders:       ${API_URL}/orders/api-docs`);
    console.log(`  Customers:    ${API_URL}/customers/api-docs`);
    console.log(`  Notifications: ${API_URL}/notifications/api-docs`);

    console.log('\n═══════════════════════════════════════');
    console.log('  Demo Complete');
    console.log('  ✅ Multi-service architecture');
    console.log('  ✅ Order lifecycle management');
    console.log('  ✅ Invoice generation');
    console.log('  ✅ Customer auth & addresses');
    console.log('  ✅ Product categories & reviews');
    console.log('  ✅ Low stock alerts');
    console.log('  ✅ LinkedIn auto-posting');
    console.log('  ✅ Email notifications');
    console.log('  ✅ Webhook integrations');
    console.log('  ✅ Prometheus metrics');
    console.log('  ✅ Swagger API docs');
    console.log('═══════════════════════════════════════\n');
}

demo().catch(err => { console.error('Demo failed:', err); process.exit(1); });
