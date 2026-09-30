const express = require('express');
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const stockMovementController = require('../controllers/stockMovement');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     StockMovement:
 *       type: object
 *       required:
 *         - type
 *         - product
 *         - quantity
 *       properties:
 *         type:
 *           type: string
 *           enum: ['entry', 'exit']
 *           description: The type of stock movement (entry or exit).
 *         product:
 *           type: string
 *           format: ObjectId
 *           description: The ID of the product associated with the stock movement.
 *         quantity:
 *           type: number
 *           description: The quantity of the product in the stock movement.
 *         reason:
 *           type: string
 *           enum: ['sold', 'returned', 'damaged', 'other']
 *           description: The reason for the stock movement (required for exit).
 *         notes:
 *           type: string
 *           description: Additional notes about the stock movement.
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the stock movement was created.
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: The timestamp when the stock movement was last updated.
 *       example:
 *         type: entry
 *         product: 60d0fe4f5311236168a109ca
 *         quantity: 10
 *         reason: sold
 *         notes: Initial stock entry
 */

/**
 * @swagger
 * tags:
 *   name: StockMovements
 *   description: The stock movements managing API
 */

/**
 * @swagger
 * /api/stock-movements:
 *   get:
 *     summary: Returns the list of all the stock movements
 *     security:
 *       - BearerAuth: []
 *     tags: [StockMovements]
 *     responses:
 *       200:
 *         description: The list of the stock movements
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/StockMovement'
 */
router.get('/', authenticate, authorizeRoles('ADMIN'), stockMovementController.getStockMovements);

/**
 * @swagger
 * /api/stock-movements/{id}:
 *   get:
 *     summary: Get the stock movement by id
 *     security:
 *       - BearerAuth: []
 *     tags: [StockMovements]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The stock movement id
 *     responses:
 *       200:
 *         description: The stock movement description by id
 *         contents:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StockMovement'
 *       404:
 *         description: The stock movement was not found
 */
router.get('/:id', authenticate, stockMovementController.getStockMovementById);

/**
 * @swagger
 * /api/stock-movements:
 *   post:
 *     summary: Create a new stock movement
 *     security:
 *       - BearerAuth: []
 *     tags: [StockMovements]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockMovement'
 *     responses:
 *       201:
 *         description: The stock movement was successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StockMovement'
 *       500:
 *         description: Some server error
 */
router.post('/', authenticate, authorizeRoles('ADMIN'), stockMovementController.createStockMovement);

/**
 * @swagger
 * /api/stock-movements/{id}:
 *   put:
 *     summary: Update the stock movement by the id
 *     security:
 *       - BearerAuth: []
 *     tags: [StockMovements]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The stock movement id
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/StockMovement'
 *     responses:
 *       200:
 *         description: The stock movement was updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/StockMovement'
 *       404:
 *         description: The stock movement was not found
 *       500:
 *         description: Some error happened
 */
router.put('/:id', authenticate, authorizeRoles('ADMIN'), stockMovementController.updateStockMovement);

/**
 * @swagger
 * /api/stock-movements/{id}:
 *   delete:
 *     summary: Remove the stock movement by id
 *     security:
 *       - BearerAuth: []
 *     tags: [StockMovements]
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: The stock movement id
 *     responses:
 *       200:
 *         description: The stock movement was deleted
 *       404:
 *         description: The stock movement was not found
 */
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), stockMovementController.deleteStockMovement);

/**
 * @swagger
 * /api/stock-movements/product/{productId}:
 *   get:
 *     summary: Get stock movements by product ID
 *     description: Retrieve a paginated list of stock movements for a specific product.
 *     security:
 *       - BearerAuth: []
 *     tags: [StockMovements]
 *     parameters:
 *       - in: path
 *         name: productId
 *         schema:
 *           type: string
 *           format: ObjectId
 *         required: true
 *         description: The ID of the product to filter stock movements.
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number for pagination.
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The number of items per page for pagination.
 *     responses:
 *       200:
 *         description: A paginated list of stock movements for the specified product.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 list:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StockMovement'
 *                 total:
 *                   type: number
 *                   description: The total number of stock movements for the product.
 *                 totalPages:
 *                   type: number
 *                   description: The total number of pages.
 *                 currentPage:
 *                   type: number
 *                   description: The current page number.
 *                 pageSize:
 *                   type: number
 *                   description: The number of items per page.
 *                 nextPage:
 *                   type: number
 *                   nullable: true
 *                   description: The next page number (null if no next page).
 *                 prevPage:
 *                   type: number
 *                   nullable: true
 *                   description: The previous page number (null if no previous page).
 *       400:
 *         description: Invalid product ID.
 *       404:
 *         description: No stock movements found for the specified product.
 *       500:
 *         description: Failed to fetch stock movements.
 */
router.get('/product/:productId', authenticate, stockMovementController.getStockMovementByProduct);

module.exports = router;