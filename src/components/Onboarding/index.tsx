import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { t } from '../../lib/i18n';
import { ChevronLeft, Check, Plus, Trash2, ShieldCheck, CreditCard } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CURRENCIES, uid } from '../../lib/calculations';
import { authUpdateProfile, auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';

// ── Step definitions ──────────────────────────────────
type Step =
  | 'account_type'
  | 'profile_p1'     // פרופיל משתמש 1
  | 'profile_p2'     // פרופיל משתמש 2 (אם משפחתי)
  | 'budget_p1'      // תקציב אישי 1
  | 'budget_p2'      // תקציב אישי 2
  | 'budget_family'  // תקציב משפחתי
  | 'cards_p1'       // כרטיסי אשראי משתמש 1
  | 'cards_p2'       // כרטיסי אשראי משתמש 2
  | 'cards_family'   // כרטיסי אשראי משפחה
  | 'emergency'      // קרן חירום
  | 'cats_p'         // קטגוריות אישיות
  | 'cats_f'         // קטגוריות משפחה
  | 'currency'       // מטבע
  | 'done';          // סיום

const CATS_PERSONAL = ['מזון ומסעדות','קפה','תחבורה','דלק','בריאות ורפואה','בידור','ביגוד','קוסמטיקה','חינוך','ספורט','מנויים','קניות אונליין','מתנות','אחר'];
const CATS_FAMILY   = ['שכר דירה / משכנתא','ארנונה','חשמל','מים וגז','אינטרנט','ביטוחים','קניות סופר','ילדים — חוגים','ילדים — ביגוד','חיסכון','חופשה','תיקונים','רכב','עוזרת בית','אחר'];

interface CardDraft { id: string; name: string; billingDay: number; limit: number }

interface OBData {
  accountType: 'personal' | 'family_solo' | 'family';
  // משתמש 1
  name: string;
  budgetP1: number;
  cardsP1: CardDraft[];
  efP1: number;         // קרן חירום
  // משתמש 2
  partnerName: string;
  budgetP2: number;
  cardsP2: CardDraft[];
  efP2: number;
  // משפחה
  budgetFamily: number;
  cardsFamily: CardDraft[];
  efFamily: number;
  rent: number;         // שכ"ד / משכנתא חודשי
  // כללי
  startDay: number;
  currency: string;
  catsPersonal: string[];
  catsFamily: string[];
}

const defaultData = (): OBData => ({
  accountType:  'personal',
  name: '', budgetP1: 0, cardsP1: [], efP1: 0,
  partnerName: '', budgetP2: 0, cardsP2: [], efP2: 0,
  budgetFamily: 0, cardsFamily: [], efFamily: 0, rent: 0,
  startDay: 1, currency: 'ILS',
  catsPersonal: ['מזון ומסעדות','תחבורה','ביגוד','בריאות ורפואה','ספורט','בידור','קניות אונליין','אחר'],
  catsFamily:   ['שכר דירה / משכנתא','חשמל','קניות סופר','ילדים — חוגים','ביטוחים','חופשה','אחר'],
});

// חישוב רצף הצעדים לפי סוג חשבון
const getSteps = (accountType: string): Step[] => {
  const isFamily   = accountType !== 'personal';
  const hasPartner = accountType === 'family';
  return [
    'account_type',
    'profile_p1',
    ...(hasPartner ? ['profile_p2' as Step] : []),
    'budget_p1',
    ...(hasPartner ? ['budget_p2' as Step] : []),
    ...(isFamily   ? ['budget_family' as Step] : []),
    'cards_p1',
    ...(hasPartner ? ['cards_p2' as Step] : []),
    ...(isFamily   ? ['cards_family' as Step] : []),
    'emergency',
    'cats_p',
    ...(isFamily   ? ['cats_f' as Step] : []),
    'currency',
    'done',
  ];
};

const STEP_LABELS: Record<Step, string> = {
  account_type:  'סוג חשבון',
  profile_p1:    'פרופיל אישי',
  profile_p2:    'פרופיל בן/בת זוג',
  budget_p1:     'תקציב אישי',
  budget_p2:     'תקציב בן/בת זוג',
  budget_family: 'תקציב משפחתי',
  cards_p1:      'כרטיסי אשראי',
  cards_p2:      'כרטיסי אשראי — בן/בת זוג',
  cards_family:  'כרטיסי אשראי — משפחה',
  emergency:     'קרן חירום',
  cats_p:        'קטגוריות אישיות',
  cats_f:        'קטגוריות משפחה',
  currency:      'מטבע',
  done:          'סיום',
};

// ── Card draft editor ─────────────────────────────────
const CardEditor: React.FC<{
  cards: CardDraft[];
  onChange: (cards: CardDraft[]) => void;
  sym: string;
}> = ({ cards, onChange, sym }) => {
  const addCard = () => {
    onChange([...cards, { id: uid(), name: '', billingDay: 10, limit: 0 }]);
  };
  const update = (id: string, patch: Partial<CardDraft>) => {
    onChange(cards.map(c => c.id === id ? { ...c, ...patch } : c));
  };
  const remove = (id: string) => onChange(cards.filter(c => c.id !== id));

  return (
    <div className="space-y-3">
      {cards.map(card => (
        <div key={card.id} className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/10 space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard size={15} className="text-primary flex-shrink-0" />
            <input
              className="flex-1 bg-surface-container-high border-0 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
              placeholder="שם הכרטיס (למשל: ויזה כאל)"
              value={card.name}
              onChange={e => update(card.id, { name: e.target.value })}
            />
            <button onClick={() => remove(card.id)} className="p-1.5 text-error hover:bg-error/10 rounded-lg transition-colors flex-shrink-0">
              <Trash2 size={14} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">יום חיוב</label>
              <select
                className="w-full bg-surface-container-high border-0 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                value={card.billingDay}
                onChange={e => update(card.id, { billingDay: parseInt(e.target.value) })}
              >
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => (
                  <option key={d} value={d}>יום {d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">מסגרת אשראי ({sym}) — אופציונלי</label>
              <input
                type="number"
                className="w-full bg-surface-container-high border-0 rounded-lg px-3 py-2 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder="0"
                value={card.limit || ''}
                onChange={e => update(card.id, { limit: parseFloat(e.target.value) || 0 })}
              />
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={addCard}
        className="w-full py-3 border-2 border-dashed border-outline-variant/30 rounded-xl text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all text-sm font-medium flex items-center justify-center gap-2"
      >
        <Plus size={16} /> הוסף כרטיס אשראי
      </button>
      {cards.length === 0 && (
        <p className="text-xs text-on-surface-variant text-center">אין צורך בכרטיס — ניתן לדלג</p>
      )}
    </div>
  );
};

// ── Main Onboarding ───────────────────────────────────
export const Onboarding: React.FC = () => {
  const { updateDB } = useApp();
  const [data,   setData]   = useState<OBData>(defaultData());
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const steps   = getSteps(data.accountType);
  const [stepIdx, setStepIdx] = useState(0);
  const step    = steps[stepIdx];
  const pct     = Math.round(stepIdx / (steps.length - 1) * 100);
  const isLast  = step === 'done';
  const sym     = CURRENCIES[data.currency]?.symbol || '₪';

  const nextStep = () => {
    setErr('');
    if (step === 'account_type' && !data.name.trim()) { setErr('נא להזין שם'); return; }
    if (step === 'profile_p2' && data.accountType === 'family' && !data.partnerName.trim()) { setErr('נא להזין שם בן/בת הזוג'); return; }
    if (isLast) { finish(); return; }
    setStepIdx(i => i + 1);
  };

  const prevStep = () => {
    setErr('');
    if (stepIdx > 0) setStepIdx(i => i - 1);
  };

  // כאשר משתנה סוג החשבון — אפס אינדקס
  const setAccountType = (type: OBData['accountType']) => {
    setData(d => ({ ...d, accountType: type }));
    setStepIdx(0);
  };

  const toggleCat = (type: 'personal' | 'family', cat: string) => {
    setData(d => {
      const key = type === 'personal' ? 'catsPersonal' : 'catsFamily';
      const arr = d[key];
      return { ...d, [key]: arr.includes(cat) ? arr.filter(c => c !== cat) : [...arr, cat] };
    });
  };

  const finish = async () => {
    setSaving(true);
    const finalType = data.accountType === 'family_solo' ? 'family' : data.accountType;
    const isFamily  = data.accountType !== 'personal';

    // בנה כרטיסי אשראי מכל המשתמשים
    const allCards = [
      ...data.cardsP1.filter(c => c.name.trim()).map(c => ({ id: c.id, name: `${c.name} (${data.name})`, billingDay: c.billingDay, last4: '', limit: c.limit })),
      ...data.cardsP2.filter(c => c.name.trim()).map(c => ({ id: c.id, name: `${c.name} (${data.partnerName})`, billingDay: c.billingDay, last4: '', limit: c.limit })),
      ...data.cardsFamily.filter(c => c.name.trim()).map(c => ({ id: c.id, name: `${c.name} (משפחה)`, billingDay: c.billingDay, last4: '', limit: c.limit })),
    ];

    // הוצאה קבועה של שכ"ד אם הוזן
    const familyFixed = data.rent > 0 ? [{
      id: uid(), name: 'שכר דירה / משכנתא', amount: data.rent,
      currency: data.currency, category: 'שכר דירה / משכנתא', type: 'family' as const,
    }] : [];

    await updateDB(() => ({
      settings: {
        profile: {
          name: data.name.trim(),
          accountType: finalType,
          partnerName: data.partnerName.trim(),
          hasSoloFamily: data.accountType === 'family_solo',
        },
        currency: data.currency,
        budget: {
          personal:  data.budgetP1,
          personal2: data.budgetP2,
          family:    data.budgetFamily,
          startDay:  data.startDay,
          rollover:  true,
        } as any,
        cats: { personal: data.catsPersonal, family: data.catsFamily, personal2: data.catsPersonal },
        incomeTypes: ['משכורת', 'נדל"ן', 'שוק ההון', 'פנסיה', 'קרן השתלמות', 'עצמאי', 'אחר'],
        goals: {},
        emergencyFunds: { personal: data.efP1, personal2: data.efP2, family: data.efFamily },
        onboardingDone: true,
      },
      fixed:       { personal: [], personal2: [], family: familyFixed },
      variable:    [],
      incomes:     [],
      savings:     [],
      creditCards: allCards,
      tasks:       {},
    }));

    if (auth.currentUser && data.name) {
      try { await authUpdateProfile(auth.currentUser, data.name); } catch {}
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col font-sans">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <span className="text-primary text-xs font-black">₪</span>
          </div>
          <div className="font-bold text-on-surface">תקציב</div>
        </div>
        <div className="space-y-2">
          <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="text-xs text-on-surface-variant">
            שלב {stepIdx + 1} מתוך {steps.length} — {STEP_LABELS[step]}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >

            {/* ── סוג חשבון ── */}
            {step === 'account_type' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">החשבון הוא עבור...</h1>
                {[
                  { id: 'personal'    as const, title: 'שימוש אישי',               sub: 'אישי, חיסכון, הכנסות' },
                  { id: 'family_solo' as const, title: 'משפחתי (ללא בן/בת זוג)',   sub: 'אישי, משפחה, חיסכון' },
                  { id: 'family'      as const, title: 'משפחתי עם בן/בת זוג',      sub: 'שני משתמשים + חשבון משפחתי' },
                ].map(t => (
                  <button key={t.id} onClick={() => setAccountType(t.id)}
                    className={cn('w-full flex items-center justify-between p-4 rounded-xl border text-right transition-all',
                      data.accountType === t.id ? 'border-primary/40 bg-primary/8' : 'border-outline-variant/15 bg-surface-container-low hover:border-outline-variant/30'
                    )}>
                    <div>
                      <div className="font-semibold">{t.title}</div>
                      <div className="text-xs text-on-surface-variant mt-0.5">{t.sub}</div>
                    </div>
                    {data.accountType === t.id && <Check className="text-primary flex-shrink-0" size={18} />}
                  </button>
                ))}
                <div className="pt-2 space-y-3">
                  <div>
                    <label className="text-xs font-medium text-on-surface-variant block mb-1.5">שמך</label>
                    <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30"
                      placeholder="למשל: אלירן" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  {data.accountType === 'family' && (
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1.5">שם בן/בת הזוג</label>
                      <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30"
                        placeholder="למשל: שירה" value={data.partnerName} onChange={e => setData(d => ({ ...d, partnerName: e.target.value }))} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── פרופיל משתמש 1 ── */}
            {step === 'profile_p1' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">שלום, {data.name}! 👋</h1>
                <p className="text-on-surface-variant text-sm">ביום כמה מתחיל החודש התקציבי שלך?</p>
                <div className="flex flex-wrap gap-2">
                  {[1,5,10,15,20,25].map(d => (
                    <button key={d} onClick={() => setData(x => ({ ...x, startDay: d }))}
                      className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                        data.startDay === d ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant')}>
                      יום {d}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── פרופיל משתמש 2 ── */}
            {step === 'profile_p2' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">פרטי {data.partnerName}</h1>
                <p className="text-on-surface-variant text-sm">מלא את הפרטים עבור {data.partnerName}</p>
                <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/8">
                  <p className="text-xs text-on-surface-variant">שם בן/בת הזוג: <strong className="text-on-surface">{data.partnerName}</strong></p>
                  <p className="text-xs text-on-surface-variant mt-1">התקציב וכרטיסי האשראי יוגדרו בשלבים הבאים</p>
                </div>
              </div>
            )}

            {/* ── תקציב משתמש 1 ── */}
            {step === 'budget_p1' && (
              <div className="space-y-5">
                <h1 className="text-2xl font-bold">תקציב אישי — {data.name}</h1>
                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/8">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">תקציב חודשי ({sym})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-primary">{sym}</span>
                    <input className="bg-transparent border-0 text-2xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                      placeholder="0" value={data.budgetP1 || ''} onChange={e => setData(d => ({ ...d, budgetP1: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
            )}

            {/* ── תקציב משתמש 2 ── */}
            {step === 'budget_p2' && (
              <div className="space-y-5">
                <h1 className="text-2xl font-bold">תקציב אישי — {data.partnerName}</h1>
                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/8">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">תקציב חודשי ({sym})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-primary">{sym}</span>
                    <input className="bg-transparent border-0 text-2xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                      placeholder="0" value={data.budgetP2 || ''} onChange={e => setData(d => ({ ...d, budgetP2: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
            )}

            {/* ── תקציב משפחה ── */}
            {step === 'budget_family' && (
              <div className="space-y-5">
                <h1 className="text-2xl font-bold">תקציב משפחתי</h1>
                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/8">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">תקציב חודשי ({sym})</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-primary">{sym}</span>
                    <input className="bg-transparent border-0 text-2xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                      placeholder="0" value={data.budgetFamily || ''} onChange={e => setData(d => ({ ...d, budgetFamily: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
                <div className="bg-surface-container-lowest p-5 rounded-xl border border-outline-variant/8">
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">שכר דירה / משכנתא חודשי ({sym})</label>
                  <p className="text-xs text-on-surface-variant mb-3">יתווסף אוטומטית כהוצאה קבועה משפחתית</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-primary">{sym}</span>
                    <input className="bg-transparent border-0 text-2xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                      placeholder="0" value={data.rent || ''} onChange={e => setData(d => ({ ...d, rent: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
            )}

            {/* ── כרטיסי אשראי משתמש 1 ── */}
            {step === 'cards_p1' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">כרטיסי אשראי — {data.name}</h1>
                <p className="text-sm text-on-surface-variant">הוסף את הכרטיסים שלך. ללא מספר כרטיס — רק שם ויום חיוב.</p>
                <CardEditor cards={data.cardsP1} onChange={cards => setData(d => ({ ...d, cardsP1: cards }))} sym={sym} />
              </div>
            )}

            {/* ── כרטיסי אשראי משתמש 2 ── */}
            {step === 'cards_p2' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">כרטיסי אשראי — {data.partnerName}</h1>
                <p className="text-sm text-on-surface-variant">הוסף את הכרטיסים של {data.partnerName}.</p>
                <CardEditor cards={data.cardsP2} onChange={cards => setData(d => ({ ...d, cardsP2: cards }))} sym={sym} />
              </div>
            )}

            {/* ── כרטיסי אשראי משפחה ── */}
            {step === 'cards_family' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">כרטיסי אשראי — משפחה</h1>
                <p className="text-sm text-on-surface-variant">כרטיסים משותפים למשפחה.</p>
                <CardEditor cards={data.cardsFamily} onChange={cards => setData(d => ({ ...d, cardsFamily: cards }))} sym={sym} />
              </div>
            )}

            {/* ── קרן חירום ── */}
            {step === 'emergency' && (
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="text-primary" size={28} />
                  <h1 className="text-2xl font-bold">קרן חירום</h1>
                </div>
                <p className="text-sm text-on-surface-variant leading-relaxed">
                  קרן חירום היא סכום שמור למצבי חירום — מומלץ לפחות 3 חודשי הוצאות.
                </p>

                {/* המלצה */}
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4">
                  <p className="text-xs text-primary font-bold mb-1">💡 המלצה</p>
                  <p className="text-xs text-on-surface-variant">
                    על בסיס התקציב שהגדרת, קרן חירום מומלצת היא:
                    <strong className="text-primary"> {sym}{Math.round((data.budgetP1 + data.budgetP2 + data.budgetFamily) * 3).toLocaleString('he-IL')}</strong> (3 חודשים)
                  </p>
                </div>

                <div className="space-y-4">
                  {[
                    { label: `קרן חירום — ${data.name}`, val: data.efP1, key: 'efP1' as const },
                    ...(data.accountType === 'family' ? [{ label: `קרן חירום — ${data.partnerName}`, val: data.efP2, key: 'efP2' as const }] : []),
                    ...(data.accountType !== 'personal' ? [{ label: 'קרן חירום — משפחה', val: data.efFamily, key: 'efFamily' as const }] : []),
                  ].map(item => (
                    <div key={item.key} className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/8">
                      <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block mb-2">{item.label} ({sym})</label>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-primary">{sym}</span>
                        <input className="bg-transparent border-0 text-xl font-black w-full focus:ring-0 p-0 text-on-surface" type="number"
                          placeholder="0" value={item.val || ''} onChange={e => setData(d => ({ ...d, [item.key]: parseFloat(e.target.value) || 0 }))} />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-on-surface-variant">ניתן לעדכן בכל עת בהגדרות</p>
              </div>
            )}

            {/* ── קטגוריות אישיות ── */}
            {step === 'cats_p' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">קטגוריות הוצאות אישיות</h1>
                <p className="text-sm text-on-surface-variant">בחר את הקטגוריות הרלוונטיות</p>
                <div className="flex flex-wrap gap-2">
                  {CATS_PERSONAL.map(cat => {
                    const selected = data.catsPersonal.includes(cat);
                    return (
                      <button key={cat} onClick={() => toggleCat('personal', cat)}
                        className={cn('px-4 py-2 rounded-full text-sm border font-medium transition-all',
                          selected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant')}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-on-surface-variant">נבחרו: <strong className="text-primary">{data.catsPersonal.length}</strong> קטגוריות</p>
              </div>
            )}

            {/* ── קטגוריות משפחה ── */}
            {step === 'cats_f' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">קטגוריות הוצאות משפחתיות</h1>
                <p className="text-sm text-on-surface-variant">בחר את הקטגוריות הרלוונטיות</p>
                <div className="flex flex-wrap gap-2">
                  {CATS_FAMILY.map(cat => {
                    const selected = data.catsFamily.includes(cat);
                    return (
                      <button key={cat} onClick={() => toggleCat('family', cat)}
                        className={cn('px-4 py-2 rounded-full text-sm border font-medium transition-all',
                          selected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant')}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-on-surface-variant">נבחרו: <strong className="text-primary">{data.catsFamily.length}</strong> קטגוריות</p>
              </div>
            )}

            {/* ── מטבע ── */}
            {step === 'currency' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">מטבע</h1>
                <div className="space-y-2">
                  {Object.entries(CURRENCIES).map(([k, v]) => (
                    <button key={k} onClick={() => setData(d => ({ ...d, currency: k }))}
                      className={cn('w-full flex items-center justify-between p-4 rounded-xl border transition-all',
                        data.currency === k ? 'border-primary/40 bg-primary/8' : 'border-outline-variant/15 bg-surface-container-low')}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{v.flag}</span>
                        <div className="text-right">
                          <div className="font-semibold">{v.symbol} {v.name}</div>
                          <div className="text-xs text-on-surface-variant">{k}</div>
                        </div>
                      </div>
                      {data.currency === k && <Check className="text-primary" size={18} />}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── סיום ── */}
            {step === 'done' && (
              <div className="space-y-5">
                <h1 className="text-2xl font-bold">הכל מוכן! 🎉</h1>
                <div className="bg-primary/5 border border-primary/15 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">✦</div>
                  <h2 className="font-bold text-lg mb-2">ברוך הבא, {data.name}!</h2>
                  <p className="text-sm text-on-surface-variant">האפליקציה מוכנה לניהול הכספים שלך</p>
                </div>

                {/* סיכום */}
                <div className="space-y-2">
                  {[
                    { label: 'תקציב אישי', val: data.budgetP1 > 0 ? `${sym}${data.budgetP1.toLocaleString()}` : 'לא הוגדר' },
                    ...(data.accountType === 'family' ? [{ label: `תקציב ${data.partnerName}`, val: data.budgetP2 > 0 ? `${sym}${data.budgetP2.toLocaleString()}` : 'לא הוגדר' }] : []),
                    ...(data.accountType !== 'personal' ? [{ label: 'תקציב משפחה', val: data.budgetFamily > 0 ? `${sym}${data.budgetFamily.toLocaleString()}` : 'לא הוגדר' }] : []),
                    { label: 'כרטיסי אשראי', val: `${data.cardsP1.length + data.cardsP2.length + data.cardsFamily.length} כרטיסים` },
                    { label: 'קרן חירום', val: (data.efP1 + data.efP2 + data.efFamily) > 0 ? `${sym}${(data.efP1 + data.efP2 + data.efFamily).toLocaleString()}` : 'לא הוגדר' },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-outline-variant/8 last:border-0">
                      <span className="text-sm text-on-surface-variant">{item.label}</span>
                      <span className="text-sm font-bold text-on-surface">{item.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {err && (
          <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">{err}</div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-4 border-t border-outline-variant/8 flex gap-3 flex-shrink-0">
        {stepIdx > 0 && (
          <button onClick={prevStep} className="px-5 py-3 border border-outline-variant/20 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center gap-2">
            <ChevronLeft size={16} /> חזור
          </button>
        )}
        <button onClick={nextStep} disabled={saving} className="flex-1 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-60 hover:shadow-xl hover:shadow-primary/20 transition-all">
          {saving ? (t(lang,'loading')||'שומר...') : isLast ? (t(lang,'finish')||'✅ סיים!') : (t(lang,'continue')||'המשך →')}
        </button>
      </div>
    </div>
  );
};
