'use strict';
const jwt = require('jsonwebtoken');
const pool = require('../database/connection');
const { UnauthorizedError } = require('../utils/errors');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(new UnauthorizedError('Authentication token required'));
    }
    const token = header.slice(7);
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return next(new UnauthorizedError('Invalid or expired token'));
    }

    const { rows } = await pool.query(
      'SELECT id, full_name, email, role, is_active FROM users WHERE id = $1',
      [payload.userId]
    );
    if (rows.length === 0 || !rows[0].is_active) {
      return next(new UnauthorizedError('Account not found or inactive'));
    }
    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
