const bwipjs = require('bwip-js');
const Product = require('../models/Product');
const InventoryUnit = require('../models/InventoryUnit');

exports.generateBarcodes = async (req, res) => {
  try {
    const { productId, count } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const inventoryUnits = await InventoryUnit.find({ product: productId }).limit(count);
    if (inventoryUnits.length === 0) {
      return res.status(404).json({ error: 'No inventory units found for this product' });
    }

    const barcodes = await Promise.all(inventoryUnits.map(async (unit) => {
      const barcode = await bwipjs.toBuffer({
        bcid: 'code128',       // Barcode type
        text: unit._id.toString(), // Text to encode
        scale: 3,              // 3x scaling factor
        height: 10,            // Bar height, in millimeters
        includetext: true,     // Show human-readable text
        textxalign: 'center',  // Always good to set this
      });

      return {
        unitId: unit._id,
        barcode: barcode.toString('base64'),
      };
    }));

    res.status(200).json(barcodes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate barcodes' });
  }
};