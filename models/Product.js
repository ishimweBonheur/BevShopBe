const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    image: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
    price: { type: Number, required: true },
    isUnique: { type: Boolean, required: true },
    barcode: { type: Schema.Types.Mixed, unique: true },
    quantity: {
      type: Number,
      default: function () {
        return this.isUnique ? 1 : 0;
      },
      min: 0,
    },
    colors: { type: String, default: '' },
    sizes: { type: String, default: '' },
    condition: {
      type: String,
      enum: ['New', 'Like New', 'Good', 'Fair'],
      required: true,
    },
    status: { type: String, enum: ['available', 'sold_out'], default: 'available' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.pre('save', async function (next) {
  if (!this.barcode) {
    let barcode;
    let exists;
    do {
      barcode = Math.floor(1000000000 + Math.random() * 9000000000).toString(); 
      exists = await mongoose.model('Product').findOne({ barcode });
    } while (exists);
    this.barcode = barcode;
  }
  
  
  this.status = this.quantity === 0 ? 'sold_out' : 'available';
  
  next();
});

module.exports = mongoose.model('Product', productSchema);
