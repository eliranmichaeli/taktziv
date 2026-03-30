import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard, Receipt, Wallet, TrendingUp, Bot,
  Settings, LogOut, User, ChevronDown, Globe,
  PiggyBank, Calendar, Star, Sun, Moon, Monitor,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t, LANGS, isRTL } from '../../lib/i18n';
import type { TabId, LangCode, ThemeMode } from '../../types';
import { cn } from '../../lib/utils';
import { authSignOut } from '../../lib/firebase';
import { MONTHS_HE } from '../../lib/calculations';

// ── Sidebar ───────────────────────────────────────────
export const Sidebar: React.FC = () => {
  const { tab, setTab, lang, db } = useApp();
  const p          = db.settings.profile;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const name1      = p.name || t(lang, 'personal');
  const name2      = p.partnerName || '';

  const navItems: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: t(lang, 'dashboard'), icon: LayoutDashboard },
    { id: 'personal',  label: hasPartner ? name1 : t(lang, 'personal'), icon: User },
    ...(hasPartner ? [{ id: 'personal2' as TabId, label: name2,           icon: User    }] : []),
    ...(isFamily   ? [{ id: 'family'    as TabId, label: t(lang,'family'), icon: Receipt }] : []),
    { id: 'income',    label: t(lang, 'income'),   icon: Wallet },
    { id: 'cashflow',  label: t(lang, 'cashflow'), icon: TrendingUp },
    { id: 'savings',   label: t(lang, 'savings'),  icon: PiggyBank },
    { id: 'annual',    label: t(lang, 'annual'),   icon: Calendar },
    { id: 'advisor',   label: t(lang, 'advisor'),  icon: Bot },
    { id: 'freedom',   label: t(lang, 'freedom'),  icon: Star },
    { id: 'settings',  label: t(lang, 'settings'), icon: Settings },
    ...(user?.email === 'eliran1456@gmail.com' ? [{ id: 'admin' as TabId, label: 'ניהול', icon: ShieldCheck }] : []),
  ];

  // Admin — רק למנהל
  const ADMIN_EMAIL = 'eliran1456@gmail.com';
  if (db && (db as any)._adminEmail === ADMIN_EMAIL || true) {
    // נטפל בזה ב-useApp
  }

  return (
    <aside className={cn(
      'h-screen w-[200px] fixed top-0 bottom-0 flex flex-col bg-surface border-outline-variant/15 z-50',
      isRTL(lang) ? 'right-0 border-l' : 'left-0 border-r'
    )}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-outline-variant/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-black">₪</span>
          </div>
          <div>
            <div className="text-[14px] font-bold text-on-surface leading-tight">{t(lang, 'appName')}</div>
            <div className="text-[9px] text-on-surface-variant font-medium tracking-wider">BETA</div>
          </div>
        </div>
      </div>

      {/* Nav — overflow:hidden לתפריט קבוע ללא גלילה */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-hidden">
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
              tab === item.id
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            )}
          >
            <item.icon size={16} className="flex-shrink-0 opacity-80" />
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-outline-variant/10 pt-3 flex-shrink-0">
        <button
          onClick={authSignOut}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-on-surface-variant hover:text-error transition-colors rounded-lg hover:bg-error/5"
        >
          <LogOut size={14} />
          <span>התנתק</span>
        </button>
      </div>
    </aside>
  );
};

// ── TopBar ────────────────────────────────────────────
export const TopBar: React.FC = () => {
  const { month, year, setMonth, tab, lang, setLang, setTheme, theme, syncStatus, db, user } = useApp();
  const [showLang,   setShowLang]   = useState(false);
  const [showAvatar, setShowAvatar] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const rtl = isRTL(lang);

  const MONTHS       = lang === 'he' ? MONTHS_HE : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const showMonthBar = !['settings','advisor','annual','freedom'].includes(tab);
  const syncDot      = syncStatus === 'online' ? 'bg-primary' : syncStatus === 'syncing' ? 'bg-secondary animate-pulse' : 'bg-tertiary';
  const initials     = (user?.displayName || user?.email || 'U').charAt(0).toUpperCase();

  // סגור כשלוחצים מחוץ
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setShowAvatar(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const themeOptions: { val: ThemeMode; icon: React.ElementType; label: string }[] = [
    { val: 'light', icon: Sun,     label: 'בהיר' },
    { val: 'dark',  icon: Moon,    label: 'כהה' },
    { val: 'auto',  icon: Monitor, label: 'אוטומטי' },
  ];

  return (
    <header className={cn(
      'fixed top-0 h-14 flex items-center justify-between px-4 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/15 z-40 gap-3',
      rtl ? 'right-[200px] left-0' : 'left-[200px] right-0'
    )}>
      {/* Month bar */}
      {showMonthBar ? (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 justify-center">
          <select
            value={year}
            onChange={e => setMonth(month, parseInt(e.target.value))}
            className="bg-surface-container-low border-0 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:ring-1 focus:ring-primary flex-shrink-0"
          >
            {[2022,2023,2024,2025,2026].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {MONTHS.map((m, i) => (
            <button key={i} onClick={() => setMonth(i, year)}
              className={cn('px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-shrink-0',
                i === month ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant hover:bg-surface-container-high'
              )}>
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      ) : <div className="flex-1" />}

      {/* Right controls */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Sync dot */}
        <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
          <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', syncDot)} />
          <span className="hidden sm:block">
            {syncStatus === 'online' ? t(lang,'synced') : syncStatus === 'syncing' ? t(lang,'syncing') : t(lang,'offline')}
          </span>
        </div>

        {/* Lang */}
        <div className="relative">
          <button onClick={() => { setShowLang(!showLang); setShowAvatar(false); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors text-xs font-medium text-on-surface-variant">
            <Globe size={13} />
            <span>{LANGS[lang].flag}</span>
            <ChevronDown size={11} className={cn('transition-transform', showLang && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showLang && (
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className={cn('absolute top-full mt-2 bg-surface-container-low rounded-xl border border-outline-variant/15 shadow-xl overflow-hidden z-50 min-w-[160px]',
                  rtl ? 'right-0' : 'left-0'
                )}>
                {(Object.entries(LANGS) as [LangCode, typeof LANGS[LangCode]][]).map(([code, L]) => (
                  <button key={code} onClick={() => { setLang(code); setShowLang(false); }}
                    className={cn('w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors',
                      lang === code ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                    )}>
                    <span>{L.flag}</span><span>{L.name}</span>
                    {lang === code && <span className="ms-auto text-primary text-xs">✓</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Avatar + menu */}
        <div className="relative" ref={avatarRef}>
          <button
            onClick={() => { setShowAvatar(!showAvatar); setShowLang(false); }}
            className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold flex-shrink-0 hover:ring-2 hover:ring-primary/30 transition-all"
          >
            {initials}
          </button>
          <AnimatePresence>
            {showAvatar && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute top-full mt-2 bg-surface-container-low rounded-xl border border-outline-variant/15 shadow-xl overflow-hidden z-50',
                  // תמיד פתח לשמאל כדי לא לחרוג מהמסך
                  rtl ? 'left-0' : 'right-0'
                )}
                style={{ minWidth: '200px', maxWidth: '240px' }}
              >
                {/* שם + מייל */}
                <div className="px-4 py-3 border-b border-outline-variant/10">
                  <div className="text-sm font-bold text-on-surface truncate">
                    {user?.displayName || t(lang,'personal')}
                  </div>
                  <div className="text-[11px] text-on-surface-variant truncate mt-0.5">
                    {user?.email || ''}
                  </div>
                </div>

                {/* מצב תצוגה */}
                <div className="px-3 py-2 border-b border-outline-variant/10">
                  <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">מצב תצוגה</div>
                  <div className="flex gap-1">
                    {themeOptions.map(opt => (
                      <button key={opt.val}
                        onClick={() => { setTheme(opt.val); }}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-medium transition-all',
                          theme === opt.val
                            ? 'bg-primary/10 text-primary'
                            : 'text-on-surface-variant hover:bg-surface-container-high'
                        )}>
                        <opt.icon size={14} />
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* הגדרות */}
                <button
                  onClick={() => { setShowAvatar(false); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
                >
                  <Settings size={14} />
                  <span>הגדרות</span>
                </button>

                {/* התנתקות */}
                <button
                  onClick={() => { setShowAvatar(false); authSignOut(); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-error hover:bg-error/5 transition-colors border-t border-outline-variant/10"
                >
                  <LogOut size={14} />
                  <span>התנתק</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
};

// ── Mobile Bottom Nav ─────────────────────────────────
export const MobileBottomNav: React.FC = () => {
  const { tab, setTab, lang } = useApp();
  const items: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: t(lang,'dashboard'), icon: LayoutDashboard },
    { id: 'personal',  label: t(lang,'personal'),  icon: User },
    { id: 'cashflow',  label: t(lang,'cashflow'),  icon: TrendingUp },
    { id: 'savings',   label: t(lang,'savings'),   icon: PiggyBank },
    { id: 'advisor',   label: t(lang,'advisor'),   icon: Bot },
    { id: 'settings',  label: t(lang,'settings'),  icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/15 z-50 flex items-stretch safe-bottom">
      {items.map(item => (
        <button key={item.id} onClick={() => setTab(item.id)}
          className={cn('flex-1 flex flex-col items-center justify-center gap-1 text-[9px] font-medium transition-colors',
            tab === item.id ? 'text-primary' : 'text-on-surface-variant'
          )}>
          {tab === item.id ? (
            <div className="bg-primary/10 rounded-xl px-3 py-1"><item.icon size={18} /></div>
          ) : (
            <item.icon size={20} />
          )}
          <span className="hidden xs:block">{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
