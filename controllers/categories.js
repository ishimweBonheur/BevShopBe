const { pool } = require('../models');
const { wrap } = require('../helper/http');
const { fail } = require('../helper/money');
const { randomUUID } = require('node:crypto');
const { text } = require('../helper/http');
const { uuid } = require('../services/accounting');

exports.getCategories = wrap(async (req,res) => res.json((await pool.query('SELECT c.id AS _id,c.*, (SELECT count(*)::integer FROM products p WHERE p.category_id=c.id AND p.is_active) AS product_count FROM categories c WHERE c.is_active ORDER BY c.name')).rows));

exports.createCategory = wrap(async (req,res) => res.status(201).json((await pool.query('INSERT INTO categories(id,name,description) VALUES($1,$2,$3) RETURNING id AS _id,*',[randomUUID(),text(req.body.name,'Name'),String(req.body.description || '')])).rows[0]));

exports.updateCategory = wrap(async (req,res) => {
  const result=await pool.query('UPDATE categories SET name=$2,description=$3 WHERE id=$1 RETURNING id AS _id,*',[uuid(req.params.id),text(req.body.name,'Name'),String(req.body.description || '')]);
  if (!result.rows.length) fail('Category not found',404); res.json(result.rows[0]);
});

exports.deleteCategory = wrap(async (req,res) => {
  await pool.query('UPDATE categories SET is_active=false WHERE id=$1',[uuid(req.params.id)]);res.json({success:true});
});
