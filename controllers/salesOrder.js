const Order = require("../models/salesOrder");
const Product = require("../models/Product");
const Sale = require("../models/sales");
const sales = require("../models/sales");
const mongoose = require('mongoose');
const { generateInvoicesNumber } = require("../helper");
exports.createOrder = async (req, res) => {
  try {
    console.log(req.user_id)
    let { customer, products, discount, tax } = req.body;

    // Ensure tax and discount are numbers
    discount = parseFloat(discount) || 0;
    tax = parseFloat(tax) || 0;

    let totalAmount = 0; // Initialize total amount

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product || product.quantity < item.quantity) {
        return res
          .status(400)
          .json({
            error: `Insufficient stock for ${product?.name || "a product"}`,
          });
      }

      totalAmount += item.price * item.quantity;

      product.quantity -= item.quantity;
      await product.save();
    }

    totalAmount -= discount;
    totalAmount = totalAmount < 0 ? 0 : totalAmount;

    totalAmount += (tax / 100) * totalAmount;
    const invoiceNumber = await generateInvoicesNumber()
   
    const order = await Order.create({ products, totalAmount, discount, customer, tax, preparedBy:req.user._id,invoiceNumber });

   

    const sale = await Sale.create({
      order: order._id,
      totalAmount: order.totalAmount,
      remainingAmount: order.totalAmount,
      paymentMethod: "none",
      status: "pending",
    });

    res.status(201).json({ order, sale });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateOrder = async (req, res) => {
  try {
    const { products, tax, discount } = req.body;
    let totalAmount = 0;

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    for (const item of order.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    for (const item of products) {
      const product = await Product.findById(item.product);
      if (!product || product.quantity < item.quantity) {
        return res
          .status(400)
          .json({
            error: `Insufficient stock for ${product?.name || "a product"}`,
          });
      }
      totalAmount += item.price * item.quantity;
      product.quantity -= item.quantity;
      await product.save();
    }

    totalAmount += tax - discount;

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { products, totalAmount, tax, discount },
      { new: true }
    );

    await Sale.findOneAndUpdate(
      { order: req.params.id },
      { totalAmount },
      { new: true }
    );

    res.status(200).json(updatedOrder);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });

    for (const item of order.products) {
      const product = await Product.findById(item.product);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    await Order.findByIdAndDelete(req.params.id);

    // Delete the corresponding Sale entry
    await Sale.findOneAndDelete({ order: req.params.id });

    res
      .status(200)
      .json({ message: "Order and related sale deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate(
      "products.product"
    );
    if (!order) return res.status(404).json({ error: "Order not found" });

    for (const item of order.products) {
      const product = await Product.findById(item.product._id);
      if (product) {
        product.quantity += item.quantity;
        await product.save();
      }
    }

    order.status = "canceled";
    await order.save();

    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.completeOrder = async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "completed" },
      { new: true }
    );
    res.status(200).json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getSalesOrders = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const total = await Order.countDocuments();
    const totalPages = Math.ceil(total / size);
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(size, 10);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    const orders = await Order.find()
    .sort({ createdAt: -1 }) 
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .populate("products.product")
      .populate("preparedBy", "firstName lastName email phone") // Populate preparedBy with selected fields
      .lean();

    res.status(200).json({
      list: orders,
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

// This is to filter the sales by product
exports.getSalesByProduct = async (req, res) => {
  try {
    const { page = 1, size = 10, productId } = req.query;

    const pageSize = parseInt(size, 10);
    const currentPage = parseInt(page, 10);
    const skip = (currentPage - 1) * pageSize;

    const matchStage = productId
      ? [{ $match: { "products.product": new mongoose.Types.ObjectId(productId) } }]
      : [];

    // Aggregate to get sales by product
    const salesByProduct = await Order.aggregate([
      ...matchStage, 
      { $unwind: "$products" }, 
      {
        $group: {
          _id: "$products.product", 
          totalQuantity: { $sum: "$products.quantity" }, 
          totalSales: { $sum: { $multiply: ["$products.quantity", "$products.price"] } }, 
        },
      },
      {
        $lookup: {
          from: "products",
          localField: "_id",
          foreignField: "_id",
          as: "productDetails",
        },
      },
      { $unwind: "$productDetails" }, 
      {
        $project: {
          productName: "$productDetails.name", 
          productDescription: "$productDetails.description", 
          productImage: "$productDetails.image", 
          productPrice: "$productDetails.price", 
          totalQuantity: 1,
          totalSales: 1,
        },
      },
      { $skip: skip }, 
      { $limit: pageSize }, 
    ]);

    
    const totalProducts = await Order.aggregate([
      ...matchStage, 
      { $unwind: "$products" },
      { $group: { _id: "$products.product" } },
      { $count: "total" },
    ]);

    const total = totalProducts.length > 0 ? totalProducts[0].total : 0;
    const totalPages = Math.ceil(total / pageSize);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    res.status(200).json({
      list: salesByProduct,
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