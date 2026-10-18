'use strict';
const historyRepository = require('../database/history.repository');
const { success } = require('../utils/response');

async function getTaskHistory(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const { assignment_id } = req.query;
    const history = await historyRepository.getTaskHistory(
      taskId,
      req.user,
      { assignment_id: assignment_id ? parseInt(assignment_id) : undefined }
    );
    return success(res, history);
  } catch (err) { next(err); }
}

module.exports = { getTaskHistory };
