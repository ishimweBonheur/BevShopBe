const {pool}=require('../models');
const {wrap}=require('../helper/http');
exports.getSettings=wrap(async(req,res)=>res.json((await pool.query('SELECT currency,timezone,target_margin FROM settings WHERE id=1')).rows[0]));
