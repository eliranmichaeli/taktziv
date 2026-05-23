// netlify/functions/vision.ts
// OCR חינמי דרך OCR.space API — ללא Workers, ללא CDN
import type { Handler } from '@netlify/functions';

function parseExpenses(text: string): { name: string; amount: number; currency: string }[] {
  const lines   = text.split('\n').map(l => l.trim()).filter(Boolean);
  const results: { name: string; amount: number; currency: string }[] = [];
  const seen    = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // חפש סכום כסף — מספר עם אפשרות לנקודה/פסיק
    const amountMatch = line.match(/([\d,]+(?:\.\d{1,2})?)/);
    if (!amountMatch) continue;

    const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
    if (isNaN(amount) || amount < 1 || amount > 999999) continue;

    // זיהוי מטבע
    let currency = 'ILS';
    if (line.includes('$') || /usd/i.test(line)) currency = 'USD';
    else if (line.includes('€') || /eur/i.test(line)) currency = 'EUR';
    else if (line.includes('£') || /gbp/i.test(line)) currency = 'GBP';

    // שם: טקסט בשורה ללא המספר, או שורה קודמת
    let name = line.replace(amountMatch[0], '').replace(/[₪$€£:\-–|.,\d]/g, '').trim();
    if (!name || name.length < 2) {
      name = i > 0 ? lines[i - 1].replace(/[0-9₪$€£:\-–|.,]/g, '').trim() : '';
    }
    if (!name || name.length < 2) continue;

    const key = `${name}__${amount}`;
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

  const ocrKey = process.env.OCR_SPACE_API_KEY;
  if (!ocrKey) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'OCR_SPACE_API_KEY חסר בהגדרות Netlify' }) };
  }

  let body: { image?: string; mimeType?: string } = {};
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'בקשה לא תקינה' }) };
  }

  if (!body.image) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'חסרה תמונה' }) };
  }

  try {
    const mimeType = body.mimeType || 'image/jpeg';
    const dataUri  = `data:${mimeType};base64,${body.image}`;

    // קריאה ל-OCR.space — שתי שפות במקביל: עברית ואנגלית
    const callOCR = async (lang: string) => {
      const fd = new URLSearchParams();
      fd.append('base64Image', dataUri);
      fd.append('language',   lang);
      fd.append('isOverlayRequired', 'false');
      fd.append('detectOrientation',  'true');
      fd.append('scale',              'true');
      fd.append('isTable',            'true');
      const res = await fetch('https://api.ocr.space/parse/image', {
        method:  'POST',
        headers: { 'apikey': ocrKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: fd.toString(),
      });
      return res.json() as Promise<any>;
    };

    // נסה עברית קודם, אם נכשל — אנגלית
    let ocrData = await callOCR('isr');
    if (ocrData.IsErroredOnProcessing || !ocrData.ParsedResults?.[0]?.ParsedText?.trim()) {
      ocrData = await callOCR('eng');
    }

    if (ocrData.IsErroredOnProcessing) {
      const msg = ocrData?.ErrorMessage?.[0] || 'שגיאה ב-OCR';
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: msg }) };
    }

    // חלץ טקסט מכל הדפים
    const fullText = (ocrData.ParsedResults || [])
      .map((r: any) => r.ParsedText || '')
      .join('\n');

    if (!fullText.trim()) {
      return { statusCode: 200, headers: cors, body: JSON.stringify({ expenses: [], error: 'לא זוהה טקסט — נסה תמונה ברורה יותר' }) };
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
