const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reports');
const { authenticate, authorizeRoles } = require('../middlewares/auth');
/**
 * @swagger
 * tags:
 *   name: Reports
 *   description: API endpoints for generating sales, inventory, and product reports
 */

/**
 * @swagger
 * /api/reports/inventory:
 *   get:
 *     summary: Get inventory report
 *     security:
 *       - BearerAuth: []
 *     description: Fetch inventory details including stock levels and value.
 *     tags: [Reports]
 *     responses:
 *       200:
 *         description: Inventory report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalStockValue:
 *                   type: number
 *                 lowStockItems:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                       productName:
 *                         type: string
 *                       quantity:
 *                         type: number
 *                       status:
 *                         type: string
 *                 inventorySummary:
 *                   type: array
 *       500:
 *         description: Server error
 */
router.get('/inventory',authenticate,  reportController.getInventoryReport);

/**
 * @swagger
 * /api/reports/sales:
 *   get:
 *     summary: Get sales report
 *     security:
 *       - BearerAuth: []
 *     description: Retrieve sales data based on period (daily, weekly, monthly).
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly]
 *         required: true
 *         description: Sales period filter
 *     responses:
 *       200:
 *         description: Sales report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalSales:
 *                   type: number
 *                 totalProfit:
 *                   type: number
 *                 period:
 *                   type: string
 *                 totalOrders:
 *                   type: integer
 *       500:
 *         description: Server error
 */
router.get('/sales', authenticate,reportController.getSalesReport);

/**
 * @swagger
 * /api/reports/best-selling:
 *   get:
 *     summary: Get best-selling products
 *     security:
 *       - BearerAuth: []
 *     description: Retrieve the top 5 best-selling products based on a selected date range.
 *     tags: [Reports]
 *     parameters:
 *       - in: query
 *         name: filterType
 *         schema:
 *           type: string
 *           enum: [daily, weekly, monthly, yearly, custom]
 *         required: true
 *         description: The time range for best-selling products.
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Required only when filterType is 'custom'. Start date in YYYY-MM-DD format.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         required: false
 *         description: Required only when filterType is 'custom'. End date in YYYY-MM-DD format.
 *     responses:
 *       200:
 *         description: Best-selling products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       productId:
 *                         type: string
 *                         example: "650af78b5e123abc1234abcd"
 *                       productName:
 *                         type: string
 *                         example: "Wireless Headphones"
 *                       quantitySold:
 *                         type: number
 *                         example: 120
 *                       totalSales:
 *                         type: number
 *                         example: 5400.00
 *                       averagePrice:
 *                         type: number
 *                         example: 45.00
 *                       categoryName:
 *                         type: string
 *                         example: "Electronics"
 *       400:
 *         description: Invalid input parameters
 *       500:
 *         description: Server error
 */
router.get('/best-selling', authenticate, reportController.getBestSellingProducts);


module.exports = router;
