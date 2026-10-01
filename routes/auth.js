const router = require('express').Router();
const controller = require('../controllers/auth');
const { authenticate } = require('../middlewares/auth');

router.get('/auth/setup-status', controller.getSetupStatus);
router.post('/auth/setup', controller.setupOwner);
router.post('/auth/login', controller.loginUser);
router.get('/auth/check', authenticate, controller.checkUser);
const password=require('../controllers/password');
router.post('/auth/password',authenticate,password.limit,password.change);
router.post('/auth/recovery-code',authenticate,password.limit,password.generate);
router.post('/auth/recover',password.limit,password.recover);

module.exports = router;
