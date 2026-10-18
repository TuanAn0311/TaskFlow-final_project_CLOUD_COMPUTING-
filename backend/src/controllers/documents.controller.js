'use strict';

const documentsRepository = require('../database/documents.repository');
const storage = require('../services/supabaseStorage');
const { success } = require('../utils/response');

async function listTaskDocuments(req, res, next) {
  try {
    const rows = await documentsRepository.getTaskDocuments(Number(req.params.id), req.user);
    return success(res, rows);
  } catch (error) { next(error); }
}

async function uploadTaskDocuments(req, res, next) {
  try {
    const rows = await documentsRepository.addTaskDocuments(Number(req.params.id), req.files || [], req.user);
    return success(res, rows, 'Task documents uploaded', 201);
  } catch (error) { next(error); }
}

async function listReports(req, res, next) {
  try {
    const rows = await documentsRepository.getTaskReports(Number(req.params.id), req.user);
    return success(res, rows);
  } catch (error) { next(error); }
}

async function uploadReportFiles(req, res, next) {
  try {
    const rows = await documentsRepository.addLatestReportFiles(
      Number(req.params.id),
      Number(req.params.assignmentId),
      req.files || [],
      req.user
    );
    return success(res, rows, 'Completion report files uploaded', 201);
  } catch (error) { next(error); }
}

async function getSignedUrl(req, res, next) {
  try {
    const { documentId, reportId } = req.params;
    const taskId = req.params.id;
    const document = reportId
      ? await documentsRepository.getReportDocument(Number(taskId), Number(reportId), Number(documentId), req.user)
      : await documentsRepository.getTaskDocument(Number(taskId), Number(documentId), req.user);
    const download = req.query.disposition === 'attachment';
    const url = await storage.createSignedUrl(document.storage_path, download);
    return success(res, { url, expires_in: 120 });
  } catch (error) { next(error); }
}

module.exports = {
  getSignedUrl,
  listReports,
  listTaskDocuments,
  uploadReportFiles,
  uploadTaskDocuments,
};
