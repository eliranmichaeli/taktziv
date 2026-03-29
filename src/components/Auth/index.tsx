import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, User, Eye, EyeOff, CheckCircle, RefreshCw } from 'lucide-react';
import {
  authEmailSignIn, authEmailRegister, authGoogle, authForgot,
  authUpdateProfile, authSendVerification, auth,
} from '../../lib/firebase';
import { LANGS } from '../../lib/i18n';
import type { LangCode } from '../../types';
import { cn } from '../../lib/utils';

const ERR_MAP: Record<string, string> = {
  'auth/user-not-found':       'לא נמצא משתמש עם כתובת דוא"ל זו',
  'auth/wrong-password':       'כתובת הדוא"ל או הסיסמה שגויים',
  'auth/invalid-credential':   'כתובת הדוא"ל או הסיסמה שגויים',
  'auth/email-already-in-use': 'כתובת דוא"ל זו כבר רשומה — נסה להתחבר',
  'auth/weak-password':        'הסיסמה חלשה מדי — דרושים לפחות 6 תווים',
  'auth/too-many-requests':    'יותר מדי ניסיונות — נסה שוב מאוחר יותר',
  'auth/popup-closed-by-user': 'חלון הכניסה נסגר לפני שהפעולה הושלמה',
  'auth/account-exists-with-different-credential': 'כתובת הדוא"ל רשומה עם שיטת כניסה אחרת',
};

export const AuthScreen: React.FC = () => {
  const [mode,        setMode]       = useState<'login' | 'register' | 'forgot'>('login');
  const [email,       setEmail]      = useState('');
  const [password,    setPassword]   = useState('');
  const [fullName,    setFullName]   = useState('');
  const [showPass,    setShowPass]   = useState(false);
  const [consent,     setConsent]    = useState(false);
  const [loading,     setLoading]    = useState(false);
  const [error,       setError]      = useState('');
  const [langCode,    setLangCode]   = useState<LangCode>('he');
  const [forgotSent,  setForgotSent] = useState(false);

  // מצב אימות מייל
  const [verifyMode,   setVerifyMode]   = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // טיימר לcooldown
  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSubmit = async () => {
    setError('');
    if (!email || !password) { setError('נא למלא את כל השדות'); return; }
    if (mode === 'register' && !consent) { setError('נא לאשר קבלת עדכונים לצורך ההרשמה'); return; }
    setLoading(true);
    try {
      if (mode === 'login') {
        const cred = await authEmailSignIn(email, password);
        // אם מייל לא אומת — הצג מסך אימות
        if (!cred.user.emailVerified) {
          setVerifyMode(true);
          setLoading(false);
          return;
        }
      } else {
        // הרשמה — שלח מייל אימות
        const cred = await authEmailRegister(email, password);
        if (fullName) await authUpdateProfile(cred.user, fullName);
        await authSendVerification(cred.user);
        setVerifyMode(true);
        startCooldown();
      }
    } catch (e: any) {
      setError(ERR_MAP[e.code] || e.message || 'שגיאה לא ידועה');
    }
    setLoading(false);
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !auth.currentUser) return;
    setLoading(true);
    try {
      await authSendVerification(auth.currentUser);
      startCooldown();
    } catch (e: any) {
      setError(ERR_MAP[e.code] || e.message);
    }
    setLoading(false);
  };

  const handleCheckVerified = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    await auth.currentUser.reload();
    if (!auth.currentUser.emailVerified) {
      setError('המייל עדיין לא אומת — בדוק את תיבת הדוא"ל שלך');
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setError('');
    setLoading(true);
    try {
      await authGoogle();
      // Google מאמת אוטומטית — אין צורך במסך אימות
    } catch (e: any) {
      setError(ERR_MAP[e.code] || e.message);
    }
    setLoading(false);
  };

  const handleForgot = async () => {
    if (!email) { setError('הזן כתובת דוא"ל תחילה'); return; }
    setLoading(true);
    try {
      await authForgot(email);
      setForgotSent(true);
    } catch (e: any) {
      setError(ERR_MAP[e.code] || e.message);
    }
    setLoading(false);
  };

  // ── מסך אימות מייל ────────────────────────────────
  if (verifyMode) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-5">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 shadow-2xl text-center"
        >
          {/* אייקון */}
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Mail className="text-primary" size={32} />
          </div>

          <h2 className="text-xl font-black text-on-surface mb-2">אמת את כתובת המייל שלך</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed mb-2">
            שלחנו לינק אימות לכתובת:
          </p>
          <p className="text-sm font-bold text-primary mb-6 break-all">{email}</p>

          <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 mb-6 text-right space-y-2">
            <div className="flex items-start gap-2">
              <CheckCircle size={15} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-on-surface-variant">פתח את המייל שנשלח אליך</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={15} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-on-surface-variant">לחץ על הקישור לאימות</p>
            </div>
            <div className="flex items-start gap-2">
              <CheckCircle size={15} className="text-primary mt-0.5 flex-shrink-0" />
              <p className="text-xs text-on-surface-variant">חזור לכאן ולחץ "כבר אימתתי"</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">
              {error}
            </div>
          )}

          {/* כבר אימתתי */}
          <button
            onClick={handleCheckVerified}
            disabled={loading}
            className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-60 hover:shadow-xl hover:shadow-primary/20 transition-all mb-3"
          >
            {loading ? '...' : '✓ כבר אימתתי — כנס לאפליקציה'}
          </button>

          {/* שלח שוב */}
          <button
            onClick={handleResend}
            disabled={resendCooldown > 0 || loading}
            className="w-full py-2.5 bg-surface-container-high text-on-surface-variant rounded-xl text-sm font-medium disabled:opacity-50 transition-all flex items-center justify-center gap-2 mb-4"
          >
            <RefreshCw size={14} />
            {resendCooldown > 0 ? `שלח שוב בעוד ${resendCooldown} שניות` : 'שלח מייל אימות שוב'}
          </button>

          {/* חזרה */}
          <button
            onClick={() => { setVerifyMode(false); setError(''); setMode('login'); }}
            className="text-xs text-on-surface-variant hover:text-primary transition-colors"
          >
            חזרה למסך הכניסה
          </button>
        </motion.div>
      </div>
    );
  }

  // ── מסך כניסה/הרשמה רגיל ──────────────────────────
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm bg-surface-container-low rounded-2xl p-8 border border-outline-variant/10 shadow-2xl"
      >
        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-black text-sm">₪</span>
          </div>
          <div>
            <div className="font-bold text-lg text-on-surface">תקציב</div>
            <div className="text-xs text-on-surface-variant">ניהול חכם של הכסף שלך</div>
          </div>
        </div>

        {/* Lang selector */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {(Object.entries(LANGS) as [LangCode, typeof LANGS[LangCode]][]).map(([code, L]) => (
            <button
              key={code}
              onClick={() => setLangCode(code)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1',
                langCode === code
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
              )}
            >
              {L.flag} {L.name}
            </button>
          ))}
        </div>

        {/* Tabs */}
        {mode !== 'forgot' && (
          <div className="flex bg-surface-container-high rounded-xl p-1 mb-6">
            {(['login', 'register'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-semibold transition-all',
                  mode === m ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'
                )}
              >
                {m === 'login' ? 'התחברות' : 'הרשמה'}
              </button>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">
            {error}
          </div>
        )}

        {forgotSent ? (
          <div className="text-center py-4">
            <div className="text-3xl mb-3">✉</div>
            <p className="font-semibold">קישור לאיפוס נשלח!</p>
            <p className="text-xs text-on-surface-variant mt-1">בדוק את תיבת הדוא"ל שלך</p>
            <button onClick={() => { setForgotSent(false); setMode('login'); }} className="mt-4 text-primary text-sm font-medium">
              חזרה להתחברות
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {mode === 'register' && (
              <div className="relative">
                <User className="absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                <input
                  className="w-full ps-10 pe-4 py-3 bg-surface-container-high border-0 rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                  placeholder="שם מלא"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
              <input
                type="email"
                className="w-full ps-10 pe-4 py-3 bg-surface-container-high border-0 rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder='כתובת דוא"ל'
                value={email}
                onChange={e => setEmail(e.target.value)}
                dir="ltr"
              />
            </div>
            {mode !== 'forgot' && (
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={16} />
                <input
                  type={showPass ? 'text' : 'password'}
                  className="w-full ps-10 pe-10 py-3 bg-surface-container-high border-0 rounded-xl text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                  placeholder="סיסמה (לפחות 6 תווים)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                  dir="ltr"
                />
                <button onClick={() => setShowPass(!showPass)} className="absolute end-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            )}

            {mode === 'register' && (
              <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-primary/5 border border-primary/15 rounded-xl">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={e => setConsent(e.target.checked)}
                  className="mt-0.5 accent-primary w-4 h-4 flex-shrink-0"
                />
                <span className="text-xs text-on-surface-variant leading-relaxed">
                  אני מאשר/ת קבלת עדכונים ומידע על תכונות חדשות.
                  <span className="text-error font-bold"> * חובה</span>
                </span>
              </label>
            )}

            <button
              onClick={mode === 'forgot' ? handleForgot : handleSubmit}
              disabled={loading}
              className="w-full py-3.5 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-60 hover:shadow-xl hover:shadow-primary/20 transition-all"
            >
              {loading ? '...' : mode === 'login' ? 'התחבר' : mode === 'register' ? 'הירשם' : 'שלח קישור איפוס'}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-outline-variant/20" />
              <span className="text-xs text-on-surface-variant">או</span>
              <div className="flex-1 h-px bg-outline-variant/20" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading}
              className="w-full py-3 bg-surface-container-high border border-outline-variant/15 rounded-xl font-semibold text-sm text-on-surface hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2.5"
            >
              <svg width="16" height="16" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
                <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
                <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
                <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 6.294C4.672 4.169 6.656 3.58 9 3.58z"/>
              </svg>
              המשך עם Google
            </button>

            {mode === 'login' && (
              <button onClick={() => setMode('forgot')} className="w-full text-center text-xs text-on-surface-variant hover:text-primary transition-colors">
                שכחתי סיסמה
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};
