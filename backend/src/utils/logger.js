'use strict';

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const LOG_DIR = path.join(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const isProd = process.env.NODE_ENV === 'production';

// ─── Formats ───────────────────────────────────────────────────────────────
const jsonFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
  format.errors({ stack: true }),
  format.json()
);

const prettyFormat = format.combine(
  format.colorize({ all: true }),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.errors({ stack: true }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n  ${JSON.stringify(meta, null, 2)}` : '';
    return `[${timestamp}] ${level}: ${message}${metaStr}`;
  })
);

// ─── Transports ────────────────────────────────────────────────────────────
const consoleTransport = new transports.Console({
  format: isProd ? jsonFormat : prettyFormat,
  handleExceptions: true,
});

const combinedRotate = new DailyRotateFile({
  filename: path.join(LOG_DIR, 'combined-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

const errorRotate = new DailyRotateFile({
  level: 'error',
  filename: path.join(LOG_DIR, 'error-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
  format: jsonFormat,
});

// ─── Logger Singleton ──────────────────────────────────────────────────────
//
// Default level is 'http', NOT 'info'. Winston's npm levels are
// error:0 warn:1 info:2 http:3 verbose:4 debug:5, and the logger-level gate is
// applied before any transport sees the message. At 'info' every morgan access
// log (emitted via logger.http) is silently discarded — the HTTP access log
// would simply never reach combined-*.log. 'http' keeps access logging on while
// still excluding verbose/debug.
const logger = createLogger({
  level: process.env.LOG_LEVEL || 'http',
  exitOnError: false,
  transports: [consoleTransport, combinedRotate, errorRotate],
});

// Rotation event hooks
combinedRotate.on('rotate', (oldFile, newFile) => {
  logger.info('Log rotated', { oldFile, newFile });
});

module.exports = logger;
