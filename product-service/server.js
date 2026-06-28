const express = require('express');
const mongoose = require('mongoose');

const app = express();
app.use(express.json());

const mongoURI =
    process.env.MONGO_URI || 'mongodb://mongo-products:27017/products';

mongoose
    .connect(mongoURI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => console.log('✅ Product DB connected'))
    .catch((err) => console.error('❌ DB error:', err));

// ----- Schema -----
const ProductSchema = new mongoose.Schema({
    name: { type: String, required: true },
    price: { type: Number, required: true },
    stock: { type: Number, required: true, min: 0 },
});
const Product = mongoose.model('Product', ProductSchema);

// ----- Auto‑seed if empty (for out‑of‑the‑box testing) -----
(async function seedDatabase() {
    const count = await Product.countDocuments();
    if (count === 0) {
        console.log('🌱 Seeding sample products...');
        await Product.insertMany([
            { name: 'Wireless Mouse', price: 29.99, stock: 50 },
            { name: 'Mechanical Keyboard', price: 89.99, stock: 30 },
            { name: 'USB-C Cable', price: 12.49, stock: 100 },
        ]);
        console.log('✅ Sample products seeded.');
    }
})();

// ----- Routes -----
app.get('/health', (req, res) => res.send('OK'));

app.get('/products', async (req, res) => {
    const products = await Product.find();
    res.json(products);
});

app.get('/products/:id', async (req, res) => {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Not found' });
    res.json(product);
});

// Deduct stock (called by order service)
app.put('/products/:id/deduct', async (req, res) => {
    const { quantity } = req.body;
    if (!quantity || quantity <= 0) {
        return res.status(400).json({ error: 'Quantity must be positive' });
    }
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) {
        return res.status(409).json({ error: 'Insufficient stock' });
    }
    product.stock -= quantity;
    await product.save();
    res.json(product);
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Product service on port ${PORT}`));
