const Joi = require('joi');

const registerSchema = Joi.object({
  firstName: Joi.string().required().messages({
    'string.empty': 'First name is required',
  }),
  lastName: Joi.string().required().messages({
    'string.empty': 'Last name is required',
  }),
  username: Joi.string().required().messages({
    'string.empty': 'Username is required',
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please include a valid email',
  }),
  phone: Joi.string().required().messages({
    'string.empty': 'Phone number is required',
  }),
  password: Joi.string().min(6).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 6 characters',
  }),
  role: Joi.string().valid('ADMIN', 'SALES_PERSON', 'MANAGER').optional(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Please include a valid email',
  }),
  password: Joi.string().required().messages({
    'string.empty': 'Password is required',
  }),
});

module.exports = { registerSchema, loginSchema };