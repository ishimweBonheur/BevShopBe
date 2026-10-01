const { randomUUID, createHash } = require('node:crypto');
const { Decimal, fail, money, integer, allocatedCost } = require('../helper/money');
const uuid = value => { if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || '')) fail('A valid UUID is required'); return value; };
async function journal(db, transactionId, debit, credit, amount) {
  if (new Decimal(amount).isZero()) return;
  for (const [account, dr, cr] of [[debit, amount, 0], [credit, 0, amount]]) {
    await db.query('INSERT INTO journal_lines(id,transaction_id,account,debit,credit) VALUES($1,$2,$3,$4,$5)', [randomUUID(), transactionId, account, String(dr), String(cr)]);
  }
}
async function movement(db, tx, product, quantity, value) {
  await db.query('UPDATE products SET quantity=quantity+$2, inventory_value=inventory_value+$3 WHERE id=$1', [product, quantity, String(value)]);
  await db.query('INSERT INTO stock_movements(id,transaction_id,product_id,quantity_delta,value_delta,created_at) VALUES($1,$2,$3,$4,$5,(SELECT created_at FROM transactions WHERE id=$2))', [randomUUID(), tx, product, quantity, String(value)]);
}
async function item(db, tx, product, quantity, price, cost, packs = null, units = null) {
  await db.query("INSERT INTO transaction_items(id,transaction_id,product_id,product_name,quantity,unit_price,cost,packs,units_per_pack,category_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE((SELECT name FROM categories WHERE id=$10),''))",
    [randomUUID(), tx, product.id, product.name, quantity, String(price), String(cost), packs, units,product.category_id]);
}
async function post(db, kind, body, userId) {
  const key = uuid(body.requestKey);
  const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value==='object'
    ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
  const requestHash=createHash('sha256').update(JSON.stringify(canonical(body))).digest('hex');
  // One shop-wide posting lock gives deterministic costing and prevents overselling,
  // duplicate retry races, and reversals racing another stock update.
  await db.query('SELECT pg_advisory_xact_lock(85215250)');
  const previous = await db.query('SELECT * FROM transactions WHERE request_key=$1', [key]);
  if (previous.rows.length) {
    if (previous.rows[0].kind !== kind || previous.rows[0].created_by !== userId || previous.rows[0].request_hash !== requestHash) fail('Request key already used for a different entry', 409);
    return { ...previous.rows[0], replayed: true };
  }
  const payment = body.paymentMethod === 'card' ? 'bank' : body.paymentMethod || 'cash';
  if (!['cash', 'mobile_money', 'bank'].includes(payment)) fail('Invalid payment method');
  const id = randomUUID();
  let amount = new Decimal(0);
  const category = String(body.category || '').trim().slice(0, 100);
  const notes = String(body.notes || '').trim().slice(0, 2000);
  await db.query('INSERT INTO transactions(id,request_key,kind,amount,payment_method,category,notes,created_by,request_hash) VALUES($1,$2,$3,0,$4,$5,$6,$7,$8)', [id, key, kind, payment, category, notes, userId, requestHash]);
  if(body.date) {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Number.isFinite(Date.parse(body.date)) || new Date(body.date).toISOString().slice(0,10)!==body.date) fail('Invalid transaction date');
    const today=(await db.query("SELECT to_char(now() AT TIME ZONE 'Africa/Kigali','YYYY-MM-DD') AS day")).rows[0].day;
    if(body.date>today) fail('Transaction date cannot be in the future');
    if(body.date<today) {
      if(['purchase','sale','loss','reversal'].includes(kind) && (await db.query("SELECT id FROM transactions WHERE id<>$1 AND created_at>=($2::date::timestamp AT TIME ZONE 'Africa/Kigali') LIMIT 1",[id,body.date])).rows.length) fail('Record stock entries in date order to preserve purchase costing',409);
      await db.query("UPDATE transactions SET created_at=$2::date::timestamp AT TIME ZONE 'Africa/Kigali' WHERE id=$1",[id,body.date]);
    }
  }
  if(body.supplierId && kind==='purchase') {
    if(!(await db.query('SELECT id FROM suppliers WHERE id=$1',[uuid(body.supplierId)])).rows.length) fail('Supplier not found',404);
    await db.query('UPDATE transactions SET supplier_id=$2 WHERE id=$1',[id,body.supplierId]);
  }
  if (kind === 'stock_count') {
    if(body.date) fail('Physical counts must be recorded at the time of counting');
    const product=(await db.query('SELECT * FROM products WHERE id=$1 AND is_active FOR UPDATE',[uuid(body.productId)])).rows[0];
    if(!product) fail('Product not found',404);
    if(integer(body.expectedQuantity,'Expected quantity',0)!==product.quantity) fail('Stock changed since you started counting. Refresh and count again.',409);
    const actual=integer(body.actualQuantity,'Actual quantity',0);
    const delta=actual-product.quantity;
    if(!notes) fail('A stock count reason is required');
    const unitCost=product.quantity ? new Decimal(product.inventory_value).div(product.quantity) : delta>0 ? money(body.unitCost ?? product.last_purchase_cost,'Cost per extra item',true) : new Decimal(0);
    amount=delta<0 ? allocatedCost(product.inventory_value,product.quantity,-delta) : unitCost.mul(delta).toDecimalPlaces(6);
    if(delta) {
      await movement(db,id,product.id,delta,delta<0 ? amount.negated() : amount);
      await item(db,id,product,Math.abs(delta),unitCost.toFixed(6),amount);
      await journal(db,id,delta<0 ? 'stock_losses':'inventory',delta<0 ? 'inventory':'stock_gains',amount);
    }
    await db.query('INSERT INTO stock_counts(id,transaction_id,product_id,expected_quantity,actual_quantity,unit_cost,reason) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),id,product.id,product.quantity,actual,unitCost.toFixed(6),notes]);
    await db.query("UPDATE transactions SET notes=notes || $2 WHERE id=$1",[id,` (Count: expected ${product.quantity}, actual ${actual}, difference ${delta})`]);
  } else if (kind === 'purchase') {
    const product = (await db.query('SELECT * FROM products WHERE id=$1 AND is_active FOR UPDATE', [uuid(body.productId)])).rows[0];
    if (!product) fail('Product not found', 404);
    const packs = integer(body.packs, 'Packs');
    const units = integer(body.unitsPerPack ?? product.units_per_pack, 'Items per pack');
    const quantity = integer(packs * units);
    amount = money(body.totalCost, 'Total purchase cost', true).add(money(body.deliveryCost ?? 0, 'Delivery cost'));
    await movement(db, id, product.id, quantity, amount);
    await db.query('UPDATE products SET last_purchase_cost=$2 WHERE id=$1',[product.id,amount.div(quantity).toFixed(6)]);
    await item(db, id, product, quantity, amount.div(quantity).toFixed(6), amount, packs, units);
    await journal(db, id, 'inventory', payment, amount);
  } else if (kind === 'sale' || kind === 'loss') {
    const lines = kind === 'loss' ? [{ productId: body.productId, quantity: body.quantity }] : body.items;
    if (!Array.isArray(lines) || !lines.length || lines.length > 100) fail('Provide between 1 and 100 sale items');
    const seen = new Set();
    let totalCost = new Decimal(0);
    for (const line of lines) {
      const productId = uuid(line.productId);
      if (seen.has(productId)) fail('Combine repeated products into one sale line');
      seen.add(productId);
      const product = (await db.query('SELECT * FROM products WHERE id=$1 AND is_active FOR UPDATE', [productId])).rows[0];
      if (!product) fail('Product not found', 404);
      const quantity = integer(line.quantity);
      const cost = allocatedCost(product.inventory_value, product.quantity, quantity);
      const price = kind === 'sale' ? money(line.unitPrice ?? product.selling_price, 'Selling price', true) : new Decimal(0);
      if (kind === 'sale' && price.mul(quantity).lt(cost) && body.acceptBelowCost !== true) fail('Selling below cost. Explicit acknowledgement is required.', 409);
      amount = amount.add(price.mul(quantity));
      totalCost = totalCost.add(cost);
      await movement(db, id, product.id, -quantity, cost.negated());
      await item(db, id, product, quantity, price, cost);
    }
    if (kind === 'sale') {
      await journal(db, id, payment, 'sales', amount);
      await journal(db, id, 'cost_of_sales', 'inventory', totalCost);
    } else {
      if (!notes) fail('Explain the stock loss');
      amount = totalCost;
      await journal(db, id, 'stock_losses', 'inventory', totalCost);
    }
  } else if (['expense','capital','withdrawal'].includes(kind)) {
    amount = money(body.amount, 'Amount', true);
    if (kind === 'expense' && !category) fail('Expense category is required');
    await journal(db, id, kind === 'capital' ? payment : kind === 'expense' ? 'operating_expenses' : 'owner_drawings', kind === 'capital' ? 'owner_equity' : payment, amount);
  } else if (kind === 'reversal') {
    if (!notes) fail('A correction reason is required');
    const original = (await db.query('SELECT * FROM transactions WHERE id=$1 FOR UPDATE', [uuid(body.transactionId)])).rows[0];
    if (!original || original.kind === 'reversal') fail('Original transaction not found or cannot be reversed', 404);
    if ((await db.query('SELECT id FROM transactions WHERE reversal_of=$1', [original.id])).rows.length) fail('Already reversed', 409);
    const movements = (await db.query('SELECT * FROM stock_movements WHERE transaction_id=$1', [original.id])).rows;
    for (const move of movements) {
      // Only reverse stock-bearing entries while they are the latest movement
      // for every affected product, otherwise later weighted costs would be false.
      const later = await db.query(`SELECT m.id FROM stock_movements m JOIN transactions t ON t.id=m.transaction_id
        WHERE m.product_id=$1 AND m.transaction_id<>$2 AND m.created_at >= $3 AND t.kind<>'reversal'
        AND NOT EXISTS(SELECT 1 FROM transactions r WHERE r.reversal_of=t.id) LIMIT 1`, [move.product_id, original.id, move.created_at]);
      if (later.rows.length) fail('Reverse later stock transactions for this product first', 409);
      await movement(db, id, move.product_id, -move.quantity_delta, new Decimal(move.value_delta).negated());
    }
    await db.query('INSERT INTO journal_lines(id,transaction_id,account,debit,credit) SELECT gen_random_uuid(),$1,account,credit,debit FROM journal_lines WHERE transaction_id=$2', [id, original.id]);
    await db.query('UPDATE transactions SET reversal_of=$2, payment_method=$3 WHERE id=$1', [id, original.id, original.payment_method]);
    amount = new Decimal(original.amount);
  } else fail('Unsupported transaction type');
  // A zero-cost loss still needs an explicit journal to satisfy audit constraints.
  if (!(await db.query('SELECT id FROM journal_lines WHERE transaction_id=$1 LIMIT 1', [id])).rows.length) {
    await db.query('INSERT INTO journal_lines(id,transaction_id,account,debit,credit) VALUES($1,$2,$3,0,0)', [randomUUID(), id, 'stock_losses']);
  }
  const result=await db.query('UPDATE transactions SET amount=$2 WHERE id=$1 RETURNING *', [id, amount.toFixed(6)]);
  return result.rows[0];
}
module.exports = { post, uuid };
