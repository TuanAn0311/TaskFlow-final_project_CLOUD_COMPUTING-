'use strict';
const commentsRepository = require('../database/comments.repository');
const { success, paginated } = require('../utils/response');

async function getComments(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const { page = 1, limit = 50 } = req.query;
    const result = await commentsRepository.getComments(taskId, req.user, {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
    });
    return paginated(res, result.comments, {
      page: result.page, limit: result.limit, total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
    });
  } catch (err) { next(err); }
}

async function addComment(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const { content } = req.body;
    const comment = await commentsRepository.addComment(taskId, req.user.id, content, req.user);
    return success(res, comment, 'Comment added', 201);
  } catch (err) { next(err); }
}

async function updateComment(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    const { content } = req.body;
    const comment = await commentsRepository.updateComment(taskId, commentId, content, req.user);
    return success(res, comment, 'Comment updated');
  } catch (err) { next(err); }
}

async function deleteComment(req, res, next) {
  try {
    const taskId = parseInt(req.params.id);
    const commentId = parseInt(req.params.commentId);
    const result = await commentsRepository.deleteComment(taskId, commentId, req.user);
    return success(res, result, 'Comment deleted');
  } catch (err) { next(err); }
}

module.exports = { getComments, addComment, updateComment, deleteComment };
