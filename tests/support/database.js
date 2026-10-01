const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

// Isolated PostgreSQL engine: API tests never connect to the configured Neon URL.
async function createTestApp() {
  const database = new PGlite();
  await database.exec(fs.readFileSync(path.join(__dirname, '../../models/schema.sql'), 'utf8'));
  process.env.JWT_SECRET = 'test-only-jwt-secret-not-for-deployment';
  process.env.SETUP_TOKEN = 'test-only-owner-setup-token';
  const modelPath = require.resolve('../../models');
  require.cache[modelPath] = {
    id: modelPath,
    filename: modelPath,
    loaded: true,
    exports: {
      pool: { query: (...args) => database.query(...args), end: () => database.close() },
      transaction: callback => database.transaction(callback),
    },
  };
  const app = require('../../app');
  return { app, database };
}

module.exports = { createTestApp };
