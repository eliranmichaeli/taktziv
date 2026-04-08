// netlify/functions/payplus.ts
// ניהול תשלומים דרך PayPlus API

import type { Handler } from '@netlify/functions';

const ADMIN_EMAIL  = 'eliran1456@gmail.com';
const API_BASE     = 'https://restapidev.payplus.co.il/api/v1.0'; // prod: restapi.payplus.co.il

// אימות Firebase token
async function verifyToken(token: string): Promise<{ uid: string; email: string } | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY;
  if (!apiKey) return null;
  try {
    const res  = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    const u = data.users?.[0];
    return u ? { uid: u.localId, email: u.email } : null;
  } catch { return null; }
}

// PayPlus API headers
function payplusHeaders() {
  return {
    'Content-Type':  'application/json',
    'Authorization': `APIKey ${process.env.PAYPLUS_API_KEY}`,
    'X-SECRET-KEY':  process.env.PAYPLUS_SECRET_KEY || '',
  };
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')    return { statusCode: 405, headers: cors, body: 'Method Not Allowed' };

  // אימות
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const user  = await verifyToken(token);
  if (!user) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'נדרשת התחברות' }) };

  const body = JSON.parse(event.body || '{}') as { action: string; [key: string]: any };

  // ── יצירת קישור תשלום ────────────────────────────
  if (body.action === 'create_payment_link') {
    const pageUid = process.env.PAYPLUS_PAGE_UID;
    if (!pageUid) {
      return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'PayPlus לא מוגדר' }) };
    }

    try {
      const payload = {
        payment_page_uid: pageUid,
        amount:           5,          // ₪5 לחודש
        currency_code:    'ILS',
        charge_method:    1,          // חיוב מיידי
        create_token:     true,       // שמור token לחיובים עתידיים
        customer: {
          customer_name:  user.email.split('@')[0],
          email:          user.email,
          uid:            user.uid,
        },
        more_info:   user.uid,        // נשמור UID לzwebhook
        expiry_datetime: '',
        refURL_success: `${process.env.URL}/payment-success`,
        refURL_failure: `${process.env.URL}/payment-failure`,
      };

      const res  = await fetch(`${API_BASE}/PaymentPages/generateLink`, {
        method:  'POST',
        headers: payplusHeaders(),
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as any;

      if (!res.ok || data.results?.status !== '1') {
        console.error('PayPlus error:', data);
        return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'שגיאה ביצירת קישור תשלום' }) };
      }

      return {
        statusCode: 200,
        headers:    { ...cors, 'Content-Type': 'application/json' },
        body:       JSON.stringify({ paymentUrl: data.data?.payment_page_link }),
      };
    } catch (e: any) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: e.message }) };
    }
  }

  // ── ביטול מנוי ───────────────────────────────────
  if (body.action === 'cancel_subscription') {
    const { payplusToken } = body;
    if (!payplusToken) {
      return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'חסר token' }) };
    }

    try {
      // בטל את ה-token החוזר ב-PayPlus
      const res  = await fetch(`${API_BASE}/Tokens/${payplusToken}`, {
        method:  'DELETE',
        headers: payplusHeaders(),
      });

      if (!res.ok) {
        return { statusCode: 502, headers: cors, body: JSON.stringify({ error: 'שגיאה בביטול המנוי' }) };
      }

      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
    } catch (e: any) {
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: e.message }) };
    }
  }

  return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'פעולה לא מוכרת' }) };
};
