// const mongoose = require('mongoose');

// const categorySchema = new mongoose.Schema({
//   name: { type: String, required: true, unique: true },
//   parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
//   isActive: { type: Boolean, required: true, default: true}
// }, { timestamps: true });

// module.exports = mongoose.model('Category', categorySchema);


const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  isActive: { type: Boolean, required: true, default: true }
}, { timestamps: true });

// Middleware to handle category deletion
categorySchema.post('findOneAndDelete', async function (doc) {
  if (doc) {
    //This is to update all products with this category to set category to null
    await mongoose.model('Product').updateMany(
      { category: doc._id },
      { $set: { category: null } }
    );

    // This is to update all subcategories with this category as parent to set parent to null
    await mongoose.model('Category').updateMany(
      { parent: doc._id },
      { $set: { parent: null } }
    );
  }
});

module.exports = mongoose.model('Category', categorySchema);