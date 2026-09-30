const mongoose = require('mongoose');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

exports.createStockMovement = async (req, res) => {
  try {
    const { type, productId, quantity, reason } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({ error: 'Product ID and quantity are required' });
    }

    // Validate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid Product ID' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // ❌ Reject movement if the product is unique
    if (product.isUnique) {
      return res.status(400).json({ error: 'Stock movement is not allowed for unique products' });
    }

    const stockMovement = new StockMovement({
      type,
      product: productId,
      quantity,
      reason,
    });

    await stockMovement.save();

    if (type === 'entry') {
      product.quantity += quantity;
    } else if (type === 'exit') {
      if (product.quantity < quantity) {
        return res.status(400).json({ error: 'Not enough stock available' });
      }
      product.quantity -= quantity;
    }

    await product.save();

    res.status(201).json(stockMovement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update Stock Movement
exports.updateStockMovement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    const { type, productId, quantity, reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }

    const stockMovement = await StockMovement.findById(id).session(session);
    if (!stockMovement) {
      return res.status(404).json({ error: 'Stock movement not found' });
    }

    const product = await Product.findById(productId).session(session);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.isUnique) {
      return res.status(400).json({ error: 'Stock movement update not allowed for unique products' });
    }

    // Revert previous stock movement effect
    if (stockMovement.type === 'entry') {
      product.quantity -= stockMovement.quantity;
    } else if (stockMovement.type === 'exit') {
      product.quantity += stockMovement.quantity;
    }

    // Apply new stock movement effect
    if (type === 'entry') {
      product.quantity += quantity;
    } else if (type === 'exit') {
      if (product.quantity < quantity) {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({ error: 'Not enough stock available' });
      }
      product.quantity -= quantity;
    }

    // Update stock movement record
    stockMovement.type = type;
    stockMovement.product = productId;
    stockMovement.quantity = quantity;
    stockMovement.reason = reason;

    await stockMovement.save({ session });
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json(stockMovement);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};

// Delete Stock Movement
exports.deleteStockMovement = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid stock movement ID' });
    }

    const stockMovement = await StockMovement.findById(id).session(session);
    if (!stockMovement) {
      return res.status(404).json({ error: 'Stock movement not found' });
    }

    const product = await Product.findById(stockMovement.product).session(session);
    if (!product) {
      return res.status(404).json({ error: 'Associated product not found' });
    }

    if (product.isUnique) {
      return res.status(400).json({ error: 'Stock movement deletion not allowed for unique products' });
    }

    // Reverse the stock movement effect before deleting
    if (stockMovement.type === 'entry') {
      product.quantity -= stockMovement.quantity;
    } else if (stockMovement.type === 'exit') {
      product.quantity += stockMovement.quantity;
    }

    await stockMovement.deleteOne({ session });
    await product.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Stock movement deleted successfully' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ error: error.message });
  }
};



exports.getStockMovements = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    // Convert to integers
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(size, 10);

    // Calculate total stock movements and pages
    const total = await StockMovement.countDocuments();
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    // Get paginated stock movements
    const stockMovements = await StockMovement.find()
    .sort({ createdAt: -1 }) 
      .populate('product')
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .lean();

    // Return paginated response
    res.status(200).json({
      list: stockMovements,
      total,
      totalPages,
      currentPage,
      pageSize,
      nextPage: hasNextPage ? currentPage + 1 : null,
      prevPage: hasPrevPage ? currentPage - 1 : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getStockMovementById = async (req, res) => {
  try {
    const stockMovement = await StockMovement.findById(req.params.id).populate('product');
    if (!stockMovement) {
      return res.status(404).json({ error: 'Stock movement not found' });
    }
    res.status(200).json(stockMovement);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getInventoryReport = async (req, res) => {
  try {
    const products = await Product.find();
    const report = products.map(product => ({
      productId: product._id,
      name: product.name,
      stockLevel: product.quantity,
      stockValue: product.quantity * product.price,
      turnoverRate: product.salesCount ? product.salesCount / (product.quantity || 1) : 0,
    }));
    res.status(200).json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



// This is to filter the movement by product
exports.getStockMovementByProduct = async (req, res) => {
  try {
    const { productId } = req.params; 
    const { page = 1, size = 10 } = req.query; 

    const pageSize = parseInt(size, 10);
    const currentPage = parseInt(page, 10);
    const skip = (currentPage - 1) * pageSize;

    // This is toValidate productId
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    // Find stock movements by productId
    const stockMovements = await StockMovement.find({ product: productId })
      .populate('product') // Populate product details
      .skip(skip) // Pagination: skip records
      .limit(pageSize); // Pagination: limit records

    // Count total stock movements for the product
    const total = await StockMovement.countDocuments({ product: productId });
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    res.status(200).json({
      list: stockMovements,
      total,
      totalPages,
      currentPage,
      pageSize,
      nextPage: hasNextPage ? currentPage + 1 : null,
      prevPage: hasPrevPage ? currentPage - 1 : null,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};