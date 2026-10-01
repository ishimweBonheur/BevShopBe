const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({connectionString:process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL});
async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(85215249)');
    await client.query(fs.readFileSync(path.join(__dirname, '../models/schema.sql'), 'utf8'));
    await client.query('COMMIT');
  } catch(error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
if (require.main === module) migrate().then(() => console.log('PostgreSQL schema ready'))
  .catch(error => { console.error('Migration failed:', error.code || error.message); process.exitCode = 1; })
  .finally(() => pool.end());
module.exports = { migrate };
