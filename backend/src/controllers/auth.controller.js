'use strict';
const authRepository = require('../database/auth.repository');
const { success } = require('../utils/response');

async function register(req, res, next) {
  try {
    const result = await authRepository.register(req.body);
    return success(res, result, 'Registration successful', 201);
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authRepository.login(req.body);
    return success(res, result, 'Login successful');
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await authRepository.getMe(req.user.id);
    return success(res, user, 'Current user retrieved');
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, getMe };
