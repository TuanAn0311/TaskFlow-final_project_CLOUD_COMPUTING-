'use strict';
const assignmentsRepository = require('../database/assignments.repository');
const { success } = require('../utils/response');

async function getAssignments(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const assignments = await assignmentsRepository.getAssignments(taskId, req.user);
    return success(res, assignments);
  } catch (err) { next(err); }
}

async function assignUsers(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const { assignee_ids } = req.body;
    const results = await assignmentsRepository.assignUsers(taskId, assignee_ids, req.user.id, req.user);
    return success(res, results, 'Users assigned successfully', 201);
  } catch (err) { next(err); }
}

async function revokeAssignment(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const assignmentId = parseInt(req.params.assignmentId);
    const { revoke_reason } = req.body;
    const result = await assignmentsRepository.revokeAssignment(taskId, assignmentId, req.user.id, revoke_reason, req.user);
    return success(res, result, 'Assignment revoked');
  } catch (err) { next(err); }
}

async function updateAssignmentStatus(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const assignmentId = parseInt(req.params.assignmentId);
    const { status, note } = req.body;
    const result = await assignmentsRepository.updateAssignmentStatus(taskId, assignmentId, status, req.user.id, note, req.user);
    return success(res, result, 'Assignment status updated');
  } catch (err) { next(err); }
}

module.exports = { getAssignments, assignUsers, revokeAssignment, updateAssignmentStatus };
