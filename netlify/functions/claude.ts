// netlify/functions/claude.ts
// Fix: CRIT-04 — Added per-user rate limiting (20 req/hour)
// Fix: CRIT-05 — Added Firebase ID token verification (auth required)
//
// Required env vars in Netlify dashboard:
//   ANTHROPIC_API_KEY   — Anthropic API key (server-side only, never VITE_ prefix)
//   FIREBASE_PROJECT_ID — your Firebase project ID

import type { Handler, HandlerEvent } from '@netlify/functions';

// ── In-memory rate limiter ────────────────────────────
// Note: Netlify Functions are stateless — this resets on cold starts.
// For production, replace with Redis/Upstash for persistent rate limiting.
const RATE_LIMIT_MAX      = 20;   // requests
const RATE_LIMIT_WINDOW   = 60 * 60 * 1000; // 1 hour in ms

interface RateEntry { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateEntry>();

function checkRateLimit(uid: string): { allowed: boolean; remaining: number } {
  const now    = Date.now();
  const entry  = rateLimitMap.get(uid);

  if (!entry || now > entry.resetAt) {
    // First request or window expired — reset
    rateLimitMap.set(uid, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1 };
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: RATE_LIMIT_MAX - entry.count };
}

// ── Firebase token verification ───────────────────────
// Uses Firebase's public key endpoint — no Firebase Admin SDK required.
async function verifyFirebaseToken(token: string, projectId: string): Promise<string | null> {
  try {
    // Call Firebase's token verification endpoint
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`;
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ idToken: token }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { users?: { localId: string }[] };
    return data.users?.[0]?.localId ?? null;
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────
export const handler: Handler = async (event: HandlerEvent) => {
  // Only accept POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Fix: CRIT-05 — Require Firebase ID token
  const authHeader = event.headers['authorization'] || event.headers['Authorization'] || '';
  const token      = authHeader.replace(/^Bearer\s+/i, '').trim();

  if (!token) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized — missing token' }) };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    console.error('[claude fn] FIREBASE_PROJECT_ID not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  const uid = await verifyFirebaseToken(token, projectId);
  if (!uid) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized — invalid token' }) };
  }

  // Fix: CRIT-04 — Rate limiting per user
  const { allowed, remaining } = checkRateLimit(uid);
  if (!allowed) {
    return {
      statusCode: 429,
      headers: { 'Retry-After': '3600', 'X-RateLimit-Remaining': '0' },
      body: JSON.stringify({ error: 'Rate limit exceeded — try again in an hour' }),
    };
  }

  // Parse body
  let body: { model?: string; max_tokens?: number; system?: string; messages?: unknown[] };
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude fn] ANTHROPIC_API_KEY not set');
    return { statusCode: 500, body: JSON.stringify({ error: 'Server misconfiguration' }) };
  }

  // Forward to Anthropic — strip any client-supplied model override
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',  // Always use a fixed model — never trust client
        max_tokens: Math.min(body.max_tokens ?? 900, 1500), // Cap at 1500
        system:     body.system   ?? '',
        messages:   body.messages ?? [],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[claude fn] Anthropic error:', response.status, data);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: data?.error?.message ?? 'Upstream error' }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type':          'application/json',
        'X-RateLimit-Remaining': String(remaining),
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('[claude fn] fetch error:', err);
    return { statusCode: 502, body: JSON.stringify({ error: 'Failed to reach AI service' }) };
  }
};
