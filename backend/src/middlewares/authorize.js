'use strict';
const { ForbiddenError } = require('../utils/errors');

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(new ForbiddenError('Not authenticated'));
  }
  if (!roles.includes(req.user.role)) {
    return next(new ForbiddenError('Insufficient permissions'));
  }
  next();
};

module.exports = authorize;

