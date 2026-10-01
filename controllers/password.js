const {randomBytes,createHash}=require('node:crypto');
const bcrypt=require('bcryptjs');
const {transaction}=require('../models');
const {wrap}=require('../helper/http');
const {fail}=require('../helper/money');
function validate(password){if(typeof password!=='string'||password.length<10||Buffer.byteLength(password)>72)fail('Password must have at least 10 characters and at most 72 bytes');}
const attempts=new Map();
exports.limit=(req,res,next)=>{
  const now=Date.now();for(const [key,a] of attempts)if(a.until<now)attempts.delete(key);
  const key=req.ip;const a=attempts.get(key)||{count:0,until:now+900000};
  if(attempts.size>=1000&&!attempts.has(key))return res.status(429).json({error:'Please try again later'});
  attempts.set(key,a);if(++a.count>10)return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});next();
};
exports.change=wrap(async(req,res)=>{
  validate(req.body.newPassword);
  await transaction(async db=>{
    const user=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
    if(typeof req.body.currentPassword!=='string'||!await bcrypt.compare(req.body.currentPassword,user.password))fail('Current password is incorrect',400);
    await db.query('UPDATE users SET password=$2,token_version=token_version+1 WHERE id=$1',[user.id,await bcrypt.hash(req.body.newPassword,12)]);
  });res.json({success:true,message:'Password changed. Sign in again on all devices.'});
});
exports.generate=wrap(async(req,res)=>{
  const code=randomBytes(32).toString('hex');
  await transaction(async db=>{
    const user=(await db.query('SELECT * FROM users WHERE id=$1 FOR UPDATE',[req.user.id])).rows[0];
    if(typeof req.body.currentPassword!=='string'||!await bcrypt.compare(req.body.currentPassword,user.password))fail('Current password is incorrect',400);
    await db.query('DELETE FROM recovery_codes WHERE user_id=$1',[user.id]);
    await db.query('INSERT INTO recovery_codes(hash,user_id) VALUES($1,$2)',[createHash('sha256').update(code).digest('hex'),user.id]);
  });res.set('Cache-Control','no-store').json({recoveryCode:code});
});
exports.recover=wrap(async(req,res)=>{
  validate(req.body.newPassword);
  const hash=createHash('sha256').update(String(req.body.recoveryCode||'')).digest('hex');
  await transaction(async db=>{
    const user=(await db.query('SELECT u.* FROM users u JOIN settings s ON s.owner_id=u.id WHERE lower(u.email)=$1 FOR UPDATE OF u',[String(req.body.email||'').trim().toLowerCase()])).rows[0];
    if(!user || !(await db.query('DELETE FROM recovery_codes WHERE hash=$1 AND user_id=$2 RETURNING hash',[hash,user.id])).rows.length)fail('Invalid email or recovery code',400);
    await db.query('UPDATE users SET password=$2,token_version=token_version+1 WHERE id=$1',[user.id,await bcrypt.hash(req.body.newPassword,12)]);
  });res.json({success:true,message:'Password reset. Sign in and create a new recovery code.'});
});
