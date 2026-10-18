'use strict';

const pool = require('./connection');
const { canAccessTask, getTaskById } = require('./tasks.repository');
const { ForbiddenError, NotFoundError } = require('../utils/errors');
const storage = require('../services/supabaseStorage');
const logger = require('../utils/logger');

function assertCanManageTask(task, user) {
  if (user.role !== 'admin' && String(task.created_by) !== String(user.id)) {
    throw new ForbiddenError('Only the task creator or admin can add task documents');
  }
}

async function storeFiles(files, { taskId, reportId = null, userId }) {
  const uploaded = [];
  try {
    for (const file of files) {
      const metadata = storage.validateFile(file);
      const storagePath = storage.createStoragePath(taskId, reportId, metadata.originalFilename);
      uploaded.push({ storagePath, ...metadata });
      await storage.uploadFile({ ...file, ...metadata }, storagePath);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows: tasks } = await client.query(
        'SELECT id FROM tasks WHERE id = $1 AND deleted_at IS NULL FOR SHARE',
        [taskId]
      );
      if (tasks.length === 0) throw new NotFoundError('Task not found');
      if (reportId) {
        const { rows: reports } = await client.query(
          `SELECT r.id
           FROM task_completion_reports r
           JOIN task_assignments a ON a.id = r.assignment_id
           WHERE r.id = $1 AND r.task_id = $2
             AND a.assignment_status = 'active' AND a.status = 'completed'
             AND NOT EXISTS (
               SELECT 1
               FROM task_completion_reports newer
               WHERE newer.assignment_id = r.assignment_id
                 AND (newer.created_at, newer.id) > (r.created_at, r.id)
             )
           FOR SHARE OF a`,
          [reportId, taskId]
        );
        if (reports.length === 0) throw new NotFoundError('Completion report is no longer active');
      }
      const rows = [];
      for (const file of uploaded) {
        const { rows: inserted } = await client.query(
          `INSERT INTO task_documents
             (task_id, completion_report_id, uploaded_by, storage_path, original_filename, content_type, file_size)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, task_id, completion_report_id, original_filename, content_type, file_size, created_at`,
          [taskId, reportId, userId, file.storagePath, file.originalFilename, file.contentType, file.fileSize]
        );
        rows.push(inserted[0]);
      }
      await client.query('COMMIT');
      return rows;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    for (const file of uploaded) {
      try {
        await storage.deleteFile(file.storagePath);
      } catch (cleanupError) {
        logger.error('Failed to clean up an uploaded file after a database error', cleanupError);
      }
    }
    throw error;
  }
}

async function getTaskDocuments(taskId, user) {
  if (!await canAccessTask(taskId, user)) throw new ForbiddenError('Access denied');
  const { rows } = await pool.query(
    `SELECT id, task_id, original_filename, content_type, file_size, created_at
     FROM task_documents
     WHERE task_id = $1 AND completion_report_id IS NULL
     ORDER BY created_at, id`,
    [taskId]
  );
  return rows;
}

async function addTaskDocuments(taskId, files, user) {
  const task = await getTaskById(taskId, user);
  assertCanManageTask(task, user);
  if (!files.length) return [];
  return storeFiles(files, { taskId, userId: user.id });
}

async function getTaskDocument(taskId, documentId, user) {
  if (!await canAccessTask(taskId, user)) throw new ForbiddenError('Access denied');
  const { rows } = await pool.query(
    `SELECT id, task_id, completion_report_id, storage_path, original_filename, content_type, file_size
     FROM task_documents
     WHERE id = $1 AND task_id = $2`,
    [documentId, taskId]
  );
  if (rows.length === 0) throw new NotFoundError('Document not found');
  return rows[0];
}

async function getTaskReports(taskId, user) {
  if (!await canAccessTask(taskId, user)) throw new ForbiddenError('Access denied');
  const { rows } = await pool.query(
    `SELECT r.id, r.task_id, r.assignment_id, r.submitted_by, r.note, r.created_at,
            a.user_id AS assignee_id, assignee.full_name AS assignee_name,
            submitter.full_name AS submitted_by_name,
            COALESCE(files.items, '[]'::json) AS files
     FROM task_completion_reports r
     JOIN task_assignments a ON a.id = r.assignment_id
     JOIN users assignee ON assignee.id = a.user_id
     JOIN users submitter ON submitter.id = r.submitted_by
     LEFT JOIN LATERAL (
       SELECT json_agg(json_build_object(
         'id', d.id,
         'original_filename', d.original_filename,
         'content_type', d.content_type,
         'file_size', d.file_size,
         'created_at', d.created_at
       ) ORDER BY d.created_at, d.id) AS items
       FROM task_documents d
       WHERE d.completion_report_id = r.id
     ) files ON TRUE
     WHERE r.task_id = $1
     ORDER BY r.created_at DESC, r.id DESC`,
    [taskId]
  );
  return rows;
}

async function addLatestReportFiles(taskId, assignmentId, files, user) {
  if (!await canAccessTask(taskId, user)) throw new ForbiddenError('Access denied');
  const { rows } = await pool.query(
    `SELECT r.id
     FROM task_completion_reports r
     JOIN task_assignments a ON a.id = r.assignment_id
     WHERE r.task_id = $1 AND a.id = $2
       AND a.assignment_status = 'active' AND a.status = 'completed'
       AND ($3 = 'admin' OR a.user_id = $4)
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1`,
    [taskId, assignmentId, user.role, user.id]
  );
  if (rows.length === 0) throw new NotFoundError('Completion report not found or access denied');
  if (!files.length) return [];
  return storeFiles(files, { taskId, reportId: rows[0].id, userId: user.id });
}

async function getReportDocument(taskId, reportId, documentId, user) {
  if (!await canAccessTask(taskId, user)) throw new ForbiddenError('Access denied');
  const { rows } = await pool.query(
    `SELECT d.id, d.task_id, d.completion_report_id, d.storage_path, d.original_filename, d.content_type, d.file_size
     FROM task_documents d
     JOIN task_completion_reports r ON r.id = d.completion_report_id
     WHERE d.id = $1 AND d.task_id = $2 AND r.id = $3`,
    [documentId, taskId, reportId]
  );
  if (rows.length === 0) throw new NotFoundError('Report file not found');
  return rows[0];
}

module.exports = {
  addLatestReportFiles,
  addTaskDocuments,
  getReportDocument,
  getTaskDocument,
  getTaskDocuments,
  getTaskReports,
};
