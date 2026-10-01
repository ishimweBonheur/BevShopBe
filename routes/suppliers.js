const router=require('express').Router();
const {pool}=require('../models');
const {wrap,text}=require('../helper/http');
const {randomUUID}=require('node:crypto');
const {uuid}=require('../services/accounting');
router.get('/suppliers',wrap(async(req,res)=>res.json((await pool.query('SELECT s.*,(SELECT count(*) FROM transactions t WHERE t.supplier_id=s.id) AS purchase_count FROM suppliers s ORDER BY name')).rows)));
router.post('/suppliers',wrap(async(req,res)=>res.status(201).json((await pool.query('INSERT INTO suppliers(id,name,phone,email,address) VALUES($1,$2,$3,$4,$5) RETURNING *',[randomUUID(),text(req.body.name,'Supplier name'),String(req.body.phone||''),String(req.body.email||''),String(req.body.address||'')])).rows[0])));
router.put('/suppliers/:id',wrap(async(req,res)=>res.json((await pool.query('UPDATE suppliers SET name=$2,phone=$3,email=$4,address=$5 WHERE id=$1 RETURNING *',[uuid(req.params.id),text(req.body.name,'Supplier name'),String(req.body.phone||''),String(req.body.email||''),String(req.body.address||'')])).rows[0])));
module.exports=router;
