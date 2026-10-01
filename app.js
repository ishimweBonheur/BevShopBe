require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { swaggerUi, specs } = require('./swagger');

const app = express();

// ---------- CORS ----------
// Fixed origins (local dev + deployed frontend)
const staticOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://beverages-red.vercel.app',
];

// Optional: additional origins via comma-separated FRONTEND_URL
if (process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(url => staticOrigins.push(url));
}

// Allow any Vercel preview deployment for this project
const vercelPreviewRegex =
  /^https:\/\/beverages-[a-z0-9]+-ishimwebonheurs-projects\.vercel\.app$/;

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients (curl, Swagger UI, server-to-server)
    if (!origin) return callback(null, true);

    if (staticOrigins.includes(origin) || vercelPreviewRegex.test(origin)) {
      return callback(null, true);
    }

    console.warn('CORS blocked origin:', origin);
    return callback(new Error(`CORS blocked: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ---------- Body parsing ----------
app.use(express.json({ limit: '256kb' }));

// ---------- Root ----------
app.get('/', (req, res) =>
  res.json({
    message: 'Beverage shop API',
    database: 'postgresql',
    health: '/api/health',
    docs: '/api/docs',
  })
);

// ---------- Docs (must be mounted before the authenticated API router) ----------
app.get('/api/docs.json', (req, res) => res.json(specs));
app.use(
  '/api/docs',
  swaggerUi.serve,
  swaggerUi.setup(specs, { customSiteTitle: 'Beverage Shop API' })
);

// ---------- API routes ----------
app.use('/api', require('./routes'));

// ---------- 404 + error handling ----------
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(require('./middlewares/errors'));

// ---------- Startup ----------
function start() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) {
    throw new Error('DATABASE_URL and JWT_SECRET are required');
  }
  const { pool } = require('./models');
  pool
    .query('SELECT 1 FROM settings LIMIT 1')
    .then(() => {
      const server = app.listen(process.env.PORT || 4000, () =>
        console.log(`Shop API listening on port ${process.env.PORT || 4000}`)
      );
      require('./services/backup').schedule();
      for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, () => server.close(() => pool.end()));
      }
    })
    .catch(error => {
      console.error(
        'Database unavailable. Run npm run db:migrate first.',
        error.code || error.name
      );
      process.exitCode = 1;
      pool.end();
    });
}

if (require.main === module) start();
module.exports = app;