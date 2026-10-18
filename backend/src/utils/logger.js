'use strict';
const SENSITIVE_KEYS = ['password', 'password_hash', 'token', 'secret', 'authorization'];

const sanitize = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(sk => k.toLowerCase().includes(sk))) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = v;
    }
  }
  return out;
};

const info = (msg, meta = {}) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(JSON.stringify({ level: 'info', msg, ...sanitize(meta), ts: new Date().toISOString() }));
  }
};

const warn = (msg, meta = {}) => {
  if (process.env.NODE_ENV !== 'test') {
    console.warn(JSON.stringify({ level: 'warn', msg, ...sanitize(meta), ts: new Date().toISOString() }));
  }
};

const err = (msg, error = {}) => {
  const safeErr = { message: error.message, code: error.code };
  if (process.env.NODE_ENV !== 'production') safeErr.stack = error.stack;
  console.error(JSON.stringify({ level: 'error', msg, error: safeErr, ts: new Date().toISOString() }));
};

module.exports = { info, warn, error: err };

