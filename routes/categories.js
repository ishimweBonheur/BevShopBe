const express = require('express');
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const categoryController = require('../controllers/categories');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Category:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *         parent:
 *           type: string
 *           format: ObjectId
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get all categories
 *     security:
 *       - BearerAuth: []
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: A list of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Category'
 *       500:
 *         description: Failed to fetch categories
 */
router.get('/', authenticate, categoryController.getCategories);

/**
 * @swagger
 * /api/categories:
 *   post:
 *     summary: Create a new category
 *     security:
 *       - BearerAuth: []
 *     tags: [Categories]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       201:
 *         description: Category created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Failed to create category
 */
router.post('/', authenticate, authorizeRoles('ADMIN'), categoryController.createCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     summary: Update a category by ID
 *     security:
 *       - BearerAuth: []
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Category'
 *     responses:
 *       200:
 *         description: Category updated successfully
 *       400:
 *         description: Invalid request data
 *       404:
 *         description: Category not found
 *       500:
 *         description: Failed to update category
 */
router.put('/:id', authenticate, authorizeRoles('ADMIN'), categoryController.updateCategory);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     summary: Delete a category by ID
 *     security:
 *       - BearerAuth: []
 *     tags: [Categories]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Category ID
 *     responses:
 *       200:
 *         description: Category deleted successfully
 *       404:
 *         description: Category not found
 *       500:
 *         description: Failed to delete category
 */
router.delete('/:id', authenticate, authorizeRoles('ADMIN'), categoryController.deleteCategory);

/**
 * @swagger
 * /api/categories/disable-enable/{id}:
 *   post:
 *     summary: Enable or disable a category
 *     description: This endpoint allows an admin to enable or disable a category.
 *     tags:
 *       - Categories
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the category to enable or disable.
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Category status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Category disabled successfully"
 *       400:
 *         description: Invalid category ID
 *       403:
 *         description: Unauthorized, admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/disable-enable/:id', authenticate, authorizeRoles('ADMIN'), categoryController.disableCategory);

/**
 * @swagger
 * /api/categories/activate-all:
 *   post:
 *     summary: Activate all categories
 *     description: This endpoint allows an admin to activate all categories.
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: All categories activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "All categories activated successfully"
 *       500:
 *         description: Failed to activate all categories
 */
router.post('/activate-all', authenticate, authorizeRoles('ADMIN'), categoryController.activateAllCategories);

module.exports = router;
