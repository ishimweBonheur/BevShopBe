const { pool, transaction } = require('../models');
const { wrap } = require('../helper/http');
const { integer } = require('../helper/money');
const { post } = require('../services/accounting');

exports.getTransactions = wrap(async (req,res) => {
  const page=integer(req.query.page || 1,'Page');
  const rows=(await pool.query(`SELECT t.*, (SELECT s.name FROM suppliers s WHERE s.id=t.supplier_id) AS supplier_name, (SELECT r.id FROM transactions r WHERE r.reversal_of=t.id) AS reversed_by,
    COALESCE((SELECT json_agg(i) FROM transaction_items i WHERE i.transaction_id=t.id),'[]') AS items
    FROM transactions t WHERE ($2::text IS NULL OR t.kind=ANY(string_to_array($2,','))) AND ($3::uuid IS NULL OR t.supplier_id=$3) ORDER BY created_at DESC LIMIT 100 OFFSET $1`,[(page-1)*100,req.query.kind || null,req.query.supplierId || null])).rows;
  res.json({list:rows,page});
});

exports.record = kind => wrap(async (req, res) => {
  const result = await transaction(async db => {
    const saved=await post(db, kind, req.body, req.user.id);
    saved.items=(await db.query('SELECT * FROM transaction_items WHERE transaction_id=$1',[saved.id])).rows;
    return saved;
  });
  res.status(result.replayed ? 200 : 201).json(result);
});
