import React, { useState, useRef } from 'react';
import { Plus, Pencil, Trash2, X, Upload, FileSpreadsheet, AlertCircle, Camera, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import { fixedTotal, varTotal, varForMonth, getCurrencySymbol, today, uid } from '../../lib/calculations';
import type { ScopeType, FixedExpense, VariableExpense, PaymentMethod, CreditCard } from '../../types';
import { cn } from '../../lib/utils';
import { auth } from '../../lib/firebase';

// זיהוי מטבע מטקסט
const detectCurrency = (text: string): string => {
  if (text.includes('$') || text.toLowerCase().includes('usd')) return 'USD';
  if (text.includes('€') || text.toLowerCase().includes('eur')) return 'EUR';
  if (text.includes('£') || text.toLowerCase().includes('gbp')) return 'GBP';
  return 'ILS';
};

const currencySymbol = (c: string) =>
  c === 'USD' ? '$' : c === 'EUR' ? '€' : c === 'GBP' ? '£' : '₪';

// ── Expense Row ───────────────────────────────────────
const ExpenseRow: React.FC<{
  name: string; category: string; amount: number; sym: string;
  sub?: string; note?: string;
  paymentMethod?: PaymentMethod; cardName?: string; billingDay?: number;
  isStandingOrder?: boolean; standingOrderExpiry?: string;
  onEdit?: () => void; onDelete?: () => void;
}> = ({ name, category, amount, sym, sub, note, paymentMethod, cardName, billingDay, isStandingOrder, standingOrderExpiry, onEdit, onDelete }) => {
  const payInfo = isStandingOrder
    ? `הוראת קבע${billingDay ? ` · יום ${billingDay}` : ''}${standingOrderExpiry ? ` · עד ${standingOrderExpiry}` : ''}`
    : paymentMethod === 'credit' && cardName
    ? `${cardName}${billingDay ? ` · יום חיוב ${billingDay}` : ''}`
    : paymentMethod === 'cash' ? 'מזומן' : '';

  return (
    <div className="flex items-center justify-between py-3.5 border-b border-outline-variant/6 last:border-0 group hover:bg-surface-container-highest/30 rounded-lg px-2 -mx-2 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-on-surface truncate">{name}</div>
        <div className="text-[11px] text-on-surface-variant space-x-1 rtl:space-x-reverse">
          <span>{category}</span>
          {sub    && <span>· {sub}</span>}
          {payInfo && <span className="text-primary/70">· {payInfo}</span>}
          {note   && <span className="italic">· {note}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 ms-3 flex-shrink-0">
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          {onEdit   && <button onClick={onEdit}   className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant"><Pencil size={13} /></button>}
          {onDelete && <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant"><Trash2 size={13} /></button>}
        </div>
        <div className="text-[14px] font-bold text-error">
          −{sym}{Math.round(Math.abs(amount)).toLocaleString('he-IL')}
        </div>
      </div>
    </div>
  );
};

// ── Add Expense Modal ─────────────────────────────────
interface AddExpenseModalProps {
  type: ScopeType; isFixed: boolean;
  existing?: FixedExpense | VariableExpense; onClose: () => void;
}

const AddExpenseModal: React.FC<AddExpenseModalProps> = ({ type, isFixed, existing, onClose }) => {
  const { db, month, year, lang, updateDB } = useApp();
  const sym  = getCurrencySymbol(db);
  const cats = db.settings.cats[type] || [];
  const cards: CreditCard[] = db.creditCards || [];

  const [name,       setName]       = useState((existing as any)?.name     || '');
  const [amount,     setAmount]     = useState(String((existing as any)?.amount || ''));
  const [category,   setCategory]   = useState((existing as any)?.category || cats[0] || '');
  const [note,       setNote]       = useState((existing as any)?.note     || '');
  const [dateVal,    setDate]       = useState((existing as any)?.date     || today());
  const [payMethod,  setPayMethod]  = useState<PaymentMethod>((existing as any)?.paymentMethod || 'cash');
  const [cardId,     setCardId]     = useState((existing as any)?.cardId   || '');
  const [billingDay, setBillingDay] = useState((existing as any)?.billingDay || 10);
  const [soExpiry,   setSoExpiry]   = useState((existing as any)?.standingOrderExpiry || '');
  const [saving,     setSaving]     = useState(false);

  const selectedCard = cards.find(c => c.id === cardId);

  const handleSave = async () => {
    if (!name.trim() || !amount) return;
    setSaving(true);
    const cardName = selectedCard?.name || '';
    const isStandingOrder = payMethod === 'standing_order';

    if (isFixed) {
      const entry: FixedExpense = {
        id: (existing as FixedExpense)?.id || uid(),
        name: name.trim(), amount: parseFloat(amount),
        currency: db.settings.currency, category, type, note,
        paymentMethod: payMethod, cardId, cardName,
        billingDay: payMethod !== 'cash' ? billingDay : undefined,
        isStandingOrder,
        standingOrderExpiry: isStandingOrder ? soExpiry : undefined,
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
        paymentMethod: payMethod, cardId, cardName,
        billingDay: payMethod !== 'cash' ? billingDay : undefined,
        isStandingOrder,
        standingOrderExpiry: isStandingOrder ? soExpiry : undefined,
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
            {existing ? 'עריכת' : ''} {isFixed ? 'הוצאה קבועה' : 'הוצאה משתנה'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">שם ההוצאה</label>
            <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
              placeholder="לדוגמה: חשמל, קניות סופר..." value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">סכום ({sym})</label>
              <input type="number" inputMode="decimal"
                className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">קטגוריה</label>
              <select className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                value={category} onChange={e => setCategory(e.target.value)}>
                {cats.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">אמצעי תשלום</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { val: 'cash'           as PaymentMethod, label: 'מזומן' },
                { val: 'credit'         as PaymentMethod, label: 'אשראי' },
                { val: 'standing_order' as PaymentMethod, label: 'הוראת קבע' },
              ]).map(opt => (
                <button key={opt.val} type="button" onClick={() => setPayMethod(opt.val)}
                  className={cn('py-2.5 rounded-xl text-xs font-medium border transition-all',
                    payMethod === opt.val ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
                  )}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {payMethod === 'credit' && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">כרטיס אשראי</label>
              {cards.length > 0 ? (
                <select className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                  value={cardId} onChange={e => {
                    setCardId(e.target.value);
                    const c = cards.find(c => c.id === e.target.value);
                    if (c) setBillingDay(c.billingDay);
                  }}>
                  <option value="">בחר כרטיס...</option>
                  {cards.map(c => <option key={c.id} value={c.id}>{c.name} · יום {c.billingDay}</option>)}
                </select>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-tertiary/8 border border-tertiary/20 rounded-xl">
                  <AlertCircle size={14} className="text-tertiary flex-shrink-0" />
                  <span className="text-xs text-on-surface-variant">לא הוגדרו כרטיסי אשראי — הוסף בהגדרות</span>
                </div>
              )}
              <div className="mt-3">
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">יום חיוב</label>
                <select className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                  value={billingDay} onChange={e => setBillingDay(parseInt(e.target.value))}>
                  {Array.from({length: 28}, (_, i) => i+1).map(d => <option key={d} value={d}>יום {d}</option>)}
                </select>
              </div>
            </div>
          )}

          {payMethod === 'standing_order' && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">יום החיוב החודשי</label>
                <select className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                  value={billingDay} onChange={e => setBillingDay(parseInt(e.target.value))}>
                  {Array.from({length: 28}, (_, i) => i+1).map(d => <option key={d} value={d}>יום {d} לחודש</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-on-surface-variant block mb-1.5">תוקף הוראת הקבע (אופציונלי)</label>
                <input type="date"
                  className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                  value={soExpiry} onChange={e => setSoExpiry(e.target.value)} />
                <p className="text-[10px] text-on-surface-variant mt-1">השאר ריק אם אין תאריך פקיעה ידוע</p>
              </div>
            </div>
          )}

          {!isFixed && (
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">תאריך</label>
              <input type="date" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                value={dateVal} onChange={e => setDate(e.target.value)} />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-on-surface-variant block mb-1.5">הערה (אופציונלי)</label>
            <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
              placeholder="הערה חופשית..." value={note} onChange={e => setNote(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm">ביטול</button>
          <button onClick={handleSave} disabled={saving || !name.trim() || !amount}
            className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">
            {saving ? '...' : 'שמור'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Image AI Recognition Modal ────────────────────────
const ImageImportModal: React.FC<{
  scope: ScopeType; isFixed: boolean; onClose: () => void;
}> = ({ scope, isFixed, onClose }) => {
  const { db, month, year, updateDB } = useApp();
  const cats    = db.settings.cats[scope] || ['אחר'];
  const fileRef = useRef<HTMLInputElement>(null);

  type ParsedRow = { name: string; amount: number; currency: string; selected: boolean };

  const [preview,   setPreview]   = useState<ParsedRow[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error,     setError]     = useState('');
  const [imageUrl,  setImageUrl]  = useState('');

  const analyzeImage = async (file: File) => {
    setError('');
    setPreview([]);

    // הצג תצוגה מקדימה
    const reader = new FileReader();
    reader.onload = e => setImageUrl(e.target?.result as string);
    reader.readAsDataURL(file);

    setAnalyzing(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload  = () => resolve((r.result as string).split(',')[1]);
        r.onerror = () => reject(new Error('שגיאה בקריאת הקובץ'));
        r.readAsDataURL(file);
      });

      const mediaType = (file.type || 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
      const idToken   = await auth.currentUser?.getIdToken(true);
      if (!idToken) throw new Error('לא מחובר — אנא התחבר מחדש');

      const resp = await fetch('/.netlify/functions/claude', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` },
        body: JSON.stringify({
          system: `אתה מערכת לזיהוי הוצאות מתמונות. המשתמש שולח תמונה של קבלה, חשבון, צילום מסך עסקה, או רשימת הוצאות.
חלץ את כל ההוצאות/עסקאות מהתמונה והחזר JSON בלבד ללא שום טקסט נוסף:
{"expenses":[{"name":"שם ההוצאה","amount":100,"currency":"ILS"}]}
כללים:
- name: שם קצר וברור בעברית
- amount: מספר חיובי בלבד
- currency: ILS/USD/EUR/GBP לפי מה שמופיע, ברירת מחדל ILS
- אם אין הוצאות ברורות: {"expenses":[],"error":"לא זוהו הוצאות בתמונה"}`,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'זהה את כל ההוצאות בתמונה.' },
            ],
          }],
          max_tokens: 1000,
        }),
      });

      const data = await resp.json() as any;
      if (!resp.ok) throw new Error(data.error || 'שגיאה בניתוח התמונה');

      const text   = (data.content?.[0]?.text || '').replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(text);

      if (parsed.error || !parsed.expenses?.length) {
        setError(parsed.error || 'לא זוהו הוצאות. נסה תמונה ברורה יותר.');
        return;
      }
      setPreview(parsed.expenses.map((e: any) => ({ ...e, selected: true })));
    } catch (e: any) {
      setError(e.message || 'שגיאה בניתוח התמונה. נסה שוב.');
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleRow = (i: number) =>
    setPreview(prev => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));

  const handleImport = async () => {
    const selected = preview.filter(r => r.selected);
    if (!selected.length) return;
    setImporting(true);
    try {
      if (isFixed) {
        const entries: FixedExpense[] = selected.map(row => ({
          id: uid(), name: row.name, amount: row.amount,
          currency: row.currency, category: cats[0] || 'אחר', type: scope,
        }));
        await updateDB(d => ({
          ...d,
          fixed: { ...d.fixed, [scope]: [...(d.fixed[scope] || []), ...entries] },
        }));
      } else {
        const entries = selected.map(row => ({
          id: uid(), name: row.name, amount: row.amount,
          currency: row.currency, category: cats[0] || 'אחר',
          type: scope, month, year, date: today(),
        }));
        await updateDB(d => ({ ...d, variable: [...(d.variable || []), ...entries] }));
      }
      onClose();
    } catch {
      setError('שגיאה בשמירה. נסה שוב.');
      setImporting(false);
    }
  };

  const selectedCount = preview.filter(r => r.selected).length;
  const allSelected   = preview.length > 0 && preview.every(r => r.selected);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="w-full md:max-w-lg bg-surface rounded-t-[1.5rem] md:rounded-[1.5rem] p-6 border border-outline-variant/10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles size={20} className="text-primary" />
            זיהוי הוצאות מתמונה · AI
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>

        <div className="bg-primary/5 border border-primary/15 rounded-xl p-3.5 mb-4">
          <p className="text-xs text-on-surface leading-relaxed">
            העלה <span className="font-bold">קבלה, חשבון, או צילום מסך עסקה</span> — ה-AI יזהה אוטומטית את שמות ההוצאות והסכומים.
          </p>
        </div>

        {/* אזור העלאה */}
        {!imageUrl && (
          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) analyzeImage(f); }}
            className="border-2 border-dashed border-outline-variant/30 hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-all mb-4 group"
          >
            <Camera size={36} className="mx-auto mb-3 text-on-surface-variant group-hover:text-primary transition-colors" />
            <p className="font-medium text-on-surface">לחץ לבחירת תמונה</p>
            <p className="text-xs text-on-surface-variant mt-1">או גרור לכאן · JPG, PNG, WEBP</p>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden"
              onChange={e => e.target.files?.[0] && analyzeImage(e.target.files[0])} />
          </div>
        )}

        {/* תצוגת תמונה */}
        {imageUrl && (
          <div className="mb-4">
            <div className="relative rounded-xl overflow-hidden border border-outline-variant/10 mb-2">
              <img src={imageUrl} alt="תמונה שהועלתה" className="w-full max-h-48 object-contain bg-surface-container-low" />
              {analyzing && (
                <div className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center gap-2">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  <p className="text-white text-xs font-medium">מנתח עם AI...</p>
                </div>
              )}
            </div>
            {!analyzing && (
              <button
                onClick={() => { setImageUrl(''); setPreview([]); setError(''); }}
                className="text-xs text-primary hover:underline"
              >
                החלף תמונה
              </button>
            )}
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-error/8 border border-error/20 rounded-xl mb-4">
            <AlertCircle size={14} className="text-error flex-shrink-0" />
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        {/* תצוגה מקדימה עם checkboxes */}
        {preview.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-on-surface-variant">זוהו {preview.length} הוצאות — סמן מה לייבא:</p>
              <button
                onClick={() => setPreview(prev => prev.map(r => ({ ...r, selected: !allSelected })))}
                className="text-[10px] text-primary hover:underline"
              >
                {allSelected ? 'בטל הכל' : 'בחר הכל'}
              </button>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto rounded-xl border border-outline-variant/10 p-2">
              {preview.map((row, i) => (
                <div
                  key={i}
                  onClick={() => toggleRow(i)}
                  className={cn(
                    'flex items-center justify-between py-2.5 px-3 rounded-lg text-xs cursor-pointer transition-all',
                    row.selected
                      ? 'bg-primary/8 border border-primary/20'
                      : 'bg-surface-container-low border border-transparent opacity-50'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      'w-4 h-4 rounded flex items-center justify-center border transition-all flex-shrink-0',
                      row.selected ? 'bg-primary border-primary' : 'border-outline-variant/40'
                    )}>
                      {row.selected && <CheckCircle2 size={11} className="text-on-primary" />}
                    </div>
                    <span className="text-on-surface font-medium">{row.name}</span>
                  </div>
                  <span className={cn('font-bold flex-shrink-0 ms-2', row.selected ? 'text-error' : 'text-on-surface-variant')}>
                    −{currencySymbol(row.currency)}{row.amount.toLocaleString('he-IL')}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-on-surface-variant mt-1.5 text-center">
              ההוצאות יסווגו תחת הקטגוריה הראשונה — ניתן לשנות לאחר הייבוא
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm">ביטול</button>
          <button
            onClick={handleImport}
            disabled={selectedCount === 0 || importing || analyzing}
            className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50"
          >
            {importing ? 'מייבא...' : selectedCount > 0 ? `ייבא ${selectedCount} הוצאות` : 'בחר הוצאות'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Excel Import Modal ────────────────────────────────
const ExcelImportModal: React.FC<{
  scope: ScopeType; isFixed: boolean; onClose: () => void;
}> = ({ scope, isFixed, onClose }) => {
  const { db, month, year, updateDB } = useApp();
  const cats    = db.settings.cats[scope] || ['אחר'];
  const fileRef = useRef<HTMLInputElement>(null);

  const [preview,   setPreview]   = useState<{ name: string; amount: number; currency: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [error,     setError]     = useState('');
  const [fileName,  setFileName]  = useState('');

  const handleFile = async (file: File) => {
    setError('');
    setPreview([]);
    setFileName(file.name);
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: 'array' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      const parsed: { name: string; amount: number; currency: string }[] = [];
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length < 2) continue;
        const nameVal   = String(row[0] ?? '').trim();
        const amountRaw = String(row[1] ?? '').trim();
        if (!nameVal || !amountRaw) continue;
        const amountNum = parseFloat(amountRaw.replace(/[^0-9.-]/g, ''));
        if (isNaN(amountNum) || amountNum <= 0) continue;
        parsed.push({ name: nameVal, amount: amountNum, currency: detectCurrency(amountRaw + ' ' + nameVal) });
      }

      if (!parsed.length) { setError('לא נמצאו נתונים תקינים. וודא שיש 2 עמודות: שם הוצאה וסכום.'); return; }
      setPreview(parsed);
    } catch {
      setError('שגיאה בקריאת הקובץ — וודא שזה קובץ Excel תקין (.xlsx / .xls)');
    }
  };

  const handleImport = async () => {
    if (!preview.length) return;
    setImporting(true);
    try {
      if (isFixed) {
        const entries: FixedExpense[] = preview.map(row => ({
          id: uid(), name: row.name, amount: row.amount,
          currency: row.currency, category: cats[0] || 'אחר', type: scope,
        }));
        await updateDB(d => ({ ...d, fixed: { ...d.fixed, [scope]: [...(d.fixed[scope] || []), ...entries] } }));
      } else {
        const entries = preview.map(row => ({
          id: uid(), name: row.name, amount: row.amount,
          currency: row.currency, category: cats[0] || 'אחר',
          type: scope, month, year, date: today(),
        }));
        await updateDB(d => ({ ...d, variable: [...(d.variable || []), ...entries] }));
      }
      onClose();
    } catch {
      setError('שגיאה בייבוא. נסה שוב.');
      setImporting(false);
    }
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
        className="w-full md:max-w-lg bg-surface rounded-t-[1.5rem] md:rounded-[1.5rem] p-6 border border-outline-variant/10 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-primary" />
            ייבוא מ-Excel · {isFixed ? 'הוצאות קבועות' : 'הוצאות משתנות'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>

        <div className="bg-surface-container-low rounded-xl p-4 mb-4 border border-outline-variant/8">
          <p className="text-xs font-bold text-on-surface mb-2">מבנה הקובץ הנדרש:</p>
          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="bg-primary/8 rounded-lg p-2.5 font-bold text-primary">עמודה א׳<br /><span className="font-normal opacity-80">שם ההוצאה</span></div>
            <div className="bg-primary/8 rounded-lg p-2.5 font-bold text-primary">עמודה ב׳<br /><span className="font-normal opacity-80">סכום (₪ / $ / €)</span></div>
          </div>
        </div>

        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className="border-2 border-dashed border-outline-variant/30 hover:border-primary/50 rounded-xl p-8 text-center cursor-pointer transition-all mb-4 group"
        >
          <Upload size={32} className="mx-auto mb-3 text-on-surface-variant group-hover:text-primary transition-colors" />
          <p className="font-medium text-on-surface">לחץ לבחירת קובץ Excel</p>
          <p className="text-xs text-on-surface-variant mt-1">או גרור לכאן · .xlsx ו-.xls</p>
          {fileName && <p className="text-xs text-primary mt-2 font-bold">✓ {fileName}</p>}
          <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
            onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-error/8 border border-error/20 rounded-xl mb-4">
            <AlertCircle size={14} className="text-error flex-shrink-0" />
            <p className="text-xs text-error">{error}</p>
          </div>
        )}

        {preview.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-bold text-on-surface-variant mb-2">תצוגה מקדימה — {preview.length} הוצאות:</p>
            <div className="max-h-52 overflow-y-auto space-y-1 rounded-xl border border-outline-variant/10 p-2">
              {preview.map((row, i) => (
                <div key={i} className="flex justify-between items-center py-2 px-3 bg-surface-container-low rounded-lg text-xs">
                  <span className="text-on-surface font-medium truncate">{row.name}</span>
                  <span className="text-error font-bold flex-shrink-0 ms-2">
                    −{currencySymbol(row.currency)}{row.amount.toLocaleString('he-IL')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm">ביטול</button>
          <button onClick={handleImport} disabled={!preview.length || importing}
            className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">
            {importing ? 'מייבא...' : `ייבא ${preview.length} הוצאות`}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ── Main Expenses ─────────────────────────────────────
export const Expenses: React.FC<{ scope: ScopeType }> = ({ scope }) => {
  const { db, month, year, lang, updateDB } = useApp();
  const sym    = getCurrencySymbol(db);
  const fixed  = db.fixed[scope] || [];
  const vars   = varForMonth(db, scope, month, year);
  const totalF = fixedTotal(db, scope);
  const totalV = varTotal(db, scope, month, year);
  const p      = db.settings.profile;
  const label  = scope === 'personal'  ? (p.name || t(lang, 'personal'))
               : scope === 'personal2' ? ((p as any).partnerName || 'משתמש 2')
               : t(lang, 'family');

  const [modal,      setModal]      = useState<{ isFixed: boolean; item?: any } | null>(null);
  const [excelModal, setExcelModal] = useState<{ isFixed: boolean } | null>(null);
  const [imageModal, setImageModal] = useState<{ isFixed: boolean } | null>(null);

  const deleteFixed = (id: string) => {
    if (!confirm('למחוק הוצאה קבועה זו?')) return;
    updateDB(d => ({ ...d, fixed: { ...d.fixed, [scope]: (d.fixed[scope] || []).filter(e => e.id !== id) } }));
  };
  const deleteVar = (id: string) => {
    if (!confirm('למחוק הוצאה זו?')) return;
    updateDB(d => ({ ...d, variable: d.variable.filter(e => e.id !== id) }));
  };

  const ActionButtons = ({ isFixed }: { isFixed: boolean }) => (
    <div className="flex items-center gap-2 flex-wrap justify-end">
      <button
        onClick={() => setImageModal({ isFixed })}
        className="flex items-center gap-1.5 px-3 py-2 bg-primary/5 text-primary border border-primary/20 rounded-xl text-xs font-medium hover:bg-primary/10 transition-all"
      >
        <Sparkles size={13} /> זיהוי תמונה
      </button>
      <button
        onClick={() => setExcelModal({ isFixed })}
        className="flex items-center gap-1.5 px-3 py-2 bg-surface-container-high text-on-surface-variant border border-outline-variant/20 rounded-xl text-xs font-medium hover:bg-surface-container-highest transition-all"
      >
        <FileSpreadsheet size={13} /> Excel
      </button>
      <button
        onClick={() => setModal({ isFixed })}
        className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all"
      >
        <Plus size={15} /> הוצאה
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* הוצאות קבועות */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/8 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold">{t(lang, 'fixedExpenses')}</h2>
            <div className="text-xs text-on-surface-variant mt-0.5">{label} · חוזר חודשי</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-on-surface-variant text-sm font-medium">{sym}{Math.round(totalF).toLocaleString('he-IL')} סה"כ</span>
            <ActionButtons isFixed={true} />
          </div>
        </div>
        <div className="p-6">
          {fixed.length === 0 ? (
            <div className="text-center py-6 text-on-surface-variant text-sm">אין הוצאות קבועות</div>
          ) : fixed.map(e => (
            <ExpenseRow key={e.id} name={e.name} category={e.category} amount={e.amount} sym={sym}
              note={e.note} paymentMethod={e.paymentMethod} cardName={e.cardName}
              billingDay={e.billingDay} isStandingOrder={e.isStandingOrder} standingOrderExpiry={e.standingOrderExpiry}
              onEdit={() => setModal({ isFixed: true, item: e })}
              onDelete={() => deleteFixed(e.id)} />
          ))}
        </div>
      </div>

      {/* הוצאות משתנות */}
      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5">
        <div className="flex items-center justify-between p-6 border-b border-outline-variant/8 flex-wrap gap-3">
          <div>
            <h2 className="text-base font-bold">{t(lang, 'variableExpenses')}</h2>
            <div className="text-xs text-on-surface-variant mt-0.5">{label} · החודש</div>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span className="text-on-surface-variant text-sm font-medium">{sym}{Math.round(totalV).toLocaleString('he-IL')} סה"כ</span>
            <ActionButtons isFixed={false} />
          </div>
        </div>
        <div className="p-6">
          {vars.length === 0 ? (
            <div className="text-center py-6 text-on-surface-variant text-sm">אין הוצאות לחודש זה</div>
          ) : vars.map(e => (
            <ExpenseRow key={e.id} name={e.name} category={e.category} amount={e.amount} sym={sym}
              sub={e.date} note={e.note} paymentMethod={(e as any).paymentMethod}
              cardName={(e as any).cardName} billingDay={(e as any).billingDay}
              isStandingOrder={(e as any).isStandingOrder} standingOrderExpiry={(e as any).standingOrderExpiry}
              onEdit={() => setModal({ isFixed: false, item: e })}
              onDelete={() => deleteVar(e.id)} />
          ))}
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal && (
          <AddExpenseModal type={scope} isFixed={modal.isFixed} existing={modal.item} onClose={() => setModal(null)} />
        )}
        {excelModal && (
          <ExcelImportModal scope={scope} isFixed={excelModal.isFixed} onClose={() => setExcelModal(null)} />
        )}
        {imageModal && (
          <ImageImportModal scope={scope} isFixed={imageModal.isFixed} onClose={() => setImageModal(null)} />
        )}
      </AnimatePresence>
    </div>
  );
};
