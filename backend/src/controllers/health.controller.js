'use strict';
const pool = require('../database/connection');

async function getHealth(req, res, next) {
  try {
    await pool.query('SELECT 1');
    return res.status(200).json({
      status: 'success',
      message: 'Server and database are healthy.',
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getHealth };
