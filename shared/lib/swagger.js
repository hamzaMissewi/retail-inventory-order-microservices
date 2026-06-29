const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

function setupSwagger(app, options) {
    const { title, version, description, serverUrl, serviceName } = options;

    const swaggerDefinition = {
        openapi: '3.0.0',
        info: {
            title,
            version,
            description,
        },
        servers: [{ url: serverUrl || `http://localhost:${process.env.PORT || 3000}` }],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
        },
    };

    const specs = swaggerJsdoc({
        swaggerDefinition,
        apis: [`./routes/*.js`, `./server.js`],
    });

    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
        customSiteTitle: `${title} - API Docs`,
    }));

    return specs;
}

module.exports = { setupSwagger };
