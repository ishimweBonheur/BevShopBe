const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const {randomUUID,randomBytes}=require('node:crypto');const {PGlite}=require('@electric-sql/pglite');
test('encrypted snapshot restores every table exactly and refuses nonempty targets or altered ciphertext',async()=>{
  const {createTestApp}=require('./support/database');const {database}=await createTestApp();const target=new PGlite();
  const {snapshot,encrypt,decrypt,restoreData}=require('../services/backup');
  process.env.BACKUP_KEY=randomBytes(32).toString('hex');
  try{
    const owner=randomUUID(),product=randomUUID();
    await database.query("INSERT INTO users(id,email,username,password,first_name,last_name,role) VALUES($1,'backup@example.com','owner','hashed','Backup','Owner','ADMIN')",[owner]);
    await database.query('UPDATE settings SET owner_id=$1',[owner]);
    await database.query("INSERT INTO products(id,name,barcode,units_per_pack,selling_price) VALUES($1,'Precision test',$2,12,2500)",[product,product]);
    await database.transaction(db=>require('../services/accounting').post(db,'purchase',{requestKey:randomUUID(),productId:product,packs:2,totalCost:'99999999999.123456'},owner));
    const data=await snapshot(database);const encrypted=encrypt(data);assert.ok(!encrypted.includes(Buffer.from('backup@example.com')));
    const damaged=Buffer.from(encrypted);damaged[damaged.length-1]^=1;assert.throws(()=>decrypt(damaged));
    await target.exec(fs.readFileSync('models/schema.sql','utf8'));
    const restored=await target.transaction(db=>restoreData(db,decrypt(encrypted)));
    assert.equal(restored.products,1);assert.equal(restored.transactions,1);assert.equal((await target.query('SELECT inventory_value FROM products')).rows[0].inventory_value,'99999999999.123456');
    await assert.rejects(target.transaction(db=>restoreData(db,data)),/empty/);
  }finally{await database.close();await target.close();}
});
