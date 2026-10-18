'use strict';
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  if (err instanceof AppError && err.isOperational) {
    const body = { status: 'error', message: err.message };
    if (err.errors) body.errors = err.errors;
    return res.status(err.statusCode).json(body);
  }

  // Handle express body-parser errors
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ status: 'error', message: 'Invalid JSON in request body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ status: 'error', message: 'Request body is too large' });
  }
  if (err.type === 'encoding.unsupported' || err.type === 'charset.unsupported') {
    return res.status(415).json({ status: 'error', message: 'Unsupported request encoding' });
  }

  logger.error('Unhandled error', err);

  // Don't leak error details in production
  const isProd = process.env.NODE_ENV === 'production';
  return res.status(500).json({
    status: 'error',
    message: 'Internal server error',
    ...(isProd ? {} : { detail: err.message }),
  });
};

module.exports = errorHandler;
