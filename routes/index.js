const router = require('express').Router();
const { pool } = require('../models');
const { wrap } = require('../helper/http');
const { authenticate } = require('../middlewares/auth');
router.get('/health', wrap(async (req, res) => {
  await pool.query('SELECT 1 FROM settings LIMIT 1');
  res.json({ status: 'ok', database: 'postgresql' });
}));
router.use(require('./auth'));
router.use(authenticate);
for (const route of ['settings', 'categories', 'products', 'sales', 'reports', 'suppliers','reconciliation','backup']) router.use(require('./' + route));
module.exports = router;
