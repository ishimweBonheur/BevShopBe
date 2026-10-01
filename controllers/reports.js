const { transaction } = require('../models');
const { wrap } = require('../helper/http');
const { report } = require('../services/reports');

exports.getSummary = wrap(async (req,res) => res.json(await transaction(async db => {
  await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
  return report(db,req.query);
})));
