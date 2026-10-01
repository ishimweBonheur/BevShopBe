const fs=require('node:fs');const path=require('node:path');const {randomBytes}=require('node:crypto');
const file=path.join(__dirname,'../.env');let content=fs.readFileSync(file,'utf8');
const env=require('dotenv').parse(content);
if(env.BACKUP_KEY && !/^[a-f0-9]{64}$/i.test(env.BACKUP_KEY))throw Error('Existing BACKUP_KEY is invalid; do not replace a key used for existing backups');
if(!env.BACKUP_KEY){content=content.replace(/^BACKUP_KEY=.*\r?\n?/m,'');fs.writeFileSync(file,content.trimEnd()+'\nBACKUP_KEY='+randomBytes(32).toString('hex')+'\n');}
console.log('Backup encryption configured. Preserve BACKUP_KEY separately from your backup files.');
