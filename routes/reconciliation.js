const router=require('express').Router();
const {pool,transaction}=require('../models');
const {wrap}=require('../helper/http');
const {Decimal,money,fail}=require('../helper/money');
const {randomUUID,createHash}=require('node:crypto');
const {uuid}=require('../services/accounting');
async function preview(db,date) {
  const today=(await db.query("SELECT to_char(now() AT TIME ZONE 'Africa/Kigali','YYYY-MM-DD') AS day")).rows[0].day;
  date=date || today;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10)!==date || date>today) fail('Choose today or a valid past date');
  const {cutoff}=(await db.query("SELECT LEAST(clock_timestamp(),(($1::date+1)::timestamp AT TIME ZONE 'Africa/Kigali')) AS cutoff",[date])).rows[0];
  const rows=(await db.query('SELECT j.account,sum(j.debit-j.credit) AS balance FROM journal_lines j JOIN transactions t ON t.id=j.transaction_id WHERE t.created_at<$1 AND j.account IN (\'cash\',\'mobile_money\') GROUP BY j.account',[cutoff])).rows;
  return {date,cutoff,expectedCash:rows.find(r=>r.account==='cash')?.balance || '0',expectedMobile:rows.find(r=>r.account==='mobile_money')?.balance || '0'};
}
router.get('/reconciliations/preview',wrap(async(req,res)=>res.json(await transaction(db=>preview(db,req.query.date)))));
router.get('/reconciliations',wrap(async(req,res)=>res.json((await pool.query('SELECT *,actual_cash-expected_cash AS cash_difference,actual_mobile-expected_mobile AS mobile_difference FROM cash_reconciliations ORDER BY created_at DESC LIMIT 365')).rows)));
router.post('/reconciliations',wrap(async(req,res)=>{
  const b=req.body;const key=uuid(b.requestKey);const hash=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
  const result=await transaction(async db=>{
    await db.query('SELECT pg_advisory_xact_lock(85215250)');
    const old=(await db.query('SELECT * FROM cash_reconciliations WHERE request_key=$1',[key])).rows[0];
    if(old){if(old.request_hash!==hash)fail('Request key already used',409);return old;}
    const p=await preview(db,b.date);const cash=money(b.actualCash,'Actual cash'),mobile=money(b.actualMobile,'Actual Mobile Money');
    if(String(b.expectedCash)!==String(p.expectedCash)||String(b.expectedMobile)!==String(p.expectedMobile))fail('Recorded balances changed. Refresh the comparison before saving.',409);
    const notes=String(b.notes||'').trim();
    if((!cash.eq(new Decimal(p.expectedCash)) || !mobile.eq(new Decimal(p.expectedMobile))) && !notes)fail('Explain the balance difference');
    return (await db.query('INSERT INTO cash_reconciliations(id,request_key,request_hash,business_date,cutoff,expected_cash,actual_cash,expected_mobile,actual_mobile,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[randomUUID(),key,hash,p.date,p.cutoff,p.expectedCash,cash.toFixed(6),p.expectedMobile,mobile.toFixed(6),notes])).rows[0];
  });res.status(201).json(result);
}));
router.get('/stock-counts',wrap(async(req,res)=>res.json((await pool.query('SELECT c.*,p.name,(SELECT id FROM transactions r WHERE r.reversal_of=c.transaction_id) AS reversed_by FROM stock_counts c JOIN products p ON p.id=c.product_id ORDER BY c.created_at DESC LIMIT 365')).rows)));
router.post('/stock-counts',require('../controllers/sale').record('stock_count'));
module.exports=router;
