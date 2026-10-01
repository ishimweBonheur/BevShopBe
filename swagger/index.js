const swaggerUi = require('swagger-ui-express');

const string = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const amount = { type: 'number', minimum: 0, example: 2500 };
const quantity = { type: 'integer', minimum: 1 };
const object = (properties, required = []) => ({ type: 'object', properties, required });
const financial = {
  requestKey: { ...uuid, description: 'Generate a new UUID for each entry. Reuse it with the same payload only when retrying.' },
  paymentMethod: { type: 'string', enum: ['cash', 'mobile_money', 'card'], default: 'cash' },
  notes: string,
  date: {type:'string',format:'date',description:'Optional transaction date in Africa/Kigali. Stock entries must be posted in date order.'},
};
const product = object({ name: string, categoryId: uuid, description: string, unitsPerPack: quantity, sellingPrice: amount, lowStockLevel: { type: 'integer', minimum: 0 }, barcode: string, packs:quantity, amountPerPack:amount, requestKey:uuid, supplierId:uuid, date:{type:"string",format:"date"} }, ['name', 'unitsPerPack', 'sellingPrice']);
const category = object({ name: string, description: string }, ['name']);
const idParameter = { name: 'id', in: 'path', required: true, schema: uuid };
const paths = {};
function operation(path, method, summary, tag, schema, options = {}) {
  const { public: isPublic, parameters, created } = options;
  paths[path] ||= {};
  paths[path][method] = {
    summary, tags: [tag],
    ...(isPublic ? { security: [] } : {}),
    ...(parameters ? { parameters } : {}),
    ...(schema ? { requestBody: { required: true, content: { 'application/json': { schema } } } } : {}),
    responses: {
      [created ? '201' : '200']: { description: 'Successful response' },
      '400': { description: 'Invalid input' },
      '401': {description:'Invalid credentials or expired session'}, '403': {description:'Invalid setup token'},
      '409': { description: 'Conflicting entry, insufficient stock, or below-cost acknowledgement required' },
    },
  };
}
operation('/health', 'get', 'Check database connection', 'Health', null, { public: true });
operation('/auth/setup-status', 'get', 'Check whether the first owner needs to be created', 'Authentication', null, { public: true });
operation('/auth/setup', 'post', 'Create the first owner (requires SETUP_TOKEN from the backend environment)', 'Authentication', object({ firstName: string, lastName: string, email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 10 }, setupToken: string }, ['firstName', 'lastName', 'email', 'password', 'setupToken']), { public: true, created: true });
operation('/auth/login', 'post', 'Sign in and copy the returned token into Authorize', 'Authentication', object({ email: { type: 'string', format: 'email' }, password: { type: 'string', format: 'password', description:'Use the exact password saved during owner setup.', minLength:10 } }, ['email', 'password']), { public: true });
operation('/auth/check', 'get', 'Get the signed-in user', 'Authentication');
operation('/settings', 'get', 'Get shop settings', 'Settings');
operation('/categories', 'get', 'List categories', 'Categories');
operation('/categories', 'post', 'Create a category', 'Categories', category, { created: true });
operation('/categories/{id}', 'put', 'Update a category', 'Categories', category, { parameters: [idParameter] });
operation('/categories/{id}', 'delete', 'Archive a category', 'Categories', null, { parameters: [idParameter] });
operation('/products', 'get', 'List products and pricing suggestions', 'Products', null, { parameters: [{ name: 'search', in: 'query', schema: string }] });
operation('/products', 'post', 'Create product and receive its initial packs atomically', 'Products', {...product,required:['name','categoryId','unitsPerPack','sellingPrice','packs','amountPerPack','requestKey']}, { created: true });
operation('/products/{id}', 'put', 'Update product details and selling price', 'Products', product, { parameters: [idParameter] });
operation('/products/{id}', 'delete', 'Archive a product with no remaining stock', 'Products', null, { parameters: [idParameter] });
operation('/purchases', 'post', 'Receive packs paid in full', 'Stock', object({ ...financial, productId: uuid, packs: { ...quantity, example: 2 }, unitsPerPack: quantity, totalCost: { ...amount, example: 50000 }, deliveryCost: amount, supplierId:uuid, date:{type:"string",format:"date"} }, ['requestKey', 'productId', 'packs', 'totalCost']), { created: true });
operation('/sales', 'post', 'Record a paid sale of individual items', 'Sales', object({ ...financial, items: { type: 'array', minItems: 1, items: object({ productId: uuid, quantity, unitPrice: amount }, ['productId', 'quantity']) }, acceptBelowCost: { type: 'boolean', default: false } }, ['requestKey', 'items']), { created: true });
operation('/expenses', 'post', 'Record a paid operating expense', 'Accounting', object({ ...financial, category: string, amount }, ['requestKey', 'category', 'amount']), { created: true });
operation('/losses', 'post', 'Record damaged, expired or missing items', 'Stock', object({ ...financial, productId: uuid, quantity }, ['requestKey', 'productId', 'quantity', 'notes']), { created: true });
for (const endpoint of ['capital', 'withdrawals']) operation('/' + endpoint, 'post', endpoint === 'capital' ? 'Record owner funds' : 'Record an owner withdrawal', 'Accounting', object({ ...financial, amount }, ['requestKey', 'amount']), { created: true });
operation('/reversals', 'post', 'Reverse an entry with an audit reason', 'Accounting', object({ ...financial, transactionId: uuid }, ['requestKey', 'transactionId', 'notes']), { created: true });
operation('/transactions', 'get', 'Read transaction history', 'Accounting', null, { parameters: [{ name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },{name:'kind',in:'query',schema:string,description:'Comma-separated transaction types'},{name:'supplierId',in:'query',schema:uuid}] });
operation('/reports/summary', 'get', 'Revenue, profit, cash and inventory report', 'Reports', null, { parameters: [
  { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly', 'yearly', 'custom'], default: 'daily' } },
  {name:'date',in:'query',description:'Choose the day, week, month or year containing this date.',schema:{type:'string',format:'date'}},
  ...['startDate', 'endDate'].map(name => ({ name, in: 'query', description: 'Required for a custom period; end date is inclusive.', schema: { type: 'string', format: 'date' } })),
] });

operation('/suppliers','get','List suppliers','Purchases');
operation('/suppliers','post','Create supplier','Purchases',object({name:string,phone:string,email:string,address:string},['name']),{created:true});
operation('/suppliers/{id}','put','Update supplier','Purchases',object({name:string,phone:string,email:string,address:string},['name']),{parameters:[idParameter]});
operation('/reconciliations/preview','get','Expected cash and Mobile Money balances','Reconciliation',null,{parameters:[{name:'date',in:'query',schema:{type:'string',format:'date'}}]});
operation('/reconciliations','get','Saved daily balance comparisons','Reconciliation');
operation('/reconciliations','post','Record actual balances without changing the ledger','Reconciliation',object({...financial,date:{type:'string',format:'date'},expectedCash:string,expectedMobile:string,actualCash:amount,actualMobile:amount},['requestKey','expectedCash','expectedMobile','actualCash','actualMobile']),{created:true});
operation('/stock-counts','get','Physical stock count history','Stock');
operation('/stock-counts','post','Count individual stock and post the difference','Stock',object({...financial,productId:uuid,expectedQuantity:{type:'integer',minimum:0},actualQuantity:{type:'integer',minimum:0},unitCost:amount},['requestKey','productId','expectedQuantity','actualQuantity','notes']),{created:true});
operation('/auth/password','post','Change password and revoke existing sessions','Authentication',object({currentPassword:string,newPassword:{...string,minLength:10}},['currentPassword','newPassword']));
operation('/auth/recovery-code','post','Create a one-time offline recovery code','Authentication',object({currentPassword:string},['currentPassword']));
operation('/auth/recover','post','Reset password using the saved one-time recovery code','Authentication',object({email:string,recoveryCode:string,newPassword:{...string,minLength:10}},['email','recoveryCode','newPassword']),{public:true});
operation('/backups','get','Encrypted backup status and available copies','Recovery');
operation('/backups','post','Create encrypted database backup','Recovery',null,{created:true});
operation('/backups/{name}','get','Download encrypted backup','Recovery',null,{parameters:[{name:'name',in:'path',required:true,schema:string}]});
const specs = {
  openapi: '3.0.3',
  info: { title: 'Beverage Shop API', version: '1.0.0', description: 'PostgreSQL inventory and bookkeeping. Documentation is public. To call protected endpoints, sign in through POST /auth/login and paste the returned token into Authorize. Single-owner shop. All amounts are RWF.' },
  servers: [{ url: '/api' }],
  security: [{ BearerAuth: [] }],
  components: { securitySchemes: { BearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
  paths,
};

module.exports = { swaggerUi, specs };
