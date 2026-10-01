const { Decimal, fail } = require('../helper/money');
async function report(db, query) {
  const settings = (await db.query('SELECT * FROM settings WHERE id=1')).rows[0];
  const period = query.period || query.filterType || 'daily';
  const units = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' };
  let range;
  if (period === 'custom') {
    for (const date of [query.startDate, query.endDate]) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) fail('Valid startDate and endDate are required');
    }
    if (query.startDate > query.endDate) fail('Start date must precede end date');
    range = (await db.query("SELECT $1::date::timestamp AT TIME ZONE $3 AS start, ($2::date+1)::timestamp AT TIME ZONE $3 AS finish", [query.startDate, query.endDate, settings.timezone])).rows[0];
  } else {
    if (!units[period]) fail('Invalid report period');
    if(query.date && (!/^\d{4}-\d{2}-\d{2}$/.test(query.date) || !Number.isFinite(Date.parse(query.date)) || new Date(query.date).toISOString().slice(0,10)!==query.date)) fail('Invalid report date');
    range = (await db.query("SELECT date_trunc($1, COALESCE($3::date,(now() AT TIME ZONE $2)::date)::timestamp) AT TIME ZONE $2 AS start, (date_trunc($1, COALESCE($3::date,(now() AT TIME ZONE $2)::date)::timestamp) + ('1 ' || $1)::interval) AT TIME ZONE $2 AS finish", [units[period], settings.timezone,query.date || null])).rows[0];
  }
  const balances = (await db.query(`SELECT j.account,
    COALESCE(sum(j.debit-j.credit) FILTER(WHERE t.created_at<$1),0) AS opening,
    COALESCE(sum(j.debit) FILTER(WHERE t.created_at>=$1 AND t.created_at<$2),0) AS debits,
    COALESCE(sum(j.credit) FILTER(WHERE t.created_at>=$1 AND t.created_at<$2),0) AS credits
    FROM journal_lines j JOIN transactions t ON t.id=j.transaction_id WHERE t.created_at<$2 GROUP BY j.account`, [range.start, range.finish])).rows;
  const net = account => {
    const row = balances.find(x => x.account === account);
    return row ? new Decimal(row.debits).minus(row.credits) : new Decimal(0);
  };
  const revenue = net('sales').negated();
  const cogs = net('cost_of_sales');
  const expenses = net('operating_expenses');
  const losses = net('stock_losses');
  const stockGains=net('stock_gains').negated();
  const cash = ['cash','mobile_money','bank'].map(account => {
    const row = balances.find(x => x.account === account) || { opening: '0', debits: '0', credits: '0' };
    return { account, opening: row.opening, received: row.debits, paid: row.credits, closing: new Decimal(row.opening).add(row.debits).minus(row.credits).toFixed(6) };
  });
  const inventory = (await db.query(`SELECT p.id,p.name,p.low_stock_level,
    COALESCE(sum(m.quantity_delta) FILTER(WHERE m.created_at<$1),0)::integer AS quantity,
    COALESCE(sum(m.value_delta) FILTER(WHERE m.created_at<$1),0) AS value
    FROM products p LEFT JOIN stock_movements m ON m.product_id=p.id GROUP BY p.id ORDER BY p.name`, [range.finish])).rows;
  const activity = (await db.query(`SELECT t.*, u.first_name || ' ' || u.last_name AS recorded_by,
    (SELECT original.kind FROM transactions original WHERE original.id=t.reversal_of) AS original_kind,
    (SELECT r.id FROM transactions r WHERE r.reversal_of=t.id) AS reversed_by,
    COALESCE((SELECT json_agg(i) FROM transaction_items i WHERE i.transaction_id=t.id),'[]') AS items
    FROM transactions t JOIN users u ON u.id=t.created_by WHERE t.created_at>=$1 AND t.created_at<$2 ORDER BY t.created_at DESC`, [range.start, range.finish])).rows;
  // Net sale quantities and revenue reflect reversals in the period they were posted.
  const best = (await db.query(`WITH sale_events AS (
    SELECT t.id AS source_id, 1 AS sign FROM transactions t WHERE t.kind='sale' AND t.created_at>=$1 AND t.created_at<$2
    UNION ALL SELECT t.reversal_of,-1 FROM transactions t JOIN transactions original ON original.id=t.reversal_of
    WHERE t.kind='reversal' AND original.kind='sale' AND t.created_at>=$1 AND t.created_at<$2
  ) SELECT i.product_id, max(i.product_name) AS name, sum(i.quantity*e.sign) AS quantity,
    sum(i.quantity*i.unit_price*e.sign) AS revenue FROM sale_events e JOIN transaction_items i ON i.transaction_id=e.source_id
    GROUP BY i.product_id ORDER BY revenue DESC`, [range.start, range.finish])).rows;
  const paymentBreakdown=(await db.query(`SELECT t.payment_method,sum(CASE WHEN t.kind='sale' THEN t.amount ELSE -t.amount END) AS amount FROM transactions t LEFT JOIN transactions o ON o.id=t.reversal_of WHERE t.created_at>=$1 AND t.created_at<$2 AND (t.kind='sale' OR (t.kind='reversal' AND o.kind='sale')) GROUP BY t.payment_method`,[range.start,range.finish])).rows;
  const expenseBreakdown=(await db.query(`SELECT COALESCE(o.category,t.category) AS category,sum(CASE WHEN t.kind='expense' THEN t.amount ELSE -t.amount END) AS amount FROM transactions t LEFT JOIN transactions o ON o.id=t.reversal_of WHERE t.created_at>=$1 AND t.created_at<$2 AND (t.kind='expense' OR (t.kind='reversal' AND o.kind='expense')) GROUP BY COALESCE(o.category,t.category)`,[range.start,range.finish])).rows;
  const damagedQuantity=Number((await db.query(`SELECT COALESCE(sum(i.quantity * CASE WHEN t.kind='loss' THEN 1 ELSE -1 END),0) AS quantity FROM transactions t LEFT JOIN transactions o ON o.id=t.reversal_of JOIN transaction_items i ON i.transaction_id=COALESCE(o.id,t.id) WHERE t.created_at>=$1 AND t.created_at<$2 AND (t.kind='loss' OR (t.kind='reversal' AND o.kind='loss'))`,[range.start,range.finish])).rows[0].quantity);
  return { period, ...range, currency: settings.currency, timezone: settings.timezone, paymentBreakdown,expenseBreakdown,damagedQuantity,
    salesCount:activity.reduce((sum,t)=>sum+(t.kind==='sale' ? 1 : t.kind==='reversal' && t.original_kind==='sale' ? -1 : 0),0),totalProducts:inventory.length,currentStock:inventory.reduce((sum,p)=>sum+p.quantity,0),lowStockProducts:inventory.filter(p=>p.quantity<=p.low_stock_level).length,
    revenue: revenue.toFixed(6), costOfGoodsSold: cogs.toFixed(6), grossProfit: revenue.minus(cogs).toFixed(6),
    expenses: expenses.toFixed(6), stockLosses: losses.toFixed(6), stockGains:stockGains.toFixed(6), netProfit: revenue.minus(cogs).minus(expenses).minus(losses).add(stockGains).toFixed(6),
    cash, inventory, inventoryValue: inventory.reduce((sum,x) => sum.add(x.value), new Decimal(0)).toFixed(6),
    totalQuantitySold: best.reduce((sum,x) => sum + Number(x.quantity),0), bestSelling: best, activity,
    trialBalance: balances.map(x => ({ account:x.account, balance:new Decimal(x.opening).add(x.debits).minus(x.credits).toFixed(6) })) };
}
module.exports = { report };
