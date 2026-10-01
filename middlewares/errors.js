module.exports = (error,req,res,next) => {
  if (res.headersSent) return next(error);
  const duplicate=error.code==='23505' && /categories|products/.test(error.constraint || '');
  const status=error.status || (duplicate ? 409 : ['23505','23503','23514','22P02','22003'].includes(error.code) ? 400:500);
  if (status===500) console.error('Shop API error:',error.code || error.name);
  res.status(status).json({error:duplicate ? (/categories/.test(error.constraint) ? 'Category already exists':'This product already exists.') : status===500 ? 'The operation failed. No partial transaction was saved.':error.status ? error.message:'Invalid or duplicate record; check the supplied values.',...(error.productId ? {productId:error.productId}:{})});
};
