const router = require('express').Router();
const controller = require('../controllers/reports');

router.get('/reports/summary', controller.getSummary);

module.exports = router;
