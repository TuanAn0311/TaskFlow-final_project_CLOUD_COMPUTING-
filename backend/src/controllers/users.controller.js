'use strict';
const usersRepository = require('../database/users.repository');
const { success, paginated } = require('../utils/response');

async function getUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, role, is_active, search } = req.query;
    const parsedActive = is_active === 'true' ? true : is_active === 'false' ? false : undefined;
    const result = await usersRepository.getAllUsers({
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      role,
      is_active: parsedActive,
      search,
    });
    return paginated(res, result.users, {
      page: result.page,
      limit: result.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / result.limit),
    });
  } catch (err) { next(err); }
}

async function getUserById(req, res, next) {
  try {
    const user = await usersRepository.getUserById(parseInt(req.params.id), req.user);
    return success(res, user);
  } catch (err) { next(err); }
}

async function updateUserStatus(req, res, next) {
  try {
    const { is_active } = req.body;
    const user = await usersRepository.updateUserStatus(parseInt(req.params.id), is_active, req.user);
    return success(res, user, 'User status updated');
  } catch (err) { next(err); }
}

module.exports = { getUsers, getUserById, updateUserStatus };
