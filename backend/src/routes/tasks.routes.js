'use strict';
const express = require('express');
const { param } = require('express-validator');
const authenticate = require('../middlewares/authenticate');
const authorize = require('../middlewares/authorize');
const validate = require('../middlewares/validate');
const { createTaskValidation, updateTaskValidation, taskQueryValidation } = require('./tasks.validation');
const tasksController = require('../controllers/tasks.controller');
const assignmentsRouter = require('./assignments.routes');
const historyRouter = require('./history.routes');
const commentsRouter = require('./comments.routes');

const router = express.Router();

router.use(authenticate);

router.post('/', createTaskValidation, validate, tasksController.createTask);
router.get('/', taskQueryValidation, validate, tasksController.getTasks);
router.get('/:id', param('id').isInt({ min: 1 }).withMessage('Task id must be a positive integer'), validate, tasksController.getTaskById);
router.patch('/:id', param('id').isInt({ min: 1 }), updateTaskValidation, validate, tasksController.updateTask);
router.delete('/:id', authorize('admin'), param('id').isInt({ min: 1 }), validate, tasksController.deleteTask);

// Nested routers
const taskIdValidation = [param('id').isInt({ min: 1 }).withMessage('Task id must be a positive integer'), validate];
router.use('/:id/assignments', taskIdValidation, assignmentsRouter);
router.use('/:id/history', taskIdValidation, historyRouter);
router.use('/:id/comments', taskIdValidation, commentsRouter);

module.exports = router;
