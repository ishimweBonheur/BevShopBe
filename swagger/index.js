const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: { title: 'Demostock API', version: '1.0.0', description: 'Demostock API' },
    servers: [{ url: '/' }], // Overridden per-request in app.js for same-origin
  },
  apis: ['./routes/*.js'],
};

const specs = swaggerJsdoc(options);

module.exports = { swaggerUi, specs };
