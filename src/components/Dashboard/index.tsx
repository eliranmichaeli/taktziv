import React from 'react';
import { AlertTriangle, Lightbulb, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import {
  totalInc, totalExp, fixedTotal, varTotal,
  incTotal, getMonthBudget, getAlerts, getCurrencySymbol,
  calcHealthScore, MONTHS_HE,
} from '../../lib/calculations';
import type { ScopeType } from '../../types';
import { cn } from '../../lib/utils';

// ── Progress bar ──────────────────────────────────────
const ProgressBar: React.FC<{ pct: number; color?: string }> = ({ pct, color }) => {
  const c = pct >= 100 ? 'bg-error' : pct >= 80 ? 'bg-tertiary' : color || 'bg-primary';
  return (
    <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', c)}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, pct)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  );
};

// ── Person card ───────────────────────────────────────
const PersonCard: React.FC<{
  label: string;
  initial: string;
  color: 'blue' | 'amber' | 'muted';
  inc: number;
  exp: number;
  budget: number;
  emergency: number;
  sym: string;
  delay: number;
}> = ({ label, initial, color, inc, exp, budget, emergency, sym, delay }) => {
  const net  = inc - exp;
  const pct  = budget > 0 ? Math.round(exp / budget * 100) : 0;
  const colors = {
    blue:  { bg: 'bg-primary/10',    text: 'text-primary',    avatar: 'bg-primary/15 text-primary' },
    amber: { bg: 'bg-secondary/10',  text: 'text-secondary',  avatar: 'bg-secondary/15 text-secondary' },
    muted: { bg: 'bg-surface-container-high', text: 'text-on-surface-variant', avatar: 'bg-surface-container-highest text-on-surface-variant' },
  };
  const c = colors[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/5"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', c.avatar)}>
          {initial}
        </div>
        <span className="font-bold text-sm text-on-surface">{label}</span>
      </div>

      {/* Income / Expenses */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">הכנסות</span>
          <span className="text-sm font-bold text-primary">{sym}{Math.round(inc).toLocaleString('he-IL')}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">הוצאות</span>
          <span className="text-sm font-bold text-error">{sym}{Math.round(exp).toLocaleString('he-IL')}</span>
        </div>
      </div>

      {/* Budget progress */}
      {budget > 0 && (
        <div className="mb-3">
          <ProgressBar pct={pct} />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-on-surface-variant">{pct}% מהתקציב</span>
            <span className={cn('text-[10px] font-bold', net >= 0 ? 'text-primary' : 'text-error')}>
              {net >= 0 ? '+' : ''}{sym}{Math.round(net).toLocaleString('he-IL')}
            </span>
          </div>
        </div>
      )}

      {/* Net (if no budget) */}
      {budget <= 0 && (
        <div className="flex justify-between items-center mb-3 pt-2 border-t border-outline-variant/8">
          <span className="text-xs text-on-surface-variant">יתרה</span>
          <span className={cn('text-sm font-bold', net >= 0 ? 'text-primary' : 'text-error')}>
            {net >= 0 ? '+' : ''}{sym}{Math.round(net).toLocaleString('he-IL')}
          </span>
        </div>
      )}

      {/* Emergency fund */}
      {emergency > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/8">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-primary opacity-70" />
            <span className="text-[11px] text-on-surface-variant">קרן חירום</span>
          </div>
          <span className="text-[12px] font-bold text-primary">{sym}{Math.round(emergency).toLocaleString('he-IL')}</span>
        </div>
      )}
    </motion.div>
  );
};

// ── Dashboard ─────────────────────────────────────────
export const Dashboard: React.FC = () => {
  const { db, month, year, lang, setTab } = useApp();
  const sym        = getCurrencySymbol(db);
  const p          = db.settings.profile;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;

  const inc    = totalInc(db, month, year);
  const exp    = totalExp(db, month, year);
  const net    = inc - exp;
  const savePct = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
  const alerts  = getAlerts(db, month, year);
  const health  = calcHealthScore(db, month, year);
  const MONTHS  = MONTHS_HE;
  const monthLabel = `${MONTHS[month]} ${year}`;

  const ef = db.settings.emergencyFunds || {};

  // Per-user data
  type UserRow = {
    label: string; initial: string; stype: ScopeType;
    color: 'blue' | 'amber' | 'muted'; emergency: number;
  };
  const userRows: UserRow[] = [
    { label: hasPartner ? p.name || t(lang,'personal') : t(lang,'personal'), initial: (p.name || 'א').charAt(0), stype: 'personal',  color: 'blue',  emergency: ef.personal  || 0 },
    ...(hasPartner ? [{ label: p.partnerName || '', initial: (p.partnerName || 'מ').charAt(0), stype: 'personal2' as ScopeType, color: 'amber' as const, emergency: ef.personal2 || 0 }] : []),
    ...(isFamily   ? [{ label: t(lang,'family'), initial: 'מ', stype: 'family'    as ScopeType, color: 'muted'  as const, emergency: ef.family    || 0 }] : []),
  ];

  // Recent transactions
  const recent = [...(db.variable || [])]
    .filter(e => e.month === month && e.year === year)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const totalEmergency = (ef.personal || 0) + (ef.personal2 || 0) + (ef.family || 0);

  return (
    <div className="space-y-6">
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

      {/* Hero — יתרה כוללת */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5"
      >
        <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.14em] mb-1">
          {monthLabel} — סיכום חודשי
        </div>
        <div className={cn('text-5xl font-black tracking-[-2px] leading-none font-headline mb-3', net >= 0 ? 'text-on-surface' : 'text-error')}>
          {net < 0 ? '−' : ''}{sym}{Math.abs(Math.round(net)).toLocaleString('he-IL')}
        </div>
        <div className="flex items-center gap-4 text-sm text-on-surface-variant mb-4">
          <span>הכנסות <strong className="text-primary">{sym}{Math.round(inc).toLocaleString('he-IL')}</strong></span>
          <span className="text-outline-variant">·</span>
          <span>הוצאות <strong className="text-on-surface">{sym}{Math.round(exp).toLocaleString('he-IL')}</strong></span>
          {savePct > 0 && (
            <>
              <span className="text-outline-variant">·</span>
              <span>נחסך <strong className="text-primary">{savePct}%</strong></span>
            </>
          )}
        </div>

        {/* Health score */}
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">בריאות פיננסית</div>
          <div className="flex-1">
            <ProgressBar
              pct={health}
              color={health >= 70 ? 'bg-primary' : health >= 50 ? 'bg-secondary' : 'bg-tertiary'}
            />
          </div>
          <div className={cn('text-xs font-bold', health >= 70 ? 'text-primary' : health >= 50 ? 'text-secondary' : 'text-tertiary')}>
            {health}/100
          </div>
        </div>
      </motion.div>

      {/* Per-person cards */}
      <div>
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">לפי חשבון</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {userRows.map((u, i) => (
            <PersonCard
              key={u.stype}
              label={u.label}
              initial={u.initial}
              color={u.color}
              inc={incTotal(db, u.stype, month, year)}
              exp={fixedTotal(db, u.stype) + varTotal(db, u.stype, month, year)}
              budget={getMonthBudget(db, u.stype === 'family' ? 'family' : 'personal', month, year)}
              emergency={u.emergency}
              sym={sym}
              delay={i * 0.08}
            />
          ))}
        </div>
      </div>

      {/* קרן חירום כוללת */}
      {totalEmergency > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-primary" />
            <div>
              <div className="font-bold text-sm text-on-surface">קרן חירום כוללת</div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                {[
                  ef.personal  ? `${p.name || 'אישי'}: ${sym}${Math.round(ef.personal).toLocaleString('he-IL')}` : null,
                  ef.personal2 ? `${p.partnerName || 'משתמש 2'}: ${sym}${Math.round(ef.personal2).toLocaleString('he-IL')}` : null,
                  ef.family    ? `משפחה: ${sym}${Math.round(ef.family).toLocaleString('he-IL')}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div className="text-2xl font-black text-primary font-headline">
            {sym}{Math.round(totalEmergency).toLocaleString('he-IL')}
          </div>
        </motion.div>
      )}

      {/* תנועות אחרונות */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">תנועות אחרונות</div>
          <button onClick={() => setTab('personal')} className="text-primary text-xs font-bold hover:underline">
            כל התנועות →
          </button>
        </div>
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
          {recent.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">
              <div className="text-2xl mb-2 opacity-30">◎</div>
              אין תנועות החודש
            </div>
          ) : (
            recent.map((tx, i) => (
              <div key={tx.id} className={cn(
                'flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-high/40 transition-colors',
                i < recent.length - 1 && 'border-b border-outline-variant/6'
              )}>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-on-surface truncate">{tx.name}</div>
                  <div className="text-[11px] text-on-surface-variant">
                    {tx.category}
                    {tx.date ? ` · ${tx.date}` : ''}
                    {(tx as any).paymentMethod === 'credit' ? ' · אשראי' : (tx as any).paymentMethod === 'standing_order' ? ' · הוראת קבע' : ''}
                  </div>
                </div>
                <div className="text-[14px] font-bold text-error flex-shrink-0 ms-3">
                  −{sym}{Math.round(Math.abs(tx.amount)).toLocaleString('he-IL')}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI tip */}
      {health < 70 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl border border-primary/10 bg-primary/4 flex items-center gap-5"
        >
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="text-primary" size={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-primary mb-1">{t(lang,'advisor')}</h3>
            <p className="text-on-surface text-sm leading-relaxed">
              ציון הבריאות הפיננסית שלך הוא <strong>{health}/100</strong>. פתח את היועץ לקבל המלצות אישיות.
            </p>
          </div>
          <button
            onClick={() => setTab('advisor')}
            className="px-5 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold rounded-xl transition-colors border border-primary/20 text-sm flex-shrink-0"
          >
            פתח יועץ AI →
          </button>
        </motion.div>
      )}
    </div>
  );
};
