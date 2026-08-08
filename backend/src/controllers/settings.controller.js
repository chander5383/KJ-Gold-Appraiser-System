const supabase = require('../config/database');

// Settings are the single source of truth for shop identity across the whole
// application (certificate header, print, PDF, sidebar...). Every response must
// therefore be the live database state — never a cached copy. Without these
// headers a browser or intermediate proxy is free to replay a stale 200 for
// GET /api/settings, which would silently resurrect the old shop details after
// an admin saved new ones.
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
  Pragma: 'no-cache',
  Expires: '0'
};

/**
 * Read every settings row straight from the database and fold it into a plain
 * `{ key: value }` object.
 *
 * Shared by getSettings and updateSettings so a save responds with exactly what
 * a subsequent GET would return — the client can adopt it verbatim.
 */
async function readAllSettings() {
  const { data, error } = await supabase
    .from('settings')
    .select('key, value, updated_at')
    .order('key', { ascending: true });

  if (error) throw error;

  const settings = {};
  let updatedAt = null;

  (data || []).forEach((s) => {
    settings[s.key] = s.value;
    if (s.updated_at && (!updatedAt || s.updated_at > updatedAt)) {
      updatedAt = s.updated_at;
    }
  });

  return { settings, updatedAt };
}

// ===== GET ALL SETTINGS =====
async function getSettings(req, res) {
  try {
    const { settings, updatedAt } = await readAllSettings();

    res.set(NO_STORE);
    res.json({ settings, updatedAt });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings.' });
  }
}

// ===== UPDATE SETTINGS =====
async function updateSettings(req, res) {
  try {
    const updates = req.body; // { key: value, key2: value2, ... }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Invalid settings data.' });
    }

    const keys = Object.keys(updates);
    if (keys.length === 0) {
      return res.status(400).json({ error: 'No settings supplied.' });
    }

    for (const [key, value] of Object.entries(updates)) {
      // Upsert each setting
      const { error } = await supabase
        .from('settings')
        .upsert(
          { key, value: value === null || value === undefined ? '' : String(value) },
          { onConflict: 'key' }
        );

      if (error) throw error;
    }

    // Re-read after writing. The response is the committed database state, not
    // an echo of the request body, so the client's global store can adopt it
    // directly and every dependent component renders the same values the next
    // GET would produce.
    const { settings, updatedAt } = await readAllSettings();

    // Log
    await supabase.from('activity_logs').insert({
      user_id: req.user.id,
      action: 'UPDATE_SETTINGS',
      entity_type: 'settings',
      details: { keys },
      ip_address: req.ip
    });

    res.set(NO_STORE);
    res.json({ message: 'Settings updated successfully.', settings, updatedAt });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Failed to update settings.' });
  }
}

module.exports = { getSettings, updateSettings };
