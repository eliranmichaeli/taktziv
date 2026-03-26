import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Plus, Pencil, Trash2, Search, X, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import { getCurrencySymbol, incTotal, totalInc, uid, today } from '../../lib/calculations';
import type { Income, ScopeType } from '../../types';
import { cn } from '../../lib/utils';

// ── Add Income Modal ──────────────────────────────────
const IncomeModal: React.FC<{
  existing?: Income;
  onClose: () => void;
}> = ({ existing, onClose }) => {
  const { db, month, year, lang, updateDB } = useApp();
  const sym   = getCurrencySymbol(db);
  const types = db.settings.incomeTypes || ['משכורת'];
  const p     = db.settings.profile;
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const isFamily   = p.accountType !== 'personal';

  const [name,       setName]       = useState(existing?.name       || '');
  const [amount,     setAmount]     = useState(String(existing?.amount || ''));
  const [scope,      setScope]      = useState<ScopeType>(existing?.type || 'personal');
  const [incomeType, setIncomeType] = useState(existing?.incomeType  || types[0]);
  const [note,       setNote]       = useState(existing?.note        || '');

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    const entry: Income = {
      id:         existing?.id || uid(),
      name:       name.trim(),
      amount:     parseFloat(amount),
      currency:   db.settings.currency,
      type:       scope,
      month,
      year,
      incomeType,
      note,
    };
    await updateDB(d => ({
      ...d,
      incomes: existing
        ? d.incomes.map(i => i.id === entry.id ? entry : i)
        : [...d.incomes, entry],
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
          <h2 className="text-lg font-bold">{existing ? 'עריכת' : '+'} הכנסה</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="שם מקור ההכנסה" value={name} onChange={e => setName(e.target.value)} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">סכום ({sym})</label>
              <input type="number" inputMode="decimal" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">סוג הכנסה</label>
              <select className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" value={incomeType} onChange={e => setIncomeType(e.target.value)}>
                {types.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {(hasPartner || isFamily) && (
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1.5">שיוך</label>
              <div className="flex gap-2">
                {[
                  { id: 'personal'  as ScopeType, label: p.name || 'אישי' },
                  ...(hasPartner ? [{ id: 'personal2' as ScopeType, label: p.partnerName || 'משתמש 2' }] : []),
                  ...(isFamily   ? [{ id: 'family'    as ScopeType, label: 'משפחה' }] : []),
                ].map(s => (
                  <button key={s.id} onClick={() => setScope(s.id)}
                    className={cn('flex-1 py-2 rounded-xl text-xs font-medium border transition-all', scope === s.id ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/15 text-on-surface-variant')}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] text-on-surface-variant font-medium block mb-1">הערה (אופציונלי)</label>
            <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high rounded-xl text-sm font-medium">{t(lang, 'cancel')}</button>
          <button onClick={handleSave} disabled={!name.trim() || !amount} className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">
            {t(lang, 'save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main Incomes ──────────────────────────────────────
export const Incomes: React.FC = () => {
  const { db, month, year, lang, updateDB } = useApp();
  const sym = getCurrencySymbol(db);
  const p   = db.settings.profile;
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const isFamily   = p.accountType !== 'personal';

  const [modal,  setModal]  = useState<{ income?: Income } | null>(null);
  const [search, setSearch] = useState('');

  const allIncomes = (db.incomes || []).filter(i => i.month === month && i.year === year);
  const filtered   = allIncomes.filter(i => !search || i.name.toLowerCase().includes(search.toLowerCase()));

  const totalAll = totalInc(db, month, year);
  const totalP   = incTotal(db, 'personal',  month, year);
  const totalP2  = incTotal(db, 'personal2', month, year);
  const totalF   = incTotal(db, 'family',    month, year);

  const deleteIncome = (id: string) => {
    if (!confirm('למחוק הכנסה?')) return;
    updateDB(d => ({ ...d, incomes: d.incomes.filter(i => i.id !== id) }));
  };

  // Pie data
  const pieData = [
    { name: p.name || 'אישי', value: totalP,  color: '#4edea3' },
    ...(hasPartner ? [{ name: p.partnerName || 'משתמש 2', value: totalP2, color: '#c0c1ff' }] : []),
    ...(isFamily   ? [{ name: 'משפחה', value: totalF, color: '#f6ad55' }] : []),
  ].filter(d => d.value > 0);

  const scopeLabel = (type: ScopeType): string => {
    if (type === 'personal')  return p.name || 'אישי';
    if (type === 'personal2') return p.partnerName || 'משתמש 2';
    return 'משפחה';
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold font-headline">{t(lang, 'income')}</h1>
          <p className="text-sm text-on-surface-variant mt-1">מעקב וניתוח זרימת כספים חודשית</p>
        </div>
        <button
          onClick={() => setModal({})}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
        >
          <Plus size={16} /> הכנסה חדשה
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'סה"כ הכנסות', val: totalAll, accent: true },
          { label: hasPartner ? p.name || 'אישי' : 'הכנסה אישית', val: totalP },
          ...(hasPartner ? [{ label: p.partnerName || 'משתמש 2', val: totalP2 }] : []),
          ...(isFamily   ? [{ label: 'הכנסה משפחתית', val: totalF }] : []),
        ].slice(0, 3).map((s, i) => (
          <div key={i} className={cn('rounded-2xl p-5 border border-outline-variant/5 relative overflow-hidden group', s.accent ? 'bg-primary/6' : 'bg-surface-container-low')}>
            <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{s.label}</div>
            <div className={cn('text-2xl font-black font-headline', s.accent ? 'text-primary' : 'text-on-surface')}>
              {sym}{Math.round(s.val).toLocaleString('he-IL')}
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
        <div className="px-6 py-4 border-b border-outline-variant/8 flex items-center justify-between gap-4 flex-wrap">
          <h3 className="font-bold text-base">רשימת הכנסות — חודש {month + 1}/{year}</h3>
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={15} />
            <input
              className="bg-surface-container-high border-0 rounded-xl ps-9 pe-4 py-2 text-sm focus:ring-1 focus:ring-primary w-52 text-on-surface"
              placeholder="חיפוש..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant text-sm">
            <div className="text-3xl mb-3 opacity-30">↑</div>
            {search ? 'לא נמצאו תוצאות' : 'אין הכנסות לחודש זה — הוסף הכנסה ראשונה'}
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/5">
            {filtered.map(income => (
              <div key={income.id} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-high/30 group transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-on-surface">{income.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className={cn(
                      'text-[10px] font-bold px-2 py-0.5 rounded-full',
                      income.type === 'personal'  ? 'bg-primary/10 text-primary' :
                      income.type === 'personal2' ? 'bg-secondary/10 text-secondary' :
                                                    'bg-tertiary/10 text-tertiary'
                    )}>
                      {scopeLabel(income.type)}
                    </span>
                    {income.incomeType && (
                      <span className="text-xs text-on-surface-variant">{income.incomeType}</span>
                    )}
                    {income.note && (
                      <span className="text-xs text-on-surface-variant italic">{income.note}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ms-4">
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                    <button onClick={() => setModal({ income })} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-colors">
                      <Pencil size={13} />
                    </button>
                    <button onClick={() => deleteIncome(income.id)} className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="text-base font-black text-primary font-headline">
                    +{sym}{Math.round(income.amount).toLocaleString('he-IL')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer totals */}
        <div className="px-6 py-4 bg-surface-container-high/20 border-t border-outline-variant/8 flex flex-wrap gap-6 justify-end">
          {[
            { label: 'אישי',    val: totalP,  show: true },
            { label: hasPartner ? p.partnerName || 'משתמש 2' : '', val: totalP2, show: hasPartner },
            { label: 'משפחה',  val: totalF,  show: isFamily },
            { label: 'סה"כ',   val: totalAll, show: true, bold: true },
          ].filter(r => r.show).map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-on-surface-variant text-sm">{r.label}:</span>
              <span className={cn('font-black font-headline', r.bold ? 'text-xl text-primary' : 'text-base text-on-surface')}>
                {sym}{Math.round(r.val).toLocaleString('he-IL')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: pie chart + AI insight */}
      {pieData.length > 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h4 className="font-bold text-sm mb-5">חלוקת הכנסות לפי חשבון</h4>
            <div className="flex items-center gap-4 h-40">
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={65} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2.5 flex-shrink-0">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-on-surface-variant">{d.name}</span>
                    <span className="font-bold ms-auto ps-2">{sym}{Math.round(d.value).toLocaleString('he-IL')}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5 flex items-center gap-5">
            <div className="flex-1">
              <h4 className="font-bold text-sm mb-2">תובנת AI</h4>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                סיכום ההכנסות לחודש זה: <strong className="text-primary">{sym}{Math.round(totalAll).toLocaleString('he-IL')}</strong>.
                {totalP > 0 && totalF > 0 && ` יחס אישי/משפחה: ${Math.round(totalP/totalAll*100)}% / ${Math.round(totalF/totalAll*100)}%.`}
                {' '}לניתוח מעמיק עבור ליועץ ה-AI.
              </p>
            </div>
            <div className="w-14 h-14 bg-surface-container-high rounded-xl flex items-center justify-center border border-primary/15 flex-shrink-0">
              <BrainCircuit size={28} className="text-primary" />
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modal !== null && (
          <IncomeModal
            existing={modal.income}
            onClose={() => setModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
