import React, { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import { fixedTotal, varTotal, varForMonth, getCurrencySymbol, today, uid } from '../../lib/calculations';
import type { ScopeType, FixedExpense, VariableExpense } from '../../types';
import { cn } from '../../lib/utils';

const ExpenseRow: React.FC<{
  name: string; category: string; amount: number; sym: string;
  sub?: string; payMethod?: string;
  onEdit?: () => void; onDelete?: () => void;
}> = ({ name, category, amount, sym, sub, payMethod, onEdit, onDelete }) => {
  const payLabel = payMethod === 'credit' ? 'אשראי' : payMethod === 'standing_order' ? 'הוראת קבע' : payMethod === 'cash' ? 'מזומן' : '';
  return (
    <div className="flex items-center justify-between py-3.5 border-b border-outline-variant/6 last:border-0 group hover:bg-surface-container-highest/30 rounded-lg px-2 -mx-2 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-on-surface truncate">{name}</div>
        <div className="text-[11px] text-on-surface-variant">
          {category}{sub ? ` · ${sub}` : ''}{payLabel ? ` · ${payLabel}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-2 ms-3 flex-shrink-0">
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          {onEdit   && <button onClick={onEdit}   className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-colors"><Pencil size={13} /></button>}
          {onDelete && <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors"><Trash2 size={13} /></button>}
        </div>
        <div className="text-[14px] font-bold text-error">
          −{sym}{Math.round(Math.abs(amount)).toLocaleString('he-IL')}
        </div>
      </div>
    </div>
  );
};

interface AddExpenseModalProps {
  type: ScopeType; isFixed: boolean;
  existing?: FixedExpense | VariableExpense; onClose: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ type, isFixed, existing, onClose }) => {
  const { db, month, year, lang, updateDB } = useApp();
  const sym  = getCurrencySymbol(db);
  const cats = db.settings.cats[type] || [];

  const [name,      setName]      = useState((existing as any)?.name     || '');
  const [amount,    setAmount]    = useState(String((existing as any)?.amount || ''));
  const [category,  setCategory]  = useState((existing as any)?.category || cats[0] || '');
  const [note,      setNote]      = useState((existing as any)?.note     || '');
  const [dateVal,   setDate]      = useState((existing as any)?.date     || today());
  const [payMethod, setPayMethod] = useState<'cash'|'credit'|'standing_order'>(
    (existing as any)?.paymentMethod || 'cash'
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    if (isFixed) {
      const entry: FixedExpense = {
        id: (existing as FixedExpense)?.id || uid(),
        name: name.trim(), amount: parseFloat(amount),
        currency: db.settings.currency, category, type, note,
        isStandingOrder: payMethod === 'standing_order',
      };
      await updateDB(d => ({
        ...d,
        fixed: {
          ...d.fixed,
          [type]: existing
            ? (d.fixed[type] || []).map(e => e.id === entry.id ? entry : e)
            : [...(d.fixed[type] || []), entry],
        },
      }));
    } else {
      const entry: VariableExpense = {
        id: (existing as VariableExpense)?.id || uid(),
        name: name.trim(), amount: parseFloat(amount),
        currency: db.settings.currency, category, type,
        month, year, date: dateVal, note,
        paymentMethod: payMethod,
      } as any;
      await updateDB(d => ({
        ...d,
        variable: existing
          ? d.variable.map(e => e.id === (entry as any).id ? entry : e)
          : [...(d.variable || []), entry],
      }));
    }
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
          <h2 className="text-lg font-bold">
            {existing ? t(lang,'edit') : ''} {isFixed ? t(lang,'fixedExpenses') : t(lang,'variableExpenses')}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">{t(lang,'name')}</label>
            <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30" placeholder="שם ההוצאה" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">{t(lang,'amount')} ({sym})</label>
              <input type="number" inputMode="decimal" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">{t(lang,'category')}</label>
              <select className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30" value={category} onChange={e => setCategory(e.target.value)}>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* שדה תשלום חדש */}
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">אמצעי תשלום</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'cash',           label: 'מזומן' },
                { val: 'credit',         label: 'אשראי' },
                { val: 'standing_order', label: 'הוראת קבע' },
              ] as const).map(opt => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => setPayMethod(opt.val)}
                  className={cn(
                    'py-2.5 rounded-xl text-xs font-medium border transition-all',
                    payMethod === opt.val
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {!isFixed && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">{t(lang,'date')}</label>
              <input type="date" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30" value={dateVal} onChange={e => setDate(e.target.value)} />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">{t(lang,'note')} (אופציונלי)</label>
            <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30" value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm">{t(lang,'cancel')}</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !amount} className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">
            {saving ? '...' : t(lang,'save')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const Expenses: React.FC<{ scope: ScopeType }> = ({ scope }) => {
  const { db, month, year, lang, updateDB } = useApp();
  const sym    = getCurrencySymbol(db);
  const fixed  = db.fixed[scope] || [];
  const vars   = varForMonth(db, scope, month, year);
  const totalF = fixedTotal(db, scope);
  const totalV = varTotal(db, scope, month, year);
  const p      = db.settings.profile;
  const label  = scope === 'personal'  ? (p.name || t(lang,'personal'))
               : scope === 'personal2' ? (p.partnerName || 'משתמש 2')
               : t(lang,'family');

  const [modal, setModal] = useState<{ isFixed: boolean; item?: any } | null>(null);

  const deleteFixed = (id: string) => {
    if (!confirm('למחוק?')) return;
    updateDB(d => ({ ...d, fixed: { ...d.fixed, [scope]: (d.fixed[scope] || []).filter(e => e.id !== id) } }));
  };
  const deleteVar = (id: string) => {
    if (!confirm('למחוק?')) return;
    updateDB(d => ({ ...d, variable: d.variable.filter(e => e.id !== id) }));
  };

  return (
    <div className="space-y-6">
      {/* Fixed */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/8">
          <div>
            <h2 className="text-base font-bold">{t(lang,'fixedExpenses')}</h2>
            <div className="text-xs text-on-surface-variant mt-0.5">{label} · חוזר חודשי</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-on-surface-variant text-sm font-medium">{sym}{Math.round(totalF).toLocaleString('he-IL')} {t(lang,'total')}</span>
            <button
              onClick={() => setModal({ isFixed: true })}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
            >
              הוצאה
            </button>
          </div>
        </div>
        <div className="p-6">
          {fixed.length === 0 ? (
            <div className="text-center py-6 text-on-surface-variant text-sm">אין הוצאות קבועות</div>
          ) : fixed.map(e => (
            <ExpenseRow key={e.id} name={e.name} category={e.category} amount={e.amount} sym={sym}
              payMethod={e.isStandingOrder ? 'standing_order' : undefined}
              onEdit={() => setModal({ isFixed: true, item: e })}
              onDelete={() => deleteFixed(e.id)} />
          ))}
        </div>
      </div>

      {/* Variable */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/8">
          <div>
            <h2 className="text-base font-bold">{t(lang,'variableExpenses')}</h2>
            <div className="text-xs text-on-surface-variant mt-0.5">{label} · החודש</div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-on-surface-variant text-sm font-medium">{sym}{Math.round(totalV).toLocaleString('he-IL')} {t(lang,'total')}</span>
            <button
              onClick={() => setModal({ isFixed: false })}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
            >
              הוצאה
            </button>
          </div>
        </div>
        <div className="p-6">
          {vars.length === 0 ? (
            <div className="text-center py-6 text-on-surface-variant text-sm">אין הוצאות לחודש זה</div>
          ) : vars.map(e => (
            <ExpenseRow key={e.id} name={e.name} category={e.category} amount={e.amount} sym={sym}
              sub={e.date} payMethod={(e as any).paymentMethod}
              onEdit={() => setModal({ isFixed: false, item: e })}
              onDelete={() => deleteVar(e.id)} />
          ))}
        </div>
      </div>

      <AnimatePresence>
        {modal && (
          <AddExpenseModal type={scope} isFixed={modal.isFixed} existing={modal.item} onClose={() => setModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
