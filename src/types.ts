// ── Account ──────────────────────────────────────────
export type AccountType = 'personal' | 'family_solo' | 'family';
export type ScopeType   = 'personal' | 'personal2' | 'family';
export type LangCode    = 'he' | 'en' | 'ru' | 'ar' | 'de' | 'fr';
export type SyncStatus  = 'online' | 'syncing' | 'offline';
export type ThemeMode   = 'light' | 'dark' | 'auto';
export type PaymentMethod = 'cash' | 'credit' | 'standing_order';

// ── Profile ──────────────────────────────────────────
export interface UserProfile {
  name: string;
  dob?: string;
  accountType: AccountType;
  partnerName?: string;
  hasSoloFamily?: boolean;
}

// ── Transactions ─────────────────────────────────────
export interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  type: ScopeType;
  note?: string;
  tag?: string;
  // תשלום
  paymentMethod?: PaymentMethod;
  cardId?: string;         // אם אשראי — איזה כרטיס
  cardName?: string;       // שם הכרטיס לתצוגה
  billingDay?: number;     // יום חיוב (אשראי / הוראת קבע)
  isStandingOrder?: boolean;
  standingOrderExpiry?: string; // תוקף הוראת קבע YYYY-MM-DD
}

export interface VariableExpense {
  id: string;
  name: string;
  amount: number;
  currency: string;
  category: string;
  type: ScopeType;
  month: number;
  year: number;
  date: string;
  note?: string;
  tag?: string;
  paymentType?: 'one_time' | 'installments';
  installments?: number;
  // תשלום
  paymentMethod?: PaymentMethod;
  cardId?: string;
  cardName?: string;
  billingDay?: number;
  isStandingOrder?: boolean;
  standingOrderExpiry?: string;
}

export interface Income {
  id: string;
  name: string;
  amount: number;
  currency: string;
  type: ScopeType;
  month: number;
  year: number;
  incomeType?: string;
  note?: string;
}

// ── Credit Cards ─────────────────────────────────────
export interface CreditCard {
  id: string;
  name: string;
  last4?: string;
  billingDay: number;
  limit?: number;         // מסגרת אשראי (אופציונלי)
  scope?: ScopeType;      // שיוך למשתמש
}

// ── Savings ──────────────────────────────────────────
export interface SavingsDeposit {
  id: string;
  amount: number;
  date: string;
  note?: string;
}

export interface SavingsPlan {
  id: string;
  name: string;
  stype: ScopeType;
  monthly?: number;
  target?: number;
  startDate: string;
  endDate?: string;
  extra?: number;
  deposits?: SavingsDeposit[];
}

// ── Budget ───────────────────────────────────────────
export interface Budget {
  personal: number;
  personal2?: number;
  family: number;
  personalYearly?: number;
  familyYearly?: number;
  startDay?: number;
  rollover?: boolean;
  monthOverrides?: Record<string, { personal?: number; family?: number }>;
}

// ── Annual Events ────────────────────────────────────
export type EventCategory = 'TRAVEL' | 'HEALTH' | 'EDUCATION' | 'HOME' | 'FAMILY' | 'INSURANCE' | 'TAX' | 'OTHER';

export interface AnnualEvent {
  id: string;
  title: string;
  description?: string;
  month: number;
  year: number;
  estimatedCost: number;
  category: EventCategory;
  scope: ScopeType;
}

// ── Financial Goals ──────────────────────────────────
export interface FinancialGoals {
  monthlySavingTarget?: number;
  monthlyBudget?: number;
  emergencyFund?: boolean;
  debtFree?: boolean;
  yearlyTarget?: number;
  notes?: string;
}

// ── Settings ─────────────────────────────────────────
export interface AppSettings {
  profile: UserProfile;
  currency: string;
  partnerCurrency?: string;
  budget: Budget;
  cats: {
    personal: string[];
    family: string[];
    personal2?: string[];
  };
  incomeTypes: string[];
  goals: Record<string, number>;
  financialGoals?: FinancialGoals;
  emergencyFunds?: {
    personal?: number;
    personal2?: number;
    family?: number;
  };
  theme?: ThemeMode;
  onboardingDone?: boolean;
  lastEmergencyAlert?: number; // timestamp של התראה אחרונה
}

// ── Full DB Structure ─────────────────────────────────
export interface AppDB {
  settings: AppSettings;
  fixed: {
    personal:  FixedExpense[];
    personal2: FixedExpense[];
    family:    FixedExpense[];
  };
  variable:    VariableExpense[];
  incomes:     Income[];
  savings:     SavingsPlan[];
  creditCards: CreditCard[];
  tasks:       Record<string, { tasks: Task[]; goals: GoalItem[] }>;
  annualEvents?: AnnualEvent[];
}

export interface Task     { id: string; text: string; done: boolean }
export interface GoalItem { id: string; text: string; done: boolean }

// ── UI State ─────────────────────────────────────────
export type TabId =
  | 'dashboard' | 'personal' | 'personal2' | 'family'
  | 'cashflow' | 'savings' | 'annual' | 'advisor'
  | 'freedom' | 'income' | 'settings' | 'admin';

export interface AppState {
  tab:   TabId;
  month: number;
  year:  number;
  lang:  LangCode;
}

// ── AI Advisor ───────────────────────────────────────
export interface ChatMessage {
  role: 'user' | 'ai';
  text: string;
}
