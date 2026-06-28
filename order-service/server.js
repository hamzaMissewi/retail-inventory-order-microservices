const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

const app = express();
app.use(express.json());

const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/orders';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true });

const OrderSchema = new mongoose.Schema({
    productId: String,
    quantity: Number,
    status: { type: String, default: 'pending' },
    createdAt: { type: Date, default: Date.now },
});
const Order = mongoose.model('Order', OrderSchema);

// Product service URL (Kubernetes service name)
const PRODUCT_SERVICE_URL =
    process.env.PRODUCT_SERVICE_URL || 'http://product-service:3001';

app.post('/orders', async (req, res) => {
    const { productId, quantity } = req.body;
    try {
        // Deduct stock from product service
        await axios.put(`${PRODUCT_SERVICE_URL}/products/${productId}/deduct`, {
            quantity,
        });
        const order = new Order({ productId, quantity, status: 'confirmed' });
        await order.save();
        res.status(201).json(order);
    } catch (error) {
        res.status(400).json({
            error: error.response?.data?.error || error.message,
        });
    }
});

app.get('/orders', async (req, res) => {
    const orders = await Order.find();
    res.json(orders);
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => console.log(`Order service running on port ${PORT}`));
