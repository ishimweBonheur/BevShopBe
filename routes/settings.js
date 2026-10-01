const router = require('express').Router();
const controller = require('../controllers/settings');

router.get('/settings', controller.getSettings);

module.exports = router;
