const router=require('express').Router();
const path=require('node:path');
const {wrap}=require('../helper/http');
const {fail}=require('../helper/money');
const backup=require('../services/backup');
router.get('/backups',wrap(async(req,res)=>res.json(await backup.status())));
router.post('/backups',wrap(async(req,res)=>res.status(201).json(await backup.createBackup())));
router.get('/backups/:name',wrap(async(req,res)=>{
  if(!/^bevshop-[a-zA-Z0-9-]+\.bevbackup$/.test(req.params.name))fail('Invalid backup name');
  res.set('Cache-Control','no-store');res.download(path.join(backup.directory(),req.params.name),req.params.name,error=>{if(error&&!res.headersSent)res.status(404).json({error:'Backup not found'});});
}));
module.exports=router;
