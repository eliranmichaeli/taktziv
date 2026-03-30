// netlify/functions/admin.ts
// פונקציית ניהול — רק למנהלים מאושרים

import type { Handler } from '@netlify/functions';

const ADMIN_EMAIL = 'eliran1456@gmail.com';

async function verifyToken(token: string): Promise<{ uid: string; email: string } | null> {
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${process.env.FIREBASE_WEB_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
    );
    if (!res.ok) return null;
    const data = await res.json() as { users?: { localId: string; email: string }[] };
    const u = data.users?.[0];
    return u ? { uid: u.localId, email: u.email } : null;
  } catch { return null; }
}

async function firestoreGet(path: string): Promise<any> {
  const url = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

async function firestorePatch(path: string, fields: Record<string, any>): Promise<void> {
  const url = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/${path}`;
  await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  });
}

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };

  // אימות
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const user  = await verifyToken(token);
  if (!user || user.email !== ADMIN_EMAIL) {
    return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ error: 'גישה נדחתה' }) };
  }

  // GET — רשימת משתמשים
  if (event.httpMethod === 'GET') {
    const action = new URL(event.rawUrl).searchParams.get('action');
    if (action === 'list_users') {
      try {
        // קרא את מסמכי ה-credits מ-Firestore
        const url = `https://firestore.googleapis.com/v1/projects/${process.env.FIREBASE_PROJECT_ID}/databases/(default)/documents/credits`;
        const res  = await fetch(url);
        const data = await res.json() as any;
        const docs  = data.documents || [];
        const users = docs.map((doc: any) => {
          const id = doc.name?.split('/').pop() || '';
          const f  = doc.fields || {};
          return {
            uid:       id,
            email:     f.email?.stringValue || id,
            isAdmin:   f.email?.stringValue === ADMIN_EMAIL,
            credits:   parseInt(f.extra?.integerValue || '0') + Math.max(0, 10 - parseInt(f.used?.integerValue || '0')),
            createdAt: f.createdAt?.stringValue || '',
          };
        });
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ users }) };
      } catch (e) {
        return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ users: [] }) };
      }
    }
  }

  // POST — פעולות ניהול
  if (event.httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}') as { action: string; [key: string]: any };

    if (body.action === 'add_credits') {
      const { uid, amount } = body;
      if (!uid || !amount) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'חסרים פרמטרים' }) };

      // קרא קרדיטים קיימים
      const doc = await firestoreGet(`credits/${uid}`);
      const f   = doc?.fields || {};
      const cur = parseInt(f.extra?.integerValue || '0');

      await firestorePatch(`credits/${uid}`, {
        extra: { integerValue: String(cur + amount) },
        month: { stringValue: f.month?.stringValue || '' },
        used:  { integerValue: f.used?.integerValue || '0' },
      });

      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true, newTotal: cur + amount }) };
    }

    if (body.action === 'add_admin') {
      // שמור רשימת מנהלים ב-Firestore
      const { email } = body;
      if (!email) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'חסר אימייל' }) };
      await firestorePatch(`admins/${email.replace('@', '_at_')}`, {
        email: { stringValue: email },
        addedBy: { stringValue: user.email },
        addedAt: { stringValue: new Date().toISOString() },
      });
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ success: true }) };
    }
  }

  return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'פעולה לא מוכרת' }) };
};
