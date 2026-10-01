const router = require('express').Router();
const controller = require('../controllers/products');

router.get('/products', controller.getProducts);
router.post('/products', controller.createProduct);
router.put('/products/:id', controller.updateProduct);
router.delete('/products/:id', controller.deleteProduct);

module.exports = router;
