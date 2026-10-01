const fs=require('node:fs/promises');
const path=require('node:path');
const {randomBytes,createCipheriv,createDecipheriv,createHash}=require('node:crypto');
const {transaction}=require('../models');
const tables=['users','categories','suppliers','products','settings','transactions','transaction_items','stock_movements','journal_lines','stock_counts','cash_reconciliations','recovery_codes'];
const directory=()=>path.resolve(process.env.BACKUP_DIR || path.join(__dirname,'../backups'));
const key=()=>{if(!/^[a-f0-9]{64}$/i.test(process.env.BACKUP_KEY||''))throw Error('Configure BACKUP_KEY before backing up');return Buffer.from(process.env.BACKUP_KEY,'hex');};
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const digest=rows=>createHash('sha256').update(JSON.stringify(rows.map(canonical).map(r=>JSON.stringify(r)).sort())).digest('hex');
// Text values preserve arbitrary numeric precision and PostgreSQL microseconds.
const readTable=(db,table)=>db.query(`SELECT (SELECT json_object_agg(key,value) FROM jsonb_each_text(to_jsonb(t))) AS row FROM ${table} t`);
async function snapshot(db){
  const data={};for(const table of tables)data[table]=(await readTable(db,table)).rows.map(r=>r.row);
  return {version:1,createdAt:new Date().toISOString(),tables:data};
}
function encrypt(data){const iv=randomBytes(12);const cipher=createCipheriv('aes-256-gcm',key(),iv);const bytes=Buffer.concat([cipher.update(JSON.stringify(data),'utf8'),cipher.final()]);return Buffer.concat([Buffer.from('BEVBACK1'),iv,cipher.getAuthTag(),bytes]);}
function decrypt(bytes){if(bytes.subarray(0,8).toString()!=='BEVBACK1')throw Error('Invalid backup format');const decipher=createDecipheriv('aes-256-gcm',key(),bytes.subarray(8,20));decipher.setAuthTag(bytes.subarray(20,36));const data=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(36)),decipher.final()]).toString());if(data.version!==1||tables.some(t=>!Array.isArray(data.tables?.[t])))throw Error('Unsupported backup');return data;}
async function restoreData(db,data){
  // Restore only into an empty shop. Never delete or overwrite existing business records.
  for(const table of tables.filter(t=>t!=='settings'))if(Number((await db.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n))throw Error('Restore target must be empty');
  for(const table of tables){
    const rows=data.tables[table];if(!rows.length)continue;
    if(table==='settings'){
      const columns=Object.keys(rows[0]).filter(c=>c!=='id');
      if(columns.some(c=>!/^[a-z_]+$/.test(c)))throw Error('Invalid settings');
      await db.query(`UPDATE settings s SET ${columns.map(c=>`"${c}"=r."${c}"`).join(',')} FROM json_populate_recordset(NULL::settings,$1::json) r WHERE s.id=r.id`,[JSON.stringify(rows)]);
    }else await db.query(`INSERT INTO ${table} SELECT * FROM json_populate_recordset(NULL::${table},$1::json)`,[JSON.stringify(rows)]);
  }
  for(const table of tables){const rows=(await readTable(db,table)).rows.map(r=>r.row);if(digest(rows)!==digest(data.tables[table]))throw Error('Restored data mismatch: '+table);}
  return Object.fromEntries(tables.map(t=>[t,data.tables[t].length]));
}
let running=false;
async function createBackup(){
  if(running)throw Error('A backup is already running');running=true;
  try{
    const data=await transaction(async db=>{await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');return snapshot(db);});
    const name='bevshop-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomBytes(4).toString('hex')+'.bevbackup';
    await fs.mkdir(directory(),{recursive:true});const file=path.join(directory(),name);
    await fs.writeFile(file+'.tmp',encrypt(data),{mode:0o600,flag:'wx'});await fs.rename(file+'.tmp',file);
    // Retain the newest 30 daily/manual snapshots. Recovery checks never delete files.
    const files=(await fs.readdir(directory())).filter(n=>/^bevshop-.*\.bevbackup$/.test(n)).sort().reverse();
    for(const old of files.slice(30))await fs.unlink(path.join(directory(),old));
    return {name,createdAt:data.createdAt};
  }finally{running=false;}
}
async function status(){
  const files=await fs.readdir(directory()).catch(()=>[]);const names=files.filter(n=>/^bevshop-.*\.bevbackup$/.test(n)).sort().reverse();
  const verification=await fs.readFile(path.join(directory(),'restore-check.json'),'utf8').then(JSON.parse).catch(()=>null);
  return {enabled:/^[a-f0-9]{64}$/i.test(process.env.BACKUP_KEY||''),schedule:'Every 24 hours while the backend is running; catches up at startup',retention:30,files:names,verification};
}
async function due(){const s=await status();if(!s.enabled)return;if(!s.files.length||(Date.now()-(await fs.stat(path.join(directory(),s.files[0]))).mtimeMs)>86400000)await createBackup();}
function schedule(){const run=()=>due().catch(()=>console.error('Automatic backup failed; check backup configuration and storage.'));run();const timer=setInterval(run,3600000);timer.unref();return timer;}
module.exports={tables,snapshot,encrypt,decrypt,restoreData,createBackup,status,schedule,directory};
