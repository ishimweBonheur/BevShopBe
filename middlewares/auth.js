const jwt = require('jsonwebtoken');
const { pool } = require('../models');
const { uuid } = require('../services/accounting');
const { fail } = require('../helper/money');
const { wrap } = require('../helper/http');
const authenticate = wrap(async (req,res,next) => {
  const token = (req.get('Authorization') || '').replace(/^Bearer /,'');
  let decoded;
  try { decoded = jwt.verify(token,process.env.JWT_SECRET); } catch { fail('Please sign in',401); }
  const user = (await pool.query('SELECT * FROM users WHERE id=$1 AND is_active AND id=(SELECT owner_id FROM settings WHERE id=1)',[uuid(decoded.id)])).rows[0];
  if (!user || (decoded.version || 0)!==user.token_version) fail('Please sign in',401);
  req.user=user; next();
});
module.exports = { authenticate };
