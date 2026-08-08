'use strict';

const supabase = require('../config/database');
const logger = require('../utils/logger');

/**
 * Verify Supabase connectivity AND measure round-trip latency.
 * Returns { ok: boolean, latencyMs: number | null }.
 */
async function checkDatabaseLatency() {
  const start = Date.now();
  try {
    const { error } = await supabase
      .from('certificates')
      .select('id')
      .limit(1);

    const latencyMs = Date.now() - start;

    if (error) {
      logger.warn('Supabase readiness check failed', { error: error.message, latencyMs });
      return { ok: false, latencyMs };
    }

    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    logger.error('Supabase readiness check threw an exception', { error: err.message, latencyMs });
    return { ok: false, latencyMs };
  }
}

/**
 * Verify Supabase connection (boolean shorthand for liveness use).
 */
async function checkSupabaseConnection() {
  const { ok } = await checkDatabaseLatency();
  return ok;
}

/**
 * Ensure required environment variables are present.
 * Returns { ok: boolean, missing: string[] }.
 */
function checkEnvVariables() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'NODE_ENV'];
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    logger.warn('Missing environment variables', { missing });
    return { ok: false, missing };
  }
  return { ok: true, missing: [] };
}

module.exports = {
  checkDatabaseLatency,
  checkSupabaseConnection,
  checkEnvVariables,
};
