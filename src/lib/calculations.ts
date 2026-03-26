import type { AppDB, ScopeType, SavingsPlan } from '../types';

// ── Currency ─────────────────────────────────────────
export const CURRENCIES: Record<string, { symbol: string; name: string; flag: string; rate: number }> = {
  ILS: { symbol: '₪', name: 'שקל', flag: '🇮🇱', rate: 1 },
  USD: { symbol: '$', name: 'Dollar', flag: '🇺🇸', rate: 0.27 },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺', rate: 0.25 },
  GBP: { symbol: '£', name: 'Pound', flag: '🇬🇧', rate: 0.21 },
};

export const getCurrencySymbol = (db: AppDB): string =>
  CURRENCIES[db.settings.currency || 'ILS']?.symbol ?? '₪';

export const toBase = (amount: number, currency: string, db: AppDB): number => {
  const base = db.settings.currency || 'ILS';
  if (currency === base) return amount;
  const from = CURRENCIES[currency];
  const to   = CURRENCIES[base];
  if (!from || !to) return amount;
  return (amount / from.rate) * to.rate;
};

// ── Fixed Expenses ────────────────────────────────────
export const fixedTotal = (db: AppDB, type: ScopeType): number =>
  (db.fixed[type] || []).reduce((s, e) => s + toBase(e.amount, e.currency, db), 0);

// ── Variable Expenses ─────────────────────────────────
export const varForMonth = (db: AppDB, type: ScopeType, month: number, year: number) =>
  (db.variable || []).filter(e => e.type === type && e.month === month && e.year === year);

export const varTotal = (db: AppDB, type: ScopeType, month: number, year: number): number =>
  varForMonth(db, type, month, year).reduce((s, e) => s + toBase(e.amount, e.currency, db), 0);

export const totalExp = (db: AppDB, month: number, year: number): number =>
  (['personal', 'personal2', 'family'] as ScopeType[]).reduce(
    (s, t) => s + fixedTotal(db, t) + varTotal(db, t, month, year), 0
  );

// ── Income ───────────────────────────────────────────
export const incTotal = (db: AppDB, type: ScopeType, month: number, year: number): number =>
  (db.incomes || [])
    .filter(e => e.type === type && e.month === month && e.year === year)
    .reduce((s, e) => s + toBase(e.amount, e.currency, db), 0);

export const totalInc = (db: AppDB, month: number, year: number): number =>
  (['personal', 'personal2', 'family'] as ScopeType[]).reduce(
    (s, t) => s + incTotal(db, t, month, year), 0
  );

export const balance = (db: AppDB, month: number, year: number): number =>
  totalInc(db, month, year) - totalExp(db, month, year);

// ── Budget ───────────────────────────────────────────
export const getMonthBudget = (db: AppDB, type: 'personal' | 'family', month: number, year: number): number => {
  const key = `${year}-${month}`;
  const override = db.settings.budget.monthOverrides?.[key];
  if (override?.[type] !== undefined) return override[type]!;
  return db.settings.budget[type] || 0;
};

// ── Budget Alerts ─────────────────────────────────────
export interface BudgetAlert {
  cat: string;
  spent: number;
  goal: number;
}

export const getAlerts = (db: AppDB, month: number, year: number): BudgetAlert[] => {
  return Object.entries(db.settings.goals || {})
    .filter(([, goal]) => goal > 0)
    .map(([cat, goal]) => {
      const spent =
        (db.variable || [])
          .filter(e => e.category === cat && e.month === month && e.year === year)
          .reduce((s, e) => s + toBase(e.amount, e.currency, db), 0) +
        (['personal', 'personal2', 'family'] as ScopeType[]).reduce(
          (s, t) =>
            s + (db.fixed[t] || [])
              .filter(e => e.category === cat)
              .reduce((ss, e) => ss + toBase(e.amount, e.currency, db), 0),
          0
        );
      return { cat, spent, goal };
    })
    .filter(a => a.spent >= a.goal * 0.9);
};

// ── Savings ──────────────────────────────────────────
export const calcSavingsCurrent = (plan: SavingsPlan): number => {
  const now   = new Date();
  const start = plan.startDate ? new Date(plan.startDate) : now;
  const elapsed = plan.endDate
    ? Math.max(0, Math.round((Math.min(now.getTime(), new Date(plan.endDate).getTime()) - start.getTime()) / (1000 * 60 * 60 * 24 * 30)))
    : (plan as any).months || 0;
  const fromMonthly  = (plan.monthly || 0) * elapsed;
  const fromDeposits = (plan.deposits || []).reduce((s, d) => s + d.amount, 0);
  return (plan.extra || 0) + fromMonthly + fromDeposits;
};

export interface SavingsWarning {
  msg: string;
  tip: string;
  requiredMonthly: number;
}

export const validateSavingsPlan = (plan: SavingsPlan): SavingsWarning | null => {
  if (!plan.target || !plan.endDate) return null;
  const start = new Date(plan.startDate || new Date());
  const end   = new Date(plan.endDate);
  const monthsAvail = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30)));
  const needed         = plan.target - (plan.extra || 0);
  const projectedTotal = (plan.monthly || 0) * monthsAvail;
  if (projectedTotal < needed) {
    const requiredMonthly = Math.ceil(needed / monthsAvail);
    return {
      msg: `תוכנית לא תשיג את היעד — תצבור ${Math.round(projectedTotal).toLocaleString('he-IL')} מתוך ${plan.target.toLocaleString('he-IL')}`,
      tip: `דרושה הפקדה חודשית של ${requiredMonthly.toLocaleString('he-IL')} (עוד ${(requiredMonthly - (plan.monthly || 0)).toLocaleString('he-IL')})`,
      requiredMonthly,
    };
  }
  return null;
};

// ── Compound Interest (Freedom Tab) ──────────────────
export interface CompoundResult {
  totalDeposits: number;
  grossFuture: number;
  netFuture: number;
  grossProfit: number;
  totalDepositFees: number;
  totalAccumFees: number;
  rule300gross: number;
  rule300net: number;
}

export const calcCompound = (
  initial: number,
  monthly: number,
  annualRate: number,
  years: number,
  feeDeposit: number, // %
  feeAccum: number    // %
): CompoundResult => {
  const months       = years * 12;
  const monthlyRate  = Math.pow(1 + annualRate / 100, 1 / 12) - 1;
  const monthlyFeeAccum  = Math.pow(1 + feeAccum / 100, 1 / 12) - 1;
  const monthlyDepositFee = monthly * (feeDeposit / 100);
  const effectiveMonthly = monthly - monthlyDepositFee;

  // Gross (no fees)
  let grossBalance  = initial;
  let totalDeposits = initial;
  for (let i = 0; i < months; i++) {
    grossBalance = grossBalance * (1 + monthlyRate) + monthly;
    totalDeposits += monthly;
  }

  // Net (with fees)
  let netBalance       = initial;
  let totalDepositFees = 0;
  for (let i = 0; i < months; i++) {
    netBalance = netBalance * (1 + monthlyRate - monthlyFeeAccum) + effectiveMonthly;
    totalDepositFees += monthlyDepositFee;
  }

  const grossProfit    = grossBalance - totalDeposits;
  const totalAccumFees = Math.max(0, grossBalance - netBalance - totalDepositFees);

  return {
    totalDeposits,
    grossFuture: grossBalance,
    netFuture:   netBalance,
    grossProfit,
    totalDepositFees,
    totalAccumFees,
    rule300gross: Math.round(grossBalance / 300),
    rule300net:   Math.round(netBalance / 300),
  };
};

// ── Health Score ──────────────────────────────────────
export const calcHealthScore = (db: AppDB, month: number, year: number): number => {
  const inc = totalInc(db, month, year);
  const exp = totalExp(db, month, year);
  const bud = getMonthBudget(db, 'personal', month, year) + getMonthBudget(db, 'family', month, year);
  const sav = (db.savings || []).reduce((s, x) => s + (x.monthly || 0), 0);

  let score = 50;
  if (inc > 0) {
    const savRate = sav / inc;
    if (savRate >= 0.2) score += 20;
    else if (savRate >= 0.1) score += 12;
    else if (savRate > 0) score += 5;
    const bal = (inc - exp) / inc;
    if (bal >= 0.3) score += 10;
    else if (bal >= 0.1) score += 5;
    else if (bal < 0) score -= 15;
  }
  if (bud > 0) {
    const used = exp / bud;
    if (used <= 0.8) score += 20;
    else if (used <= 1.0) score += 10;
    else score -= 15;
  }
  if ((db.savings || []).length > 0) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
};

// ── Formatting ────────────────────────────────────────
export const fmt = (amount: number, symbol: string, locale = 'he-IL'): string =>
  `${symbol}${Math.round(Math.abs(amount)).toLocaleString(locale)}`;

export const fmtSigned = (amount: number, symbol: string): string =>
  `${amount >= 0 ? '+' : '−'}${symbol}${Math.round(Math.abs(amount)).toLocaleString('he-IL')}`;

// ── Date helpers ──────────────────────────────────────
export const today = (): string => new Date().toISOString().split('T')[0];
export const uid   = (): string => 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);

export const MONTHS_HE = ['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'];
export const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December'];
