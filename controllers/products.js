const Product = require('../models/Product');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

const productSchema = Joi.object({
  name: Joi.string().required().messages({
    'any.required': 'Product name is required.',
    'string.empty': 'Product name cannot be empty.',
  }),
  description: Joi.string().optional(),
  image: Joi.string().optional(),
  category: Joi.string().optional(),
  price: Joi.number().required().messages({
    'any.required': 'Price is required.',
    'number.base': 'Price must be a number.',
  }),
  isUnique: Joi.boolean().required().messages({
    'any.required': 'isUnique field is required.',
  }),
  quantity: Joi.when('isUnique', {
    is: true,
    then: Joi.number().valid(1).messages({
      'any.only': 'Quantity must be exactly 1 when isUnique is true.',
    }),
    otherwise: Joi.number().min(0).messages({
      'number.min': 'Quantity cannot be less than 0.',
    }),
  }).default((parent) => (parent.isUnique ? 1 : 0)),
  condition: Joi.string().valid('New', 'Like New', 'Good', 'Fair').required().messages({
    'any.required': 'Condition is required.',
    'any.only': 'Condition must be one of: New, Like New, Good, Fair.',
  }),
  size: Joi.when('isUnique', {
    is: false,
    then: Joi.string().optional(),
  }),
  color: Joi.when('isUnique', {
    is: false,
    then: Joi.string().optional(),
  }),
  status: Joi.string().valid('available', 'sold_out').default('available'),
  barcode: Joi.string().optional(),
});

exports.getProducts = async (req, res) => {
  try {
    const { page = 1, pageSize = 10, search, categoryId } = req.query;
    const filters = {};

    // Search by name, description, or barcode
    if (search) {
      filters.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { barcode: { $regex: search, $options: "i" } },
      ];
    }

    // Filter by categoryId if provided
    if (categoryId) {
      filters.category = categoryId;
    }

    const total = await Product.countDocuments(filters);
    const totalPages = Math.ceil(total / pageSize);
    const currentPage = parseInt(page, 10);
    const Size = parseInt(pageSize, 10);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    const products = await Product.find(filters)
    .sort({ createdAt: -1 }) 
      .skip((currentPage - 1) * Size)
      .limit(Size)
      .populate("category")
      .lean();

    res.status(200).json({
      list: products,
      total,
      totalPages,
      currentPage,
      pageSize:Size,
      nextPage: hasNextPage ? currentPage + 1 : null,
      prevPage: hasPrevPage ? currentPage - 1 : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).populate('category').lean();
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createProduct = async (req, res) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.isUnique) {
      value.quantity = 1;

    }

    const product = new Product(value);
    await product.save();
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const { error, value } = productSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    if (value.isUnique) {
      value.quantity = 1;
    }

    const product = await Product.findByIdAndUpdate(req.params.id, value, { new: true }).populate('category');
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) return res.status(404).json({ error: "Product not found" });

    // Toggle the product's isActive status
    product.isActive = !product.isActive;

    // Save the updated product
    await product.save();

    res.json({
      message: `Product successfully ${product.isActive ? "activated" : "deactivated"}`,
      product,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

