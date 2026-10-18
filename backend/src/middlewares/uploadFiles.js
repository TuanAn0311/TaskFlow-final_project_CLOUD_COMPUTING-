'use strict';

const multer = require('multer');
const { MAX_FILE_SIZE } = require('../services/supabaseStorage');

const uploadFiles = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 5 },
}).array('files', 5);

module.exports = (req, res, next) => {
  uploadFiles(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ status: 'error', message: 'Each file must be 10 MB or smaller.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({ status: 'error', message: 'Upload no more than 5 files at a time using the "files" field.' });
    }
    return next(err);
  });
};
