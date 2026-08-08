'use strict';

const express   = require('express');
const rateLimit = require('express-rate-limit');
const router    = express.Router();

const requireAdminMetrics = require('../middleware/metricsAuth.middleware');

const {
  getHealth,
  getReady,
  getLive,
  getPing,
  getMetrics,
  getAdminSystem,
} = require('../controllers/health.controller');

// These routes are mounted at '/', outside the '/api/' limiter in server.js, so
// they get their own. /ready in particular issues a real Supabase query on every
// call and would otherwise be an unauthenticated way to hammer the database.
// 60/min is far above what Render health checks or the keep-alive cron need.
const monitoringLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  message:         { error: 'Too many monitoring requests, please slow down.' },
});

// ─── Public liveness endpoints ─────────────────────────────────────────────
// Kept unauthenticated so Render health checks and the GitHub Actions
// keep-alive workflow continue to work without credentials.

// Basic health endpoint – uptime, version, memory, CPU, git hash
router.get('/health', monitoringLimiter, getHealth);

// Readiness check – verifies Supabase connectivity + required env vars
router.get('/ready', monitoringLimiter, getReady);

// Liveness check – always-alive, minimal overhead
router.get('/live', monitoringLimiter, getLive);

// Keep-alive ping – for GitHub Actions cron / Render warm-up
router.get('/ping', monitoringLimiter, getPing);

// ─── Admin-only monitoring endpoints ───────────────────────────────────────
// These expose hostname, PID, memory, CPU and DB latency, so they require an
// admin JWT via `Authorization: Bearer <token>` or `?token=<token>`.

// Full application metrics snapshot (JSON)
router.get('/metrics', monitoringLimiter, requireAdminMetrics, getMetrics);

// HTML system dashboard – auto-refreshes every 30 s
router.get('/admin/system', monitoringLimiter, requireAdminMetrics, getAdminSystem);

module.exports = router;
