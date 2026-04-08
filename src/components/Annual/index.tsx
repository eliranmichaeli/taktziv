import { t } from '../../lib/i18n';
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Plus, Pencil, Trash2, X, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../../context/AppContext';
import {
  totalInc, totalExp, fixedTotal, varTotal,
  getCurrencySymbol, MONTHS_HE, MONTHS_EN, uid,
} from '../../lib/calculations';
import type { AnnualEvent, EventCategory, ScopeType } from '../../types';
import { cn } from '../../lib/utils';

interface Holiday { name: string; month: number; day: number; tip: string; urgency: 'high'|'medium'|'low' }

const JEWISH_HOLIDAYS: Holiday[] = [
  { name:'ראש השנה',     month:8,  day:1,  urgency:'high',   tip:'הכן תקציב לחגיגות, מתנות, ביגוד ואוכל' },
  { name:'יום כיפור',    month:8,  day:10, urgency:'low',    tip:'יום צום — אך כדאי לתכנן ארוחה גדולה לפני' },
  { name:'סוכות',        month:8,  day:15, urgency:'high',   tip:'עלות סוכה, ארבעת המינים ואירוח' },
  { name:'חנוכה',        month:11, day:25, urgency:'medium', tip:'מתנות לילדים, נרות ושמן' },
  { name:'פורים',        month:1,  day:14, urgency:'high',   tip:'תחפושות, משלוח מנות ומסיבות' },
  { name:'פסח',          month:2,  day:15, urgency:'high',   tip:'ניקיון, קניות לחג וליל הסדר' },
  { name:'יום העצמאות', month:3,  day:5,  urgency:'medium', tip:'טיולים, מנגל ובילויים משפחתיים' },
  { name:'שבועות',       month:4,  day:6,  urgency:'medium', tip:'עוגות גבינה ואירוח' },
];

const CHRISTIAN_HOLIDAYS: Holiday[] = [
  { name:'New Year',     month:0,  day:1,  urgency:'medium', tip:'Plan for celebrations and parties' },
  { name:"Valentine's",  month:1,  day:14, urgency:'medium', tip:'Gifts and dining out' },
  { name:'Easter',       month:2,  day:20, urgency:'high',   tip:'Gifts, family meals and travel' },
  { name:'Halloween',    month:9,  day:31, urgency:'medium', tip:'Costumes, candy and decorations' },
  { name:'Thanksgiving', month:10, day:24, urgency:'high',   tip:'Food, travel and family gatherings' },
  { name:'Christmas',    month:11, day:25, urgency:'high',   tip:'Gifts, decorations and celebrations' },
];

const AV_CATS: Record<EventCategory, { icon: string; label: string }> = {
  TRAVEL:    { icon:'✈', label:'נסיעות' },
  HEALTH:    { icon:'⚕', label:'בריאות' },
  EDUCATION: { icon:'◎', label:'חינוך' },
  HOME:      { icon:'⌂', label:'בית' },
  FAMILY:    { icon:'◈', label:'משפחה' },
  INSURANCE: { icon:'▦', label:'ביטוחים' },
  TAX:       { icon:'◫', label:'מסים' },
  OTHER:     { icon:'•', label:'אחר' },
};

const HolidayAlerts: React.FC<{ lang: string }> = ({ lang }) => {
  const isHebrew = lang === 'he' || lang === 'ar';
  const holidays = isHebrew ? JEWISH_HOLIDAYS : CHRISTIAN_HOLIDAYS;
  const now      = new Date();

  const upcoming = holidays
    .map(h => {
      const hDate = new Date(now.getFullYear(), h.month, h.day);
      const diff  = Math.ceil((hDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return { ...h, daysUntil: diff, exactDate: hDate };
    })
    .filter(h => h.daysUntil >= 0 && h.daysUntil <= 90)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 3);

  if (!upcoming.length) return null;

  return (
    <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-outline-variant/8">
        <Bell size={15} className="text-primary" />
        <span className="font-semibold text-sm">{t(lang,'upcomingHolidays')}</span>
      </div>
      <div className="divide-y divide-outline-variant/5">
        {upcoming.map((h, i) => {
          const color   = h.daysUntil <= 14 ? 'text-error' : h.daysUntil <= 30 ? 'text-tertiary' : 'text-secondary';
          const bg      = h.daysUntil <= 14 ? 'bg-error/5' : h.daysUntil <= 30 ? 'bg-tertiary/5' : '';
          const days    = h.daysUntil === 0 ? (isHebrew ? 'היום!' : 'Today!')
                        : h.daysUntil === 1 ? (isHebrew ? 'מחר'   : 'Tomorrow')
                        : isHebrew ? `עוד ${h.daysUntil} ימים` : `In ${h.daysUntil} days`;
          const dateStr = h.exactDate.toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });
          return (
            <div key={i} className={cn('px-5 py-3.5 flex items-start gap-3', bg)}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-on-surface">{h.name}</span>
                  <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', color,
                    h.daysUntil <= 14 ? 'bg-error/10' : h.daysUntil <= 30 ? 'bg-tertiary/10' : 'bg-secondary/10')}>
                    {days}
                  </span>
                  <span className="text-[11px] font-medium text-on-surface-variant">{dateStr}</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {h.urgency === 'high' ? 'הוצאה גבוהה' : h.urgency === 'medium' ? 'הוצאה בינונית' : 'הוצאה נמוכה'}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{h.tip}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface EventFormProps { event?: AnnualEvent; scope: ScopeType; year: number; onClose: () => void }

const EventForm: React.FC<EventFormProps> = ({ event, scope, year, onClose }) => {
  const { updateDB } = useApp();
  const [title,    setTitle]    = useState(event?.title       || '');
  const [desc,     setDesc]     = useState(event?.description || '');
  const [month,    setMonth]    = useState(event?.month       ?? new Date().getMonth());
  const [cost,     setCost]     = useState(String(event?.estimatedCost || ''));
  const [category, setCategory] = useState<EventCategory>(event?.category || 'OTHER');

  const handleSave = async () => {
    if (!title.trim()) return;
    const entry: AnnualEvent = {
      id: event?.id || uid(), title: title.trim(), description: desc,
      month, year, estimatedCost: parseFloat(cost) || 0, category, scope,
    };
    await updateDB(d => ({
      ...d,
      annualEvents: event
        ? (d.annualEvents || []).map(e => e.id === entry.id ? entry : e)
        : [...(d.annualEvents || []), entry],
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
          <h2 className="text-lg font-bold">{event ? 'עריכת' : 'הוסף'} אירוע</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <input className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="שם האירוע" value={title} onChange={e => setTitle(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">חודש</label>
              <select className="w-full bg-surface-container-low border-0 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-primary/30" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                {MONTHS_HE.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] text-on-surface-variant font-medium block mb-1">עלות משוערת (₪)</label>
              <input type="number" className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30" placeholder="0" value={cost} onChange={e => setCost(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-on-surface-variant font-medium block mb-1.5">קטגוריה</label>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(AV_CATS) as [EventCategory, typeof AV_CATS[EventCategory]][]).map(([k, v]) => (
                <button key={k} onClick={() => setCategory(k)} className={cn('px-3 py-1.5 rounded-full text-xs border transition-all flex items-center gap-1.5', category === k ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/15 text-on-surface-variant')}>
                  <span>{v.icon}</span>{v.label}
                </button>
              ))}
            </div>
          </div>
          <textarea className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/30 resize-none" rows={2} placeholder="הערות (אופציונלי)" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-3 bg-surface-container-high rounded-xl text-sm font-medium">ביטול</button>
          <button onClick={handleSave} disabled={!title.trim()} className="flex-1 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50">שמור</button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export const AnnualView: React.FC = () => {
  const { db, month: curMonth, year, lang, updateDB } = useApp();
  const sym    = getCurrencySymbol(db);
  const p      = db.settings.profile;
  const MONTHS = lang === 'he' ? MONTHS_HE : MONTHS_EN;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;

  const [scope,    setScope]  = useState<ScopeType>('personal');
  const [showForm, setForm]   = useState(false);
  const [editEvt,  setEdit]   = useState<AnnualEvent | undefined>();

  const events = (db.annualEvents || []).filter(e => e.year === year && e.scope === scope);
  const scopes: { id: ScopeType; label: string }[] = [
    { id: 'personal',  label: hasPartner ? p.name || 'אישי' : 'אישי' },
    ...(hasPartner ? [{ id: 'personal2' as ScopeType, label: p.partnerName || 'משתמש 2' }] : []),
    ...(isFamily   ? [{ id: 'family'    as ScopeType, label: 'משפחה' }] : []),
  ];

  const chartData = MONTHS.map((name, m) => {
    const inc     = totalInc(db, m, year);
    const exp     = totalExp(db, m, year);
    const evtCost = events.filter(e => e.month === m).reduce((s, e) => s + (e.estimatedCost || 0), 0);
    return { name: name.slice(0, 3), inc, exp: exp + evtCost, month: m };
  });

  const totalEvtCost = events.reduce((s, e) => s + (e.estimatedCost || 0), 0);
  const yearlyInc    = chartData.reduce((s, d) => s + d.inc, 0);
  const yearlyExp    = chartData.reduce((s, d) => s + d.exp, 0);

  const deleteEvent = (id: string) => {
    if (!confirm('למחוק אירוע?')) return;
    updateDB(d => ({ ...d, annualEvents: (d.annualEvents || []).filter(e => e.id !== id) }));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <HolidayAlerts lang={lang} />

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold">מבט שנתי — {year}</h1>
            <p className="text-xs text-on-surface-variant mt-0.5">תכנון תקציב שנתי ואירועים מיוחדים</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {scopes.map(s => (
              <button key={s.id} onClick={() => setScope(s.id)} className={cn('px-4 py-2 rounded-full text-xs font-medium border transition-all', scope === s.id ? 'border-primary/40 bg-primary/10 text-primary font-bold' : 'border-outline-variant/15 text-on-surface-variant')}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'הכנסה שנתית',     val: yearlyInc,               color: 'text-primary' },
            { label: 'הוצאות שוטפות',   val: yearlyExp - totalEvtCost, color: 'text-on-surface' },
            { label: 'אירועים מיוחדים', val: totalEvtCost,             color: 'text-tertiary' },
            { label: 'נטו שנתי',        val: yearlyInc - yearlyExp,    color: yearlyInc >= yearlyExp ? 'text-primary' : 'text-error' },
          ].map((kpi, i) => (
            <div key={i} className="bg-surface-container-high rounded-xl p-4">
              <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1.5">{kpi.label}</div>
              <div className={cn('text-xl font-black font-headline', kpi.color)}>
                {kpi.val < 0 ? '−' : ''}{sym}{Math.abs(Math.round(kpi.val)).toLocaleString('he-IL')}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
        <h3 className="font-semibold text-sm mb-5">תרשים שנתי — הכנסות מול הוצאות</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={12} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#bbcabf', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#bbcabf', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} width={40} />
              <Tooltip content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="bg-surface-container-highest border border-outline-variant/15 rounded-xl px-4 py-3 shadow-xl text-sm">
                    <div className="font-bold mb-2">{label}</div>
                    {payload.map((p: any) => (
                      <div key={p.name} className="text-xs flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                        <span className="text-on-surface-variant">{p.name}:</span>
                        <span style={{ color: p.color }}>{sym}{Math.round(p.value).toLocaleString('he-IL')}</span>
                      </div>
                    ))}
                  </div>
                );
              }} />
              <Bar dataKey="inc" name="הכנסות" fill="#4edea3" radius={[3,3,0,0]} />
              <Bar dataKey="exp" name="הוצאות" fill="#ffb3af" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-outline-variant/8">
          <div>
            <h3 className="font-bold">אירועים מיוחדים</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">חופשה, ביטוח שנתי, חגים ועוד</p>
          </div>
          <button onClick={() => { setEdit(undefined); setForm(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all">
            <Plus size={15} /> הוסף אירוע
          </button>
        </div>
        {events.length === 0 ? (
          <div className="text-center py-10 text-on-surface-variant text-sm">
            <div className="text-3xl mb-3 opacity-30">◫</div>
            אין אירועים מיוחדים — הוסף חופשה, ביטוח שנתי, רכישות גדולות וכו׳
          </div>
        ) : (
          <div className="p-5 space-y-3">
            {events.sort((a, b) => a.month - b.month).map(ev => {
              const cat    = AV_CATS[ev.category] || AV_CATS.OTHER;
              const isPast = ev.month < curMonth;
              return (
                <div key={ev.id} className={cn('flex items-center gap-4 p-4 rounded-xl group transition-colors', isPast ? 'opacity-50' : 'hover:bg-surface-container-high/40')}>
                  <div className="w-10 h-10 rounded-xl bg-surface-container-high flex items-center justify-center text-lg flex-shrink-0">{cat.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{ev.title}</div>
                    <div className="text-xs text-on-surface-variant mt-0.5">
                      {MONTHS[ev.month]} {year} · {cat.label}{ev.description ? ` · ${ev.description}` : ''}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold text-tertiary text-sm">{sym}{Math.round(ev.estimatedCost || 0).toLocaleString('he-IL')}</div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity flex-shrink-0">
                    <button onClick={() => { setEdit(ev); setForm(true); }} className="p-1.5 rounded-lg hover:bg-primary/10 hover:text-primary text-on-surface-variant transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => deleteEvent(ev.id)} className="p-1.5 rounded-lg hover:bg-error/10 hover:text-error text-on-surface-variant transition-colors"><Trash2 size={13} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <EventForm event={editEvt} scope={scope} year={year} onClose={() => { setForm(false); setEdit(undefined); }} />
        )}
      </AnimatePresence>
    </div>
  );
};
