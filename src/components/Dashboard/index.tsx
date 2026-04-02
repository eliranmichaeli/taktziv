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

const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MONTHS_DE = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const getMonthNames = (lang: string) => {
  switch(lang) {
    case 'en': return MONTHS_EN;
    case 'ru': return MONTHS_RU;
    case 'ar': return MONTHS_AR;
    case 'de': return MONTHS_DE;
    case 'fr': return MONTHS_FR;
    default:   return MONTHS_HE;
  }
};

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
  label: string; initial: string; color: 'blue' | 'amber' | 'muted';
  inc: number; exp: number; budget: number; emergency: number;
  sym: string; delay: number; lang: string;
}> = ({ label, initial, color, inc, exp, budget, emergency, sym, delay, lang }) => {
  const net = inc - exp;
  const pct = budget > 0 ? Math.round(exp / budget * 100) : 0;
  const colors = {
    blue:  { avatar: 'bg-primary/15 text-primary' },
    amber: { avatar: 'bg-secondary/15 text-secondary' },
    muted: { avatar: 'bg-surface-container-highest text-on-surface-variant' },
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/5"
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0', colors[color].avatar)}>
          {initial}
        </div>
        <span className="font-bold text-sm text-on-surface">{label}</span>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">{t(lang,'income')}</span>
          <span className="text-sm font-bold text-primary">{sym}{Math.round(inc).toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-on-surface-variant">{t(lang,'expenses')}</span>
          <span className="text-sm font-bold text-error">{sym}{Math.round(exp).toLocaleString()}</span>
        </div>
      </div>

      {budget > 0 && (
        <div className="mb-3">
          <ProgressBar pct={pct} />
          <div className="flex justify-between mt-1.5">
            <span className="text-[10px] text-on-surface-variant">{pct}%</span>
            <span className={cn('text-[10px] font-bold', net >= 0 ? 'text-primary' : 'text-error')}>
              {net >= 0 ? '+' : ''}{sym}{Math.round(net).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {budget <= 0 && (
        <div className="flex justify-between items-center mb-3 pt-2 border-t border-outline-variant/8">
          <span className="text-xs text-on-surface-variant">{t(lang,'balance')}</span>
          <span className={cn('text-sm font-bold', net >= 0 ? 'text-primary' : 'text-error')}>
            {net >= 0 ? '+' : ''}{sym}{Math.round(net).toLocaleString()}
          </span>
        </div>
      )}

      {emergency > 0 && (
        <div className="flex items-center justify-between pt-2 border-t border-outline-variant/8">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={13} className="text-primary opacity-70" />
            <span className="text-[11px] text-on-surface-variant">{t(lang,'emergencyFund')}</span>
          </div>
          <span className="text-[12px] font-bold text-primary">{sym}{Math.round(emergency).toLocaleString()}</span>
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

  const inc      = totalInc(db, month, year);
  const exp      = totalExp(db, month, year);
  const net      = inc - exp;
  const savePct  = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : 0;
  const alerts   = getAlerts(db, month, year);
  const health   = calcHealthScore(db, month, year);
  const MONTHS   = getMonthNames(lang);
  const monthLabel = `${MONTHS[month]} ${year}`;
  const ef       = db.settings.emergencyFunds || {};
  const totalEmergency = (ef.personal || 0) + (ef.personal2 || 0) + (ef.family || 0);

  type UserRow = { label: string; initial: string; stype: ScopeType; color: 'blue'|'amber'|'muted'; emergency: number };
  const userRows: UserRow[] = [
    { label: hasPartner ? p.name || t(lang,'personal') : t(lang,'personal'), initial: (p.name || 'א').charAt(0), stype: 'personal',  color: 'blue',  emergency: ef.personal  || 0 },
    ...(hasPartner ? [{ label: p.partnerName || '', initial: (p.partnerName || 'P').charAt(0), stype: 'personal2' as ScopeType, color: 'amber' as const, emergency: ef.personal2 || 0 }] : []),
    ...(isFamily   ? [{ label: t(lang,'family'), initial: 'F', stype: 'family' as ScopeType, color: 'muted' as const, emergency: ef.family || 0 }] : []),
  ];

  const recent = [...(db.variable || [])]
    .filter(e => e.month === month && e.year === year)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {alerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 bg-tertiary/8 border border-tertiary/20 rounded-xl text-sm text-on-surface">
          <AlertTriangle className="text-tertiary flex-shrink-0" size={18} />
          <span>{alerts.map(a => `${a.cat} (${sym}${Math.round(a.spent).toLocaleString()}/${sym}${Math.round(a.goal).toLocaleString()})`).join(' · ')}</span>
        </motion.div>
      )}

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
        className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
        <div className="text-[11px] font-bold text-on-surface-variant uppercase tracking-[0.14em] mb-1">
          {monthLabel} — {t(lang,'monthSummary') || 'סיכום חודשי'}
        </div>
        <div className={cn('text-5xl font-black tracking-[-2px] leading-none font-headline mb-3', net >= 0 ? 'text-on-surface' : 'text-error')}>
          {net < 0 ? '−' : ''}{sym}{Math.abs(Math.round(net)).toLocaleString()}
        </div>
        <div className="flex items-center gap-4 text-sm text-on-surface-variant mb-4 flex-wrap">
          <span>{t(lang,'income')} <strong className="text-primary">{sym}{Math.round(inc).toLocaleString()}</strong></span>
          <span className="text-outline-variant">·</span>
          <span>{t(lang,'expenses')} <strong className="text-on-surface">{sym}{Math.round(exp).toLocaleString()}</strong></span>
          {savePct > 0 && <>
            <span className="text-outline-variant">·</span>
            <span>{t(lang,'saved') || 'נחסך'} <strong className="text-primary">{savePct}%</strong></span>
          </>}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{t(lang,'healthScore')}</div>
          <div className="flex-1">
            <ProgressBar pct={health} color={health >= 70 ? 'bg-primary' : health >= 50 ? 'bg-secondary' : 'bg-tertiary'} />
          </div>
          <div className={cn('text-xs font-bold', health >= 70 ? 'text-primary' : health >= 50 ? 'text-secondary' : 'text-tertiary')}>
            {health}/100
          </div>
        </div>
      </motion.div>

      {/* Per-person cards */}
      <div>
        <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">
          {t(lang,'byAccount') || 'לפי חשבון'}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {userRows.map((u, i) => (
            <PersonCard key={u.stype} label={u.label} initial={u.initial} color={u.color}
              inc={incTotal(db, u.stype, month, year)}
              exp={fixedTotal(db, u.stype) + varTotal(db, u.stype, month, year)}
              budget={getMonthBudget(db, u.stype === 'family' ? 'family' : 'personal', month, year)}
              emergency={u.emergency} sym={sym} delay={i * 0.08} lang={lang} />
          ))}
        </div>
      </div>

      {/* Emergency fund total */}
      {totalEmergency > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-primary/5 border border-primary/15 rounded-2xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck size={22} className="text-primary" />
            <div>
              <div className="font-bold text-sm text-on-surface">
                {t(lang,'totalEmergencyFund') || 'קרן חירום כוללת'}
              </div>
              <div className="text-xs text-on-surface-variant mt-0.5">
                {[
                  ef.personal  ? `${p.name || t(lang,'personal')}: ${sym}${Math.round(ef.personal).toLocaleString()}` : null,
                  ef.personal2 ? `${p.partnerName || ''}: ${sym}${Math.round(ef.personal2).toLocaleString()}` : null,
                  ef.family    ? `${t(lang,'family')}: ${sym}${Math.round(ef.family).toLocaleString()}` : null,
                ].filter(Boolean).join(' · ')}
              </div>
            </div>
          </div>
          <div className="text-2xl font-black text-primary font-headline">
            {sym}{Math.round(totalEmergency).toLocaleString()}
          </div>
        </motion.div>
      )}

      {/* Recent transactions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
            {t(lang,'recentTransactions') || 'תנועות אחרונות'}
          </div>
          <button onClick={() => setTab('personal')} className="text-primary text-xs font-bold hover:underline">
            {t(lang,'allTransactions') || 'כל התנועות'} →
          </button>
        </div>
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
          {recent.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">
              <div className="text-2xl mb-2 opacity-30">◎</div>
              {t(lang,'noTransactions') || 'אין תנועות החודש'}
            </div>
          ) : recent.map((tx, i) => (
            <div key={tx.id} className={cn(
              'flex items-center justify-between px-5 py-3.5 hover:bg-surface-container-high/40 transition-colors',
              i < recent.length - 1 && 'border-b border-outline-variant/6'
            )}>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-on-surface truncate">{tx.name}</div>
                <div className="text-[11px] text-on-surface-variant">
                  {tx.category}
                  {tx.date ? ` · ${tx.date}` : ''}
                  {(tx as any).paymentMethod === 'credit' ? ` · ${t(lang,'credit')}` : ''}
                  {(tx as any).paymentMethod === 'standing_order' ? ` · ${t(lang,'standingOrder')}` : ''}
                </div>
              </div>
              <div className="text-[14px] font-bold text-error flex-shrink-0 ms-3">
                −{sym}{Math.round(Math.abs(tx.amount)).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI tip */}
      {health < 70 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
          className="p-6 rounded-2xl border border-primary/10 bg-primary/4 flex items-center gap-5">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Lightbulb className="text-primary" size={22} />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-black text-primary mb-1">{t(lang,'advisor')}</h3>
            <p className="text-on-surface text-sm leading-relaxed">
              {t(lang,'healthScoreMsg') || `ציון הבריאות הפיננסית שלך הוא ${health}/100. פתח את היועץ לקבל המלצות.`}
            </p>
          </div>
          <button onClick={() => setTab('advisor')}
            className="px-5 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-primary font-bold rounded-xl transition-colors border border-primary/20 text-sm flex-shrink-0">
            {t(lang,'openAdvisor') || 'פתח יועץ AI'} →
          </button>
        </motion.div>
      )}
    </div>
  );
};
