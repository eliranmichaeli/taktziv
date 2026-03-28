// ── Session Security ──────────────────────────────────
// Fixes: CRIT-06 (localStorage not cleared on logout)
//        HIGH-06  (no session timeout)
//
// Usage in AppContext:
//   import { startSessionTimeout, clearSessionTimeout } from '../lib/session';
//   useEffect(() => { startSessionTimeout(authSignOut); return clearSessionTimeout; }, []);

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes inactivity
const EVENTS     = ['click', 'keydown', 'mousemove', 'touchstart', 'scroll'] as const;

let _timer: ReturnType<typeof setTimeout> | null = null;
let _onExpire: (() => void) | null = null;

const resetTimer = () => {
  if (!_onExpire) return;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => {
    _onExpire?.();
  }, TIMEOUT_MS);
};

export const startSessionTimeout = (onExpire: () => void): void => {
  _onExpire = onExpire;
  EVENTS.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
  resetTimer();
};

export const clearSessionTimeout = (): void => {
  if (_timer) clearTimeout(_timer);
  _timer = null;
  _onExpire = null;
  EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
};

// ── Secure storage helpers ────────────────────────────
/** Only store non-sensitive UI preferences here (e.g. lang). Never financial data. */
export const uiStore = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set: (key: string, value: string): void => {
    try { localStorage.setItem(key, value); } catch { /* quota exceeded — ignore */ }
  },
  clearAll: (): void => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* ignore */ }
  },
};
