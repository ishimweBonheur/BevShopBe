const { fail } = require('./money');
const wrap = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
const text = (value, label, required = true) => {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length>2000) fail(`${label} is required and must be text under 2000 characters`);
  return value.trim();
};

module.exports = { wrap, text };
