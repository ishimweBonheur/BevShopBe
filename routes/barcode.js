// const express = require('express');
// const { authenticate, authorizeRoles } = require('../middlewares/auth');
// const barcodeController = require('../controllers/barcodes');

// const router = express.Router();

// /**
//  * @swagger
//  * components:
//  *   schemas:
//  *     Barcode:
//  *       type: object
//  *       required:
//  *         - product
//  *       properties:
//  *         product:
//  *           type: string
//  *           description: The product ID
//  *       example:
//  *         product: "60d0fe4f5311236168a109ca"
//  */

// /**
//  * @swagger
//  * tags:
//  *   name: Barcodes
//  *   description: The barcodes managing API
//  */

// /**
//  * @swagger
//  * /api/barcodes/generate:
//  *   post:
//  *     summary: Generate barcodes for a product
//  *     tags: [Barcodes]
//  *     requestBody:
//  *       required: true
//  *       content:
//  *         application/json:
//  *           schema:
//  *             $ref: '#/components/schemas/Barcode'
//  *     responses:
//  *       200:
//  *         description: The barcodes were successfully generated
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items:
//  *                 type: object
//  *                 properties:
//  *                   unitId:
//  *                     type: string
//  *                   barcode:
//  *                     type: string
//  *                     format: base64
//  *       500:
//  *         description: Some server error
//  */
// router.post('/generate', authenticate, authorizeRoles('admin'), barcodeController.generateBarcodes);

// module.exports = router;