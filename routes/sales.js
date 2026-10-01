const router = require('express').Router();
const controller = require('../controllers/sale');

router.get('/transactions', controller.getTransactions);

for (const [endpoint, kind] of [['purchases','purchase'],['sales','sale'],['expenses','expense'],['losses','loss'],['capital','capital'],['withdrawals','withdrawal'],['reversals','reversal']]) {
  router.post('/' + endpoint, controller.record(kind));
}

module.exports = router;
