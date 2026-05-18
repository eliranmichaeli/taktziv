// netlify/functions/vision.ts
import type { Handler } from '@netlify/functions';

function parseExpenses(text: string): { name: string; amount: number; currency: string }[] {
  const lines   = text.split('\n').map((l: string) => l.trim()).filter(Boolean);
  const results: { name: string; amount: number; currency: string }[] = [];
  const seen    = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // חפש סכום כסף בשורה
    const amountMatch = line.match(/([\d,]+(?:\.\d{1,2})?)/);
    if (!amountMatch) continue;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount < 1 || amount > 999999) continue;

    // זיהוי מטבע
    let currency = 'ILS';
    if (line.includes('$') || /usd/i.test(line)) currency = 'USD';
    else if (line.includes('€') || /eur/i.test(line)) currency = 'EUR';
    else if (line.includes('£') || /gbp/i.test(line)) currency = 'GBP';

    // שם: הטקסט בשורה ללא המספר, או השורה הקודמת
    let name = line.replace(amountMatch[0], '').replace(/[₪$€£:\-–|.,]/g, '').trim();
    if (!name || name.length < 2) {
      name = i > 0 ? lines[i - 1].replace(/[0-9₪$€£:\-–|.,]/g, '').trim() : '';
    }
    if (!name || name.length < 2) continue;

    // הימנע מכפילויות
    const key = `${name}-${amount}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({ name, amount, currency });
  }

  return results;
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };
  if (event.httpMethod !== 'POST')   return { statusCode: 405, headers: cors, body: JSON.stringify({ error: 'Method not allowed' }) };

  const apiKey = process.env.GOOGLE_VISION_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'GOOGLE_VISION_API_KEY חסר בהגדרות Netlify' }) };
  }

  let body: { image?: string } = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'בקשה לא תקינה' }) };
  }

  if (!body.image) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'חסרה תמונה' }) };
  }

  try {
    const visionRes = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image:    { content: body.image },
            features: [{ type: 'DOCUMENT_TEXT_DETECTION' }],
          }],
        }),
      }
    );

    const visionData = await visionRes.json() as any;

    if (!visionRes.ok) {
      const errMsg = visionData?.error?.message || 'שגיאה ב-Google Vision API';
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: errMsg }) };
    }

    const fullText: string = visionData?.responses?.[0]?.fullTextAnnotation?.text || '';
    if (!fullText) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ expenses: [], error: 'לא זוהה טקסט בתמונה — נסה תמונה ברורה יותר' }) };
    }

    const expenses = parseExpenses(fullText);
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ expenses }),
    };
  } catch (err: any) {
    return { statusCode: 502, headers: cors, body: JSON.stringify({ error: err.message || 'שגיאת חיבור' }) };
  }
};
