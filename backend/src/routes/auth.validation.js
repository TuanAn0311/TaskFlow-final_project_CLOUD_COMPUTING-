'use strict';
// Request validation rules for the authentication routes.
const { body } = require('express-validator');

const registerValidation = [
  body('full_name').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isByteLength({ min: 8, max: 72 }).withMessage('Password must be between 8 and 72 UTF-8 bytes'),
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
  body('password').isByteLength({ min: 1, max: 72 }).withMessage('Password must not exceed 72 UTF-8 bytes'),
];

module.exports = { registerValidation, loginValidation };
