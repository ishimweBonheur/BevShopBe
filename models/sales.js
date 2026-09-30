const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    totalAmount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ['none', 'cash', 'card', 'mobile'], default: 'none' },
    remainingAmount: { type:Number, required: true, default: 0 },
    amountPaid: { type: Number, default: 0},
    notes:{ type: String},
    overPaid: {type: Number, default: 0},
    status: { type: String, enum: ['pending', 'paid', 'refunded','half-paid'], default: 'pending' },
  },
  { timestamps: true }
);

// Middleware: If status is 'pending', set paymentMethod to 'none'
saleSchema.pre('save', function (next) {
  if (this.status === 'pending') {
    this.paymentMethod = 'none';
  }
  next();
});

module.exports = mongoose.model('Sale', saleSchema);
