'use strict';

const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    '❌ JWT_SECRET is not set. This environment variable is required.\n' +
    '   Development: add JWT_SECRET=<long-random-string> to backend/.env\n' +
    '   Production:  set JWT_SECRET in your hosting provider environment (Render → Environment)'
  );
  process.exit(1);
}

/**
 * Auth guard for the monitoring endpoints (/metrics, /admin/system).
 *
 * These expose hostname, PID, memory, CPU and database latency, so they are
 * restricted to admin users. The token is accepted from either:
 *
 *   - `Authorization: Bearer <token>`  — API clients and metrics scrapers
 *   - `?token=<token>`                 — /admin/system is HTML meant to be opened
 *                                        in a browser, and a plain browser
 *                                        navigation cannot attach an
 *                                        Authorization header
 *
 * Liveness endpoints (/health, /live, /ping) stay public so Render's health
 * checks and the GitHub Actions keep-alive workflow keep working unchanged.
 */
function requireAdminMetrics(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    logger.warn('Monitoring endpoint auth failed', {
      path:   req.originalUrl,
      ip:     req.ip,
      reason: expired ? 'expired' : 'invalid',
    });
    return res.status(expired ? 401 : 403).json({
      error: expired ? 'Token expired. Please login again.' : 'Invalid token.',
    });
  }

  if (!decoded || decoded.role !== 'admin') {
    logger.warn('Monitoring endpoint access denied – not an admin', {
      path: req.originalUrl,
      ip:   req.ip,
      user: decoded && decoded.username,
    });
    return res.status(403).json({ error: 'Admin access required.' });
  }

  req.user = decoded;
  next();
}

module.exports = requireAdminMetrics;
