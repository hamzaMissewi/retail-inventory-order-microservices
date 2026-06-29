#!/usr/bin/env node

const axios = require('axios');

const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

const products = [
    { name: 'Wireless Mouse', description: 'Ergonomic wireless mouse with 6 programmable buttons, 2.4GHz, silent clicks', price: 29.99, category: 'Electronics', tags: ['mouse', 'wireless', 'ergonomic'], stock: 50, lowStockThreshold: 10, imageUrl: 'https://picsum.photos/seed/mouse/400/400' },
    { name: 'Mechanical Keyboard', description: 'RGB mechanical keyboard with Cherry MX Blue switches, aluminum frame', price: 89.99, category: 'Electronics', tags: ['keyboard', 'mechanical', 'rgb'], stock: 30, lowStockThreshold: 5, imageUrl: 'https://picsum.photos/seed/keyboard/400/400' },
    { name: 'USB-C Hub 7-in-1', description: 'USB-C hub with HDMI 4K, 3x USB 3.0, SD card, PD 100W charging', price: 45.99, category: 'Accessories', tags: ['hub', 'usb-c', 'adapter'], stock: 75, lowStockThreshold: 15, imageUrl: 'https://picsum.photos/seed/usbhub/400/400' },
    { name: '27" 4K Gaming Monitor', description: '27-inch 4K UHD IPS 144Hz gaming monitor, 1ms response, HDR400', price: 499.99, category: 'Electronics', tags: ['monitor', 'gaming', '4k'], stock: 15, lowStockThreshold: 5, imageUrl: 'https://picsum.photos/seed/monitor/400/400' },
    { name: 'Laptop Stand', description: 'Adjustable aluminum laptop stand, fits 10-17", ventilated design', price: 34.99, category: 'Accessories', tags: ['stand', 'laptop', 'aluminum'], stock: 100, lowStockThreshold: 20, imageUrl: 'https://picsum.photos/seed/stand/400/400' },
    { name: 'Noise Cancelling Headphones', description: 'Bluetooth 5.3 over-ear headphones, ANC, 40h battery, Hi-Res audio', price: 249.99, category: 'Audio', tags: ['headphones', 'bluetooth', 'anc'], stock: 25, lowStockThreshold: 5, imageUrl: 'https://picsum.photos/seed/headphones/400/400' },
    { name: '4K Webcam', description: '4K ultra HD webcam with AI auto-framing, built-in stereo mic', price: 79.99, category: 'Electronics', tags: ['webcam', '4k', 'video'], stock: 40, lowStockThreshold: 10, imageUrl: 'https://picsum.photos/seed/webcam/400/400' },
    { name: 'LED Desk Lamp', description: 'LED desk lamp with wireless charger, adjustable brightness 5-100%', price: 59.99, category: 'Home Office', tags: ['lamp', 'led', 'desk', 'charger'], stock: 60, lowStockThreshold: 10, imageUrl: 'https://picsum.photos/seed/lamp/400/400' },
    { name: 'Portable SSD 1TB', description: '1TB USB-C portable SSD, read 1050MB/s, write 1000MB/s, IP68', price: 109.99, category: 'Storage', tags: ['ssd', 'portable', 'storage', 'usb-c'], stock: 35, lowStockThreshold: 8, imageUrl: 'https://picsum.photos/seed/ssd/400/400' },
    { name: 'Ergonomic Office Chair', description: 'Full mesh ergonomic chair, lumbar support, adjustable armrests, 300lb capacity', price: 399.99, category: 'Furniture', tags: ['chair', 'ergonomic', 'office'], stock: 10, lowStockThreshold: 3, imageUrl: 'https://picsum.photos/seed/chair/400/400' },
];

async function waitForService(url, label, retries = 30) {
    for (let i = 0; i < retries; i++) {
        try {
            const res = await axios.get(`${url}/health`, { timeout: 2000 });
            if (res.status === 200) { console.log(`  ✓ ${label} ready`); return true; }
        } catch { }
        await new Promise(r => setTimeout(r, 1000));
    }
    console.error(`  ✗ ${label} not ready after ${retries}s`);
    return false;
}

async function seed() {
    console.log('\n═══════════════════════════════════════');
    console.log('  Retail Platform Demo Seeder');
    console.log('═══════════════════════════════════════\n');

    console.log('Waiting for services...');
    const allReady = await Promise.all([
        waitForService(`${BASE_URL}/products`, 'Product Service'),
        waitForService(`${BASE_URL}/orders`, 'Order Service'),
        waitForService(`${BASE_URL}/customers`, 'Customer Service'),
    ]);

    if (!allReady.every(Boolean)) {
        console.error('\nSome services are not available. Make sure docker-compose is running.');
        process.exit(1);
    }

    console.log('\n--- Seeding Products ---');
    const createdProducts = [];
    for (const p of products) {
        try {
            const res = await axios.post(`${BASE_URL}/products`, p);
            createdProducts.push(res.data.data);
            console.log(`  ✓ ${p.name} ($${p.price})`);
        } catch (err) {
            console.error(`  ✗ ${p.name}: ${err.response?.data?.error || err.message}`);
        }
    }

    console.log(`\n--- Registering Customer ---`);
    let customer, token;
    try {
        const regRes = await axios.post(`${BASE_URL}/auth/register`, {
            name: 'Demo User',
            email: 'demo@retail-platform.com',
            password: 'demo123456',
        });
        customer = regRes.data.data.customer;
        token = regRes.data.data.token;
        console.log(`  ✓ Registered: ${customer.name} (${customer.email})`);

        const addrRes = await axios.post(`${BASE_URL}/customers/me/addresses`,
            { label: 'Home', line1: '123 Main Street', city: 'San Francisco', state: 'CA', zip: '94105', isDefault: true },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        console.log('  ✓ Address added');
    } catch (err) {
        console.error(`  ✗ Registration: ${err.response?.data?.error || err.message}`);
        return;
    }

    console.log(`\n--- Creating Orders ---`);
    for (let i = 0; i < 3; i++) {
        const product = createdProducts[i % createdProducts.length];
        const quantity = Math.floor(Math.random() * 3) + 1;
        try {
            const orderRes = await axios.post(`${BASE_URL}/orders`, {
                customer: { customerId: customer._id, name: customer.name, email: customer.email },
                items: [{ productId: product._id, quantity }],
                shippingAddress: { line1: '123 Main Street', city: 'San Francisco', state: 'CA', zip: '94105' },
            });
            const order = orderRes.data.data;
            console.log(`  ✓ Order ${order.orderNumber}: ${product.name} x${quantity} = $${order.total}`);

            if (i === 2) {
                await axios.put(`${BASE_URL}/orders/${order._id}/status`, { status: 'shipped', note: 'Shipped via UPS' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                console.log(`  ✓ Order ${order.orderNumber} status → shipped`);
            }
        } catch (err) {
            console.error(`  ✗ Order failed: ${err.response?.data?.error || err.message}`);
        }
    }

    console.log(`\n--- Adding Reviews ---`);
    for (let i = 0; i < 4; i++) {
        try {
            const reviewRes = await axios.post(`${BASE_URL}/products/${createdProducts[i]._id}/reviews`, {
                customerId: customer._id,
                customerName: customer.name,
                rating: Math.floor(Math.random() * 2) + 4,
                title: 'Great product!',
                comment: 'Very satisfied with this purchase. Fast shipping and excellent quality.',
            });
            console.log(`  ✓ Review for ${createdProducts[i].name} (${reviewRes.data.data.rating}★)`);
        } catch (err) {
            console.error(`  ✗ Review failed: ${err.message}`);
        }
    }

    console.log(`\n--- Checking Dashboard ---`);
    try {
        const [catRes, lowRes, orderList] = await Promise.all([
            axios.get(`${BASE_URL}/categories`),
            axios.get(`${BASE_URL}/products/low-stock`),
            axios.get(`${BASE_URL}/orders`),
        ]);
        console.log(`  ✓ ${catRes.data.data.length} Categories`);
        console.log(`  ✓ ${lowRes.data.data.count} Low-stock alerts`);
        console.log(`  ✓ ${orderList.data.data.pagination.total} Orders`);

        const invoiceRes = await axios.get(`${BASE_URL}/invoices/${orderList.data.data.orders[0]._id}`);
        console.log(`  ✓ Invoice generated: ${invoiceRes.data.data.invoiceNumber}`);
    } catch (err) {
        console.error(`  ✗ Dashboard: ${err.message}`);
    }

    console.log('\n═══════════════════════════════════════');
    console.log('  Demo data seeded successfully! 🚀');
    console.log('  API Gateway:   http://localhost:3000/api');
    console.log('  API Docs:      http://localhost:3000/api'); console.log('  Customer:      demo@retail-platform.com / demo123456');
    console.log('═══════════════════════════════════════\n');
}

seed().catch(err => { console.error('Seed failed:', err); process.exit(1); });
