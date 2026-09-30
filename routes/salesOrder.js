const express = require('express');
const SalesOrderController = require('../controllers/salesOrder'); 
const { authenticate } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     SalesOrder:
 *       type: object
 *       required:
 *         - customer
 *         - products
 *         - totalAmount
 *       properties:
 *         customer:
 *           type: string
 *           description: Customer name
 *         products:
 *           type: array
 *           description: List of products in the order
 *           items:
 *             type: object
 *             properties:
 *               product:
 *                 type: string
 *                 format: ObjectId
 *                 description: Product ID reference
 *               quantity:
 *                 type: number
 *                 description: Number of units ordered
 *                 minimum: 1
 *               price:
 *                 type: number
 *                 description: Price per unit of the product
 *         totalAmount:
 *           type: number
 *           description: Total amount for the order
 *         discount:
 *           type: number
 *           description: Discount applied to the order
 *           default: 0
 *         tax:
 *           type: number
 *           description: Tax applied to the order
 *           default: 0
 *         status:
 *           type: string
 *           enum: ['pending', 'completed', 'canceled']
 *           description: Order status
 *           default: 'pending'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Order creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */


/**
 * @swagger
 * /api/salesOrders:
 *   get:
 *     summary: Get all sales orders
 *     security:
 *       - BearerAuth: []
 *     tags: [SalesOrders]
 *     responses:
 *       200:
 *         description: A list of sales orders
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/SalesOrder'
 *       500:
 *         description: Failed to fetch sales orders
 */
router.get('/', authenticate, SalesOrderController.getSalesOrders);


/**
 * @swagger
 * /api/salesOrders:
 *   post:
 *     summary: Create a new sales order
 *     security:
 *       - BearerAuth: []
 *     tags: [SalesOrders]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SalesOrder'
 *     responses:
 *       201:
 *         description: Sales order created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Failed to create sales order
 */
router.post('/', authenticate, SalesOrderController.createOrder);

/**
 * @swagger
 * /api/salesOrders/{id}:
 *   put:
 *     summary: Update an existing sales order
 *     security:
 *       - BearerAuth: []
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sales order ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SalesOrder'
 *     responses:
 *       200:
 *         description: Sales order updated successfully
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Failed to update sales order
 */
router.put('/:id', authenticate, SalesOrderController.updateOrder);

/**
 * @swagger
 * /api/salesOrders/{id}:
 *   delete:
 *     summary: Delete a sales order
 *     security:
 *       - BearerAuth: []
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Sales order ID
 *     responses:
 *       200:
 *         description: Sales order deleted successfully
 *       404:
 *         description: Sales order not found
 *       500:
 *         description: Failed to delete sales order
 */
router.delete('/:id', authenticate, SalesOrderController.deleteOrder);
/**
 * @swagger
 * /api/salesOrders/sales-by-product:
 *   get:
 *     summary: Get sales data by product
 *     description: Retrieve sales data aggregated by product. Optionally filter by a specific product ID.
 *     security:
 *       - BearerAuth: []
 *     tags: [SalesOrders]
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema:
 *           type: string
 *           format: ObjectId
 *         description: The ID of the product to filter sales data (optional).
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
 *         description: A list of sales data aggregated by product.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 list:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         format: ObjectId
 *                         description: The ID of the product.
 *                       productName:
 *                         type: string
 *                         description: The name of the product.
 *                       productDescription:
 *                         type: string
 *                         description: The description of the product.
 *                       productImage:
 *                         type: string
 *                         description: The image URL of the product.
 *                       productPrice:
 *                         type: number
 *                         description: The price of the product.
 *                       totalQuantity:
 *                         type: number
 *                         description: The total quantity of the product sold.
 *                       totalSales:
 *                         type: number
 *                         description: The total sales amount for the product.
 *                 total:
 *                   type: number
 *                   description: The total number of unique products.
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
 *       500:
 *         description: Failed to fetch sales data by product.
 */
router.get('/sales-by-product', authenticate, SalesOrderController.getSalesByProduct);


module.exports = router;
