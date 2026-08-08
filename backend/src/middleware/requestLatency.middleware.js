'use strict';

const { recordRequest } = require('../services/metrics.service');

/**
 * Request latency middleware.
 *
 * - Captures the high-resolution start time for every request.
 * - Stamps an `X-Response-Time` header while the headers are still mutable.
 * - Records the sample in the metrics singleton for P50/P95 calculation.
 */
function requestLatency(req, res, next) {
  const startHr = process.hrtime.bigint();

  const elapsedMs = () => {
    const elapsedNs = process.hrtime.bigint() - startHr;
    return Math.round((Number(elapsedNs) / 1_000_000) * 100) / 100; // 2 decimals
  };

  // The header must be set BEFORE the status line is written. `finish` fires
  // after the headers have already been flushed, so setHeader() there throws
  // ERR_HTTP_HEADERS_SENT and the client never receives the value.
  const originalWriteHead = res.writeHead;
  res.writeHead = function patchedWriteHead(...args) {
    if (!res.headersSent) {
      try {
        res.setHeader('X-Response-Time', `${elapsedMs()}ms`);
      } catch (_) {
        // Header already committed by an upstream write — ignore.
      }
    }
    return originalWriteHead.apply(this, args);
  };

  // Record the true end-to-end duration once the response is fully flushed.
  res.on('finish', () => {
    recordRequest(elapsedMs(), res.statusCode);
  });

  next();
}

module.exports = requestLatency;
