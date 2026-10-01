const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { createTestApp } = require('./support/database');

test('existing Express entry point serves the PostgreSQL shop single-owner workflow', async () => {
  const { app, database } = await createTestApp();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token;
  async function request(endpoint, body, method = 'POST', status = 200) {
    const response = await fetch(base + endpoint, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const data = await response.json();
    assert.equal(response.status, status, `${endpoint}: ${JSON.stringify(data)}`);
    return data;
  }
  try {
    const docs = await fetch(base + '/docs/');
    assert.equal(docs.status, 200);
    assert.match(await docs.text(), /swagger-ui/);
    const docsCss = await fetch(base + '/docs/swagger-ui.css');
    assert.equal(docsCss.status, 200);
    const spec = await request('/docs.json', null, 'GET');
    assert.equal(spec.openapi, '3.0.3');
    assert.deepEqual(spec.paths['/auth/login'].post.security, []);
    assert.deepEqual(spec.security, [{ BearerAuth: [] }]);
    assert.ok(spec.paths['/sales'].post.requestBody);
    assert.equal((await request('/health', null, 'GET')).database, 'postgresql');
    await request('/products', null, 'GET', 401);
    await request('/auth/setup', { setupToken: 'wrong' }, 'POST', 403);
    const credentials = { email: 'owner@example.com', password: 'owner-test-password' };
    token = (await request('/auth/setup', { ...credentials, firstName: 'Shop', lastName: 'Owner', setupToken: process.env.SETUP_TOKEN }, 'POST', 201)).token;
    await request('/auth/login',{...credentials,password:'wrong-password'},'POST',401);
    await request('/auth/login', credentials);
    assert.equal((await request('/auth/check', null, 'GET')).email, credentials.email);
    assert.equal((await request('/settings', null, 'GET')).currency, 'RWF');
    const category = await request('/categories', { name: 'Beverages' }, 'POST', 201);
    assert.equal((await request('/categories',{name:' beverages '},'POST',409)).error,'Category already exists');
    const product = await request('/products', { name: 'Fanta', categoryId: category.id, unitsPerPack: 12, sellingPrice: 2500,requestKey:randomUUID(),packs:2,amountPerPack:25000 }, 'POST', 201);
    const sale = { requestKey: randomUUID(), items: [{ productId: product.id, quantity: 24 }] };
    await request('/sales', sale, 'POST', 201);
    await request('/sales', sale);
    await request('/expenses', { requestKey: randomUUID(), amount: 2000, category: 'Transport' }, 'POST', 201);
    const report = await request('/reports/summary?period=yearly', null, 'GET');
    assert.equal(Number(report.revenue), 60000);
    assert.equal(Number(report.costOfGoodsSold), 50000);
    assert.equal(Number(report.netProfit), 8000);
    const supplier=await request('/suppliers',{name:'Local wholesaler',phone:'0780000000'},'POST',201);
    const initial={name:'Coca-Cola',categoryId:category.id,unitsPerPack:24,packs:10,amountPerPack:12000,sellingPrice:700,lowStockLevel:30,requestKey:randomUUID(),supplierId:supplier.id};
    const cola=await request('/products',initial,'POST',201);
    assert.equal(cola.quantity,240);assert.equal(cola.lowStock,false);assert.equal(Number(cola.buyingPrice),500);
    assert.equal((await request('/products',initial,'POST',201)).quantity,240);
    await request('/products',{...initial,packs:11},'POST',409);
    const duplicate=await request('/products',{...initial,name:' coca-cola ',requestKey:randomUUID()},'POST',409);
    assert.equal(duplicate.error,'This product already exists.');assert.equal(duplicate.productId,cola.id);
    const before=(await request('/transactions?kind=purchase',null,'GET')).list.length;
    await request('/products',{...initial,name:'Invalid initial stock',requestKey:randomUUID(),amountPerPack:0},'POST',400);
    assert.equal((await request('/transactions?kind=purchase',null,'GET')).list.length,before);
    assert.equal((await request('/products?search=Invalid',null,'GET')).list.length,0);
    await request('/purchases',{requestKey:randomUUID(),productId:product.id,packs:1,totalCost:24000,supplierId:supplier.id},'POST',201);
    const receipt=await request('/sales',{requestKey:randomUUID(),paymentMethod:'card',items:[{productId:cola.id,quantity:5,unitPrice:700},{productId:product.id,quantity:3,unitPrice:2500}]},'POST',201);
    assert.equal(Number(receipt.amount),11000);assert.equal(receipt.items.length,2);assert.equal(receipt.items[0].category_name,'Beverages');
    const insufficient=await request('/sales',{requestKey:randomUUID(),items:[{productId:cola.id,quantity:236}]},'POST',409);
    assert.equal(insufficient.error,'Insufficient stock. Only 235 items are available.');
    await request('/losses',{requestKey:randomUUID(),productId:cola.id,quantity:3,notes:'Broken bottles'},'POST',201);
    const updated=(await request('/products?search=Coca',null,'GET')).list[0];assert.equal(updated.quantity,232);
    const summary=await request('/reports/summary?period=yearly',null,'GET');
    assert.equal(Number(summary.revenue),71000);assert.equal(Number(summary.costOfGoodsSold),58500);assert.equal(Number(summary.stockLosses),1500);assert.equal(Number(summary.netProfit),9000);
    assert.equal(summary.damagedQuantity,3);assert.equal(Number(summary.paymentBreakdown.find(r=>r.payment_method==='bank').amount),11000);
    assert.equal((await request('/transactions?kind=purchase&supplierId='+supplier.id,null,'GET')).list.length,2);
    const old=await request('/reports/summary?period=monthly&date=2020-01-15',null,'GET');assert.equal(Number(old.revenue),0);
    await request('/reports/summary?period=daily&date=2026-02-30',null,'GET',400);
    await request('/auth/setup',{...credentials,setupToken:process.env.SETUP_TOKEN},'POST',409);
    await request('/settings',{currency:'USD'},'PUT',404);
    await request('/users', {}, 'POST', 404);
    const balance=await request('/reconciliations/preview',null,'GET');
    const cashCount={requestKey:randomUUID(),date:balance.date,expectedCash:balance.expectedCash,expectedMobile:balance.expectedMobile,actualCash:0,actualMobile:0,notes:'Counted till and phone balance'};
    await request('/reconciliations',cashCount,'POST',201);await request('/reconciliations',cashCount,'POST',201);
    assert.equal((await request('/reconciliations',null,'GET')).length,1);
    await request('/reconciliations',{...cashCount,actualCash:1},'POST',409);
    await request('/capital',{requestKey:randomUUID(),amount:10000},'POST',201);
    await request('/reconciliations',{...cashCount,requestKey:randomUUID()},'POST',409);
    const count={requestKey:randomUUID(),productId:cola.id,expectedQuantity:232,actualQuantity:230,notes:'Physical shelf count shortage'};
    await request('/stock-counts',count,'POST',201);await request('/stock-counts',count,'POST',200);
    await request('/stock-counts',{...count,requestKey:randomUUID()},'POST',409);
    await request('/stock-counts',{requestKey:randomUUID(),productId:cola.id,expectedQuantity:230,actualQuantity:233,notes:'Found three bottles'},'POST',201);
    assert.equal((await request('/products?search=Coca',null,'GET')).list[0].quantity,233);
    assert.equal((await request('/stock-counts',null,'GET')).length,2);
    const afterCount=await request('/reports/summary',null,'GET');assert.equal(Number(afterCount.stockGains),1500);assert.equal(Number(afterCount.netProfit),9500);
    await request('/auth/password',{currentPassword:'wrong',newPassword:'new-owner-test-password'},'POST',400);
    const recovery=await request('/auth/recovery-code',{currentPassword:credentials.password});
    await request('/auth/password',{currentPassword:credentials.password,newPassword:'new-owner-test-password'});
    await request('/auth/check',null,'GET',401);
    await request('/auth/login',credentials,'POST',401);
    await request('/auth/recover',{email:credentials.email,recoveryCode:'invalid',newPassword:'recovered-owner-password'},'POST',400);
    await request('/auth/recover',{email:credentials.email,recoveryCode:recovery.recoveryCode,newPassword:'recovered-owner-password'});
    await request('/auth/recover',{email:credentials.email,recoveryCode:recovery.recoveryCode,newPassword:'another-owner-password'},'POST',400);
    token=(await request('/auth/login',{email:credentials.email,password:'recovered-owner-password'})).token;
    assert.equal((await request('/products?search=Coca',null,'GET')).list[0].quantity,233);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await database.close();
  }
});
