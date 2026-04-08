// src/lib/subscription.ts
// ניהול מצב מנוי — trial, active, expired

import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export type SubscriptionStatus = 'trial' | 'active' | 'expired' | 'cancelled';

export interface SubscriptionData {
  status:          SubscriptionStatus;
  trialStart:      string;   // ISO date
  trialEnd:        string;   // ISO date
  planActivatedAt?: string;
  planExpiresAt?:   string;
  payplusToken?:    string;  // recurring token מ-PayPlus
  payplusPageUid?:  string;
  lastPayment?:     string;
  nextPayment?:     string;
  cancelledAt?:     string;
  email?:           string;
}

const TRIAL_DAYS    = 30;
const ADMIN_EMAIL   = 'eliran1456@gmail.com';
const MONTHLY_PRICE = 5; // ₪

// ── Firestore helpers ─────────────────────────────────
const subRef = (uid: string) => doc(db, 'subscriptions', uid);

export async function getSubscription(uid: string): Promise<SubscriptionData | null> {
  const snap = await getDoc(subRef(uid));
  return snap.exists() ? (snap.data() as SubscriptionData) : null;
}

export async function createTrialSubscription(uid: string, email: string): Promise<SubscriptionData> {
  const now      = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + TRIAL_DAYS);

  const data: SubscriptionData = {
    status:     'trial',
    trialStart: now.toISOString(),
    trialEnd:   trialEnd.toISOString(),
    email,
  };

  await setDoc(subRef(uid), data);
  return data;
}

export async function activateSubscription(uid: string, payplusToken: string): Promise<void> {
  const now  = new Date();
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1);

  await updateDoc(subRef(uid), {
    status:          'active',
    planActivatedAt: now.toISOString(),
    nextPayment:     next.toISOString(),
    lastPayment:     now.toISOString(),
    payplusToken,
    cancelledAt:     null,
  });
}

export async function cancelSubscription(uid: string): Promise<void> {
  await updateDoc(subRef(uid), {
    status:      'cancelled',
    cancelledAt: new Date().toISOString(),
    payplusToken: null,
  });
}

// ── Client-side status check ──────────────────────────
export function getSubscriptionState(sub: SubscriptionData | null, email: string): {
  isAdmin:   boolean;
  canAccess: boolean;
  status:    SubscriptionStatus | 'admin';
  daysLeft:  number;
  isExpired: boolean;
} {
  // מנהל — גישה מלאה תמיד
  if (email === ADMIN_EMAIL) {
    return { isAdmin: true, canAccess: true, status: 'admin', daysLeft: 999, isExpired: false };
  }

  // אין מנוי כלל — צור trial
  if (!sub) {
    return { isAdmin: false, canAccess: true, status: 'trial', daysLeft: TRIAL_DAYS, isExpired: false };
  }

  const now = Date.now();

  // מנוי פעיל
  if (sub.status === 'active') {
    const nextPay = sub.nextPayment ? new Date(sub.nextPayment).getTime() : Infinity;
    const daysLeft = Math.max(0, Math.ceil((nextPay - now) / 86400000));
    return { isAdmin: false, canAccess: true, status: 'active', daysLeft, isExpired: false };
  }

  // בתקופת ניסיון
  if (sub.status === 'trial') {
    const trialEnd = new Date(sub.trialEnd).getTime();
    const daysLeft = Math.max(0, Math.ceil((trialEnd - now) / 86400000));
    const isExpired = now > trialEnd;
    return { isAdmin: false, canAccess: !isExpired, status: 'trial', daysLeft, isExpired };
  }

  // בוטל או פג
  return { isAdmin: false, canAccess: false, status: sub.status, daysLeft: 0, isExpired: true };
}

export { TRIAL_DAYS, MONTHLY_PRICE, ADMIN_EMAIL };
