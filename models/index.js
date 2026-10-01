require('dotenv').config();
const { Pool } = require('pg');
const connections = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, connectionTimeoutMillis: 15000,
});
async function transaction(fn) {
  const client = await connections.connect();
  try {
    // PgBouncer transaction pooling rejects startup options and cannot retain
    // session-level SET state. Keep schema selection inside every transaction.
    await client.query('BEGIN; SET LOCAL search_path TO bevshop, public');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
const pool = {
  query: (...args) => transaction(client => client.query(...args)),
  end: () => connections.end(),
};
module.exports = { pool, transaction };
