import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { t } from '../../lib/i18n';
import {
  totalInc, totalExp, incTotal, fixedTotal, varTotal,
  getCurrencySymbol, getMonthBudget, MONTHS_HE, MONTHS_EN,
} from '../../lib/calculations';
import type { ScopeType } from '../../types';
import { cn } from '../../lib/utils';

// ── Custom Tooltip ────────────────────────────────────
const CustomTooltip: React.FC<any> = ({ active, payload, label, sym }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-surface-container-highest border border-outline-variant/15 rounded-xl px-4 py-3 shadow-xl text-sm">
      <div className="font-bold text-on-surface mb-2">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-on-surface-variant">{p.name}:</span>
          <span className="font-bold" style={{ color: p.color }}>
            {sym}{Math.round(p.value).toLocaleString('he-IL')}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number;
  prev?: number;
  sym: string;
  accent?: boolean;
}> = ({ label, value, prev, sym, accent }) => {
  const delta = prev !== undefined ? value - prev : 0;
  const pct   = prev && prev !== 0 ? Math.round((delta / Math.abs(prev)) * 100) : 0;
  return (
    <div className={cn(
      'rounded-2xl p-5 border border-outline-variant/5',
      accent ? 'bg-primary/6' : 'bg-surface-container-low'
    )}>
      <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">{label}</div>
      <div className={cn('text-2xl font-black font-headline tracking-tight', accent ? 'text-primary' : 'text-on-surface')}>
        {sym}{Math.round(Math.abs(value)).toLocaleString('he-IL')}
      </div>
      {prev !== undefined && (
        <div className={cn(
          'flex items-center gap-1 mt-2 text-xs font-medium',
          delta > 0 ? 'text-error' : delta < 0 ? 'text-primary' : 'text-on-surface-variant'
        )}>
          {delta > 0 ? <TrendingUp size={12} /> : delta < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
          <span>{Math.abs(pct)}% מהחודש הקודם</span>
        </div>
      )}
    </div>
  );
};

// ── Main Cashflow ─────────────────────────────────────
export const Cashflow: React.FC = () => {
  const { db, month, year, lang } = useApp();
  const sym    = getCurrencySymbol(db);
  const p      = db.settings.profile;
  const isFamily   = p.accountType !== 'personal';
  const hasPartner = p.accountType === 'family' && !!p.partnerName;
  const MONTHS = lang === 'he' ? MONTHS_HE : MONTHS_EN;

  const [view, setView] = useState<'bar' | 'line'>('bar');

  const scopes: ScopeType[] = [
    'personal',
    ...(hasPartner ? ['personal2' as ScopeType] : []),
    ...(isFamily   ? ['family'    as ScopeType] : []),
  ];

  // Build 12-month data for current year
  const yearData = MONTHS.map((name, m) => {
    const inc = totalInc(db, m, year);
    const exp = totalExp(db, m, year);
    const net = inc - exp;
    const bud = getMonthBudget(db, 'personal', m, year) + getMonthBudget(db, 'family', m, year);
    return { name: name.slice(0, 3), inc, exp, net, bud, month: m };
  });

  // Current month stats
  const curInc  = totalInc(db, month, year);
  const curExp  = totalExp(db, month, year);
  const prevM   = month === 0 ? 11 : month - 1;
  const prevY   = month === 0 ? year - 1 : year;
  const prevExp = totalExp(db, prevM, prevY);
  const curNet  = curInc - curExp;

  // YTD
  const ytdInc  = yearData.slice(0, month + 1).reduce((s, d) => s + d.inc, 0);
  const ytdExp  = yearData.slice(0, month + 1).reduce((s, d) => s + d.exp, 0);
  const ytdNet  = ytdInc - ytdExp;

  // Category breakdown for current month
  const catMap: Record<string, number> = {};
  (db.variable || []).filter(e => e.month === month && e.year === year).forEach(e => {
    catMap[e.category] = (catMap[e.category] || 0) + e.amount;
  });
  scopes.forEach(scope => {
    (db.fixed[scope] || []).forEach(e => {
      catMap[e.category] = (catMap[e.category] || 0) + e.amount;
    });
  });
  const topCats = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const totalCat = topCats.reduce((s, [, v]) => s + v, 0);

  const COLORS = ['#4edea3', '#c0c1ff', '#ffb3af', '#f6ad55', '#63b3ed'];

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={t(lang, 'income')}     value={curInc}  sym={sym} accent />
        <StatCard label={t(lang, 'expenses')}   value={curExp}  prev={prevExp} sym={sym} />
        <StatCard label={t(lang, 'balance')}    value={curNet}  sym={sym} />
        <div className="bg-surface-container-low rounded-2xl p-5 border border-outline-variant/5">
          <div className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">חיסכון מצטבר {year}</div>
          <div className={cn('text-2xl font-black font-headline', ytdNet >= 0 ? 'text-primary' : 'text-error')}>
            {ytdNet >= 0 ? '' : '−'}{sym}{Math.abs(Math.round(ytdNet)).toLocaleString('he-IL')}
          </div>
          <div className="text-xs text-on-surface-variant mt-2">
            הכנסות {sym}{Math.round(ytdInc).toLocaleString('he-IL')} / הוצאות {sym}{Math.round(ytdExp).toLocaleString('he-IL')}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-bold text-base">תזרים שנתי — {year}</h2>
            <p className="text-xs text-on-surface-variant mt-0.5">הכנסות מול הוצאות לאורך השנה</p>
          </div>
          <div className="flex gap-1.5">
            {(['bar', 'line'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  view === v
                    ? 'bg-primary/10 text-primary border border-primary/25'
                    : 'text-on-surface-variant hover:bg-surface-container-high'
                )}
              >
                {v === 'bar' ? 'עמודות' : 'קו'}
              </button>
            ))}
          </div>
        </div>

        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            {view === 'bar' ? (
              <BarChart data={yearData} barSize={14} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#bbcabf', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#bbcabf', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} width={45} />
                <Tooltip content={<CustomTooltip sym={sym} />} />
                <Bar dataKey="inc" name="הכנסות" fill="#4edea3" radius={[4,4,0,0]} />
                <Bar dataKey="exp" name="הוצאות" fill="#ffb3af" radius={[4,4,0,0]} />
              </BarChart>
            ) : (
              <LineChart data={yearData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: '#bbcabf', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#bbcabf', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${sym}${(v/1000).toFixed(0)}k`} width={45} />
                <Tooltip content={<CustomTooltip sym={sym} />} />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />
                <Line type="monotone" dataKey="inc" name="הכנסות" stroke="#4edea3" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="exp" name="הוצאות" stroke="#ffb3af" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="net" name="נטו" stroke="#c0c1ff" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex gap-5 mt-4 justify-center">
          {[
            { label: 'הכנסות', color: '#4edea3' },
            { label: 'הוצאות', color: '#ffb3af' },
            ...(view === 'line' ? [{ label: 'נטו', color: '#c0c1ff' }] : []),
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5 text-xs text-on-surface-variant">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} />
              {item.label}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom: categories + per-month table */}
      <div className="grid grid-cols-12 gap-5">
        {/* Category breakdown */}
        <div className="col-span-12 md:col-span-5 bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
          <h3 className="font-bold text-sm mb-5">הוצאות לפי קטגוריה — {MONTHS[month]}</h3>
          {topCats.length === 0 ? (
            <div className="text-on-surface-variant text-sm text-center py-6">אין הוצאות לחודש זה</div>
          ) : (
            <div className="space-y-3">
              {topCats.map(([cat, val], i) => {
                const pct = totalCat > 0 ? Math.round(val / totalCat * 100) : 0;
                return (
                  <div key={cat}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-on-surface font-medium">{cat}</span>
                      <span className="text-on-surface-variant">{sym}{Math.round(val).toLocaleString('he-IL')} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: COLORS[i % COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, delay: i * 0.08 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Monthly summary table */}
        <div className="col-span-12 md:col-span-7 bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/8">
            <h3 className="font-bold text-sm">סיכום חודשי — {year}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider border-b border-outline-variant/6">
                  <th className="px-5 py-3 text-right">חודש</th>
                  <th className="px-5 py-3 text-left">הכנסות</th>
                  <th className="px-5 py-3 text-left">הוצאות</th>
                  <th className="px-5 py-3 text-left">נטו</th>
                </tr>
              </thead>
              <tbody>
                {yearData.map((row, i) => {
                  const isCurrentMonth = i === month;
                  return (
                    <tr key={i} className={cn(
                      'border-b border-outline-variant/5 last:border-0 transition-colors',
                      isCurrentMonth ? 'bg-primary/5' : 'hover:bg-surface-container-high/40'
                    )}>
                      <td className={cn('px-5 py-3 font-medium', isCurrentMonth ? 'text-primary font-bold' : 'text-on-surface')}>
                        {row.name}
                        {isCurrentMonth && <span className="ms-2 text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">עכשיו</span>}
                      </td>
                      <td className="px-5 py-3 text-left font-medium text-primary">
                        {row.inc > 0 ? `${sym}${Math.round(row.inc).toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td className="px-5 py-3 text-left font-medium text-on-surface">
                        {row.exp > 0 ? `${sym}${Math.round(row.exp).toLocaleString('he-IL')}` : '—'}
                      </td>
                      <td className={cn('px-5 py-3 text-left font-bold', row.net >= 0 ? 'text-primary' : 'text-error')}>
                        {row.inc === 0 && row.exp === 0 ? '—' :
                          `${row.net >= 0 ? '+' : '−'}${sym}${Math.abs(Math.round(row.net)).toLocaleString('he-IL')}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
