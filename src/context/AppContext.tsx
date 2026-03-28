import React, {
  createContext,
  useContext,
  useEffect,
  useReducer,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { AppDB, LangCode, SyncStatus, TabId } from '../types';
import {
  auth,
  onAuthStateChanged,
  loadDB,
  saveDB,
  defaultDB,
  authSignOut,
  type User,
} from '../lib/firebase';
import { isRTL } from '../lib/i18n';
import { uiStore, startSessionTimeout, clearSessionTimeout } from '../lib/session';

// ── State Shape ───────────────────────────────────────
interface AppContextState {
  user:        User | null;
  db:          AppDB;
  month:       number;
  year:        number;
  tab:         TabId;
  lang:        LangCode;
  syncStatus:  SyncStatus;
  authReady:   boolean;
}

type Action =
  | { type: 'SET_USER';       user: User | null }
  | { type: 'SET_DB';         db: AppDB }
  | { type: 'PATCH_DB';       patch: Partial<AppDB> }
  | { type: 'SET_TAB';        tab: TabId }
  | { type: 'SET_MONTH';      month: number; year: number }
  | { type: 'SET_LANG';       lang: LangCode }
  | { type: 'SET_SYNC';       status: SyncStatus }
  | { type: 'SET_AUTH_READY' };

const now = new Date();

// Fix: CRIT-06 — use uiStore helper instead of direct localStorage access.
// uiStore only stores non-sensitive UI preferences (lang) — never financial data.
const savedLang = uiStore.get('lang') as LangCode | null;

const initialState: AppContextState = {
  user:       null,
  db:         defaultDB(),
  month:      now.getMonth(),
  year:       now.getFullYear(),
  tab:        'dashboard',
  lang:       savedLang || 'he',
  syncStatus: 'offline',
  authReady:  false,
};

function reducer(state: AppContextState, action: Action): AppContextState {
  switch (action.type) {
    case 'SET_USER':       return { ...state, user: action.user };
    case 'SET_DB':         return { ...state, db: action.db };
    case 'PATCH_DB':       return { ...state, db: { ...state.db, ...action.patch } };
    case 'SET_TAB':        return { ...state, tab: action.tab };
    case 'SET_MONTH':      return { ...state, month: action.month, year: action.year };
    case 'SET_LANG':       return { ...state, lang: action.lang };
    case 'SET_SYNC':       return { ...state, syncStatus: action.status };
    case 'SET_AUTH_READY': return { ...state, authReady: true };
    default:               return state;
  }
}

// ── Context ───────────────────────────────────────────
interface AppContextValue extends AppContextState {
  setTab:    (tab: TabId) => void;
  setMonth:  (month: number, year: number) => void;
  setLang:   (lang: LangCode) => void;
  updateDB:  (updater: (db: AppDB) => AppDB) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

// ── Provider ──────────────────────────────────────────
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async user => {
      dispatch({ type: 'SET_USER', user });
      if (user) {
        dispatch({ type: 'SET_SYNC', status: 'syncing' });
        const data = await loadDB(user.uid);
        dispatch({ type: 'SET_DB', db: data });
        dispatch({ type: 'SET_SYNC', status: 'online' });
      } else {
        // User signed out — reset DB to default (no stale data in memory)
        dispatch({ type: 'SET_DB', db: defaultDB() });
      }
      dispatch({ type: 'SET_AUTH_READY' });
    });
    return unsub;
  }, []);

  // Fix: HIGH-06 — session timeout: auto-logout after 30 min of inactivity
  useEffect(() => {
    if (state.user) {
      startSessionTimeout(authSignOut);
    } else {
      clearSessionTimeout();
    }
    return clearSessionTimeout;
  }, [state.user]);

  // Apply RTL/LTR
  useEffect(() => {
    const dir = isRTL(state.lang) ? 'rtl' : 'ltr';
    document.documentElement.dir  = dir;
    document.documentElement.lang = state.lang;
    uiStore.set('lang', state.lang); // Fix: CRIT-06 — use uiStore (non-sensitive key only)
  }, [state.lang]);

  // Debounced save
  // Fix: MED-09 — guard against user becoming null between timer schedule and fire
  const updateDB = useCallback(async (updater: (db: AppDB) => AppDB) => {
    if (!state.user) return;
    const uid   = state.user.uid; // capture before async gap
    const newDB = updater(state.db);
    dispatch({ type: 'SET_DB', db: newDB });
    dispatch({ type: 'SET_SYNC', status: 'syncing' });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveDB(uid, newDB);  // use captured uid — safe if auth changes
        dispatch({ type: 'SET_SYNC', status: 'online' });
      } catch (err) {
        console.error('[AppContext] saveDB failed:', err);
        dispatch({ type: 'SET_SYNC', status: 'offline' });
      }
    }, 800);
  }, [state.user, state.db]);

  const setTab   = useCallback((tab: TabId)   => dispatch({ type: 'SET_TAB',   tab }),    []);
  const setMonth = useCallback((month: number, year: number) =>
    dispatch({ type: 'SET_MONTH', month, year }), []);
  const setLang  = useCallback((lang: LangCode) => dispatch({ type: 'SET_LANG', lang }), []);

  return (
    <AppContext.Provider value={{ ...state, setTab, setMonth, setLang, updateDB }}>
      {children}
    </AppContext.Provider>
  );
};
