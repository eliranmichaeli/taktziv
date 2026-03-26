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
  type User,
} from '../lib/firebase';
import { isRTL } from '../lib/i18n';

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

const initialState: AppContextState = {
  user:       null,
  db:         defaultDB(),
  month:      now.getMonth(),
  year:       now.getFullYear(),
  tab:        'dashboard',
  lang:       (localStorage.getItem('lang') as LangCode) || 'he',
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
      }
      dispatch({ type: 'SET_AUTH_READY' });
    });
    return unsub;
  }, []);

  // Apply RTL/LTR
  useEffect(() => {
    const dir = isRTL(state.lang) ? 'rtl' : 'ltr';
    document.documentElement.dir  = dir;
    document.documentElement.lang = state.lang;
    localStorage.setItem('lang', state.lang);
  }, [state.lang]);

  // Debounced save
  const updateDB = useCallback(async (updater: (db: AppDB) => AppDB) => {
    if (!state.user) return;
    const newDB = updater(state.db);
    dispatch({ type: 'SET_DB', db: newDB });
    dispatch({ type: 'SET_SYNC', status: 'syncing' });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await saveDB(state.user!.uid, newDB);
      dispatch({ type: 'SET_SYNC', status: 'online' });
    }, 800);
  }, [state.user, state.db]);

  const setTab   = useCallback((tab: TabId)  => dispatch({ type: 'SET_TAB', tab }), []);
  const setMonth = useCallback((month: number, year: number) => dispatch({ type: 'SET_MONTH', month, year }), []);
  const setLang  = useCallback((lang: LangCode) => dispatch({ type: 'SET_LANG', lang }), []);

  return (
    <AppContext.Provider value={{ ...state, setTab, setMonth, setLang, updateDB }}>
      {children}
    </AppContext.Provider>
  );
};
