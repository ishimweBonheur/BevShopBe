require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const fs=require('node:fs/promises');const path=require('node:path');const {Pool}=require('pg');
const {decrypt,restoreData}=require('../services/backup');
(async()=>{
  if(!process.env.RESTORE_DATABASE_URL||!process.argv[2])throw Error('Set RESTORE_DATABASE_URL to a separate empty database and supply the backup file path');
  const identify=url=>{const u=new URL(url);return u.hostname.replace('-pooler','')+u.pathname;};
  if([process.env.DATABASE_URL,process.env.DATABASE_URL_UNPOOLED].filter(Boolean).some(u=>identify(u)===identify(process.env.RESTORE_DATABASE_URL)))throw Error('Refusing to restore over the live database');
  const data=decrypt(await fs.readFile(path.resolve(process.argv[2])));
  const pool=new Pool({connectionString:process.env.RESTORE_DATABASE_URL});const db=await pool.connect();
  try{await db.query('BEGIN');
    const exists=(await db.query("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='bevshop') AS exists")).rows[0].exists;
    if(exists)throw Error('Use an empty database without a bevshop schema');
    await db.query(await fs.readFile(path.join(__dirname,'../models/schema.sql'),'utf8'));
    console.log('Restored and verified:',await restoreData(db,data));await db.query('COMMIT');
  }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();}
})().catch(e=>{console.error('Restore failed:',e.message);process.exitCode=1;}).finally(()=>require('../models').pool.end());
