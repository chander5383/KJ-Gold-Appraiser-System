'use strict';

/**
 * In-memory application metrics singleton.
 *
 * Tracks:
 *  - totalRequests / errorRequests counters
 *  - Rolling latency buffer (last BUFFER_SIZE samples) for P50 / P95
 *  - Process start time for uptime calculation
 *  - Sampled CPU utilisation
 *
 * NOTE: state lives in this process only. ecosystem.config.js therefore runs a
 * single fork-mode instance — under cluster mode each worker would keep its own
 * counters and /metrics would report whichever worker happened to serve it.
 */

const os = require('os');

const BUFFER_SIZE = 1000; // keep last 1 000 request durations

const state = {
  totalRequests: 0,
  errorRequests: 0,
  latencyBuffer: [],   // circular buffer of ms durations
  startedAt: Date.now(),
};

/**
 * Record one completed request.
 * @param {number} durationMs  – response time in milliseconds
 * @param {number} statusCode  – HTTP status code
 */
function recordRequest(durationMs, statusCode) {
  state.totalRequests += 1;
  if (statusCode >= 400) state.errorRequests += 1;

  // Rolling circular buffer
  if (state.latencyBuffer.length >= BUFFER_SIZE) {
    state.latencyBuffer.shift();
  }
  state.latencyBuffer.push(durationMs);
}

/**
 * Calculate a percentile from the latency buffer.
 * @param {number} p  – percentile 0–100 (e.g. 50 for P50)
 */
function percentile(p) {
  if (state.latencyBuffer.length === 0) return 0;
  const sorted = [...state.latencyBuffer].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

/**
 * Return a snapshot of all metrics.
 */
function getSnapshot() {
  const uptimeMs = Date.now() - state.startedAt;
  const uptimeSeconds = Math.floor(uptimeMs / 1000);
  const uptimeMinutes = Math.floor(uptimeSeconds / 60);

  const successRate =
    state.totalRequests === 0
      ? 100
      : (((state.totalRequests - state.errorRequests) / state.totalRequests) * 100).toFixed(2);

  const requestsPerMinute =
    uptimeMinutes === 0
      ? state.totalRequests
      : Math.round(state.totalRequests / uptimeMinutes);

  return {
    totalRequests: state.totalRequests,
    errorRequests: state.errorRequests,
    successRate: parseFloat(successRate),
    requestsPerMinute,
    latency: {
      p50Ms: percentile(50),
      p95Ms: percentile(95),
      sampleSize: state.latencyBuffer.length,
    },
    uptime: {
      seconds: uptimeSeconds,
      human: formatUptime(uptimeSeconds),
    },
  };
}

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

// ─── CPU utilisation sampling ──────────────────────────────────────────────
//
// process.cpuUsage() is cumulative since process start, so on its own it says
// nothing about current load. We sample the delta on a fixed interval and
// express it as a percentage. Sampling on a timer (rather than on each request
// to /metrics) keeps the measurement window stable — computing it on demand
// would produce wild readings whenever two scrapes land close together.

const CPU_SAMPLE_MS = 5000;
const CPU_CORES = os.cpus().length || 1;

let lastCpu = process.cpuUsage();
let lastCpuAt = process.hrtime.bigint();

let cpuSnapshot = {
  userPercent: 0,
  systemPercent: 0,
  totalPercent: 0,
  normalisedPercent: 0,
};

function sampleCpu() {
  const nowCpu = process.cpuUsage();
  const nowAt = process.hrtime.bigint();

  const elapsedUs = Number(nowAt - lastCpuAt) / 1000; // ns → µs
  if (elapsedUs <= 0) return;

  const userUs = nowCpu.user - lastCpu.user;
  const systemUs = nowCpu.system - lastCpu.system;

  lastCpu = nowCpu;
  lastCpuAt = nowAt;

  const pct = (us) => Math.round((us / elapsedUs) * 10000) / 100;
  const total = pct(userUs + systemUs);

  cpuSnapshot = {
    userPercent: pct(userUs),
    systemPercent: pct(systemUs),
    totalPercent: total,                                  // % of one core
    normalisedPercent: Math.round((total / CPU_CORES) * 100) / 100, // % of all cores
  };
}

// unref() so this timer never holds the event loop open during shutdown.
const cpuTimer = setInterval(sampleCpu, CPU_SAMPLE_MS);
cpuTimer.unref();

/**
 * Latest sampled CPU utilisation.
 * `totalPercent` is relative to a single core (can exceed 100 on multi-core);
 * `normalisedPercent` is relative to all available cores.
 */
function getCpuPercent() {
  return { ...cpuSnapshot, sampleWindowMs: CPU_SAMPLE_MS, cores: CPU_CORES };
}

module.exports = { recordRequest, getSnapshot, getCpuPercent };
