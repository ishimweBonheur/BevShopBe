const { pool, transaction } = require('../models');
const { wrap } = require('../helper/http');
const { fail } = require('../helper/money');
const { randomUUID,createHash } = require('node:crypto');
const { text } = require('../helper/http');
const { uuid, post } = require('../services/accounting');
const { Decimal, money, integer, suggestedPrice } = require('../helper/money');
const productView = row => ({...row,_id:row.id,price:row.selling_price,unitsPerPack:row.units_per_pack,
  lowStock:row.quantity<=row.low_stock_level,
  buyingPrice:row.quantity ? new Decimal(row.inventory_value).div(row.quantity).toFixed(6) : row.last_purchase_cost,
  suggestedPrice:suggestedPrice(row.quantity ? row.inventory_value : row.last_purchase_cost,row.quantity || 1,row.target_margin),
  category:row.category_id ? {_id:row.category_id,name:row.category_name}:null});
async function saveProduct(req, res) {
  const b=req.body; const price=money(b.sellingPrice ?? b.price,'Selling price',true);
  const params=[text(b.name,'Name'),b.categoryId ? uuid(b.categoryId):null,String(b.description || ''),integer(b.unitsPerPack,'Items per pack'),price.toString(),integer(b.lowStockLevel ?? 12,'Low stock level',0)];
  const result=await transaction(async db=>{
    await db.query('SELECT pg_advisory_xact_lock(85215250)');
    const hash=createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.entries(b).sort(([a],[b])=>a.localeCompare(b))))).digest('hex');
    if(!req.params.id && b.requestKey) {
      const previous=(await db.query('SELECT p.*,s.target_margin FROM products p CROSS JOIN settings s WHERE p.creation_key=$1',[uuid(b.requestKey)])).rows[0];
      if(previous) {if(previous.creation_hash!==hash) fail('Request key already used for a different product',409); return previous;}
    }
    const duplicate=(await db.query('SELECT id FROM products WHERE lower(trim(name))=lower(trim($1)) AND ($2::uuid IS NULL OR id<>$2)',[params[0],req.params.id || null])).rows[0];
    if(duplicate) { const error=new Error('This product already exists.'); error.status=409; error.productId=duplicate.id; throw error; }
    if(!params[1] || !(await db.query('SELECT id FROM categories WHERE id=$1 AND is_active',[params[1]])).rows.length) fail('Choose an existing category');
    let saved;
    if(req.params.id) saved=await db.query('UPDATE products SET name=$1,category_id=$2,description=$3,units_per_pack=$4,selling_price=$5,low_stock_level=$6 WHERE id=$7 RETURNING *',[...params,uuid(req.params.id)]);
    else saved=await db.query('INSERT INTO products(name,category_id,description,units_per_pack,selling_price,low_stock_level,id,barcode) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[...params,randomUUID(),b.barcode ? text(b.barcode,'Barcode'):randomUUID()]);
    if(!saved.rows.length) fail('Product not found',404);
    const id=saved.rows[0].id;
    if(!req.params.id && b.requestKey) await db.query('UPDATE products SET creation_key=$2,creation_hash=$3 WHERE id=$1',[id,b.requestKey,hash]);
    if(!req.params.id) {
      const packs=integer(b.packs,'Packs');
      await post(db,'purchase',{requestKey:uuid(b.requestKey),productId:id,packs,unitsPerPack:params[3],totalCost:money(b.amountPerPack,'Amount per pack',true).mul(packs).toFixed(6),supplierId:b.supplierId,date:b.date,notes:'Initial stock'},req.user.id);
    }
    return (await db.query('SELECT p.*,s.target_margin,c.name AS category_name FROM products p CROSS JOIN settings s LEFT JOIN categories c ON c.id=p.category_id WHERE p.id=$1',[id])).rows[0];
  });
  res.status(req.params.id ? 200:201).json(productView(result));
}

exports.getProducts = wrap(async (req,res) => {
  const rows=(await pool.query(`SELECT p.*,c.name AS category_name,s.target_margin FROM products p LEFT JOIN categories c ON c.id=p.category_id CROSS JOIN settings s
    WHERE p.is_active AND (p.name ILIKE $1 OR p.barcode ILIKE $1) ORDER BY p.name`,[`%${String(req.query.search || '')}%`])).rows.map(productView);
  res.json({list:rows,total:rows.length});
});

exports.createProduct = wrap(saveProduct);

exports.updateProduct = wrap(saveProduct);

exports.deleteProduct = wrap(async (req,res) => {
  const result=await pool.query('UPDATE products SET is_active=false WHERE id=$1 AND quantity=0 RETURNING id',[uuid(req.params.id)]);
  if (!result.rows.length) fail('Only products with no stock can be archived',409);res.json({success:true});
});
