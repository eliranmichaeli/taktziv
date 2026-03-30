// netlify/functions/claude.ts
// מערכת קרדיטים: כל משתמש מקבל 10 שאלות חינם בחודש
// מנהל (eliran1456@gmail.com) יכול להוסיף קרדיטים

import type { Handler } from '@netlify/functions';

const ADMIN_EMAIL       = 'eliran1456@gmail.com';
const FREE_MONTHLY      = 10;   // שאלות חינם לחודש
const RATE_LIMIT_MAX    = 30;   // מקסימום בשעה
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;

// Rate limit in-memory
const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(uid: string): boolean {
  const now   = Date.now();
  const entry = rateMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// אימות Firebase token
async function verifyToken(token: string): Promise<{ uid: string; email: string } | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { users?: { localId: string; email: string }[] };
    const user = data.users?.[0];
    return user ? { uid: user.localId, email: user.email } : null;
  } catch { return null; }
}

// קריאת/כתיבת קרדיטים מ-Firestore
async function getCredits(uid: string): Promise<{ used: number; extra: number; month: string }> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token     = process.env.FIREBASE_SERVICE_TOKEN || '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/credits/${uid}`;
  try {
    const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { used: 0, extra: 0, month: '' };
    const data = await res.json() as any;
    const f    = data.fields || {};
    return {
      used:  parseInt(f.used?.integerValue  || '0'),
      extra: parseInt(f.extra?.integerValue || '0'),
      month: f.month?.stringValue || '',
    };
  } catch { return { used: 0, extra: 0, month: '' }; }
}

async function updateCredits(uid: string, used: number, extra: number, month: string): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const token     = process.env.FIREBASE_SERVICE_TOKEN || '';
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/credits/${uid}`;
  try {
    await fetch(url, {
      method:  'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          used:  { integerValue: String(used) },
          extra: { integerValue: String(extra) },
          month: { stringValue: month },
        },
      }),
    });
  } catch {}
}

export const handler: Handler = async (event) => {
  const origin = event.headers.origin || '*';
  const corsHeaders = {
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };
  }

  // אימות
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'נדרשת התחברות' }) };

  const user = await verifyToken(token);
  if (!user) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'טוקן לא תקין — נסה להתחבר מחדש' }) };

  // Rate limit
  if (!checkRateLimit(user.uid)) {
    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'יותר מדי בקשות — נסה שוב עוד שעה' }) };
  }

  // בדיקת קרדיטים
  const now       = new Date();
  const curMonth  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  let credits     = await getCredits(user.uid);

  // אפס בתחילת חודש חדש
  if (credits.month !== curMonth) {
    credits = { used: 0, extra: credits.extra, month: curMonth };
  }

  const freeLeft  = Math.max(0, FREE_MONTHLY - credits.used);
  const extraLeft = credits.extra;
  const totalLeft = freeLeft + extraLeft;

  if (totalLeft <= 0) {
    return {
      statusCode: 402,
      headers: corsHeaders,
      body: JSON.stringify({
        error:    `נגמרו הקרדיטים החודשיים (${FREE_MONTHLY} שאלות חינם).`,
        code:     'NO_CREDITS',
        freeLeft: 0,
        extraLeft,
      }),
    };
  }

  // Parse body
  let body: { system?: string; messages?: unknown[] };
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'בקשה לא תקינה' }) }; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'שגיאת תצורת שרת' }) };

  // קריאה ל-Anthropic
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens: 1000,
        system:     body.system   ?? '',
        messages:   body.messages ?? [],
      }),
    });

    const data = await resp.json() as any;
    if (!resp.ok) {
      return { statusCode: resp.status, headers: corsHeaders, body: JSON.stringify({ error: data?.error?.message ?? 'שגיאת שרת' }) };
    }

    // עדכן קרדיטים
    const newUsed  = credits.used + 1;
    const newExtra = freeLeft > 0 ? extraLeft : Math.max(0, extraLeft - 1);
    await updateCredits(user.uid, newUsed, newExtra, curMonth);

    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Content-Type':          'application/json',
        'X-Credits-Free-Left':   String(Math.max(0, FREE_MONTHLY - newUsed)),
        'X-Credits-Extra-Left':  String(newExtra),
      },
      body: JSON.stringify({
        ...data,
        _credits: {
          freeLeft:  Math.max(0, FREE_MONTHLY - newUsed),
          extraLeft: newExtra,
          total:     Math.max(0, FREE_MONTHLY - newUsed) + newExtra,
        },
      }),
    };
  } catch (err) {
    console.error('[claude fn]', err);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'שגיאה בחיבור לשירות AI' }) };
  }
};
