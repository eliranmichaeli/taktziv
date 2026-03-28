import React, { useState } from 'react';
import { Save, PlusCircle, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { CURRENCIES, uid } from '../../lib/calculations';
import type { CreditCard as CreditCardType } from '../../types';
import { cn } from '../../lib/utils';
import { authSignOut } from '../../lib/firebase';

export const Settings: React.FC = () => {
  const { db, lang, updateDB, user } = useApp();
  const s = db.settings;
  const p = s.profile;
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const [saved, setSaved] = useState(false);

  const [currency, setCurrency] = useState(s.currency || 'ILS');
  const [startDay, setStartDay] = useState(s.budget.startDay || 1);
  const [budgetP,  setBudgetP]  = useState(s.budget.personal || 0);
  const [budgetF,  setBudgetF]  = useState(s.budget.family   || 0);

  // קרן חירום
  const ef = s.emergencyFunds || {};
  const [efPersonal,  setEfPersonal]  = useState(ef.personal  || 0);
  const [efPersonal2, setEfPersonal2] = useState(ef.personal2 || 0);
  const [efFamily,    setEfFamily]    = useState(ef.family    || 0);

  const handleSave = async () => {
    await updateDB(d => ({
      ...d,
      settings: {
        ...d.settings,
        currency,
        budget: { ...d.settings.budget, startDay, personal: budgetP, family: budgetF },
        emergencyFunds: {
          personal:  efPersonal,
          personal2: efPersonal2,
          family:    efFamily,
        },
      },
    }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCard = async () => {
    const name = prompt('שם הכרטיס:');
    if (!name) return;
    const day  = parseInt(prompt('יום חיוב (1-31):') || '10') || 10;
    const card: CreditCardType = { id: uid(), name, billingDay: day };
    await updateDB(d => ({ ...d, creditCards: [...(d.creditCards || []), card] }));
  };

  const deleteCard = async (id: string) => {
    if (!confirm('למחוק כרטיס?')) return;
    await updateDB(d => ({ ...d, creditCards: (d.creditCards || []).filter(c => c.id !== id) }));
  };

  const resetAccount = async () => {
    if (!confirm('⚠️ פעולה זו תמחק את כל הנתונים לצמיתות. האם אתה בטוח?')) return;
    if (!confirm('האם אתה בטוח לחלוטין? לא ניתן לבטל.')) return;
    await authSignOut();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-24">

      {/* Base settings */}
      <div className="bg-surface-container-low rounded-2xl p-7 shadow-sm border border-outline-variant/5">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="text-primary">◎</span> הגדרות בסיס
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-2">מטבע ראשי</label>
            <select className="w-full bg-surface-container-lowest border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/20" value={currency} onChange={e => setCurrency(e.target.value)}>
              {Object.entries(CURRENCIES).map(([k, v]) => (
                <option key={k} value={k}>{v.flag} {v.symbol} {v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-2">יום תחילת תקציב</label>
            <select className="w-full bg-surface-container-lowest border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/20" value={startDay} onChange={e => setStartDay(parseInt(e.target.value))}>
              {[1,5,10,15,20,25].map(d => <option key={d} value={d}>יום {d} לחודש</option>)}
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/8">
          <div>
            <p className="font-semibold text-sm">גלגול תקציב (Rollover)</p>
            <p className="text-xs text-on-surface-variant mt-0.5">העבר יתרה שלא נוצלה לחודש הבא אוטומטית</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" defaultChecked={s.budget.rollover !== false}
              onChange={e => updateDB(d => ({ ...d, settings: { ...d.settings, budget: { ...d.settings.budget, rollover: e.target.checked } } }))} />
            <div className="w-10 h-5 bg-surface-container-highest rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5 rtl:peer-checked:after:-translate-x-5" />
          </label>
        </div>
      </div>

      {/* Budget targets */}
      <div className="bg-surface-container-low rounded-2xl p-7 shadow-sm border border-outline-variant/5">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
          <span className="text-primary">▦</span> יעדי תקציב
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {[
            { label: 'תקציב חודשי אישי', value: budgetP, set: setBudgetP },
            { label: 'תקציב חודשי משפחתי', value: budgetF, set: setBudgetF },
          ].map((item, i) => (
            <div key={i} className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/8">
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">{item.label}</label>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">{CURRENCIES[currency]?.symbol || '₪'}</span>
                <input className="bg-transparent border-0 text-2xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                  value={item.value || ''} onChange={e => item.set(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* קרן חירום — חדש */}
      <div className="bg-surface-container-low rounded-2xl p-7 shadow-sm border border-outline-variant/5">
        <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
          <ShieldCheck className="text-primary" size={20} /> קרן חירום
        </h2>
        <p className="text-xs text-on-surface-variant mb-6">הגדר את סכום קרן החירום לכל חשבון. הסכום יוצג בדשבורד הראשי.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { label: p.name || 'אישי', value: efPersonal, set: setEfPersonal },
            ...(hasPartner ? [{ label: p.partnerName || 'משתמש 2', value: efPersonal2, set: setEfPersonal2 }] : []),
            { label: 'משפחה', value: efFamily, set: setEfFamily },
          ].map((item, i) => (
            <div key={i} className="bg-primary/4 border border-primary/15 p-5 rounded-xl">
              <label className="text-xs font-bold text-primary uppercase tracking-wider block mb-2">{item.label}</label>
              <div className="flex items-center gap-2">
                <span className="text-xl font-bold text-primary">{CURRENCIES[currency]?.symbol || '₪'}</span>
                <input className="bg-transparent border-0 text-2xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                  placeholder="0" value={item.value || ''} onChange={e => item.set(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Credit cards */}
      <div className="bg-surface-container-low rounded-2xl p-7 shadow-sm border border-outline-variant/5">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold flex items-center gap-2">כרטיסי אשראי</h2>
          <button onClick={addCard} className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-sm font-bold hover:bg-primary/20 transition-colors">
            <PlusCircle size={16} /> הוסף כרטיס
          </button>
        </div>
        <div className="space-y-3">
          {(db.creditCards || []).map(card => (
            <div key={card.id} className="flex items-center justify-between p-4 bg-surface-container-high rounded-xl border border-outline-variant/8">
              <div>
                <div className="font-semibold text-sm">{card.name}</div>
                <div className="text-xs text-on-surface-variant">יום חיוב {card.billingDay}</div>
              </div>
              <button onClick={() => deleteCard(card.id)} className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {(db.creditCards || []).length === 0 && (
            <button onClick={addCard} className="w-full py-4 border-2 border-dashed border-outline-variant/30 rounded-xl text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all text-sm font-medium flex items-center justify-center gap-2">
              <PlusCircle size={16} /> הוסף כרטיס אשראי ראשון
            </button>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-error/5 border border-error/15 rounded-2xl p-7 shadow-sm">
        <h2 className="text-lg font-bold mb-3 text-error flex items-center gap-2">
          <AlertTriangle size={20} /> אזור מסוכן
        </h2>
        <p className="text-sm text-on-surface-variant mb-5">מחיקת נתונים היא פעולה בלתי הפיכה.</p>
        <button onClick={resetAccount} className="px-6 py-3 bg-error text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity">
          אפס חשבון לצמיתות
        </button>
      </div>

      {/* Save button */}
      <motion.div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50" animate={{ scale: saved ? [1,1.05,1] : 1 }}>
        <button onClick={handleSave} className={cn(
          'bg-primary text-on-primary h-12 px-8 rounded-full shadow-[0_8px_32px_rgba(78,222,163,0.3)] flex items-center justify-center gap-3 font-bold hover:scale-105 active:scale-95 transition-all text-sm',
          saved && 'bg-on-surface text-surface'
        )}>
          <Save size={17} />
          {saved ? '✓ נשמר!' : 'שמור שינויים'}
        </button>
      </motion.div>
    </div>
  );
};
