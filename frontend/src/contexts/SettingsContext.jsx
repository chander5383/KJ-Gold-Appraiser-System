/**
 * SettingsContext — Global Shop Settings Store
 * ==============================================
 * THE single source of truth for shop information in the frontend.
 *
 * Every place that displays shop identity (certificate header, print clone,
 * PDF render target, sidebar) reads from here. Nothing hardcodes a shop name,
 * GSTIN, PAN, phone, watermark or default gold rate any more.
 *
 * Flow:
 *   GET  /api/settings          → hydrate the store (once, on mount / on login)
 *   PUT  /api/settings          → write DB, adopt the server's response
 *                                 → every consumer re-renders immediately
 *
 * There is no page reload, no re-login and no manual refetch anywhere in that
 * path: SettingsPage calls save() on this context, the context swaps its state,
 * React re-renders every subscriber.
 *
 * Cross-tab: a BroadcastChannel message tells other open tabs to adopt the same
 * payload, so a save in one tab lands in all of them.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef
} from 'react';
import api from '../api/client';
import { useAuth } from './AuthContext';

const SettingsContext = createContext(null);

/** Cross-tab notification channel. Guarded — jsdom/older Safari lack it. */
const CHANNEL_NAME = 'kj_settings';

/**
 * Last-known shop name, mirrored to localStorage purely so the LOGIN screen has
 * something better than a hardcoded literal to show. /api/settings requires a
 * token, so a logged-out visitor cannot read the live value.
 *
 * This cache is display-only for that one footer. It is deliberately never used
 * to hydrate the store — every authenticated surface, and the PDF in
 * particular, reads straight from the API.
 */
const SHOP_NAME_CACHE_KEY = 'kj_shop_name';

/** Read the last-known shop name. Returns '' when nobody has logged in yet. */
export function readCachedShopName() {
  try {
    return localStorage.getItem(SHOP_NAME_CACHE_KEY) || '';
  } catch {
    return '';
  }
}

/**
 * Keys the app knows about today. Used only to give the shop object a stable
 * shape; values ALWAYS come from the database. Any future setting added to the
 * `settings` table is still exposed through `settings[key]` without a code
 * change here.
 */
export const SHOP_KEYS = [
  'shop_name',
  'owner_name',
  'shop_address',
  'gstin',
  'pan',
  'phone',
  'cert_prefix',
  'watermark_url',
  'gold_rate_default'
];

/**
 * Empty-string shape. Deliberately NOT seeded with real shop values: a
 * hardcoded fallback is exactly the bug this module exists to remove — it would
 * render stale details for the split second before the fetch resolves, and
 * forever if the fetch failed.
 */
const EMPTY_SHOP = SHOP_KEYS.reduce((acc, k) => ({ ...acc, [k]: '' }), {});

export function SettingsProvider({ children }) {
  const { token } = useAuth();

  const [settings, setSettings] = useState(EMPTY_SHOP);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Written by both the fetch effect and the broadcast listener; a ref keeps
  // the listener from needing `settings` in its dependency array.
  const channelRef = useRef(null);

  const applySettings = useCallback((incoming) => {
    const next = { ...EMPTY_SHOP, ...(incoming || {}) };
    setSettings(next);
    setError(null);

    try {
      if (next.shop_name) localStorage.setItem(SHOP_NAME_CACHE_KEY, next.shop_name);
    } catch {
      // Private mode / storage full — the login footer just falls back.
    }
  }, []);

  /**
   * Read the authoritative values from the API.
   *
   * Freshness is enforced by the `no-store, no-cache, must-revalidate` response
   * headers the settings controller sets — the browser cannot reuse a pre-save
   * copy. Deliberately NOT sent as a request header too: `Cache-Control` is not
   * CORS-safelisted, so it would force an OPTIONS preflight on every settings
   * read, and the API's `allowedHeaders` list does not include it.
   */
  const fetchSettings = useCallback(
    async (signal) => {
      // The PDF render target runs inside Playwright, which injects only
      // `kj_token` into localStorage (no `kj_user`), so AuthContext's `token`
      // state is null there. Read localStorage directly so that context still
      // hydrates and the generated PDF gets live shop details.
      const authToken = token || localStorage.getItem('kj_token');
      if (!authToken) {
        setLoading(false);
        return null;
      }

      try {
        const res = await api.get('/settings', { signal });

        if (signal?.aborted) return null;

        applySettings(res.data.settings);
        setUpdatedAt(res.data.updatedAt || null);
        return res.data.settings;
      } catch (err) {
        if (signal?.aborted || err.code === 'ERR_CANCELED') return null;
        setError(err);
        return null;
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [token, applySettings]
  );

  // Hydrate on mount, and again whenever the session changes (login/logout).
  // AbortController keeps StrictMode's double-mount from issuing two requests.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetchSettings(controller.signal);
    return () => controller.abort();
  }, [fetchSettings]);

  // Adopt saves made in other tabs of the same browser.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return undefined;

    const channel = new BroadcastChannel(CHANNEL_NAME);
    channelRef.current = channel;

    channel.onmessage = (event) => {
      if (event.data?.type !== 'settings:updated') return;
      applySettings(event.data.settings);
      setUpdatedAt(event.data.updatedAt || null);
    };

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [applySettings]);

  /** Re-read from the database. Exposed for callers that want an explicit pull. */
  const refresh = useCallback(() => fetchSettings(), [fetchSettings]);

  /**
   * Persist a patch and update the global store from the server's reply.
   *
   * Order matters: database first, then global state. The controller responds
   * with the re-read committed rows, so what lands in state is what is actually
   * stored — never an optimistic guess that could drift if a write was coerced
   * or rejected.
   *
   * @param {Object} patch - { key: value } pairs to persist
   * @returns {Promise<Object>} the full, committed settings object
   */
  const save = useCallback(
    async (patch) => {
      const res = await api.put('/settings', patch);

      // Older/rolled-back backends return only { message }; fall back to a
      // re-read so the store is still server-truth rather than the request body.
      const committed = res.data?.settings || (await fetchSettings());
      const committedAt = res.data?.updatedAt || null;

      applySettings(committed);
      setUpdatedAt(committedAt);

      channelRef.current?.postMessage({
        type: 'settings:updated',
        settings: committed,
        updatedAt: committedAt
      });

      return committed;
    },
    [fetchSettings, applySettings]
  );

  const value = useMemo(
    () => ({
      /** Raw `{ key: value }` map — includes any setting the DB grows later. */
      settings,
      /** Known shop fields, always present as strings. */
      shop: { ...EMPTY_SHOP, ...settings },
      /** Default gold rate as a number, for seeding new certificates. */
      defaultGoldRate: Number(settings.gold_rate_default) || 0,
      loading,
      error,
      updatedAt,
      refresh,
      save
    }),
    [settings, loading, error, updatedAt, refresh, save]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
}

/** Convenience hook for components that only need the shop fields. */
export function useShop() {
  return useSettings().shop;
}
