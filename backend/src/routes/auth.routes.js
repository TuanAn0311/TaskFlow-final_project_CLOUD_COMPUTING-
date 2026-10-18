'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const { registerValidation, loginValidation } = require('./auth.validation');
const validate = require('../middlewares/validate');
const authenticate = require('../middlewares/authenticate');
const authController = require('../controllers/auth.controller');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' },
});

router.post('/register', authLimiter, registerValidation, validate, authController.register);
router.post('/login', authLimiter, loginValidation, validate, authController.login);
router.get('/me', authenticate, authController.getMe);

module.exports = router;
