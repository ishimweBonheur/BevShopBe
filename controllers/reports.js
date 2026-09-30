const Product = require('../models/Product');
const SalesOrder = require('../models/salesOrder');
const Sale = require('../models/sales');
const moment = require("moment");

exports.getInventoryReport = async (req, res) => {
  try {
    const products = await Product.find();

    const report = products.map(product => {
      let status = 'abundant';
      if (product.quantity === 0) {
        status = 'none';
      } else if (product.quantity < 10) {
        status = 'low';
      }

      return {
        productId: product._id,
        productName: product.name,
        quantity: product.quantity,
        status,
        stockValue: product.quantity * product.price,
      };
    });


    const totalStockValue = report.reduce((sum, item) => sum + item.stockValue, 0);

    res.json({
      totalStockValue,
      lowStockItems: report.filter(item => item.status === 'low' || item.status === 'none'),
      inventorySummary: report,
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to fetch inventory report" });
  }
};


// this is sales report
exports.getSalesReport = async (req, res) => {
  try {
    const { filterType, startDate, endDate } = req.query;
    let matchCondition = {};
    const now = new Date();

    // Set up date ranges
    if (filterType === 'custom' && startDate && endDate) {
      matchCondition.createdAt = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    } else if (filterType === 'daily') {
      matchCondition.createdAt = { 
        $gte: new Date(now.setHours(0, 0, 0, 0)) 
      };
    } else if (filterType === 'weekly') {
      const startOfWeek = new Date();
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      matchCondition.createdAt = { 
        $gte: startOfWeek 
      };
    } else if (filterType === 'monthly') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      matchCondition.createdAt = { 
        $gte: startOfMonth 
      };
    }

    // Query orders with populated product details
    const orders = await SalesOrder.find({
      ...matchCondition,
      status: 'completed' 
    }).populate('products.product');

    const orderIds = orders.map(order => order._id);

    // Query corresponding sales records for the orders
    const sales = await Sale.find({
      order: { $in: orderIds }
    });

    let reportStats = {
      totalSales: 0,
      totalDiscount: 0,
      totalTax: 0,
      totalQuantity: 0,
      totalProfit: 0,
      totalOrders: orders.length,
      period: filterType === 'custom' ? `${startDate} to ${endDate}` : filterType,
      paymentMethods: {},
    };

    // Calculate totals
    orders.forEach(order => {
      reportStats.totalSales += order.totalAmount;
      reportStats.totalDiscount += order.discount;
      reportStats.totalTax += order.tax;

      const sale = sales.find(sale => sale.order.toString() === order._id.toString());
      const paymentMethod = sale ? sale.paymentMethod : 'none';

      if (!reportStats.paymentMethods[paymentMethod]) {
        reportStats.paymentMethods[paymentMethod] = 0;
      }
      reportStats.paymentMethods[paymentMethod] += order.totalAmount;

      // Calculate product-specific metrics
      order.products.forEach(item => {
        if (item.product) {
          reportStats.totalQuantity += item.quantity;

          // If you have buying price, calculate profit
          if (item.product.buyingPrice) {
            const profitPerUnit = item.price - item.product.buyingPrice;
            reportStats.totalProfit += profitPerUnit * item.quantity;
          }
        }
      });
    });

    // Calculate averages
    if (reportStats.totalOrders > 0) {
      reportStats.averageOrderValue = +(reportStats.totalSales / reportStats.totalOrders).toFixed(2);
      reportStats.averageProfit = +(reportStats.totalProfit / reportStats.totalOrders).toFixed(2);
      reportStats.averageItemsPerOrder = +(reportStats.totalQuantity / reportStats.totalOrders).toFixed(2);
    }

    // Get top selling products
    const productSales = {};
    orders.forEach(order => {
      order.products.forEach(item => {
        if (item.product) {
          const productId = item.product._id.toString();
          if (!productSales[productId]) {
            productSales[productId] = {
              name: item.product.name,
              quantity: 0,
              revenue: 0
            };
          }
          productSales[productId].quantity += item.quantity;
          productSales[productId].revenue += item.price * item.quantity;
        }
      });
    });

    // Convert to array and sort by quantity
    reportStats.topProducts = Object.values(productSales)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);  

    res.json(reportStats);

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch sales report',
      details: error.message 
    });
  }
};


exports.getBestSellingProducts = async (req, res) => {
  try {
    const { filterType, startDate, endDate } = req.query;
    let start, end;

    switch (filterType) {
      case "weekly":
        start = moment().startOf("week").toDate();
        end = moment().endOf("week").toDate();
        break;
      case "monthly":
        start = moment().startOf("month").toDate();
        end = moment().endOf("month").toDate();
        break;
      case "yearly":
        start = moment().startOf("year").toDate();
        end = moment().endOf("year").toDate();
        break;
      case "custom":
        start = startDate ? new Date(startDate) : null;
        end = endDate ? new Date(endDate) : null;
        break;
      default:
        start = moment().startOf("day").toDate();
        end = moment().endOf("day").toDate();
    }

    // Build the query with date filtering
    let query = { status: "completed" };
    if (start && end) {
      query.createdAt = { $gte: start, $lte: end };
    }

    // Fetch sales data
    const salesOrders = await SalesOrder.find(query).populate({
      path: "products.product",
      populate: {
        path: "category",
        select: "name",
      },
    });

    const productSales = {};

    salesOrders.forEach((order) => {
      order.products.forEach((item) => {
        if (item.product) {
          const productId = item.product._id.toString();

          if (!productSales[productId]) {
            productSales[productId] = {
              productId: item.product._id,
              productName: item.product.name,
              quantitySold: 0,
              totalSales: 0,
              averagePrice: 0,
              categoryName: item.product.category?.name || "Uncategorized",
              condition: item.product.condition,
              colors: item.product.colors || "",
              sizes: item.product.sizes || "",
              status: item.product.status,
            };
          }

          productSales[productId].quantitySold += item.quantity;
          productSales[productId].totalSales += item.price * item.quantity;
        }
      });
    });

    // Calculate average price and format total sales
    const topSellingProducts = Object.values(productSales)
      .map((product) => ({
        ...product,
        averagePrice: +(product.totalSales / product.quantitySold).toFixed(2),
        totalSales: +product.totalSales.toFixed(2),
      }))
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    res.json({
      success: true,
      count: topSellingProducts.length,
      data: topSellingProducts,
    });
  } catch (error) {
    console.error("Best selling products error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch best-selling products",
      message: error.message,
    });
  }
};