const Decimal = require('decimal.js');
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function money(value, label = 'Amount', positive = false) {
  if (!['string', 'number'].includes(typeof value) || !/^\d+(\.\d{1,6})?$/.test(String(value))) fail(`${label} must be a non-negative number with up to 6 decimal places`);
  const result = new Decimal(value);
  if (result.gte('1000000000000') || (positive && result.lte(0))) fail(`${label} is outside the supported range`);
  return result;
}
function integer(value, label = 'Quantity', min = 1) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < min || n > 100000000) fail(`${label} must be a whole number between ${min} and 100000000`);
  return n;
}
function allocatedCost(value, available, sold) {
  if (sold > available) fail(`Insufficient stock. Only ${available} items are available.`, 409);
  return sold === available ? new Decimal(value) : new Decimal(value).mul(sold).div(available).toDecimalPlaces(6);
}
function suggestedPrice(value, quantity, margin) {
  if (!quantity) return '0.000000';
  return new Decimal(value).div(quantity).div(new Decimal(1).minus(new Decimal(margin).div(100))).toFixed(6, Decimal.ROUND_UP);
}
module.exports = { Decimal, fail, money, integer, allocatedCost, suggestedPrice };
