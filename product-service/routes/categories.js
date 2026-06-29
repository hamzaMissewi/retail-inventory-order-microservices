const express = require('express');
const { sendSuccess } = require('../shared/lib/response');

module.exports = function (Product, logger) {
    const router = express.Router();

    /**
     * @openapi
     * /categories:
     *   get:
     *     tags: [Categories]
     *     summary: List all product categories with counts
     *     responses:
     *       200:
     *         description: Categories with product counts
     */
    router.get('/', async (req, res, next) => {
        try {
            const categories = await Product.aggregate([
                { $match: { isActive: true } },
                { $group: { _id: '$category', count: { $sum: 1 }, avgPrice: { $avg: '$price' }, totalStock: { $sum: '$stock' } } },
                { $sort: { _id: 1 } },
                { $project: { name: '$_id', count: 1, avgPrice: { $round: ['$avgPrice', 2] }, totalStock: 1, _id: 0 } },
            ]);
            sendSuccess(res, categories);
        } catch (err) { next(err); }
    });

    /**
     * @openapi
     * /categories/{name}/products:
     *   get:
     *     tags: [Categories]
     *     summary: Get products in a category
     *     parameters:
     *       - in: path
     *         name: name
     *         required: true
     *         schema: { type: string }
     *     responses:
     *       200:
     *         description: Products in category
     */
    router.get('/:name/products', async (req, res, next) => {
        try {
            const products = await Product.find({ category: req.params.name, isActive: true }).lean();
            sendSuccess(res, products);
        } catch (err) { next(err); }
    });

    return router;
};
