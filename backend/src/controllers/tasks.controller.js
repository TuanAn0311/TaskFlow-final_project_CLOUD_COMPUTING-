'use strict';
const tasksRepository = require('../database/tasks.repository');
const { success, paginated } = require('../utils/response');

async function createTask(req, res, next) {
  try {
    let { title, description, priority, due_date, assignee_ids } = req.body;
    const user = req.user;

    // Employee creates task: auto-assign to themselves, ignore provided assignee_ids
    if (user.role === 'employee') {
      assignee_ids = [user.id];
    }

    const task = await tasksRepository.createTask({
      title, description, priority, due_date,
      created_by: user.id,
      assignee_ids: assignee_ids || [],
    });
    return success(res, task, 'Task created', 201);
  } catch (err) { next(err); }
}

async function getTasks(req, res, next) {
  try {
    const { page, limit, search, status, priority, assignee_id, due_after, due_before, created_by } = req.query;
    const result = await tasksRepository.getTasks(req.user, {
      page: parseInt(page) || 1,
      limit: Math.min(parseInt(limit) || 20, 100),
      search, status, priority,
      assignee_id: assignee_id ? parseInt(assignee_id) : undefined,
      due_after, due_before,
      created_by: created_by ? parseInt(created_by) : undefined,
    });
    return paginated(res, result.tasks, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
    });
  } catch (err) { next(err); }
}

async function getTaskById(req, res, next) {
  try {
    const task = await tasksRepository.getTaskById(parseInt(req.params.id), req.user);
    return success(res, task);
  } catch (err) { next(err); }
}

async function updateTask(req, res, next) {
  try {
    const task = await tasksRepository.updateTask(parseInt(req.params.id), req.user, req.body);
    return success(res, task, 'Task updated');
  } catch (err) { next(err); }
}

async function deleteTask(req, res, next) {
  try {
    const result = await tasksRepository.deleteTask(parseInt(req.params.id), req.user);
    return success(res, result, 'Task deleted');
  } catch (err) { next(err); }
}

module.exports = { createTask, getTasks, getTaskById, updateTask, deleteTask };
