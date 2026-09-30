const Sale = require("../models/sales");
const Product = require("../models/Product");
const Order = require("../models/salesOrder");

exports.getSales = async (req, res) => {
  try {
    const { page = 1, size = 10 } = req.query;

    const total = await Sale.countDocuments();
    const totalPages = Math.ceil(total / size);
    const currentPage = parseInt(page, 10);
    const pageSize = parseInt(size, 10);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    const sales = await Sale.find()
      .sort({ createdAt: -1 })
      .skip((currentPage - 1) * pageSize)
      .limit(pageSize)
      .populate({
        path: "order",
        populate: [
          {
            path: "products.product",
            model: "Product",
          },
          {
            path: "preparedBy",
            model: "User",
          },
        ],
      })
      .lean();

    res.status(200).json({
      list: sales,
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

exports.confirmPayment = async (req, res) => {
  try {
    const { orderId, paymentMethod, amountPaid, notes } = req.body;

    // Ensure amountPaid is a valid number
    const paymentAmount = parseFloat(amountPaid);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }

    // Find the order
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Find the sale record linked to the order
    let sale = await Sale.findOne({ order: orderId });
    if (!sale) return res.status(404).json({ error: "Sale record not found" });

    // Calculate new payment amounts
    const newAmountPaid = sale.amountPaid + paymentAmount;
    let newRemainingBalance = sale.totalAmount - newAmountPaid;
    let overPaid = sale.overPaid || 0; // Initialize overpaid amount if not present

    if (newRemainingBalance < 0) {
      // Track excess payment
      overPaid += Math.abs(newRemainingBalance);
      newRemainingBalance = 0; // Remaining balance should not be negative
    }

    // Determine new status
    const newStatus = newRemainingBalance === 0 ? "paid" : "half-paid";

    // Update sale record
    sale = await Sale.findOneAndUpdate(
      { order: orderId },
      {
        paymentMethod,
        amountPaid: newAmountPaid,
        remainingAmount: newRemainingBalance,
        overPaid,
        status: newStatus,
        notes: sale.notes,
      },
      { new: true }
    );

    // Update order status
    const orderStatus = newRemainingBalance === 0 ? "completed" : "pending";
    await Order.findByIdAndUpdate(orderId, {
      status: orderStatus,
      amountPaid: newAmountPaid,
    });

    res.status(200).json({ sale });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.scanBarcode = async (req, res) => {
  try {
    let { barcode } = req.body;

    if (!barcode) {
      return res.status(400).json({ error: "Barcode is required" });
    }

    // Ensure barcode is treated as a string for consistent searching
    const barcodeString = String(barcode).trim();

    // Search for product using the barcode as both string and number
    let product = await Product.findOne({
      $or: [
        { barcode: barcodeString },      
        { barcode: Number(barcodeString) } 
      ]
    });

    if (!product) {
      // Search for similar products using regex on name and description
      const similarProducts = await Product.find({
        $or: [
          { name: { $regex: barcodeString, $options: "i" } },
          { description: { $regex: barcodeString, $options: "i" } }
        ]
      });

      if (similarProducts.length === 0) {
        return res.status(404).json({ error: "Product not found" });
      }

      return res.status(200).json({ 
        message: "No exact match found, but here are similar products", 
        similarProducts 
      });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("Error scanning barcode:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
