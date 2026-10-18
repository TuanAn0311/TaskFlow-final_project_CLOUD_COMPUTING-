'use strict';
const express = require('express');
const { query } = require('express-validator');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const historyController = require('../controllers/history.controller');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get(
  '/',
  [query('assignment_id').optional().isInt({ min: 1 }).withMessage('assignment_id must be a positive integer')],
  validate,
  historyController.getTaskHistory
);

module.exports = router;
