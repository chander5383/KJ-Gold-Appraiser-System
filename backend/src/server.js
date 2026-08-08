'use strict';

require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');

const logger           = require('./utils/logger');
const requestLatency   = require('./middleware/requestLatency.middleware');

const authRoutes        = require('./routes/auth.routes');
const certificateRoutes = require('./routes/certificate.routes');
const dashboardRoutes   = require('./routes/dashboard.routes');
const adminRoutes       = require('./routes/admin.routes');
const settingsRoutes    = require('./routes/settings.routes');
const pdfRoutes         = require('./routes/pdf.routes');
const pdfSimpleRoutes   = require('./routes/pdf-simple.routes');
const healthRoutes      = require('./routes/health.routes');

const app  = express();
const PORT = process.env.PORT || 5000;

// ===== SECURITY MIDDLEWARE =====
app.use(helmet());
app.use(cors({
  origin:         process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials:    true,
  methods:        ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max:      parseInt(process.env.RATE_LIMIT_MAX)       || 100,
  message:  { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter rate limit for auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { error: 'Too many login attempts, please try again after 15 minutes.' },
});
app.use('/api/auth/login', authLimiter);

// ===== PARSING MIDDLEWARE =====
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ===== REQUEST LATENCY TRACKING =====
app.use(requestLatency);

// ===== HTTP REQUEST LOGGING (Morgan → Winston) =====
// /admin/system accepts its admin JWT via ?token= (a browser navigation cannot
// send an Authorization header), so scrub any token query param before the line
// reaches the log files — otherwise a valid admin credential lands in
// logs/combined-*.log in plaintext.
const redactToken = (line) => line.replace(/([?&]token=)[^&\s"]+/gi, '$1[REDACTED]');

app.use(morgan('combined', {
  stream: {
    write: (message) => logger.http(redactToken(message.trimEnd())),
  },
}));

// ===== ROUTES =====
app.use('/api/auth',         authRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/dashboard',    dashboardRoutes);
app.use('/api/admin',        adminRoutes);
app.use('/api/settings',     settingsRoutes);
app.use('/api/pdf',          pdfRoutes);
app.use('/api/pdf-simple',   pdfSimpleRoutes);
app.use('/',                 healthRoutes); // /health /ready /live /ping /metrics /admin/system

// ===== ERROR HANDLING =====
app.use((err, req, res, next) => {
  logger.error('Unhandled request error', {
    method:  req.method,
    url:     req.originalUrl,
    status:  err.status || 500,
    message: err.message,
    stack:   process.env.NODE_ENV !== 'production' ? err.stack : undefined,
  });
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ===== START SERVER =====
const server = app.listen(PORT, () => {
  logger.info('🚀 KJ Gold Appraiser API started', {
    port:        PORT,
    environment: process.env.NODE_ENV || 'development',
    pid:         process.pid,
  });
});

// ===== GRACEFUL SHUTDOWN =====
let shuttingDown = false;

/**
 * Flush Winston's file transports before exiting. process.exit() is immediate
 * and would otherwise truncate whatever is still buffered in the rotate streams.
 */
function exitAfterLogFlush(code) {
  logger.on('finish', () => process.exit(code));
  logger.end();
  // Never hang on a stuck transport.
  setTimeout(() => process.exit(code), 2000).unref();
}

function gracefulShutdown(signal) {
  // A second Ctrl-C (or SIGTERM after SIGINT) must not restart the sequence.
  if (shuttingDown) {
    logger.warn(`${signal} received during shutdown – already draining`);
    return;
  }
  shuttingDown = true;

  logger.info(`${signal} received – starting graceful shutdown`);

  // Stop accepting new connections; wait for in-flight requests to drain
  server.close((err) => {
    if (err) {
      logger.error('Error during graceful shutdown', { error: err.message });
      return exitAfterLogFlush(1);
    }
    logger.info('All connections drained – process exiting cleanly');
    exitAfterLogFlush(0);
  });

  // Release sockets parked in keep-alive. Without this, server.close() waits for
  // every idle client to disconnect on its own, so a normally-quiet shutdown
  // still burns the full 30 s timeout below before exiting.
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  // Force-exit if not done within 30 s
  setTimeout(() => {
    logger.error('Graceful shutdown timed out – forcing exit');
    process.exit(1);
  }, 30_000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

// ===== PROCESS ERROR HANDLERS =====
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception – process will exit', {
    error: err.message,
    stack: err.stack,
  });
  // Allow logger to flush before exiting; PM2 will restart us.
  exitAfterLogFlush(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled promise rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack:  reason instanceof Error ? reason.stack   : undefined,
  });
  // Do NOT exit – log only; avoids crashing on transient async errors
});

module.exports = app;
