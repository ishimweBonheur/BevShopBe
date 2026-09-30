const mongoose = require('mongoose');
const SalesOrder = require('../models/salesOrder');
const Product = require('../models/Product');
const InventoryUnit = require('../models/');

const createSalesOrder = async (orderData) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, discount = 0, tax = 0, orderStatus } = orderData;

    // Calculate total price for each item and total amount for the order
    let totalAmount = 0;
    const updatedItems = await Promise.all(items.map(async (item) => {
      if (!item.product || !item.quantity) {
        throw new Error('Each item must have a product and quantity');
      }

      const product = await Product.findById(item.product);
      if (!product) {
        throw new Error(`Product with ID ${item.product} not found`);
      }

      const inventoryItem = await Inventory.findOne({ product: item.product });
      if (!inventoryItem) {
        throw new Error(`Inventory item for product with ID ${item.product} not found`);
      }

      if (inventoryItem.totalQuantity < item.quantity) {
        throw new Error(`Insufficient quantity for product with ID ${item.product}`);
      }

      const price = item.price || inventoryItem.sellingPrice;
      const totalPrice = item.quantity * price;
      totalAmount += totalPrice;

      // Update inventory quantity
      inventoryItem.totalQuantity -= item.quantity;
      await inventoryItem.save();

      // Update product quantity
      product.quantity -= item.quantity;
      await product.save();

      return {
        ...item,
        price,
        totalPrice,
      };
    }));

    // Apply discount and tax
    totalAmount = totalAmount - discount + tax;

    const newSalesOrder = new SalesOrder({
      ...orderData,
      items: updatedItems,
      totalAmount,
    });

    await newSalesOrder.save({ session });

    // If the order is completed, remove products from inventory units
    if (orderStatus === 'completed') {
      await Promise.all(updatedItems.map(async (item) => {
        let remainingQuantity = item.quantity;
        const inventoryItem = await Inventory.findOne({ product: item.product }).session(session);
        for (const unitId of inventoryItem.units) {
          const unit = await InventoryUnit.findById(unitId).session(session);
          if (unit.quantity >= remainingQuantity) {
            unit.quantity -= remainingQuantity;
            remainingQuantity = 0;
          } else {
            remainingQuantity -= unit.quantity;
            unit.quantity = 0;
          }
          await unit.save({ session });
          if (remainingQuantity === 0) break;
        }
        await inventoryItem.save({ session });
      }));
    }

    await session.commitTransaction();
    session.endSession();

    return newSalesOrder;
  } catch (error) {
    console.error('Error creating sales order:', error);
    await session.abortTransaction();
    session.endSession();
    throw new Error('Failed to create sales order');
  }
};

const getSalesOrders = async (query) => {
  const { page = 1, limit = 10, ...filters } = query;
  const skip = (page - 1) * limit;

  const salesOrders = await SalesOrder.find(filters)
    .populate('items.product')
    .skip(skip)
    .limit(parseInt(limit));

  const total = await SalesOrder.countDocuments(filters);
  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const prevPage = currentPage > 1 ? currentPage - 1 : null;

  return {
    list: salesOrders,
    total,
    totalPages,
    currentPage,
    nextPage,
    prevPage,
  };
};

const getSalesOrderById = async (id) => {
  return await SalesOrder.findById(id).populate('items.product');
};

const updateSalesOrderStatus = async (id, status) => {
  const salesOrder = await SalesOrder.findById(id);
  if (!salesOrder) {
    throw new Error('Sales order not found');
  }
  salesOrder.orderStatus = "completed";
  return await salesOrder.save();
};

const cancelSalesOrder = async (id) => {
  const salesOrder = await SalesOrder.findById(id);
  if (!salesOrder) {
    throw new Error('Sales order not found');
  }
  if (salesOrder.orderStatus !== 'pending') {
    throw new Error('Only pending orders can be canceled');
  }
  salesOrder.orderStatus = 'cancelled';

  // Restore inventory quantities
  await Promise.all(salesOrder.items.map(async (item) => {
    const inventoryItem = await Inventory.findOne({ product: item.product });
    if (inventoryItem) {
      inventoryItem.totalQuantity += item.quantity;
      await inventoryItem.save();
    }

    const product = await Product.findById(item.product);
    if (product) {
      product.quantity += item.quantity;
      await product.save();
    }
  }));

  return await salesOrder.save();
};

module.exports = { createSalesOrder, getSalesOrders, getSalesOrderById, updateSalesOrderStatus, cancelSalesOrder };