import React, {
  createContext, useContext, useEffect, useReducer,
  useCallback, useRef, type ReactNode,
} from 'react';
import type { AppDB, LangCode, SyncStatus, TabId, ThemeMode } from '../types';
import {
  auth, onAuthStateChanged, loadDB, saveDB, defaultDB, authSignOut, type User,
} from '../lib/firebase';
import { isRTL } from '../lib/i18n';
import { uiStore, startSessionTimeout, clearSessionTimeout } from '../lib/session';

// ── State ─────────────────────────────────────────────
interface AppContextState {
  user:       User | null;
  db:         AppDB;
  month:      number;
  year:       number;
  tab:        TabId;
  lang:       LangCode;
  syncStatus: SyncStatus;
  authReady:  boolean;
  theme:      ThemeMode;
}

type Action =
  | { type: 'SET_USER';       user: User | null }
  | { type: 'SET_DB';         db: AppDB }
  | { type: 'SET_TAB';        tab: TabId }
  | { type: 'SET_MONTH';      month: number; year: number }
  | { type: 'SET_LANG';       lang: LangCode }
  | { type: 'SET_SYNC';       status: SyncStatus }
  | { type: 'SET_AUTH_READY' }
  | { type: 'SET_THEME';      theme: ThemeMode };

const now = new Date();
const savedLang = uiStore.get('lang') as LangCode | null;
const savedTheme = uiStore.get('theme') as ThemeMode | null;

const initialState: AppContextState = {
  user:       null,
  db:         defaultDB(),
  month:      now.getMonth(),
  year:       now.getFullYear(),
  tab:        'dashboard',
  lang:       savedLang  || 'he',
  syncStatus: 'offline',
  authReady:  false,
  theme:      savedTheme || 'auto',
};

function reducer(state: AppContextState, action: Action): AppContextState {
  switch (action.type) {
    case 'SET_USER':       return { ...state, user: action.user };
    case 'SET_DB':         return { ...state, db: action.db };
    case 'SET_TAB':        return { ...state, tab: action.tab };
    case 'SET_MONTH':      return { ...state, month: action.month, year: action.year };
    case 'SET_LANG':       return { ...state, lang: action.lang };
    case 'SET_SYNC':       return { ...state, syncStatus: action.status };
    case 'SET_AUTH_READY': return { ...state, authReady: true };
    case 'SET_THEME':      return { ...state, theme: action.theme };
    default:               return state;
  }
}

// ── Context ───────────────────────────────────────────
interface AppContextValue extends AppContextState {
  setTab:    (tab: TabId)   => void;
  setMonth:  (month: number, year: number) => void;
  setLang:   (lang: LangCode) => void;
  setTheme:  (theme: ThemeMode) => void;
  updateDB:  (updater: (db: AppDB) => AppDB) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const useApp = (): AppContextValue => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
};

// ── Theme helper ──────────────────────────────────────
const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'light') {
    root.classList.remove('dark');
  } else {
    // auto — לפי שעות היום: 20:00–07:00 = לילה
    const hour = new Date().getHours();
    const isDark = hour >= 20 || hour < 7;
    root.classList.toggle('dark', isDark);
  }
};

// ── Emergency fund alert ──────────────────────────────
const checkEmergencyAlert = (db: AppDB): boolean => {
  const ef = db.settings.emergencyFunds || {};
  const totalEF = (ef.personal || 0) + (ef.personal2 || 0) + (ef.family || 0);
  if (totalEF > 0) return false; // יש קרן חירום — אין צורך בהתראה

  const lastAlert = db.settings.lastEmergencyAlert || 0;
  const oneWeek   = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - lastAlert > oneWeek;
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
        // סנכרן theme מה-DB
        if (data.settings.theme) {
          dispatch({ type: 'SET_THEME', theme: data.settings.theme });
        }
      } else {
        dispatch({ type: 'SET_DB', db: defaultDB() });
      }
      dispatch({ type: 'SET_AUTH_READY' });
    });
    return unsub;
  }, []);

  // Session timeout
  useEffect(() => {
    if (state.user) {
      startSessionTimeout(authSignOut);
    } else {
      clearSessionTimeout();
    }
    return clearSessionTimeout;
  }, [state.user]);

  // RTL/LTR
  useEffect(() => {
    const dir = isRTL(state.lang) ? 'rtl' : 'ltr';
    document.documentElement.dir  = dir;
    document.documentElement.lang = state.lang;
    uiStore.set('lang', state.lang);
  }, [state.lang]);

  // Theme — apply on change + auto refresh every minute
  useEffect(() => {
    applyTheme(state.theme);
    uiStore.set('theme', state.theme);
    if (state.theme !== 'auto') return;
    const interval = setInterval(() => applyTheme('auto'), 60_000);
    return () => clearInterval(interval);
  }, [state.theme]);

  // Emergency fund weekly alert
  useEffect(() => {
    if (!state.user || !state.db.settings.onboardingDone) return;
    if (!checkEmergencyAlert(state.db)) return;

    // הצג התראה (toast יוצג ב-App.tsx)
    const timer = setTimeout(async () => {
      const totalBudget = (state.db.settings.budget.personal || 0)
        + (state.db.settings.budget.personal2 || 0)
        + (state.db.settings.budget.family || 0);
      const recommended = totalBudget * 3;
      const sym = state.db.settings.currency === 'ILS' ? '₪' : state.db.settings.currency;

      // שמור timestamp של ההתראה
      const uid = state.user?.uid;
      if (uid) {
        await saveDB(uid, {
          ...state.db,
          settings: { ...state.db.settings, lastEmergencyAlert: Date.now() },
        });
      }

      // הצג notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⚠️ אין לך קרן חירום', {
          body: `מומלץ להפריש ${sym}${recommended.toLocaleString('he-IL')} (3 חודשי הוצאות). הגדר בהגדרות.`,
          icon: '/favicon.ico',
        });
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, [state.user, state.db.settings.onboardingDone]);

  // Debounced save
  const updateDB = useCallback(async (updater: (db: AppDB) => AppDB) => {
    if (!state.user) return;
    const uid   = state.user.uid;
    const newDB = updater(state.db);
    dispatch({ type: 'SET_DB', db: newDB });
    dispatch({ type: 'SET_SYNC', status: 'syncing' });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveDB(uid, newDB);
        dispatch({ type: 'SET_SYNC', status: 'online' });
      } catch (err) {
        console.error('[AppContext] saveDB failed:', err);
        dispatch({ type: 'SET_SYNC', status: 'offline' });
      }
    }, 800);
  }, [state.user, state.db]);

  const setTab   = useCallback((tab: TabId)    => dispatch({ type: 'SET_TAB',   tab }),    []);
  const setMonth = useCallback((month: number, year: number) => dispatch({ type: 'SET_MONTH', month, year }), []);
  const setLang  = useCallback((lang: LangCode) => dispatch({ type: 'SET_LANG',  lang }),   []);
  const setTheme = useCallback((theme: ThemeMode) => {
    dispatch({ type: 'SET_THEME', theme });
  }, []);

  return (
    <AppContext.Provider value={{ ...state, setTab, setMonth, setLang, setTheme, updateDB }}>
      {children}
    </AppContext.Provider>
  );
};
