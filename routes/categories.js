const router = require('express').Router();
const controller = require('../controllers/categories');

router.get('/categories', controller.getCategories);
router.post('/categories', controller.createCategory);
router.put('/categories/:id', controller.updateCategory);
router.delete('/categories/:id', controller.deleteCategory);

module.exports = router;
