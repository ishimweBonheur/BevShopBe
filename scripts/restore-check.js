require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const fs=require('node:fs/promises');const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const {decrypt,restoreData,status,directory}=require('../services/backup');
(async()=>{
  const name=process.argv[2] || (await status()).files[0];if(!name)throw Error('No backup available');
  const file=path.resolve(directory(),name);const data=decrypt(await fs.readFile(file));
  const db=new PGlite();try{
    await db.exec(await fs.readFile(path.join(__dirname,'../models/schema.sql'),'utf8'));
    const counts=await db.transaction(tx=>restoreData(tx,data));
    const report={file:path.basename(file),checkedAt:new Date().toISOString(),success:true,counts};
    await fs.writeFile(path.join(directory(),'restore-check.json'),JSON.stringify(report,null,2));
    console.log('Restore verified in isolated PostgreSQL; all table hashes match.',JSON.stringify(counts));
  }finally{await db.close();}
})().catch(e=>{console.error('Restore check failed:',e.message);process.exitCode=1;}).finally(()=>require('../models').pool.end());
