import React, { useState, useEffect } from 'react';
import { Shield, CreditCard, CheckCircle, XCircle, Clock, Zap, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { auth } from '../../lib/firebase';
import {
  getSubscription, createTrialSubscription, cancelSubscription,
  getSubscriptionState, MONTHLY_PRICE, TRIAL_DAYS,
  type SubscriptionData,
} from '../../lib/subscription';
import { cn } from '../../lib/utils';

// ── Subscription Screen ────────────────────────────────
export const SubscriptionScreen: React.FC<{
  onContinue?: () => void;
}> = ({ onContinue }) => {
  const { user } = useApp();
  const [sub,      setSub]      = useState<SubscriptionData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [paying,   setPaying]   = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error,    setError]    = useState('');
  const [showCancel, setShowCancel] = useState(false);

  const email = user?.email || '';
  const state = getSubscriptionState(sub, email);

  useEffect(() => {
    if (!user) return;
    loadSub();
  }, [user]);

  const loadSub = async () => {
    if (!user) return;
    setLoading(true);
    try {
      let data = await getSubscription(user.uid);
      // אם אין מנוי — צור trial אוטומטית
      if (!data && email !== 'eliran1456@gmail.com') {
        data = await createTrialSubscription(user.uid, email);
      }
      setSub(data);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleSubscribe = async () => {
    if (!user) return;
    setPaying(true);
    setError('');
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch('/.netlify/functions/payplus', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ action: 'create_payment_link' }),
      });
      const data = await res.json() as any;
      if (!res.ok || !data.paymentUrl) throw new Error(data.error || 'שגיאה ביצירת קישור תשלום');
      // הפנה לדף התשלום של PayPlus
      window.location.href = data.paymentUrl;
    } catch (e: any) {
      setError(e.message);
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !sub?.payplusToken) return;
    setCancelling(true);
    setError('');
    try {
      const idToken = await auth.currentUser?.getIdToken(true);
      const res = await fetch('/.netlify/functions/payplus', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body:    JSON.stringify({ action: 'cancel_subscription', payplusToken: sub.payplusToken }),
      });
      if (!res.ok) throw new Error('שגיאה בביטול המנוי');
      await cancelSubscription(user.uid);
      await loadSub();
      setShowCancel(false);
    } catch (e: any) {
      setError(e.message);
    }
    setCancelling(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="text-on-surface-variant">טוען...</div>
    </div>
  );

  // מנהל — אין צורך במנוי
  if (state.isAdmin) return null;

  // מנוי פעיל — הצג סטטוס בלבד
  if (state.status === 'active') {
    return (
      <div className="max-w-md mx-auto p-6 space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 text-center">
          <CheckCircle className="text-primary mx-auto mb-3" size={40} />
          <h2 className="text-xl font-bold mb-1">המנוי פעיל</h2>
          <p className="text-sm text-on-surface-variant">
            החיוב הבא: ₪{MONTHLY_PRICE} ב-{sub?.nextPayment ? new Date(sub.nextPayment).toLocaleDateString('he-IL') : ''}
          </p>
        </div>
        {sub?.payplusToken && (
          <button onClick={() => setShowCancel(true)}
            className="w-full py-3 text-error text-sm font-medium hover:bg-error/5 rounded-xl transition-colors">
            בטל מנוי
          </button>
        )}

        {/* dialog ביטול */}
        <AnimatePresence>
          {showCancel && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4">
              <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                className="bg-surface rounded-2xl p-6 max-w-sm w-full border border-outline-variant/10 shadow-2xl">
                <AlertTriangle className="text-error mx-auto mb-3" size={32} />
                <h3 className="text-lg font-bold text-center mb-2">לבטל את המנוי?</h3>
                <p className="text-sm text-on-surface-variant text-center mb-5">
                  הגישה תיחסם מיידית. תוכל להירשם מחדש בכל עת.
                </p>
                {error && <p className="text-error text-sm text-center mb-3">{error}</p>}
                <div className="flex gap-3">
                  <button onClick={() => setShowCancel(false)}
                    className="flex-1 py-2.5 bg-surface-container-high text-on-surface rounded-xl font-medium text-sm">
                    שמור מנוי
                  </button>
                  <button onClick={handleCancel} disabled={cancelling}
                    className="flex-1 py-2.5 bg-error text-white rounded-xl font-bold text-sm disabled:opacity-50">
                    {cancelling ? '...' : 'בטל מנוי'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // מסך תשלום — trial הסתיים או בוטל
  const isExpired = state.isExpired || state.status === 'cancelled';

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-5">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-primary font-black text-xl">₪</span>
          </div>
          <h1 className="text-2xl font-black text-on-surface">
            {isExpired ? 'תקופת הניסיון הסתיימה' : `${state.daysLeft} ימי ניסיון נותרים`}
          </h1>
          <p className="text-on-surface-variant text-sm mt-2">
            {isExpired
              ? 'כדי להמשיך להשתמש באפליקציה, יש לרכוש מנוי'
              : 'הירשם עכשיו ותמשיך ליהנות מכל הפיצ\'רים'}
          </p>
        </div>

        {/* Trial status */}
        {!isExpired && (
          <div className="bg-surface-container-low rounded-2xl p-4 border border-outline-variant/8 flex items-center gap-3">
            <Clock className="text-primary flex-shrink-0" size={20} />
            <div>
              <div className="text-sm font-bold">תקופת ניסיון חינמית</div>
              <div className="text-xs text-on-surface-variant">
                נסתיימת ב-{sub?.trialEnd ? new Date(sub.trialEnd).toLocaleDateString('he-IL') : ''}
              </div>
            </div>
            <div className="ms-auto text-2xl font-black text-primary">{state.daysLeft}</div>
          </div>
        )}

        {/* Price card */}
        <div className="bg-surface-container-low rounded-2xl p-6 border border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 start-0 end-0 h-1 bg-primary" />
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-bold text-lg">מנוי חודשי</div>
              <div className="text-xs text-on-surface-variant">חיוב חודשי, ביטול בכל עת</div>
            </div>
            <div className="text-end">
              <div className="text-3xl font-black text-primary">₪{MONTHLY_PRICE}</div>
              <div className="text-xs text-on-surface-variant">/חודש</div>
            </div>
          </div>

          {/* Features */}
          <div className="space-y-2.5">
            {[
              'כל הפיצ\'רים — ללא הגבלה',
              'יועץ AI חכם',
              'מבט שנתי + חגים',
              'עצמאות כלכלית',
              'חשבון משפחתי + בן/בת זוג',
              'ייבוא Excel',
              'ביטול מיידי — בלי קנסות',
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm">
                <CheckCircle size={15} className="text-primary flex-shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm text-center">
            {error}
          </div>
        )}

        {/* CTA */}
        <button onClick={handleSubscribe} disabled={paying}
          className="w-full py-4 bg-primary text-on-primary rounded-2xl font-black text-base disabled:opacity-60 hover:shadow-2xl hover:shadow-primary/30 transition-all flex items-center justify-center gap-2.5">
          <CreditCard size={20} />
          {paying ? 'מעביר לדף תשלום...' : 'הירשם — ₪5 לחודש'}
        </button>

        <p className="text-center text-xs text-on-surface-variant">
          תשלום מאובטח באמצעות PayPlus · SSL מוצפן
        </p>

        {/* skip for trial users */}
        {!isExpired && onContinue && (
          <button onClick={onContinue} className="w-full text-center text-xs text-on-surface-variant hover:text-on-surface transition-colors py-2">
            המשך לאפליקציה בינתיים
          </button>
        )}
      </motion.div>
    </div>
  );
};

// ── Subscription Banner (in-app) ───────────────────────
export const SubscriptionBanner: React.FC = () => {
  const { user, setTab } = useApp();
  const [sub, setSub]     = useState<SubscriptionData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  const email = user?.email || '';
  const state = getSubscriptionState(sub, email);

  useEffect(() => {
    if (!user || email === 'eliran1456@gmail.com') return;
    getSubscription(user.uid).then(setSub);
  }, [user]);

  if (dismissed || state.isAdmin || state.status === 'active') return null;
  if (state.daysLeft > 7) return null; // הצג רק כשנשארו פחות מ-7 ימים

  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className={cn(
        'fixed top-14 start-[200px] end-0 z-30 px-4 py-2.5 flex items-center justify-between text-sm',
        state.daysLeft <= 2 ? 'bg-error/90 text-white' : 'bg-tertiary/90 text-on-surface'
      )}>
      <span>
        {state.daysLeft === 0
          ? '⚠️ תקופת הניסיון הסתיימה'
          : `⏰ נשארו ${state.daysLeft} ימי ניסיון`}
      </span>
      <div className="flex items-center gap-3">
        <button onClick={() => setTab('settings')}
          className="font-bold underline text-xs">
          רכוש מנוי — ₪5/חודש
        </button>
        <button onClick={() => setDismissed(true)} className="opacity-70 hover:opacity-100">✕</button>
      </div>
    </motion.div>
  );
};
