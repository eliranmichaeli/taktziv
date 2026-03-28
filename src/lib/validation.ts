// ── Input Validation & Sanitization Layer ────────────
// Fixes: CRIT-03 (No input validation), MED-02 (uid collision)
// All user-facing input must pass through these functions before
// being written to Firestore.

// ── Text sanitization ─────────────────────────────────
/** Strip characters that could cause XSS or injection. Max length enforced. */
export const sanitizeText = (s: unknown, maxLen = 100): string => {
  if (typeof s !== 'string') return '';
  return s
    .trim()
    .replace(/[<>"'`]/g, '')   // strip XSS chars
    .replace(/\\/g, '')         // strip backslashes
    .slice(0, maxLen);
};

export const sanitizeNote = (s: unknown): string => sanitizeText(s, 300);
export const sanitizeName = (s: unknown): string => sanitizeText(s, 80);
export const sanitizeCategory = (s: unknown): string => sanitizeText(s, 60);

// ── Amount validation ─────────────────────────────────
/** Returns sanitized amount or throws on invalid input. */
export const validateAmount = (raw: unknown, label = 'amount'): number => {
  const n = typeof raw === 'string' ? parseFloat(raw) : Number(raw);
  if (!isFinite(n) || isNaN(n))          throw new Error(`${label}: not a number`);
  if (n < 0)                              throw new Error(`${label}: must be positive`);
  if (n > 10_000_000)                     throw new Error(`${label}: exceeds maximum`);
  return Math.round(n * 100) / 100;       // max 2 decimal places
};

/** Returns 0 on invalid instead of throwing — for optional fields. */
export const safeAmount = (raw: unknown): number => {
  try { return validateAmount(raw); } catch { return 0; }
};

// ── Date validation ───────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const validateDate = (s: unknown): string => {
  if (typeof s !== 'string' || !DATE_RE.test(s))
    throw new Error('Invalid date format — expected YYYY-MM-DD');
  const d = new Date(s);
  if (isNaN(d.getTime())) throw new Error('Invalid date value');
  // Reject dates too far in the past or future
  const year = d.getFullYear();
  if (year < 2000 || year > 2100) throw new Error('Date out of acceptable range');
  return s;
};

export const safeDate = (s: unknown, fallback: string): string => {
  try { return validateDate(s); } catch { return fallback; }
};

// ── Month / Year validation ───────────────────────────
export const validateMonth = (m: unknown): number => {
  const n = Number(m);
  if (!Number.isInteger(n) || n < 0 || n > 11) throw new Error('Invalid month');
  return n;
};

export const validateYear = (y: unknown): number => {
  const n = Number(y);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) throw new Error('Invalid year');
  return n;
};

// ── Budget validation ─────────────────────────────────
export const validateBudget = (raw: unknown): number => {
  const n = safeAmount(raw);
  if (n > 1_000_000) throw new Error('Budget exceeds maximum (1,000,000)');
  return n;
};

// ── Password strength ─────────────────────────────────
export interface PasswordStrength {
  valid: boolean;
  score: number;   // 0–4
  message: string;
}

export const checkPassword = (p: string): PasswordStrength => {
  if (p.length < 8)     return { valid: false, score: 0, message: 'לפחות 8 תווים' };
  if (p.length < 10)    return { valid: false, score: 1, message: 'הוסף עוד תווים' };

  let score = 2;
  if (/[A-Z]/.test(p)) score++;
  if (/[0-9]/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;

  if (score < 3) return { valid: false, score, message: 'הוסף אותיות גדולות ומספרים' };
  return { valid: true, score, message: score >= 4 ? 'סיסמה חזקה' : 'סיסמה תקינה' };
};

// ── Crypto-safe UID ───────────────────────────────────
// Fixes: MED-02 (Math.random() collision risk)
export const secureUid = (): string => crypto.randomUUID();
