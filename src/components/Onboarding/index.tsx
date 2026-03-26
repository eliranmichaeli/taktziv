import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CURRENCIES, uid } from '../../lib/calculations';
import { authUpdateProfile, auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';

// ── Onboarding step definitions ───────────────────────
type Step = 'account_type' | 'profile' | 'budget' | 'cats_p' | 'cats_f' | 'currency' | 'goals';

const STEPS: Step[] = ['account_type', 'profile', 'budget', 'cats_p', 'cats_f', 'currency', 'goals'];

const STEP_LABELS: Record<Step, string> = {
  account_type: 'סוג חשבון',
  profile:      'פרופיל אישי',
  budget:       'תקציב',
  cats_p:       'קטגוריות אישיות',
  cats_f:       'קטגוריות משפחה',
  currency:     'מטבע',
  goals:        'מטרות',
};

const CATS_PERSONAL = ['מזון ומסעדות','קפה','תחבורה','דלק','בריאות ורפואה','בידור','ביגוד','קוסמטיקה','חינוך','ספורט','מנויים','קניות אונליין','מתנות','אחר'];
const CATS_FAMILY   = ['שכר דירה / משכנתא','ארנונה','חשמל','מים וגז','אינטרנט','ביטוחים','קניות סופר','ילדים — חוגים','ילדים — ביגוד','חיסכון','חופשה','תיקונים','רכב','עוזרת בית','אחר'];

interface OBData {
  accountType: 'personal' | 'family_solo' | 'family';
  name: string;
  partnerName: string;
  dob: string;
  currency: string;
  budgetP: number;
  budgetF: number;
  startDay: number;
  catsPersonal: string[];
  catsFamily: string[];
}

const defaultData = (): OBData => ({
  accountType:  'personal',
  name:         '',
  partnerName:  '',
  dob:          '',
  currency:     'ILS',
  budgetP:      0,
  budgetF:      0,
  startDay:     1,
  catsPersonal: ['מזון ומסעדות','תחבורה','ביגוד','בריאות ורפואה','ספורט','בידור','קניות אונליין','אחר'],
  catsFamily:   ['שכר דירה / משכנתא','חשמל','קניות סופר','ילדים — חוגים','ביטוחים','חופשה','אחר'],
});

export const Onboarding: React.FC = () => {
  const { updateDB }  = useApp();
  const [step,   setStep]   = useState<Step>('account_type');
  const [data,   setData]   = useState<OBData>(defaultData());
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState('');

  const stepIdx = STEPS.indexOf(step);
  const pct     = Math.round(stepIdx / (STEPS.length - 1) * 100);
  const isLast  = stepIdx === STEPS.length - 1;

  // Skip cats_f if personal user
  const nextStep = () => {
    setErr('');
    // Validate
    if (step === 'account_type' && !data.name.trim()) {
      setErr('נא להזין שם'); return;
    }
    let next = STEPS[stepIdx + 1];
    if (!next) { finish(); return; }
    // Skip family cats for non-family
    if (next === 'cats_f' && data.accountType === 'personal') {
      next = STEPS[stepIdx + 2] || STEPS[stepIdx + 1];
    }
    setStep(next);
  };

  const finish = async () => {
    setSaving(true);
    const finalType = data.accountType === 'family_solo' ? 'family' : data.accountType;
    await updateDB(() => ({
      settings: {
        profile: {
          name:         data.name.trim(),
          dob:          data.dob,
          accountType:  finalType,
          partnerName:  data.partnerName.trim(),
          hasSoloFamily: data.accountType === 'family_solo',
        },
        currency:    data.currency,
        budget:      { personal: data.budgetP, family: data.budgetF, startDay: data.startDay, rollover: true },
        cats:        { personal: data.catsPersonal, family: data.catsFamily, personal2: data.catsPersonal },
        incomeTypes: ['משכורת'],
        goals:       {},
        onboardingDone: true,
      },
      fixed:       { personal: [], personal2: [], family: [] },
      variable:    [],
      incomes:     [],
      savings:     [],
      creditCards: [],
      tasks:       {},
    }));
    // Update Firebase display name
    if (auth.currentUser && data.name) {
      try { await authUpdateProfile(auth.currentUser, data.name); } catch {}
    }
    setSaving(false);
  };

  const toggleCat = (type: 'personal' | 'family', cat: string) => {
    setData(d => {
      const key = type === 'personal' ? 'catsPersonal' : 'catsFamily';
      const arr = d[key];
      return { ...d, [key]: arr.includes(cat) ? arr.filter(c => c !== cat) : [...arr, cat] };
    });
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

        {/* Progress */}
        <div className="space-y-2">
          <div className="h-1 bg-surface-container-high rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            />
          </div>
          <div className="text-xs text-on-surface-variant">
            שלב {stepIdx + 1} מתוך {STEPS.length} — {STEP_LABELS[step]}
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
            {/* Account type */}
            {step === 'account_type' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">החשבון הוא עבור...</h1>
                {[
                  { id: 'personal' as const, title: 'שימוש אישי', sub: 'אישי, חיסכון, הכנסות' },
                  { id: 'family_solo' as const, title: 'משפחתי (ללא בן/בת זוג)', sub: 'אישי, משפחה, חיסכון' },
                  { id: 'family' as const, title: 'משפחתי עם בן/בת זוג', sub: 'שני משתמשים + חשבון משפחתי' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setData(d => ({ ...d, accountType: t.id }))}
                    className={cn(
                      'w-full flex items-center justify-between p-4 rounded-xl border text-right transition-all',
                      data.accountType === t.id
                        ? 'border-primary/40 bg-primary/8 text-on-surface'
                        : 'border-outline-variant/15 bg-surface-container-low hover:border-outline-variant/30'
                    )}
                  >
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
                    <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="למשל: אלירן" value={data.name} onChange={e => setData(d => ({ ...d, name: e.target.value }))} />
                  </div>
                  {data.accountType === 'family' && (
                    <div>
                      <label className="text-xs font-medium text-on-surface-variant block mb-1.5">שם בן/בת הזוג</label>
                      <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="למשל: שירה" value={data.partnerName} onChange={e => setData(d => ({ ...d, partnerName: e.target.value }))} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Profile */}
            {step === 'profile' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">שלום, {data.name}!</h1>
                <p className="text-on-surface-variant text-sm">תאריך לידה (אופציונלי)</p>
                <input type="date" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" value={data.dob} onChange={e => setData(d => ({ ...d, dob: e.target.value }))} />
                <p className="text-xs text-on-surface-variant">לצורך התאמה אישית של האפליקציה</p>
              </div>
            )}

            {/* Budget */}
            {step === 'budget' && (
              <div className="space-y-5">
                <h1 className="text-2xl font-bold">הגדרת תקציב</h1>
                <div>
                  <p className="text-sm font-medium mb-3">ביום כמה מתחיל החודש התקציבי?</p>
                  <div className="flex flex-wrap gap-2">
                    {[1,5,10,15,20,25].map(d => (
                      <button key={d} onClick={() => setData(x => ({ ...x, startDay: d }))} className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all', data.startDay === d ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant')}>
                        יום {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-on-surface-variant font-medium block mb-1.5">תקציב אישי ({CURRENCIES[data.currency]?.symbol})</label>
                    <input type="number" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={data.budgetP || ''} onChange={e => setData(d => ({ ...d, budgetP: parseFloat(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-xs text-on-surface-variant font-medium block mb-1.5">תקציב משפחה ({CURRENCIES[data.currency]?.symbol})</label>
                    <input type="number" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={data.budgetF || ''} onChange={e => setData(d => ({ ...d, budgetF: parseFloat(e.target.value) || 0 }))} />
                  </div>
                </div>
              </div>
            )}

            {/* Categories */}
            {(step === 'cats_p' || step === 'cats_f') && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">{step === 'cats_p' ? 'קטגוריות אישיות' : 'קטגוריות משפחה'}</h1>
                <p className="text-sm text-on-surface-variant">בחר את הקטגוריות הרלוונטיות</p>
                <div className="flex flex-wrap gap-2">
                  {(step === 'cats_p' ? CATS_PERSONAL : CATS_FAMILY).map(cat => {
                    const selected = (step === 'cats_p' ? data.catsPersonal : data.catsFamily).includes(cat);
                    return (
                      <button key={cat} onClick={() => toggleCat(step === 'cats_p' ? 'personal' : 'family', cat)}
                        className={cn('px-4 py-2 rounded-full text-sm border font-medium transition-all', selected ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-surface-container-low border-outline-variant/15 text-on-surface-variant')}>
                        {cat}
                      </button>
                    );
                  })}
                </div>
                <div className="text-xs text-on-surface-variant">נבחרו: <strong className="text-primary">{(step === 'cats_p' ? data.catsPersonal : data.catsFamily).length}</strong> קטגוריות</div>
              </div>
            )}

            {/* Currency */}
            {step === 'currency' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">מטבע</h1>
                <div className="space-y-2">
                  {Object.entries(CURRENCIES).map(([k, v]) => (
                    <button key={k} onClick={() => setData(d => ({ ...d, currency: k }))}
                      className={cn('w-full flex items-center justify-between p-4 rounded-xl border transition-all', data.currency === k ? 'border-primary/40 bg-primary/8' : 'border-outline-variant/15 bg-surface-container-low')}>
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

            {/* Goals */}
            {step === 'goals' && (
              <div className="space-y-4">
                <h1 className="text-2xl font-bold">כמעט סיימנו!</h1>
                <p className="text-on-surface-variant text-sm">ניתן להוסיף מטרות פיננסיות מאוחר יותר בהגדרות.</p>
                <div className="bg-primary/5 border border-primary/15 rounded-2xl p-6 text-center">
                  <div className="text-4xl mb-3">✦</div>
                  <h2 className="font-bold text-lg mb-2">הכל מוכן, {data.name}!</h2>
                  <p className="text-sm text-on-surface-variant">לחץ "סיים" כדי להתחיל לנהל את הכספים שלך</p>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {err && <div className="mt-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">{err}</div>}
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-4 border-t border-outline-variant/8 flex gap-3 flex-shrink-0">
        {stepIdx > 0 && (
          <button onClick={() => setStep(STEPS[stepIdx - 1])} className="px-5 py-3 border border-outline-variant/20 rounded-xl text-sm font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors flex items-center gap-2">
            <ChevronLeft size={16} /> חזור
          </button>
        )}
        <button onClick={nextStep} disabled={saving} className="flex-1 py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-60 hover:shadow-xl hover:shadow-primary/20 transition-all">
          {saving ? '⏳ שומר...' : isLast ? '✅ סיים והתחל!' : 'המשך →'}
        </button>
      </div>
    </div>
  );
};
