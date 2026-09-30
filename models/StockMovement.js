const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['entry', 'exit'],
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      enum: ['sold', 'returned', 'damaged', 'other'],
      required: function () { return this.type === 'exit'; },
    },
    notes: { type: String }, 
  },
  { timestamps: true }
);

module.exports = mongoose.model('StockMovement', stockMovementSchema);
