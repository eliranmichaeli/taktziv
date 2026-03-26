import React, { useState } from 'react';
import {
  LayoutDashboard, Receipt, Wallet, TrendingUp, Bot,
  Settings, LogOut, Bell, User, ChevronDown,
  PiggyBank, Calendar, Star, Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t, LANGS, isRTL } from '../../lib/i18n';
import type { TabId, LangCode } from '../../types';
import { cn } from '../../lib/utils';
import { authSignOut } from '../../lib/firebase';
import { calcSavingsCurrent, getMonthBudget, totalExp, totalInc, MONTHS_HE } from '../../lib/calculations';

// ── Sidebar ───────────────────────────────────────────
interface SidebarProps {
  mobile?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ mobile = false }) => {
  const { tab, setTab, lang, db } = useApp();
  const p = db.settings.profile;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const name1 = p.name || t(lang, 'personal');
  const name2 = p.partnerName || '';

  const navItems: { id: TabId; label: string; icon: React.ElementType; group?: string }[] = [
    { id: 'dashboard',  label: t(lang, 'dashboard'), icon: LayoutDashboard },
    { id: 'personal',   label: hasPartner ? name1 : t(lang, 'personal'), icon: User },
    ...(hasPartner ? [{ id: 'personal2' as TabId, label: name2, icon: User }] : []),
    ...(isFamily   ? [{ id: 'family'    as TabId, label: t(lang, 'family'), icon: Receipt }] : []),
    { id: 'income',     label: t(lang, 'income'),   icon: Wallet },
    { id: 'cashflow',   label: t(lang, 'cashflow'), icon: TrendingUp },
    { id: 'savings',    label: t(lang, 'savings'),  icon: PiggyBank },
    { id: 'annual',     label: t(lang, 'annual'),   icon: Calendar },
    { id: 'advisor',    label: t(lang, 'advisor'),  icon: Bot },
    { id: 'freedom',    label: t(lang, 'freedom'),  icon: Star },
    { id: 'settings',   label: t(lang, 'settings'), icon: Settings },
  ];

  // Savings progress for sidebar widget
  const totalSaved = (db.savings || []).reduce((s, p) => s + calcSavingsCurrent(p), 0);
  const totalTarget = (db.savings || []).reduce((s, p) => s + (p.target || 0), 0);
  const savePct = totalTarget > 0 ? Math.min(100, Math.round(totalSaved / totalTarget * 100)) : 0;

  if (mobile) {
    return (
      <nav className="flex items-stretch h-full overflow-x-auto no-scrollbar">
        {navItems.slice(0, 8).map(item => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={cn(
              'flex-1 min-w-[52px] flex flex-col items-center justify-center gap-1 text-[9px] font-medium transition-colors',
              tab === item.id ? 'text-primary' : 'text-on-surface-variant'
            )}
          >
            <item.icon size={20} />
            <span className="hidden xs:block truncate px-1">{item.label}</span>
          </button>
        ))}
      </nav>
    );
  }

  return (
    <aside className={cn(
      'h-screen w-[200px] fixed top-0 bottom-0 flex flex-col bg-surface border-outline-variant/15 z-50',
      isRTL(lang) ? 'right-0 border-l' : 'left-0 border-r'
    )}>
      {/* Brand */}
      <div className="px-5 py-5 border-b border-outline-variant/10">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-black">₪</span>
          </div>
          <div>
            <div className="text-[14px] font-bold text-on-surface leading-tight">
              {t(lang, 'appName')}
            </div>
            <div className="text-[9px] text-on-surface-variant font-medium tracking-wider">BETA</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto no-scrollbar">
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

      {/* Savings widget */}
      {(db.savings || []).length > 0 && (
        <div className="mx-3 mb-3 p-3.5 bg-surface-container-low rounded-xl border border-outline-variant/10">
          <div className="text-[9px] font-bold text-on-surface-variant tracking-widest uppercase mb-3">
            חיסכון כולל
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">₪{Math.round(totalSaved).toLocaleString('he-IL')}</span>
              <span className="text-primary font-bold">{savePct}%</span>
            </div>
            <div className="h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-primary transition-all duration-500" style={{ width: `${savePct}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 pb-4 border-t border-outline-variant/10 pt-3 space-y-0.5">
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
  const { month, year, setMonth, tab, lang, setLang, syncStatus, db, user } = useApp();
  const [showLang, setShowLang] = useState(false);
  const rtl = isRTL(lang);

  const MONTHS = lang === 'he' ? MONTHS_HE : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const showMonthBar = !['settings', 'advisor', 'annual', 'freedom'].includes(tab);

  const syncDot = syncStatus === 'online' ? 'bg-primary' : syncStatus === 'syncing' ? 'bg-secondary animate-pulse' : 'bg-tertiary';

  return (
    <header className={cn(
      'fixed top-0 h-14 flex items-center justify-between px-5 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/15 z-40 gap-4',
      rtl ? 'right-[200px] left-0' : 'left-[200px] right-0'
    )}>
      {/* Left: add buttons (context-sensitive) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Shown inline; full logic in each tab */}
      </div>

      {/* Center: Month bar */}
      {showMonthBar && (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 justify-center">
          <select
            value={year}
            onChange={e => setMonth(month, parseInt(e.target.value))}
            className="bg-surface-container-low border-0 rounded-lg px-2 py-1.5 text-xs text-on-surface focus:ring-1 focus:ring-primary flex-shrink-0"
          >
            {[2022,2023,2024,2025,2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => setMonth(i, year)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all flex-shrink-0',
                i === month
                  ? 'bg-primary text-on-primary font-bold'
                  : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
              )}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      )}

      {/* Right: lang + sync + user */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Sync */}
        <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
          <div className={cn('w-1.5 h-1.5 rounded-full', syncDot)} />
          <span className="hidden sm:block">
            {syncStatus === 'online' ? t(lang, 'synced') : syncStatus === 'syncing' ? t(lang, 'syncing') : t(lang, 'offline')}
          </span>
        </div>

        {/* Lang selector */}
        <div className="relative">
          <button
            onClick={() => setShowLang(!showLang)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-container-low hover:bg-surface-container-high transition-colors text-xs font-medium text-on-surface-variant"
          >
            <Globe size={13} />
            <span>{LANGS[lang].flag}</span>
            <ChevronDown size={11} className={cn('transition-transform', showLang && 'rotate-180')} />
          </button>
          <AnimatePresence>
            {showLang && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className={cn(
                  'absolute top-full mt-2 bg-surface-container-low rounded-xl border border-outline-variant/15 shadow-xl overflow-hidden z-50',
                  rtl ? 'right-0' : 'left-0'
                )}
                style={{ minWidth: '160px' }}
              >
                {(Object.entries(LANGS) as [LangCode, typeof LANGS[LangCode]][]).map(([code, L]) => (
                  <button
                    key={code}
                    onClick={() => { setLang(code); setShowLang(false); }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors text-right',
                      lang === code
                        ? 'bg-primary/10 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                    )}
                  >
                    <span>{L.flag}</span>
                    <span>{L.name}</span>
                    {lang === code && <span className="ms-auto text-primary text-xs">✓</span>}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-on-primary text-xs font-bold flex-shrink-0">
            {(user?.displayName || user?.email || 'U').charAt(0).toUpperCase()}
          </div>
        </div>
      </div>
    </header>
  );
};

// ── Mobile Bottom Nav ─────────────────────────────────
export const MobileBottomNav: React.FC = () => {
  const { tab, setTab, lang } = useApp();
  const items: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: t(lang, 'dashboard'), icon: LayoutDashboard },
    { id: 'personal',  label: t(lang, 'personal'),  icon: User },
    { id: 'cashflow',  label: t(lang, 'cashflow'),  icon: TrendingUp },
    { id: 'savings',   label: t(lang, 'savings'),   icon: PiggyBank },
    { id: 'advisor',   label: t(lang, 'advisor'),   icon: Bot },
    { id: 'settings',  label: t(lang, 'settings'),  icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/15 z-50 flex items-stretch safe-bottom">
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => setTab(item.id)}
          className={cn(
            'flex-1 flex flex-col items-center justify-center gap-1 text-[9px] font-medium transition-colors',
            tab === item.id ? 'text-primary' : 'text-on-surface-variant'
          )}
        >
          {tab === item.id ? (
            <div className="bg-primary/10 rounded-xl px-3 py-1">
              <item.icon size={18} />
            </div>
          ) : (
            <item.icon size={20} />
          )}
        </button>
      ))}
    </nav>
  );
};
