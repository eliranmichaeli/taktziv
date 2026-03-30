// netlify/functions/claude.ts
// גרסה פשוטה — אימות Firebase + rate limiting בלבד
// קרדיטים מנוהלים בצד הלקוח דרך Firestore

import type { Handler } from '@netlify/functions';

const RATE_LIMIT_MAX    = 20;
const RATE_LIMIT_WINDOW = 60 * 60 * 1000;
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

// אימות token עם Firebase REST API
async function verifyFirebaseToken(token: string): Promise<string | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    // אם אין API key — בדוק רק שה-token לא ריק (fallback פשוט)
    return token.length > 50 ? 'anonymous' : null;
  }
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ idToken: token }),
      }
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.users?.[0]?.localId ?? null;
  } catch {
    // אם הבדיקה נכשלת — נאפשר (fallback)
    return token.length > 50 ? 'unverified' : null;
  }
}

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  // בדוק token
  const token = (event.headers.authorization || event.headers.Authorization || '')
    .replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'נדרשת התחברות' }) };
  }

  const uid = await verifyFirebaseToken(token);
  if (!uid) {
    return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'פג תוקף ההתחברות — נסה להתחבר מחדש' }) };
  }

  // Rate limit
  if (!checkRateLimit(uid)) {
    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'יותר מדי בקשות — נסה שוב עוד שעה' }) };
  }

  // Parse body
  let body: { system?: string; messages?: unknown[]; max_tokens?: number };
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'בקשה לא תקינה' }) }; }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'שגיאת תצורת שרת — ANTHROPIC_API_KEY חסר' }) };
  }

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
        max_tokens: Math.min(body.max_tokens ?? 900, 1500),
        system:     body.system   ?? '',
        messages:   body.messages ?? [],
      }),
    });

    const data = await resp.json() as any;

    if (!resp.ok) {
      console.error('[claude fn] Anthropic error:', resp.status, data);
      return {
        statusCode: resp.status,
        headers:    corsHeaders,
        body:       JSON.stringify({ error: data?.error?.message ?? 'שגיאה בשירות AI' }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[claude fn] fetch error:', err);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'שגיאה בחיבור לשירות AI' }) };
  }
};
