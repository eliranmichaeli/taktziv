// netlify/functions/vision.ts
// זיהוי טקסט מתמונות דרך Google Cloud Vision API

import type { Handler } from '@netlify/functions';

const rateMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(uid: string): boolean {
  const now   = Date.now();
  const entry = rateMap.get(uid);
  if (!entry || now > entry.resetAt) {
    rateMap.set(uid, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }
  if (entry.count >= 50) return false;
  entry.count++;
  return true;
}

async function verifyFirebaseToken(token: string): Promise<string | null> {
  const apiKey = process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) return token.length > 50 ? 'anonymous' : null;
  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) }
    );
    if (!res.ok) return null;
    const data = await res.json() as any;
    return data.users?.[0]?.localId ?? null;
  } catch {
    return token.length > 50 ? 'unverified' : null;
  }
}

// חלץ הוצאות מהטקסט שזוהה
function parseExpensesFromText(text: string): { name: string; amount: number; currency: string }[] {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: { name: string; amount: number; currency: string }[] = [];

  // דפוסים לזיהוי סכום כסף
  const amountPattern = /(?:₪|\$|€|£|ils|usd|eur|gbp)?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:₪|\$|€|£|ils|usd|eur|gbp)?/i;
  const currencyMap: Record<string, string> = {
    '₪': 'ILS', 'ils': 'ILS',
    '$': 'USD', 'usd': 'USD',
    '€': 'EUR', 'eur': 'EUR',
    '£': 'GBP', 'gbp': 'GBP',
  };

  const detectCurrency = (str: string): string => {
    for (const [sym, cur] of Object.entries(currencyMap)) {
      if (str.toLowerCase().includes(sym)) return cur;
    }
    return 'ILS';
  };

  // נסה לזהות שורות עם שם + סכום
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(amountPattern);
    if (!match) continue;

    const amountStr = match[1].replace(/,/g, '');
    const amount    = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0 || amount > 1000000) continue;

    // שם ההוצאה — הטקסט לפני הסכום, או השורה הקודמת
    let name = line.replace(match[0], '').replace(/[:\-–|]/g, '').trim();
    if (!name && i > 0) name = lines[i - 1];
    if (!name || name.length < 2) continue;

    // נקה מספרים מהשם
    name = name.replace(/^\d+\.?\s*/, '').trim();
    if (!name || name.length < 2) continue;

    const currency = detectCurrency(line);
    results.push({ name, amount, currency });
  }

  return results;
}

export const handler: Handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: corsHeaders, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' };

  // אימות
  const token = (event.headers.authorization || event.headers.Authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'נדרשת התחברות' }) };

  const uid = await verifyFirebaseToken(token);
  if (!uid)  return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ error: 'פג תוקף ההתחברות' }) };

  if (!checkRateLimit(uid)) return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'יותר מדי בקשות — נסה שוב עוד שעה' }) };

  const visionKey = process.env.GOOGLE_VISION_API_KEY;
  if (!visionKey) return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'GOOGLE_VISION_API_KEY חסר בהגדרות השרת' }) };

  let body: { image?: string; mimeType?: string };
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'בקשה לא תקינה' }) }; }

  if (!body.image) return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'חסרה תמונה' }) };

  try {
    // קריאה ל-Google Vision
    const visionResp = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${visionKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image:    { content: body.image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
          }],
        }),
      }
    );

    const visionData = await visionResp.json() as any;
    if (!visionResp.ok) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'שגיאה ב-Google Vision API' }) };
    }

    const fullText = visionData.responses?.[0]?.fullTextAnnotation?.text || '';
    if (!fullText) {
      return { statusCode: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenses: [], error: 'לא זוהה טקסט בתמונה' }) };
    }

    const expenses = parseExpensesFromText(fullText);
    return {
      statusCode: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenses, rawText: fullText }),
    };
  } catch (err) {
    console.error('[vision fn] error:', err);
    return { statusCode: 502, headers: corsHeaders, body: JSON.stringify({ error: 'שגיאה בחיבור ל-Google Vision' }) };
  }
};
