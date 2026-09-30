const Product = require('../models/Product');

exports.getProducts = async (query) => {
  try {
    const { page = 1, limit = 10, search } = query;
    const filters = {};

    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const products = await Product.find(filters)
      .skip((+page - 1) * +limit)
      .limit(+limit)
      .populate('category')
      .lean(); // Converts documents into plain JS objects for performance

    const total = await Product.countDocuments(filters);

    return { products, total, page: +page, limit: +limit };
  } catch (error) {
    throw new Error('Error fetching products');
  }
};

exports.getProductById = async (id) => {
  return await Product.findById(id).populate('category').lean();
};

exports.createProduct = async (data) => {
  const product = new Product(data);
  return await product.save();
};

exports.updateProduct = async (id, data) => {
  return await Product.findByIdAndUpdate(id, data, { new: true }).populate('category');
};

exports.deleteProduct = async (id) => {
  return await Product.findByIdAndDelete(id);
};
