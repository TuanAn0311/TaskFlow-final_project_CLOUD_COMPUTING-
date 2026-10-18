'use strict';

const success = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    status: 'success',
    message,
    data,
  });
};

const paginated = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    status: 'success',
    message,
    data,
    pagination,
  });
};

const error = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  const body = { status: 'error', message };
  if (errors) body.errors = errors;
  return res.status(statusCode).json(body);
};

module.exports = { success, paginated, error };

