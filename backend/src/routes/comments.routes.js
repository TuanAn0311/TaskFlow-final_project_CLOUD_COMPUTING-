'use strict';
const express = require('express');
const { body, param, query } = require('express-validator');
const authenticate = require('../middlewares/authenticate');
const validate = require('../middlewares/validate');
const commentsController = require('../controllers/comments.controller');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get(
  '/',
  [query('page').optional().isInt({ min: 1 }), query('limit').optional().isInt({ min: 1, max: 100 })],
  validate,
  commentsController.getComments
);

router.post(
  '/',
  [body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 5000 })],
  validate,
  commentsController.addComment
);

router.patch(
  '/:commentId',
  [
    param('commentId').isInt({ min: 1 }).withMessage('Comment id must be a positive integer'),
    body('content').trim().notEmpty().withMessage('Content is required').isLength({ max: 5000 }),
  ],
  validate,
  commentsController.updateComment
);

router.delete('/:commentId', param('commentId').isInt({ min: 1 }).withMessage('Comment id must be a positive integer'), validate, commentsController.deleteComment);

module.exports = router;
