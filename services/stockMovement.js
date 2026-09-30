const StockMovement = require('../models/StockMovement');
const Inventory = require('../models/Inventory');
const InventoryUnit = require('../models/inventoryUnit');
const Product = require('../models/Product');
const mongoose = require('mongoose');

const getStockMovements = async (query) => {
  const { page = 1, limit = 10, product } = query;
  const skip = (page - 1) * limit;
  const filter = {};

  if (product) {
    filter.product = product;
  }

  const stockMovements = await StockMovement.find(filter)
    .populate('product')
    .skip(skip)
    .limit(parseInt(limit));

  const total = await StockMovement.countDocuments(filter);
  const totalPages = Math.ceil(total / limit);
  const currentPage = parseInt(page);
  const nextPage = currentPage < totalPages ? currentPage + 1 : null;
  const prevPage = currentPage > 1 ? currentPage - 1 : null;

  return {
    list: stockMovements,
    total,
    totalPages,
    currentPage,
    nextPage,
    prevPage,
  };
};

const createStockMovement = async (stockMovementData) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { type, product, quantity, buyingPrice, sellingPrice, location } = stockMovementData;

    const stockMovement = new StockMovement(stockMovementData);
    await stockMovement.save({ session });

    const inventory = await Inventory.findOne({ product }).session(session);

    if (type === 'entry') {
      const inventoryUnits = [];
      for (let i = 0; i < quantity; i++) {
        const inventoryUnit = new InventoryUnit({
          product,
          quantity: 1,
          buyingPrice,
          sellingPrice,
          location,
        });
        await inventoryUnit.save({ session });
        inventoryUnits.push(inventoryUnit._id);
      }

      if (inventory) {
        inventory.totalQuantity += quantity;
        inventory.units.push(...inventoryUnits);
        await inventory.save({ session });
      } else {
        const newInventory = new Inventory({
          product,
          totalQuantity: quantity,
          units: inventoryUnits,
        });
        await newInventory.save({ session });
      }
    } else if (type === 'exit' && inventory) {
      let remainingQuantity = quantity;
      for (const unitId of inventory.units) {
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
      inventory.totalQuantity -= quantity;
      if (inventory.totalQuantity < 0) inventory.totalQuantity = 0;
      await inventory.save({ session });
    }

    const productItem = await Product.findById(product).session(session);
    if (productItem) {
      productItem.quantity = inventory ? inventory.totalQuantity : 0;
      await productItem.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return stockMovement;
  } catch (error) {
    console.error('Error creating stock movement:', error);
    await session.abortTransaction();
    session.endSession();
    throw new Error('Failed to create stock movement');
  }
};

module.exports = { getStockMovements, createStockMovement };