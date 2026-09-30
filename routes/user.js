const express = require('express');
const { authenticate, authorizeRoles } = require('../middlewares/auth');
const pagination = require('../middlewares/pagination');
const userController = require('../controllers/user');
const User = require('../models/User');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - firstName
 *         - lastName
 *         - username
 *         - email
 *         - phone
 *         - password
 *       properties:
 *         firstName:
 *           type: string
 *         lastName:
 *           type: string
 *         username:
 *           type: string
 *         email:
 *           type: string
 *           format: email
 *         phone:
 *           type: string
 *         password:
 *           type: string
 *           format: password
 *         role:
 *           type: string
 *           enum: ['ADMIN', 'SALES_PERSON', 'MANAGER']
 */

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user (Admin only)
 *     security:
 *       - BearerAuth: []
 *     tags: [Users]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Invalid request data
 */
router.post('/', authenticate, authorizeRoles('ADMIN'), userController.createUser);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users
 *     security:
 *       - BearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Number of users per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for username, email, first name, or last name
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: ['ADMIN', 'SALES_PERSON', 'MANAGER']
 *         description: Filter by user role
 *     responses:
 *       200:
 *         description: A list of users
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 results:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *                 totalDocuments:
 *                   type: integer
 *                 totalPages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *                 nextPage:
 *                   type: integer
 *                   nullable: true
 *                 prevPage:
 *                   type: integer
 *                   nullable: true
 *       400:
 *         description: Invalid request data
 */
router.get('/', authenticate, authorizeRoles('ADMIN'), pagination(User), userController.getAllUsers);

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update a user (Admin, Manager, or Owner)
 *     security:
 *       - BearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Invalid request data
 */
router.put('/:id', authenticate, authorizeRoles('ADMIN', 'MANAGER', 'SALES_PERSON'), userController.updateUser);


/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Deactivate a user (Admin, Manager, or Owner)
 *     description: Deactivates a user by setting their `is_active` field to `false`. The user is not removed from the system.
 *     security:
 *       - BearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to deactivate.
 *     responses:
 *       200:
 *         description: User deactivated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User deactivated
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (user does not have the required role)
 */
router.delete('/:id',authenticate, authorizeRoles('ADMIN', 'MANAGER', 'SALES_PERSON'),userController.deleteUser);

/**
 * @swagger
 * /api/users/activate/{id}:
 *   put:
 *     summary: Activate a user (Admin, Manager)
 *     description: Activates a user by setting their `is_active` field to `true`.
 *     security:
 *       - BearerAuth: []
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the user to activate.
 *     responses:
 *       200:
 *         description: User activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User activated successfully
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: User not found
 *       401:
 *         description: Unauthorized (missing or invalid token)
 *       403:
 *         description: Forbidden (user does not have the required role)
 */
router.put('/activate/:id',authenticate, authorizeRoles('ADMIN', 'MANAGER'),userController.activeUser);




module.exports = router;