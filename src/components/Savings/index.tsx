import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import { getCurrencySymbol, calcSavingsCurrent, validateSavingsPlan, today, uid } from '../../lib/calculations';
import type { SavingsPlan, ScopeType } from '../../types';
import { cn } from '../../lib/utils';

const SavingsCard: React.FC<{
  plan: SavingsPlan; sym: string;
  onEdit: () => void; onDelete: () => void; onDeposit: () => void;
}> = ({ plan, sym, onEdit, onDelete, onDeposit }) => {
  const current  = calcSavingsCurrent(plan);
  const pct      = plan.target ? Math.min(100, Math.round(current / plan.target * 100)) : null;
  const warning  = validateSavingsPlan(plan);
  const barColor = pct === null ? 'bg-primary' : pct >= 100 ? 'bg-primary' : pct >= 60 ? 'bg-secondary' : 'bg-on-surface-variant';

  return (
    <div className="bg-surface-container-high rounded-2xl p-5 border border-outline-variant/8">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <div className="font-bold text-on-surface truncate">{plan.name}</div>
          <div className="text-[11px] text-on-surface-variant mt-0.5">
            {plan.monthly ? `${sym}${plan.monthly.toLocaleString('he-IL')}/חודש` : ''}
            {plan.endDate ? ` · עד ${new Date(plan.endDate).toLocaleDateString('he-IL')}` : ''}
          </div>
        </div>
        <div className="text-right flex-shrink-0 ms-3">
          <div className="text-xl font-black text-primary font-headline">
            {sym}{Math.round(current).toLocaleString('he-IL')}
          </div>
          {plan.target && (
            <div className="text-[10px] text-on-surface-variant">מתוך {sym}{plan.target.toLocaleString('he-IL')}</div>
          )}
        </div>
      </div>

      {pct !== null && (
        <div className="mb-3">
          <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden mb-1.5">
            <motion.div
              className={cn('h-full rounded-full', barColor)}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-on-surface-variant">
            <span>{pct}{t(lang,'percentDone')||'% הושלם'}</span>
            {plan.target && current < plan.target && (
              <span>נותר {sym}{Math.round(plan.target - current).toLocaleString('he-IL')}</span>
            )}
            {plan.target && current >= plan.target && <span className="text-primary">✓ יעד הושג!</span>}
          </div>
        </div>
      )}

      {warning && (
        <div className="mb-3 p-3 bg-tertiary/8 border border-tertiary/20 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertTriangle className="text-tertiary flex-shrink-0 mt-0.5" size={14} />
            <div>
              <div className="text-xs font-bold text-tertiary">{warning.msg}</div>
              <div className="text-[11px] text-on-surface-variant mt-0.5">{warning.tip}</div>
            </div>
          </div>
        </div>
      )}

      {(plan.deposits || []).length > 0 && (
        <div className="mb-3 space-y-1.5">
          {(plan.deposits || []).slice(-2).reverse().map(d => (
            <div key={d.id} className="flex justify-between text-[11px] text-on-surface-variant px-1">
              <span className="text-primary font-semibold">+{sym}{d.amount.toLocaleString('he-IL')}</span>
              <span>{d.note || ''}</span>
              <span>{d.date}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onDeposit} className="flex-1 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary/20 transition-colors">
          {t('he', 'deposit')}
        </button>
        <button onClick={onEdit}   className="p-2 rounded-xl hover:bg-surface-container-highest text-on-surface-variant hover:text-primary transition-colors"><Pencil size={14} /></button>
        <button onClick={onDelete} className="p-2 rounded-xl hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"><Trash2 size={14} /></button>
      </div>
    </div>
  );
};

interface PlanModalProps { stype: ScopeType; existing?: SavingsPlan; sym: string; onClose: () => void }

const PlanModal: React.FC<PlanModalProps> = ({ stype, existing, sym, onClose }) => {
  const { lang, updateDB } = useApp();
  const [name,    setName]    = useState(existing?.name    || '');
  const [monthly, setMonthly] = useState(String(existing?.monthly || ''));
  const [target,  setTarget]  = useState(String(existing?.target  || ''));
  const [extra,   setExtra]   = useState(String(existing?.extra   || ''));
  const [start,   setStart]   = useState(existing?.startDate || today());
  const [end,     setEnd]     = useState(existing?.endDate   || '');

  const handleSave = async () => {
    if (!name.trim()) return;
    const plan: SavingsPlan = {
      id: existing?.id || uid(), name: name.trim(), stype,
      monthly: parseFloat(monthly) || 0, target: parseFloat(target) || undefined,
      extra: parseFloat(extra) || 0, startDate: start, endDate: end || undefined,
      deposits: existing?.deposits || [],
    };
    await updateDB(d => ({
      ...d,
      savings: existing
        ? d.savings.map(s => s.id === plan.id ? plan : s)
        : [...(d.savings || []), plan],
    }));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-md bg-surface rounded-t-[1.5rem] md:rounded-[1.5rem] p-6 border border-outline-variant/10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">{existing ? 'עריכת' : 'תוכנית'} חיסכון</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30" placeholder="שם התוכנית" value={name} onChange={e => setName(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">הפקדה חודשית ({sym})</label>
              <input type="number" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={monthly} onChange={e => setMonthly(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">יעד ({sym})</label>
              <input type="number" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={target} onChange={e => setTarget(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-on-surface-variant font-medium block mb-1">סכום פתיחה ({sym})</label>
            <input type="number" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={extra} onChange={e => setExtra(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">תאריך התחלה</label>
              <input type="date" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" value={start} onChange={e => setStart(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">תאריך יעד</label>
              <input type="date" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" value={end} onChange={e => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high rounded-xl text-sm font-medium">{t(lang, 'cancel')}</button>
          <button onClick={handleSave} disabled={!name.trim()} className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">{t(lang, 'save')}</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

const DepositModal: React.FC<{ plan: SavingsPlan; sym: string; onClose: () => void }> = ({ plan, sym, onClose }) => {
  const { lang, updateDB } = useApp();
  const [amount, setAmount] = useState('');
  const [note,   setNote]   = useState('');

  const handleSave = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    await updateDB(d => ({
      ...d,
      savings: d.savings.map(s => s.id === plan.id
        ? { ...s, deposits: [...(s.deposits || []), { id: uid(), amount: amt, note, date: today() }] }
        : s
      ),
    }));
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-sm bg-surface rounded-t-[1.5rem] md:rounded-[1.5rem] p-6 border border-outline-variant/10 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold">הוספת הפקדה — {plan.name}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-on-surface-variant font-medium block mb-1">סכום ({sym})</label>
            <input type="number" inputMode="decimal" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant font-medium block mb-1">הערה (אופציונלי)</label>
            <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="לדוגמה: הפקדה חודשית" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high rounded-xl text-sm font-medium">{t(lang, 'cancel')}</button>
          <button onClick={handleSave} disabled={!amount || parseFloat(amount) <= 0} className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">{t(lang,'deposit')}</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const Savings: React.FC = () => {
  const { db, lang, updateDB } = useApp();
  const sym        = getCurrencySymbol(db);
  const p          = db.settings.profile;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const savings    = db.savings || [];

  const [planModal,    setPlanModal]    = useState<{ stype: ScopeType; plan?: SavingsPlan } | null>(null);
  const [depositModal, setDepositModal] = useState<SavingsPlan | null>(null);

  const deletePlan = (id: string) => {
    if (!confirm('למחוק תוכנית?')) return;
    updateDB(d => ({ ...d, savings: d.savings.filter(s => s.id !== id) }));
  };

  const sections: { stype: ScopeType; label: string }[] = [
    { stype: 'personal',  label: hasPartner ? p.name || 'אישי 1' : 'אישי' },
    ...(hasPartner ? [{ stype: 'personal2' as ScopeType, label: p.partnerName || 'אישי 2' }] : []),
    ...(isFamily   ? [{ stype: 'family'    as ScopeType, label: 'משפחה' }] : []),
  ];

  const totalSaved  = savings.reduce((s, p) => s + calcSavingsCurrent(p), 0);
  const totalTarget = savings.reduce((s, p) => s + (p.target || 0), 0);

  return (
    <div className="space-y-6">
      {savings.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {sections.map(sec => {
            const plans = savings.filter(s => s.stype === sec.stype);
            const total = plans.reduce((s, p) => s + calcSavingsCurrent(p), 0);
            return (
              <div key={sec.stype} className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/5">
                <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{sec.label}</div>
                <div className="text-2xl font-black text-primary font-headline">{sym}{Math.round(total).toLocaleString('he-IL')}</div>
                <div className="text-xs text-on-surface-variant mt-1">{plans.length} תוכניות</div>
              </div>
            );
          })}
        </div>
      )}

      {sections.map(sec => {
        const plans = savings.filter(s => s.stype === sec.stype);
        return (
          <div key={sec.stype} className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/8">
              <h2 className="font-bold text-base">{sec.label}</h2>
              <button
                onClick={() => setPlanModal({ stype: sec.stype })}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
              >
                <Plus size={15} /> תוכנית חדשה
              </button>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              {plans.length === 0 ? (
                <div className="col-span-2 text-center py-8 text-on-surface-variant text-sm">
                  אין תוכניות חיסכון — לחץ "תוכנית חדשה" כדי להתחיל
                </div>
              ) : plans.map(plan => (
                <SavingsCard
                  key={plan.id} plan={plan} sym={sym}
                  onEdit={() => setPlanModal({ stype: sec.stype, plan })}
                  onDelete={() => deletePlan(plan.id)}
                  onDeposit={() => setDepositModal(plan)}
                />
              ))}
            </div>
          </div>
        );
      })}

      <AnimatePresence>
        {planModal && (
          <PlanModal stype={planModal.stype} existing={planModal.plan} sym={sym} onClose={() => setPlanModal(null)} />
        )}
        {depositModal && (
          <DepositModal plan={depositModal} sym={sym} onClose={() => setDepositModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
