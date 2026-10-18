'use strict';
const express = require('express');
const { body, param } = require('express-validator');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const assignmentsController = require('../controllers/assignments.controller');
const documentsController = require('../controllers/documents.controller');
const uploadFiles = require('../middlewares/uploadFiles');

// mergeParams: true to access :id from parent tasks router
const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', assignmentsController.getAssignments);

router.post(
  '/',
  authorize('admin'),
  [
    body('assignee_ids').isArray({ min: 1 }).withMessage('assignee_ids must be a non-empty array'),
    body('assignee_ids.*').isInt({ min: 1 }).withMessage('Each assignee_id must be a positive integer'),
  ],
  validate,
  assignmentsController.assignUsers
);

router.patch(
  '/:assignmentId/status',
  [
    param('assignmentId').isInt({ min: 1 }).withMessage('Assignment id must be a positive integer'),
    body('status').isIn(['todo', 'in_progress', 'completed']).withMessage('Status must be todo, in_progress, or completed'),
    body('note').optional().isString().isLength({ max: 500 }),
    body('completion_note').optional().isString().isLength({ max: 5000 }),
  ],
  validate,
  assignmentsController.updateAssignmentStatus
);

router.post(
  '/:assignmentId/report/files',
  param('assignmentId').isInt({ min: 1 }).withMessage('Assignment id must be a positive integer'),
  validate,
  uploadFiles,
  documentsController.uploadReportFiles
);

router.patch(
  '/:assignmentId/revoke',
  authorize('admin'),
  [
    param('assignmentId').isInt({ min: 1 }).withMessage('Assignment id must be a positive integer'),
    body('revoke_reason').optional().isString().isLength({ max: 500 }),
  ],
  validate,
  assignmentsController.revokeAssignment
);

module.exports = router;
