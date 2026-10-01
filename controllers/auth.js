const { pool, transaction } = require('../models');
const { wrap } = require('../helper/http');
const { fail } = require('../helper/money');
const bcrypt = require('bcryptjs');
const { timingSafeEqual } = require('node:crypto');
const { sign, createUser, userView } = require('../services/Auth');

exports.getSetupStatus = wrap(async (req,res) => res.json({needsSetup:!(await pool.query('SELECT id FROM users LIMIT 1')).rows.length}));

exports.setupOwner = wrap(async (req,res) => {
  const configured = process.env.SETUP_TOKEN || '';
  const supplied = String(req.body.setupToken || '');
  if (!configured || Buffer.byteLength(configured)!==Buffer.byteLength(supplied) || !timingSafeEqual(Buffer.from(configured),Buffer.from(supplied))) fail('Valid local SETUP_TOKEN required',403);
  const result = await transaction(async db => {
    await db.query('SELECT pg_advisory_xact_lock(85215251)');
    if ((await db.query('SELECT id FROM users LIMIT 1')).rows.length) fail('Setup has already completed',409);
    const owner=await createUser(db,req.body,'ADMIN');
    await db.query('UPDATE settings SET owner_id=$1 WHERE id=1',[owner.id]);
    return owner;
  });
  res.status(201).json(sign(result));
});

exports.loginUser = wrap(async (req,res) => {
  const user = (await pool.query('SELECT * FROM users WHERE email=$1 AND is_active AND id=(SELECT owner_id FROM settings WHERE id=1)',[String(req.body.email || '').trim().toLowerCase()])).rows[0];
  if (!user || typeof req.body.password !== 'string' || !(await bcrypt.compare(req.body.password,user.password))) fail('Invalid email or password',401);
  res.json(sign(user));
});

exports.checkUser = (req,res) => res.json(userView(req.user));
