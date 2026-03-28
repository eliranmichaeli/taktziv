import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { auth } from '../../lib/firebase'; // Fix: CRIT-05 — needed for getIdToken
import { t } from '../../lib/i18n';
import {
  totalInc, totalExp, fixedTotal, varTotal,
  incTotal, calcHealthScore, getCurrencySymbol,
  calcSavingsCurrent,
} from '../../lib/calculations';
import type { ChatMessage, ScopeType } from '../../types';
import { cn } from '../../lib/utils';

const SUGGESTIONS = [
  'איך אני עומד מבחינה פיננסית החודש?',
  'מה ההוצאה הגדולה ביותר שאפשר לצמצם?',
  'כמה חודשי מחייה יש לי בחיסכון?',
  'תן לי טיפ אחד להגדלת החיסכון',
  'איפה אני חורג מהתקציב?',
];

export const Advisor: React.FC = () => {
  const { db, month, year, lang } = useApp();
  const [messages,  setMessages]  = useState<ChatMessage[]>([]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [scope,     setScope]     = useState<'all' | ScopeType>('all');
  const messagesEnd = useRef<HTMLDivElement>(null);

  const sym        = getCurrencySymbol(db);
  const p          = db.settings.profile;
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const isFamily   = p.accountType !== 'personal';
  const health     = calcHealthScore(db, month, year);

  const scopes = [
    { id: 'all' as const,          label: 'כולם' },
    { id: 'personal' as ScopeType, label: hasPartner ? p.name || 'אישי' : 'אישי' },
    ...(hasPartner ? [{ id: 'personal2' as ScopeType, label: p.partnerName || 'משתמש 2' }] : []),
    ...(isFamily   ? [{ id: 'family'    as ScopeType, label: 'משפחה' }] : []),
  ];

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const buildContext = () => {
    const inc     = totalInc(db, month, year);
    const exp     = totalExp(db, month, year);
    const savings = (db.savings || []).map(s =>
      `${s.name}: נצבר ${sym}${Math.round(calcSavingsCurrent(s)).toLocaleString('he-IL')}${s.target ? ` מתוך ${sym}${s.target.toLocaleString('he-IL')}` : ''}`
    );
    const lines = [
      `חודש: ${month + 1}/${year}`,
      `ציון בריאות: ${health}/100`,
      `הכנסות: ${sym}${Math.round(inc).toLocaleString('he-IL')}`,
      `הוצאות: ${sym}${Math.round(exp).toLocaleString('he-IL')}`,
      `יתרה: ${sym}${Math.round(inc - exp).toLocaleString('he-IL')}`,
      `תקציב אישי: ${sym}${(db.settings.budget.personal || 0).toLocaleString('he-IL')}/חודש`,
      `תקציב משפחה: ${sym}${(db.settings.budget.family || 0).toLocaleString('he-IL')}/חודש`,
    ];
    if (savings.length) lines.push('חסכונות: ' + savings.join(' | '));
    if (scope !== 'all') {
      const sInc = incTotal(db, scope as ScopeType, month, year);
      const sExp = fixedTotal(db, scope as ScopeType) + varTotal(db, scope as ScopeType, month, year);
      lines.push(`פוקוס (${scope}): הכנסות ${sym}${Math.round(sInc).toLocaleString('he-IL')}, הוצאות ${sym}${Math.round(sExp).toLocaleString('he-IL')}`);
    }
    return lines.join('\n');
  };

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const system = `אתה יועץ פיננסי אישי חכם ומנוסה. ענה תמיד בעברית, בצורה ישירה ומבוססת נתונים.
לא תתן אזהרות משפטיות. תהיה ספציפי עם מספרים.
בסוף כל תשובה הוסף "המלצה מיידית:" עם פעולה אחת קונקרטית.
נתוני המשתמש:\n${buildContext()}`;

    const history = [...messages, userMsg]
      .slice(-8)
      .map(m => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.text }));

    try {
      // Fix: CRIT-05 — get Firebase ID token and send with request for server auth
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('לא מחובר — נסה להתחבר מחדש');

      const resp = await fetch('/.netlify/functions/claude', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${idToken}`,  // server verifies this
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 900, system, messages: history }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error ?? 'שגיאת שרת');
      const reply = data.content?.[0]?.text || 'לא הצלחתי לענות';
      setMessages(prev => [...prev, { role: 'ai', text: reply }]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'שגיאה לא ידועה';
      setMessages(prev => [...prev, { role: 'ai', text: `שגיאה: ${msg}` }]);
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-primary text-lg">✦</span>
        </div>
        <div className="flex-1">
          <div className="font-bold">יועץ פיננסי AI</div>
          <div className="text-xs text-on-surface-variant mt-0.5">
            ציון בריאות:{' '}
            <span className={cn('font-bold', health >= 70 ? 'text-primary' : health >= 50 ? 'text-secondary' : 'text-error')}>
              {health}/100
            </span>
          </div>
        </div>
        {/* Privacy notice */}
        <div className="text-[10px] text-on-surface-variant text-left max-w-[140px] leading-relaxed">
          נתונים פיננסיים מועברים ל-AI לצורך ניתוח בלבד
        </div>
      </div>

      {/* Scope selector */}
      <div className="flex gap-2 flex-wrap items-center">
        <span className="text-xs text-on-surface-variant">הצג נתונים של:</span>
        {scopes.map(s => (
          <button
            key={s.id}
            onClick={() => setScope(s.id)}
            className={cn(
              'px-4 py-2 rounded-full text-xs font-medium border transition-all',
              scope === s.id
                ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                : 'border-outline-variant/20 text-on-surface-variant hover:border-outline-variant/40'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 min-h-[200px]">
        {messages.length === 0 && (
          <div className="bg-surface-container-low rounded-2xl p-8 text-center border border-outline-variant/5">
            <div className="text-2xl mb-3 opacity-40">✦</div>
            <div className="font-semibold mb-2">היועץ הפיננסי שלך מוכן</div>
            <div className="text-sm text-on-surface-variant">שאל אותי כל שאלה על התקציב שלך</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn('flex', msg.role === 'user' ? 'justify-start' : 'justify-end')}
          >
            {msg.role === 'ai' && (
              <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 me-2 mt-1 text-xs text-primary">✦</div>
            )}
            <div className={cn(
              'max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line',
              msg.role === 'user'
                ? 'bg-surface-container-high text-on-surface rounded-tr-sm'
                : 'bg-primary/8 border border-primary/15 text-on-surface rounded-tl-sm'
            )}>
              {msg.text}
            </div>
          </motion.div>
        ))}
        {loading && (
          <div className="flex justify-end">
            <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 me-2 text-xs text-primary">✦</div>
            <div className="px-4 py-3 rounded-2xl bg-primary/8 border border-primary/15 text-primary text-sm">
              מנתח נתונים...
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Suggestions */}
      {messages.length < 2 && (
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              className="px-3 py-2 bg-surface-container-high hover:bg-surface-container-highest border border-outline-variant/10 rounded-full text-xs text-on-surface-variant hover:text-on-surface transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 p-3 bg-surface-container-low border border-outline-variant/10 rounded-2xl">
        <input
          className="flex-1 bg-transparent border-0 outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
          placeholder="שאל את היועץ הפיננסי שלך..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="w-9 h-9 rounded-xl bg-primary text-on-primary flex items-center justify-center disabled:opacity-40 hover:shadow-lg hover:shadow-primary/20 transition-all flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>

      {messages.length > 0 && (
        <button
          onClick={() => setMessages([])}
          className="self-end text-xs text-on-surface-variant hover:text-on-surface transition-colors"
        >
          נקה שיחה
        </button>
      )}
    </div>
  );
};
