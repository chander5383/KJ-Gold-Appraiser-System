'use strict';

const os = require('os');
const { execSync } = require('child_process');

const logger = require('../utils/logger');
const { checkDatabaseLatency, checkEnvVariables } = require('../services/health.service');
const { getSnapshot, getCpuPercent } = require('../services/metrics.service');

// ─── Startup metadata (resolved once) ────────────────────────────────────────

let GIT_COMMIT = process.env.GIT_COMMIT || null;
if (!GIT_COMMIT) {
  try {
    // stdio pipe on stderr: production images often have no git binary and no
    // .git directory, and we don't want "fatal: not a git repository" leaking
    // into the process stdout ahead of the structured logs.
    GIT_COMMIT = execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (_) {
    GIT_COMMIT = 'unknown';
  }
}

const BUILD_NUMBER = process.env.BUILD_NUMBER || 'local';
const APP_VERSION  = process.env.npm_package_version || '1.0.0';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMemoryUsage() {
  const m = process.memoryUsage();
  const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';
  return {
    rss:       toMB(m.rss),
    heapUsed:  toMB(m.heapUsed),
    heapTotal: toMB(m.heapTotal),
    external:  toMB(m.external),
  };
}

function getCpuUsage() {
  const u = process.cpuUsage();
  const sampled = getCpuPercent();
  return {
    // Cumulative CPU time consumed since process start.
    userMs:   (u.user   / 1000).toFixed(2) + ' ms',
    systemMs: (u.system / 1000).toFixed(2) + ' ms',
    // Current utilisation, sampled over a rolling window.
    userPercent:       sampled.userPercent,
    systemPercent:     sampled.systemPercent,
    totalPercent:      sampled.totalPercent,      // relative to one core
    normalisedPercent: sampled.normalisedPercent, // relative to all cores
    sampleWindowMs:    sampled.sampleWindowMs,
  };
}

function getSystemInfo() {
  return {
    platform:    process.platform,
    arch:        process.arch,
    nodeVersion: process.version,
    hostname:    os.hostname(),
    cpuCount:    os.cpus().length,
    totalMemory: (os.totalmem() / 1024 / 1024).toFixed(0) + ' MB',
    freeMemory:  (os.freemem()  / 1024 / 1024).toFixed(0) + ' MB',
  };
}

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /health
 */
function getHealth(req, res) {
  const data = {
    status:      'healthy',
    uptime:      process.uptime().toFixed(2),
    uptimeHuman: formatUptime(Math.floor(process.uptime())),
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version:     APP_VERSION,
    gitCommit:   GIT_COMMIT,
    buildNumber: BUILD_NUMBER,
    memory:      getMemoryUsage(),
    cpu:         getCpuUsage(),
  };
  // debug, not info: Render polls /health continuously and morgan already logs
  // every request, so an info-level line here is pure duplicated noise in
  // combined-*.log. Set LOG_LEVEL=debug to see these.
  logger.debug('Health check', { status: data.status, uptime: data.uptime });
  return res.status(200).json(data);
}

/**
 * GET /ready
 * Checks DB connectivity + env vars. Returns 200 or 503.
 */
async function getReady(req, res) {
  try {
    const [db, env] = await Promise.all([
      checkDatabaseLatency(),
      Promise.resolve(checkEnvVariables()),
    ]);

    const ready = db.ok && env.ok;

    const payload = {
      ready,
      checks: {
        database: { ok: db.ok, latencyMs: db.latencyMs },
        env:      { ok: env.ok, missing: env.missing },
      },
      timestamp: new Date().toISOString(),
    };

    if (ready) {
      logger.info('Readiness check passed', { dbLatencyMs: db.latencyMs });
      return res.status(200).json(payload);
    }

    logger.warn('Readiness check failed', payload.checks);
    return res.status(503).json(payload);
  } catch (err) {
    logger.error('Readiness check error', { error: err.message, stack: err.stack });
    return res.status(500).json({ ready: false, error: 'Internal check error' });
  }
}

/**
 * GET /live
 */
function getLive(req, res) {
  return res.status(200).json({ alive: true });
}

/**
 * GET /ping
 * Lightweight keep-alive endpoint.
 */
function getPing(req, res) {
  return res.status(200).json({ success: true });
}

/**
 * GET /metrics
 * Full application metrics snapshot.
 */
function getMetrics(req, res) {
  const metrics = getSnapshot();
  const payload = {
    timestamp:   new Date().toISOString(),
    version:     APP_VERSION,
    gitCommit:   GIT_COMMIT,
    buildNumber: BUILD_NUMBER,
    process: {
      pid:         process.pid,
      uptime:      process.uptime().toFixed(2),
      uptimeHuman: formatUptime(Math.floor(process.uptime())),
      memory:      getMemoryUsage(),
      cpu:         getCpuUsage(),
    },
    system: getSystemInfo(),
    application: metrics,
  };
  logger.info('Metrics requested');
  return res.status(200).json(payload);
}

/**
 * GET /admin/system
 * HTML system dashboard.
 */
async function getAdminSystem(req, res) {
  try {
    const [db] = await Promise.all([checkDatabaseLatency()]);
    const metrics  = getSnapshot();
    const memory   = getMemoryUsage();
    const cpu      = getCpuUsage();
    const sysInfo  = getSystemInfo();
    const uptime   = formatUptime(Math.floor(process.uptime()));
    const dbStatus = db.ok ? '🟢 Connected' : '🔴 Disconnected';
    const dbColor  = db.ok ? '#22c55e' : '#ef4444';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>KJ Gold API – System Dashboard</title>
  <meta http-equiv="refresh" content="30"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh;padding:2rem}
    h1{font-size:1.6rem;font-weight:700;color:#f8fafc;margin-bottom:.25rem}
    .sub{color:#94a3b8;font-size:.85rem;margin-bottom:2rem}
    .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:1.25rem;margin-bottom:2rem}
    .card{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.25rem}
    .card h2{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.75rem}
    .stat{font-size:1.35rem;font-weight:700;color:#f8fafc}
    .label{font-size:.75rem;color:#94a3b8;margin-top:.15rem}
    .badge{display:inline-block;padding:.25rem .65rem;border-radius:999px;font-size:.75rem;font-weight:600}
    .green{background:#064e3b;color:#34d399}
    .red{background:#450a0a;color:#f87171}
    .yellow{background:#451a03;color:#fbbf24}
    table{width:100%;border-collapse:collapse;font-size:.8rem}
    th{text-align:left;color:#64748b;font-weight:500;padding:.4rem .6rem;border-bottom:1px solid #334155}
    td{padding:.4rem .6rem;color:#cbd5e1;border-bottom:1px solid #1e293b}
    tr:last-child td{border:none}
    .section{background:#1e293b;border:1px solid #334155;border-radius:12px;padding:1.25rem;margin-bottom:1.25rem}
    .section h2{font-size:.7rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b;margin-bottom:.75rem}
    .footer{color:#475569;font-size:.75rem;text-align:center;margin-top:2rem}
    .refresh{color:#64748b;font-size:.72rem;float:right}
  </style>
</head>
<body>
  <h1>⚙️ KJ Gold API – System Dashboard</h1>
  <p class="sub">Auto-refreshes every 30 s &nbsp;·&nbsp; ${new Date().toISOString()} <span class="refresh">v${APP_VERSION} · ${GIT_COMMIT} · build ${BUILD_NUMBER}</span></p>

  <!-- KPI Cards -->
  <div class="grid">
    <div class="card">
      <h2>Status</h2>
      <div class="stat"><span class="badge green">● Healthy</span></div>
      <div class="label">Uptime: ${uptime}</div>
    </div>
    <div class="card">
      <h2>Database</h2>
      <div class="stat" style="color:${dbColor}">${dbStatus}</div>
      <div class="label">Latency: ${db.latencyMs} ms</div>
    </div>
    <div class="card">
      <h2>Total Requests</h2>
      <div class="stat">${metrics.totalRequests.toLocaleString()}</div>
      <div class="label">${metrics.errorRequests} errors · ${metrics.successRate}% success</div>
    </div>
    <div class="card">
      <h2>Req / Min</h2>
      <div class="stat">${metrics.requestsPerMinute}</div>
      <div class="label">Since startup</div>
    </div>
    <div class="card">
      <h2>P50 Latency</h2>
      <div class="stat">${metrics.latency.p50Ms} ms</div>
      <div class="label">Median response time</div>
    </div>
    <div class="card">
      <h2>P95 Latency</h2>
      <div class="stat">${metrics.latency.p95Ms} ms</div>
      <div class="label">95th percentile</div>
    </div>
    <div class="card">
      <h2>CPU Utilisation</h2>
      <div class="stat">${cpu.totalPercent}%</div>
      <div class="label">${cpu.normalisedPercent}% across ${sysInfo.cpuCount} cores</div>
    </div>
    <div class="card">
      <h2>Memory (RSS)</h2>
      <div class="stat">${memory.rss}</div>
      <div class="label">Heap used: ${memory.heapUsed}</div>
    </div>
  </div>

  <!-- Memory -->
  <div class="section">
    <h2>Memory Usage</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>RSS</td><td>${memory.rss}</td></tr>
      <tr><td>Heap Used</td><td>${memory.heapUsed}</td></tr>
      <tr><td>Heap Total</td><td>${memory.heapTotal}</td></tr>
      <tr><td>External</td><td>${memory.external}</td></tr>
    </table>
  </div>

  <!-- CPU -->
  <div class="section">
    <h2>CPU Usage</h2>
    <table>
      <tr><th>Metric</th><th>Value</th></tr>
      <tr><td>Utilisation (1 core)</td><td>${cpu.totalPercent}%</td></tr>
      <tr><td>Utilisation (all ${sysInfo.cpuCount} cores)</td><td>${cpu.normalisedPercent}%</td></tr>
      <tr><td>User</td><td>${cpu.userPercent}%</td></tr>
      <tr><td>System</td><td>${cpu.systemPercent}%</td></tr>
      <tr><td>Sample Window</td><td>${cpu.sampleWindowMs} ms</td></tr>
      <tr><td>Cumulative User CPU Time</td><td>${cpu.userMs}</td></tr>
      <tr><td>Cumulative System CPU Time</td><td>${cpu.systemMs}</td></tr>
    </table>
  </div>

  <!-- System -->
  <div class="section">
    <h2>System Info</h2>
    <table>
      <tr><th>Property</th><th>Value</th></tr>
      <tr><td>Hostname</td><td>${sysInfo.hostname}</td></tr>
      <tr><td>Platform</td><td>${sysInfo.platform} / ${sysInfo.arch}</td></tr>
      <tr><td>Node.js</td><td>${sysInfo.nodeVersion}</td></tr>
      <tr><td>CPU Cores</td><td>${sysInfo.cpuCount}</td></tr>
      <tr><td>Total Memory</td><td>${sysInfo.totalMemory}</td></tr>
      <tr><td>Free Memory</td><td>${sysInfo.freeMemory}</td></tr>
      <tr><td>PID</td><td>${process.pid}</td></tr>
    </table>
  </div>

  <div class="footer">KJ Gold Appraiser · ${process.env.NODE_ENV || 'development'} · ${new Date().getFullYear()}</div>
</body>
</html>`;

    logger.info('Admin system dashboard served');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    logger.error('Admin system dashboard error', { error: err.message });
    return res.status(500).json({ error: 'Failed to generate dashboard' });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

module.exports = {
  getHealth,
  getReady,
  getLive,
  getPing,
  getMetrics,
  getAdminSystem,
};
