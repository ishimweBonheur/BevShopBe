require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { swaggerUi, specs } = require('./swagger');
const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json({limit:'256kb'}));
app.get('/',(req,res)=>res.json({message:'Beverage shop API',database:'postgresql',health:'/api/health',docs:'/api/docs'}));
// Documentation must be mounted before the authenticated API router.
app.get('/api/docs.json', (req, res) => res.json(specs));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(specs, { customSiteTitle: 'Beverage Shop API' }));
app.use('/api',require('./routes'));
function start() {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) throw new Error('DATABASE_URL and JWT_SECRET are required');
  const {pool}=require('./models');
  pool.query('SELECT 1 FROM settings LIMIT 1').then(()=>{
    const server=app.listen(process.env.PORT || 4000,()=>console.log(`Shop API listening on port ${process.env.PORT || 4000}`));
    require('./services/backup').schedule();
    for (const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>pool.end()));
  }).catch(error=>{console.error('Database unavailable. Run npm run db:migrate first.',error.code || error.name);process.exitCode=1;pool.end();});
}
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use(require('./middlewares/errors'));
if (require.main === module) start();
module.exports = app;
