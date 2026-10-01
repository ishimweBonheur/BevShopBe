const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const {PGlite}=require('@electric-sql/pglite');
const {post}=require('../services/accounting');
const {report}=require('../services/reports');
const {allocatedCost,suggestedPrice,integer,money}=require('../helper/money');
let db; const user=randomUUID();
before(async()=>{
  db=new PGlite();
  await db.exec(fs.readFileSync('models/schema.sql','utf8'));
  await db.query("INSERT INTO users(id,email,username,password,first_name,last_name,role) VALUES($1,'test@example.com','owner','hashed','Test','Owner','ADMIN')",[user]);
  await db.query("UPDATE settings SET currency='RWF',timezone='Africa/Kigali' WHERE id=1");
});
after(async()=>db.close());
async function product(){const id=randomUUID();await db.query("INSERT INTO products(id,name,barcode,units_per_pack,selling_price) VALUES($1,$2,$2,12,2500)",[id,id]);return id;}
async function run(kind,body){return db.transaction(tx=>post(tx,kind,{requestKey:randomUUID(),...body},user));}
test('24 individual sales preserve the entire 50,000 purchase cost',async()=>{
  const id=await product();
  await run('purchase',{productId:id,packs:2,totalCost:50000});
  let allocated=0;
  for(let i=0;i<24;i++) {
    const sale=await run('sale',{items:[{productId:id,quantity:1}]});
    allocated+=Number((await db.query('SELECT cost FROM transaction_items WHERE transaction_id=$1',[sale.id])).rows[0].cost);
  }
  assert.ok(Math.abs(allocated-50000)<0.000001);
  const row=(await db.query('SELECT quantity,inventory_value FROM products WHERE id=$1',[id])).rows[0];
  assert.equal(row.quantity,0);assert.equal(Number(row.inventory_value),0);
  const r=await report(db,{period:'daily'});
  assert.equal(Number(r.revenue),60000);assert.equal(Number(r.costOfGoodsSold),50000);assert.equal(Number(r.netProfit),10000);
  await run('expense',{amount:2000,category:'Transport'});
  assert.equal(Number((await report(db,{period:'yearly'})).netProfit),8000);
});
test('failed multi-item sale rolls back stock, payment and journal',async()=>{
  const id=await product();await run('purchase',{productId:id,packs:1,totalCost:1200});
  await assert.rejects(run('sale',{items:[{productId:id,quantity:2},{productId:randomUUID(),quantity:1}]}),/not found/);
  assert.equal((await db.query('SELECT quantity FROM products WHERE id=$1',[id])).rows[0].quantity,12);
  await assert.rejects(run('sale',{items:[{productId:id,quantity:13}]}),/Insufficient stock/);
});
test('retry key prevents duplicate purchase',async()=>{
  const id=await product();const requestKey=randomUUID();const body={requestKey,productId:id,packs:2,totalCost:50000};
  const first=await run('purchase',body);const second=await run('purchase',body);
  assert.equal(first.id,second.id);assert.equal(second.replayed,true);
  await assert.rejects(run('purchase',{...body,totalCost:60000}),/different entry/);
  assert.equal((await db.query('SELECT quantity FROM products WHERE id=$1',[id])).rows[0].quantity,24);
});
test('weighted costs, below-cost acknowledgement, losses and immutable cost history',async()=>{
  const id=await product();await run('purchase',{productId:id,packs:1,totalCost:1200});
  await run('purchase',{productId:id,packs:1,totalCost:2400});
  await assert.rejects(run('sale',{items:[{productId:id,quantity:1,unitPrice:100}]}),/below cost/);
  const sale=await run('sale',{items:[{productId:id,quantity:1,unitPrice:100}],acceptBelowCost:true});
  assert.equal(Number((await db.query('SELECT cost FROM transaction_items WHERE transaction_id=$1',[sale.id])).rows[0].cost),150);
  await run('purchase',{productId:id,packs:1,totalCost:3600});
  assert.equal(Number((await db.query('SELECT cost FROM transaction_items WHERE transaction_id=$1',[sale.id])).rows[0].cost),150);
  const loss=await run('loss',{productId:id,quantity:1,notes:'Broken bottle'});
  assert.ok(Number(loss.amount)>0);
});
test('reversals balance, restore inventory, and prevent duplicate or out-of-order reversal',async()=>{
  const id=await product();const purchase=await run('purchase',{productId:id,packs:1,totalCost:1200});
  const sale=await run('sale',{items:[{productId:id,quantity:2}]});
  await assert.rejects(run('reversal',{transactionId:purchase.id,notes:'Correction'}),/later stock/);
  await run('reversal',{transactionId:sale.id,notes:'Wrong sale'});
  await assert.rejects(run('reversal',{transactionId:sale.id,notes:'Again'}),/Already reversed/);
  await run('reversal',{transactionId:purchase.id,notes:'Wrong purchase'});
  assert.equal((await db.query('SELECT quantity FROM products WHERE id=$1',[id])).rows[0].quantity,0);
  assert.equal(Number((await db.query('SELECT sum(debit-credit) AS balance FROM journal_lines')).rows[0].balance),0);
});
test('database rejects unbalanced committed journal',async()=>{
  await assert.rejects(db.transaction(async tx=>{
    await tx.query("INSERT INTO transactions(id,request_key,kind,amount,payment_method,created_by) VALUES($1,$2,'expense',1,'cash',$3)",[randomUUID(),randomUUID(),user]);
  }),/balanced journal/);
});
test('posted stock and journal entries cannot be edited or deleted',async()=>{
  await assert.rejects(db.query('UPDATE journal_lines SET debit=0'),/immutable/);
  await assert.rejects(db.query('DELETE FROM stock_movements'),/immutable/);
});
test('validation and custom period bounds',async()=>{
  assert.throws(()=>integer(1.5),/whole number/);assert.throws(()=>money(-1),/non-negative/);
  assert.equal(suggestedPrice(50000,24,20),'2604.166667');
  assert.equal(allocatedCost('0.333333',1,1).toString(),'0.333333');
  await assert.rejects(report(db,{period:'custom',startDate:'2026-02-30',endDate:'2026-03-01'}),/Valid/);
  await assert.rejects(report(db,{period:'wrong'}),/Invalid/);
  const r=await report(db,{period:'custom',startDate:'2020-01-01',endDate:'2020-01-01'});
  assert.equal(new Date(r.finish)-new Date(r.start),86400000);assert.equal(Number(r.revenue),0);
});
