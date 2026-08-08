'use strict';

/**
 * PM2 Ecosystem Configuration
 * KJ Gold Appraiser – Backend API
 *
 * Usage:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 start ecosystem.config.js                    # development
 *   pm2 reload ecosystem.config.js --env production  # restart (see note below)
 *   pm2 stop  kj-gold-api
 *   pm2 logs  kj-gold-api
 *   pm2 monit
 *
 * Note: this app runs in fork mode (see "Process model" below), so `pm2 reload`
 * is a graceful restart rather than a zero-downtime one — there is a brief gap
 * while the single instance comes back up. The graceful-shutdown handler in
 * src/server.js drains in-flight requests first, so no request is cut off.
 */

module.exports = {
  apps: [
    {
      // ── Identity ────────────────────────────────────────────────────────
      name:           'kj-gold-api',
      script:         'src/server.js',
      cwd:            __dirname,

      // ── Process model ───────────────────────────────────────────────────
      // Single fork-mode instance, deliberately.
      //
      // The metrics store (src/services/metrics.service.js) is in-process
      // memory. Under cluster mode every worker keeps its own counters and
      // latency buffer, so /metrics reports whichever worker happened to serve
      // the scrape — request totals and P50/P95 would be both wrong and
      // non-deterministic. Render's free tier is 1 vCPU, where cluster mode
      // buys no real throughput anyway.
      //
      // If you later move to a multi-core host and want cluster mode, move the
      // metrics store to Redis (or aggregate via pm2's messaging bus) FIRST.
      instances:      1,
      exec_mode:      'fork',

      // ── Restart policy ──────────────────────────────────────────────────
      autorestart:          true,
      max_restarts:         10,
      min_uptime:           '10s',          // min time alive before considered stable
      restart_delay:        4000,           // ms between restart attempts
      max_memory_restart:   '512M',         // auto-restart when RSS exceeds this

      // ── Logs ────────────────────────────────────────────────────────────
      // Canonical PM2 keys. Winston already writes structured, rotated logs to
      // logs/combined-%DATE%.log and logs/error-%DATE%.log — these two files
      // only capture raw stdout/stderr that bypasses Winston (e.g. a native
      // crash trace), which is exactly what you want them for.
      out_file:     'logs/pm2-out.log',
      error_file:   'logs/pm2-error.log',
      merge_logs:   true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      // ── Watch (disabled in production; enable in dev if desired) ────────
      watch:        false,

      // ── Environment – development ────────────────────────────────────────
      env: {
        NODE_ENV:   'development',
        PORT:       5000,
        LOG_LEVEL:  'debug',
      },

      // ── Environment – production ─────────────────────────────────────────
      env_production: {
        NODE_ENV:   'production',
        PORT:       5000,
        // 'http', not 'info': morgan writes access logs via logger.http, which
        // winston filters out entirely at the 'info' level. See utils/logger.js.
        LOG_LEVEL:  'http',
        // All secrets (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, etc.)
        // should be injected via Render's Environment Variables, NOT hardcoded here.
      },

      // ── Shutdown ────────────────────────────────────────────────────────
      // PM2 sends SIGINT first; our graceful-shutdown handler drains connections.
      kill_timeout:         30000,          // ms before SIGKILL is sent
      listen_timeout:       8000,           // ms PM2 waits for the app to be online
      shutdown_with_message: false,
    },
  ],
};
