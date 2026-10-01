require('dotenv').config({path:require('node:path').join(__dirname,'../.env')});
const {createBackup}=require('../services/backup');
createBackup().then(r=>console.log('Encrypted backup saved:',r.name)).catch(()=>{console.error('Backup failed. Check database, BACKUP_KEY and backup directory.');process.exitCode=1;}).finally(()=>require('../models').pool.end());
