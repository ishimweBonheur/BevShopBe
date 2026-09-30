const express = require('express');
const SalesController = require('../controllers/sale');
const { authenticate, authorizeRoles } = require('../middlewares/auth');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Sale:
 *       type: object
 *       required:
 *         - order
 *         - totalAmount
 *         - status
 *       properties:
 *         order:
 *           type: string
 *           format: ObjectId
 *         totalAmount:
 *           type: number
 *         paymentMethod:
 *           type: string
 *           enum: ['cash', 'credit_card', 'mobile_money', 'pending']
 *         status:
 *           type: string
 *           enum: ['pending', 'completed', 'refunded']
 *         createdAt:
 *           type: string
 *           format: date-time
 *     PaginatedSalesResponse:
 *       type: object
 *       properties:
 *         list:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/Sale'
 *         total:
 *           type: integer
 *           description: Total number of sales records
 *         totalPages:
 *           type: integer
 *           description: Total number of pages
 *         currentPage:
 *           type: integer
 *           description: Current page number
 *         pageSize:
 *           type: integer
 *           description: Number of sales records per page
 *         nextPage:
 *           type: integer
 *           nullable: true
 *           description: Next page number (null if no next page)
 *         prevPage:
 *           type: integer
 *           nullable: true
 *           description: Previous page number (null if no previous page)
 */

/**
 * @swagger
 * tags:
 *   name: Sales
 *   description: Sales management API
 */

/**
 * @swagger
 * /api/sales:
 *   get:
 *     summary: Get all sales with pagination
 *     security:
 *       - BearerAuth: []
 *     tags: [Sales]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number to retrieve
 *       - in: query
 *         name: size
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The number of sales records per page
 *     responses:
 *       200:
 *         description: A paginated list of sales
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedSalesResponse'
 *       500:
 *         description: Failed to fetch sales
 */
router.get('/', authenticate, authorizeRoles('CASHIER','MANAGER','ADMIN'), SalesController.getSales);

/**
 * @swagger
 * /api/sales/confirm-payment:
 *   post:
 *     summary: Confirm a sale payment
 *     security:
 *       - BearerAuth: []
 *     tags: [Sales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - orderId
 *               - paymentMethod
 *               - amountPaid
 *               - notes
 *             properties:
 *               orderId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: ['cash', 'credit_card', 'mobile_money']
 *     responses:
 *       200:
 *         description: Payment confirmed
 *       404:
 *         description: Order not found
 *       500:
 *         description: Failed to confirm payment
 */
router.post('/confirm-payment', authenticate, SalesController.confirmPayment);

/**
 * @swagger
 * /api/sales/scan-barcode:
 *   post:
 *     summary: Scan a product barcode
 *     security:
 *       - BearerAuth: []
 *     tags: [Sales]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - barcode
 *             properties:
 *               barcode:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product found
 *       404:
 *         description: Product not found
 *       500:
 *         description: Failed to scan barcode
 */
router.post('/scan-barcode', authenticate, SalesController.scanBarcode);

module.exports = router;
