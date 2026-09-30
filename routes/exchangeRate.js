
const express = require('express');
const router = express.Router();
const exchangeRateController = require('../controllers/exchangeRateController');
const { authenticate ,authorizeRoles} = require('../middlewares/auth');



/**
 * @swagger
 * components:
 *   schemas:
 *     ExchangeRate:
 *       type: object
 *       required:
 *         - rate
 *       properties:
 *         rate:
 *           type: number
 *           description: The exchange rate for 1 USD to Congolese Francs
 *         updatedBy:
 *           type: string
 *           format: ObjectId
 *           description: ID of the user who updated the rate
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the update
 */

/**
 * @swagger
 * tags:
 *   name: Exchange Rate
 *   description: API for managing the exchange rate (1 USD to Congolese Francs)
 */

/**
 * @swagger
 * /api/exchange-rate:
 *   get:
 *     summary: Get the current exchange rate
 *     tags: [Exchange Rate] 
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: The current exchange rate, or null when it has not yet been configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rate:
 *                   type: number
 *                   nullable: true
 *                   example: 2500
 *       500:
 *         description: Failed to fetch exchange rate
 *   put:
 *     summary: Update the exchange rate (Admin only)
 *     tags: [Exchange Rate]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rate:
 *                 type: number
 *                 example: 2500
 *     responses:
 *       200:
 *         description: Exchange rate updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Exchange rate updated successfully
 *                 rate:
 *                   type: number
 *                   example: 2500
 *       400:
 *         description: Invalid rate provided
 *       500:
 *         description: Failed to update exchange rate
 */
// The active rate is used throughout the storefront, including before a user
// signs in, so it must be readable without an access token. Updates remain
// restricted to administrators below.
router.get('/', exchangeRateController.getExchangeRate);



router.put('/', authenticate, authorizeRoles('ADMIN'), exchangeRateController.updateExchangeRate);

module.exports = router;
