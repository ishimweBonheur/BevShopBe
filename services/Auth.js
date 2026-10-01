const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('node:crypto');
const { fail } = require('../helper/money');
const { text } = require('../helper/http');
const userView = u => ({ _id:u.id,id:u.id,email:u.email,username:u.username,firstName:u.first_name,lastName:u.last_name,phone:u.phone,is_active:u.is_active,createdAt:u.created_at,updatedAt:u.created_at });
const sign = u => ({ user:userView(u),token:jwt.sign({id:u.id,version:u.token_version || 0},process.env.JWT_SECRET,{expiresIn:'12h'}) });
async function createUser(db, body, role) {
  const email = text(body.email,'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Invalid email');
  if (typeof body.password !== 'string' || body.password.length<10 || Buffer.byteLength(body.password)>72) fail('Password must have at least 10 characters and at most 72 bytes');
  const password = await bcrypt.hash(body.password,12);
  return (await db.query(`INSERT INTO users(id,email,username,password,first_name,last_name,phone,role)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [randomUUID(),email,text(body.username || email,'Username'),password,text(body.firstName,'First name'),text(body.lastName,'Last name'),String(body.phone || ''),role])).rows[0];
}

module.exports = { userView, sign, createUser };
