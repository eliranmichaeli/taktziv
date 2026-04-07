import React, { useState, useCallback } from 'react';
import { RefreshCw, Sparkles, Calculator } from 'lucide-react';
import { t } from '../../lib/i18n';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { getCurrencySymbol, calcCompound, CURRENCIES } from '../../lib/calculations';
import { cn } from '../../lib/utils';

export const Freedom: React.FC = () => {
  const { db } = useApp();
  const sym = getCurrencySymbol(db);
  const cur = db.settings.currency || 'ILS';

  // Rule 300 state
  const [monthlyExpense, setMonthlyExpense] = useState('');
  const rule300Result = monthlyExpense ? parseFloat(monthlyExpense) * 300 : null;

  // Compound calc state
  const [initial,    setInitial]    = useState('100000');
  const [monthly,    setMonthly]    = useState('2500');
  const [rate,       setRate]       = useState('7');
  const [years,      setYears]      = useState('20');
  const [feeDeposit, setFeeDeposit] = useState('0');
  const [feeAccum,   setFeeAccum]   = useState('0.5');
  const [result,     setResult]     = useState<ReturnType<typeof calcCompound> | null>(null);
  const [showIntro,  setShowIntro]  = useState(true);

  const calc = useCallback(() => {
    const r = calcCompound(
      parseFloat(initial) || 0,
      parseFloat(monthly) || 0,
      parseFloat(rate)    || 7,
      parseFloat(years)   || 20,
      parseFloat(feeDeposit) || 0,
      parseFloat(feeAccum)   || 0,
    );
    setResult(r);
  }, [initial, monthly, rate, years, feeDeposit, feeAccum]);

  const fmt = (n: number) => `${sym}${Math.round(Math.max(0, n)).toLocaleString('he-IL')}`;

  if (showIntro) {
    return (
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/5 shadow-sm"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary/10 text-primary rounded-xl"><Sparkles size={22} /></div>
            <div>
              <h1 className="text-2xl font-black font-headline">{t(lang,'freedom')}</h1>
              <div className="text-xs text-primary font-bold tracking-wider mt-0.5">FINANCIAL INDEPENDENCE</div>
            </div>
          </div>

          <p className="text-on-surface-variant leading-relaxed mb-6">
            חוק ה-300 הוא גרסה פשוטה ופרקטית של <strong className="text-on-surface">מחקר טריניטי</strong> המפורסם. הוא עוזר לך להבין בדיוק מהו סכום ההון הנדרש כדי שתוכל לחיות מהתשואה של כספך בלבד — מבלי לעבוד ומבלי שהקרן תישחק.
          </p>

          <div className="bg-primary/6 border border-primary/15 rounded-2xl p-6 mb-6 text-center">
            <div className="text-xs text-primary font-bold tracking-wider mb-2">הנוסחה</div>
            <div className="text-2xl font-black text-primary">סכום הפרישה = הוצאה חודשית × 300</div>
          </div>

          <div className="space-y-4 text-sm text-on-surface leading-relaxed mb-8">
            <p><strong>דוגמה:</strong> אם אתה זקוק ל-₪10,000 בחודש — <span className="text-primary font-bold">₪10,000 × 300 = ₪3,000,000</span> זהו "סכום החופש" שלך.</p>
            <p>משיכה שנתית של <strong>4% מההון</strong> צפויה להספיק לעשרות שנים, תוך התחשבות באינפלציה ובתנודות השוק.</p>
            <p><strong>חשוב:</strong> המשיכה היא הצמדה לסכום ראשוני — לא 4% מחדש כל שנה. אם משכת ₪100,000 בשנה 1 ואינפלציה 3%, תמשוך ₪103,000 בשנה 2 — ללא קשר למצב השוק.</p>
          </div>

          <button
            onClick={() => setShowIntro(false)}
            className="w-full py-4 bg-primary text-on-primary rounded-xl font-bold text-base hover:shadow-xl hover:shadow-primary/20 transition-all"
          >
            הבנתי — עבור למחשבון
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back */}
      <button onClick={() => setShowIntro(true)} className="text-sm text-on-surface-variant hover:text-on-surface transition-colors">
        ← חזרה להסבר
      </button>

      {/* Rule-300 quick */}
      <div className="bg-surface-container-low rounded-2xl p-6 border-2 border-primary/20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl text-primary"><Sparkles size={18} /></div>
          <h2 className="font-bold">מחשבון חוק ה-300</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <label className="text-xs text-on-surface-variant mb-1 block">הוצאה חודשית רצויה בפרישה ({sym})</label>
            <input
              type="number"
              className="w-full bg-surface-container-high border-0 rounded-xl px-4 py-3 text-on-surface focus:ring-2 focus:ring-primary/30 transition-all"
              placeholder="10,000"
              value={monthlyExpense}
              onChange={e => setMonthlyExpense(e.target.value)}
            />
          </div>
          <div className="text-on-surface-variant font-bold text-lg">× 300 =</div>
          <div className="flex-1 bg-primary/8 border border-primary/20 rounded-xl p-4">
            <div className="text-xs text-primary font-bold mb-1">יעד הון עצמי</div>
            <div className="text-2xl font-black text-primary font-headline">
              {rule300Result ? sym + rule300Result.toLocaleString('he-IL') : '—'}
            </div>
          </div>
        </div>
        {rule300Result && (
          <div className="mt-3 p-2.5 bg-primary/6 rounded-lg text-xs font-bold text-primary text-center">
            זהו יעד ההון הנדרש לעצמאות כלכלית לפי כלל ה-4%
          </div>
        )}
      </div>

      {/* Compound calculator */}
      <div className="bg-surface rounded-2xl p-8 border border-outline-variant/8 shadow-xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-primary/10 text-primary rounded-xl"><Calculator size={24} /></div>
          <h2 className="text-2xl font-black font-headline">מחשבון ריבית דריבית</h2>
        </div>

        {/* Currency selector */}
        <div className="mb-6">
          <label className="text-xs text-on-surface-variant font-medium block mb-1.5">מטבע</label>
          <select className="bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30 w-full sm:w-auto">
            {Object.entries(CURRENCIES).map(([k, v]) => (
              <option key={k} value={k}>{v.flag} {v.symbol} {v.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-5 mb-8">
          {[
            { label: 'הון התחלתי', value: initial,    set: setInitial,    unit: sym },
            { label: 'הפקדה חודשית', value: monthly,  set: setMonthly,    unit: sym },
            { label: 'ריבית שנתית', value: rate,      set: setRate,       unit: '%' },
            { label: 'שנות הפקדה',  value: years,     set: setYears,      unit: 'שנה' },
            { label: 'דמי ניהול מהפקדה', value: feeDeposit, set: setFeeDeposit, unit: '%' },
            { label: 'דמי ניהול מצבירה', value: feeAccum,   set: setFeeAccum,   unit: '%' },
          ].map((f, i) => (
            <div key={i} className="space-y-2">
              <label className="text-xs text-on-surface-variant font-medium block leading-tight">{f.label}</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full bg-surface-container-low border-0 rounded-xl px-3 py-3 pe-8 text-sm text-on-surface focus:ring-2 focus:ring-primary/30 transition-all"
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                />
                <span className="absolute end-3 top-1/2 -translate-y-1/2 text-xs text-on-surface-variant">{f.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={calc}
          className="bg-primary text-on-primary font-bold px-8 py-4 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-primary/20 flex items-center gap-3 mx-auto"
        >
          <RefreshCw size={18} />
          חשב תחזית
        </button>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 pt-8 border-t border-outline-variant/10"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5 mb-6">
              {[
                { label: 'סכום הפקדות כולל',     val: fmt(result.totalDeposits),    color: 'text-on-surface' },
                { label: 'רווח (ריבית דריבית)',   val: fmt(result.grossProfit),      color: 'text-primary' },
                { label: 'דמי ניהול מהפקדה',      val: fmt(result.totalDepositFees), color: 'text-error' },
                { label: 'דמי ניהול מצבירה',      val: fmt(result.totalAccumFees),   color: 'text-error' },
              ].map((item, i) => (
                <div key={i} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/5">
                  <div className="text-xs text-on-surface-variant mb-2">{item.label}</div>
                  <div className={cn('text-xl font-black font-headline', item.color)}>{item.val}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-primary/6 border border-primary/20 rounded-2xl p-6">
                <div className="text-sm text-on-surface-variant mb-2">ערך עתידי ללא דמי ניהול</div>
                <div className="text-4xl font-black text-primary font-headline">{fmt(result.grossFuture)}</div>
                <div className="text-xs text-primary mt-2">קצבה חודשית: {fmt(result.rule300gross)}/חודש</div>
              </div>
              <div className="bg-secondary/6 border border-secondary/20 rounded-2xl p-6">
                <div className="text-sm text-on-surface-variant mb-2">ערך עתידי בניכוי דמי ניהול</div>
                <div className="text-4xl font-black text-secondary font-headline">{fmt(result.netFuture)}</div>
                <div className="text-xs text-secondary mt-2">קצבה חודשית: {fmt(result.rule300net)}/חודש</div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
