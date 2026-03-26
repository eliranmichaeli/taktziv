import React from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Plus } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import {
  totalInc, totalExp, balance, fixedTotal, varTotal,
  incTotal, getMonthBudget, getAlerts, getCurrencySymbol,
  calcHealthScore, MONTHS_HE,
  fmt, fmtSigned,
} from '../../lib/calculations';
import type { ScopeType } from '../../types';
import { cn } from '../../lib/utils';

// ── Stat card ────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  warn?: boolean;
  delay?: number;
}> = ({ label, value, sub, accent, warn, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3, delay }}
    className={cn(
      'rounded-2xl p-6 border border-outline-variant/5 relative overflow-hidden',
      accent ? 'bg-primary/8' : warn ? 'bg-tertiary/8' : 'bg-surface-container-low'
    )}
  >
    <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{label}</div>
    <div className={cn(
      'text-3xl font-black tracking-tight font-headline',
      accent ? 'text-primary' : warn ? 'text-tertiary' : 'text-on-surface'
    )}>
      {value}
    </div>
    {sub && <div className="text-xs text-on-surface-variant mt-2">{sub}</div>}
  </motion.div>
);

// ── Budget progress bar ───────────────────────────────
const BudgetBar: React.FC<{ label: string; spent: number; budget: number; sym: string }> = ({
  label, spent, budget, sym,
}) => {
  if (budget <= 0) return null;
  const pct    = Math.min(100, Math.round(spent / budget * 100));
  const isOver = pct >= 100;
  const isWarn = pct >= 80;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-on-surface-variant font-medium">{label}</span>
        <span className={cn('font-bold', isOver ? 'text-error' : isWarn ? 'text-tertiary' : 'text-on-surface-variant')}>
          {sym}{Math.round(spent).toLocaleString('he-IL')} / {sym}{budget.toLocaleString('he-IL')} ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', isOver ? 'bg-error' : isWarn ? 'bg-tertiary' : 'bg-primary')}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
};

// ── Dashboard ─────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const { db, month, year, lang, setTab, updateDB } = useApp();
  const sym   = getCurrencySymbol(db);
  const p     = db.settings.profile;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;

  const inc   = totalInc(db, month, year);
  const exp   = totalExp(db, month, year);
  const bal   = balance(db, month, year);
  const savePct = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;

  const budP  = getMonthBudget(db, 'personal', month, year);
  const budF  = getMonthBudget(db, 'family', month, year);
  const expP  = fixedTotal(db, 'personal') + varTotal(db, 'personal', month, year);
  const expF  = fixedTotal(db, 'family') + varTotal(db, 'family', month, year);
  const alerts = getAlerts(db, month, year);
  const health = calcHealthScore(db, month, year);

  const MONTHS = MONTHS_HE;
  const monthLabel = `${MONTHS[month]} ${year}`;

  // Recent transactions
  const recent = [...(db.variable || [])]
    .filter(e => e.month === month && e.year === year)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  // User rows
  type UserRow = { label: string; stype: ScopeType; color: string };
  const userRows: UserRow[] = [
    { label: hasPartner ? p.name || t(lang, 'personal') : t(lang, 'personal'), stype: 'personal', color: 'text-primary' },
    ...(hasPartner ? [{ label: p.partnerName || '', stype: 'personal2' as ScopeType, color: 'text-secondary' }] : []),
    ...(isFamily   ? [{ label: t(lang, 'family'), stype: 'family' as ScopeType, color: 'text-tertiary' }] : []),
  ];

  return (
    <div className="space-y-8">
      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-tertiary/8 border border-tertiary/20 rounded-xl text-sm text-on-surface"
        >
          <AlertTriangle className="text-tertiary flex-shrink-0" size={18} />
          <span>{alerts.map(a => `${a.cat} (${sym}${Math.round(a.spent).toLocaleString('he-IL')}/${sym}${Math.round(a.goal).toLocaleString('he-IL')})`).join(' · ')}</span>
        </motion.div>
      )}

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="space-y-2"
      >
        <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.14em]">
          {monthLabel} — {t(lang, 'balance')}
        </div>
        <div className={cn(
          'text-5xl font-black tracking-[-2px] leading-none font-headline',
          bal >= 0 ? 'text-on-surface' : 'text-error'
        )}>
          {bal < 0 ? '−' : ''}{sym}{Math.abs(Math.round(bal)).toLocaleString('he-IL')}
        </div>
        <div className="flex items-center gap-4 text-sm text-on-surface-variant pt-1">
          <span>{t(lang, 'income')} <strong className="text-primary">{sym}{Math.round(inc).toLocaleString('he-IL')}</strong></span>
          <span className="text-outline-variant">·</span>
          <span>{t(lang, 'expenses')} <strong className="text-on-surface">{sym}{Math.round(exp).toLocaleString('he-IL')}</strong></span>
          {savePct > 0 && <>
            <span className="text-outline-variant">·</span>
            <span>חיסכון <strong className="text-primary">{savePct}%</strong></span>
          </>}
        </div>
      </motion.div>

      {/* Budget bars */}
      {(budP > 0 || budF > 0) && (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5 space-y-4">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">מעקב תקציב</div>
          {budP > 0 && <BudgetBar label={hasPartner ? p.name || t(lang, 'personal') : t(lang, 'personal')} spent={expP} budget={budP} sym={sym} />}
          {budF > 0 && <BudgetBar label={t(lang, 'family')} spent={expF} budget={budF} sym={sym} />}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t(lang, 'income')}   value={sym + Math.round(inc).toLocaleString('he-IL')} accent delay={0} />
        <StatCard label={t(lang, 'expenses')} value={sym + Math.round(exp).toLocaleString('he-IL')} delay={0.05} />
        {userRows.slice(0, 2).map((u, i) => (
          <StatCard
            key={u.stype}
            label={u.label}
            value={sym + Math.round(fixedTotal(db, u.stype) + varTotal(db, u.stype, month, year)).toLocaleString('he-IL')}
            delay={0.1 + i * 0.05}
          />
        ))}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-12 gap-6">
        {/* Per-user breakdown */}
        {userRows.length > 1 && (
          <div className="col-span-12 lg:col-span-5 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-5">פירוט לפי חשבון</div>
            <div className="space-y-0">
              {userRows.map(u => {
                const uInc = incTotal(db, u.stype, month, year);
                const uExp = fixedTotal(db, u.stype) + varTotal(db, u.stype, month, year);
                const net  = uInc - uExp;
                return (
                  <div key={u.stype} className="flex items-center justify-between py-3.5 border-b border-outline-variant/8 last:border-0">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('w-1.5 h-8 rounded-full', u.stype === 'personal' ? 'bg-primary' : u.stype === 'personal2' ? 'bg-secondary' : 'bg-tertiary')} />
                      <div>
                        <div className="text-sm font-semibold text-on-surface">{u.label}</div>
                        <div className="text-[11px] text-on-surface-variant">
                          {t(lang, 'income')} {sym}{Math.round(uInc).toLocaleString('he-IL')} / {t(lang, 'expenses')} {sym}{Math.round(uExp).toLocaleString('he-IL')}
                        </div>
                      </div>
                    </div>
                    <div className={cn('text-base font-black font-headline', net >= 0 ? 'text-primary' : 'text-error')}>
                      {net >= 0 ? '' : '−'}{sym}{Math.abs(Math.round(net)).toLocaleString('he-IL')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent transactions */}
        <div className={cn(
          'col-span-12 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5',
          userRows.length > 1 ? 'lg:col-span-7' : 'lg:col-span-8'
        )}>
          <div className="flex items-center justify-between mb-5">
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">תנועות אחרונות</div>
            <button
              onClick={() => setTab('personal')}
              className="text-primary text-xs font-bold hover:underline"
            >
              הכל →
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-8 text-on-surface-variant text-sm">
              <div className="mb-3 text-2xl opacity-30">◎</div>
              אין תנועות החודש
            </div>
          ) : (
            <div className="space-y-0">
              {recent.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-3.5 border-b border-outline-variant/6 last:border-0 group hover:bg-surface-container-high/30 rounded-lg px-2 -mx-2 transition-colors cursor-default">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-on-surface truncate">{tx.name}</div>
                    <div className="text-[11px] text-on-surface-variant">{tx.category}{tx.date ? ` · ${tx.date}` : ''}</div>
                  </div>
                  <div className="text-[14px] font-bold text-error flex-shrink-0 ms-3">
                    −{sym}{Math.round(Math.abs(tx.amount)).toLocaleString('he-IL')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Insight card */}
      {health < 70 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-7 rounded-[2rem] border border-primary/10 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <Lightbulb className="text-on-primary" size={24} fill="currentColor" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-black text-primary mb-1.5">{t(lang, 'advisor')}</h3>
            <p className="text-on-surface text-sm leading-relaxed">
              ציון הבריאות הפיננסית שלך הוא <strong>{health}/100</strong>. עבור ליועץ ה-AI לקבלת ניתוח מפורט והמלצות אישיות.
            </p>
          </div>
          <button
            onClick={() => setTab('advisor')}
            className="px-6 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold rounded-xl transition-colors border border-primary/20 text-sm flex-shrink-0"
          >
            פתח יועץ AI →
          </button>
        </motion.div>
      )}
    </div>
  );
};
