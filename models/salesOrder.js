const { required } = require('joi');
const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema(
  {
    products: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
      },
    ],
    totalAmount: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    preparedBy :{type: mongoose.Schema.Types.ObjectId, ref: "User",required: true},
    invoiceNumber: {type: String, required: true},
    discount: { type: Number, default: 0 },
    customer: { type: String, required: true },
    status: { type: String, enum: ['pending', 'completed', 'canceled'], default: 'pending' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
