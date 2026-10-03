import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const base = process.env.TEST_API_URL
if (!base || new URL(base).port !== '18082') throw new Error('Use the isolated test API on port 18082; never the development database.')
let token
async function api(path, body) {
 const response = await fetch(base + '/api/v1' + path, {method: body ? 'POST' : 'GET', headers: {'Content-Type':'application/json', ...(token ? {Authorization:'Bearer '+token} : {})}, ...(body ? {body:JSON.stringify(body)} : {})})
 const data = await response.json()
 assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`)
 return data
}
const owner = await api('/auth/setup', {name:'Report Test Owner',email:'reports@example.test',password:'test-report-password'})
token = owner.token
const category = await api('/categories', {name:'Soft Drinks'})
const product = await api('/products', {name:'Coca-Cola 500ml',category_id:category.id,units_per_pack:24,selling_price:700,low_stock_level:20})
const supplier = await api('/suppliers', {name:'Report Supplier'})
for (const [packs,price] of [[10,12000],[5,14400]]) await api('/purchases', {supplier_id:supplier.id,items:[{product_id:product.id,packs,price_per_pack:price}],notes:'Report verification purchase'})
assert.equal((await api('/purchases?limit=15&offset=0')).length,2)
assert.equal((await api('/purchases?supplier_id='+supplier.id)).length,2)
assert.equal((await api('/products/'+product.id)).average_cost_per_item,533.33)
await api('/sales', {payment_method:'cash',items:[{product_id:product.id,quantity:20,selling_price:700}]})
const profit = await api('/reports/print?period=today')
assert.equal(profit.summary.profit_loss,3333.4)
await api('/expenses', {name:'Transport',amount:5000,category:'Transport',description:'Delivery cost'})
await api('/damaged-items', {product_id:product.id,quantity:2,reason:'Broken bottles'})
await api('/owner-money', {type:'money_added',amount:100000,notes:'Opening money'})
await api('/owner-money', {type:'money_taken',amount:1000,notes:'Owner withdrawal'})
for(let i=0;i<55;i++) await api('/owner-money', {type:'money_added',amount:1,notes:`History completeness row ${i+1}; this longer note tests wrapped PDF table content without clipping or truncation.`})
const loss = await api('/reports/print?period=today')
assert.deepEqual(loss.summary, {sales_revenue:14000,purchases:192000,cost_of_items_sold:10666.6,expenses:5000,damaged_loss:1066.66,profit_loss:-2733.26,items_sold:20,items_purchased:360,current_stock:338,low_stock_count:0,damaged_items:2,out_of_stock_count:0,cash:14000,mobile_money:0,bank:0})
assert.equal(loss.history.length,62)
assert.deepEqual(new Set(loss.history.map(r=>r.type)), new Set(['sale','purchase','expense','damage','money_added','money_taken']))
for(const period of ['today','week','month','year']) {
 const report=await api('/reports/print?period='+period)
 assert.deepEqual(report.summary, await api('/reports/summary?period='+period))
 assert.equal(report.history.length,62)
 assert.equal(report.summary.profit_loss,-2733.26)
 if(period==='year') assert.equal(report.monthly.length,12)
}
const day=loss.period.from.slice(0,10)
assert.deepEqual((await api(`/reports/print?from=${day}&to=${day}`)).summary,loss.summary)
const zero=await api('/reports/print?from=2000-01-01&to=2000-01-01')
assert.equal(zero.summary.profit_loss,0)
assert.equal(zero.history.length,0)
for(const query of ['from=bad&to=bad','from=2026-10-03','from=2026-10-04&to=2026-10-03','period=invalid']) {
 const response=await fetch(base+'/api/v1/reports/print?'+query,{headers:{Authorization:'Bearer '+token}})
 assert.equal(response.status,400)
}
const output=join(tmpdir(),'bevshop-report-verification.json')
writeFileSync(output,JSON.stringify({base,token,profit,loss,zero}))
console.log('PASS: purchases list and supplier filter; all six history types; 62 full history rows; all periods; payment/stock counts; consistent summary and PDF snapshots.')
console.log('Verified: 14,000 - 10,666.60 - 5,000 - 1,066.66 = -2,733.26 RWF. Purchases of 192,000 are excluded from profit.')
console.log('Browser test fixture:',output)
