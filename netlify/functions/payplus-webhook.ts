// netlify/functions/payplus-webhook.ts
// מקבל webhook מ-PayPlus בעת תשלום מוצלח

import type { Handler } from '@netlify/functions';

// עדכון Firestore דרך REST (ללא Admin SDK)
async function updateFirestore(uid: string, data: Record<string, any>): Promise<void> {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
  if (!projectId) return;

  const fields: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === 'string')  fields[key] = { stringValue: val };
    if (typeof val === 'number')  fields[key] = { doubleValue: val };
    if (typeof val === 'boolean') fields[key] = { booleanValue: val };
    if (val === null)             fields[key] = { nullValue: null };
  }

  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/subscriptions/${uid}`;
  await fetch(url, {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ fields }),
  });
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let payload: any;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: 'Invalid JSON' };
  }

  console.log('[payplus-webhook] received:', JSON.stringify(payload).slice(0, 500));

  // PayPlus שולח status_code '1' עבור תשלום מוצלח
  const isSuccess = payload.status_code === '1' || payload.results?.status === '1';
  if (!isSuccess) {
    console.log('[payplus-webhook] payment not successful, ignoring');
    return { statusCode: 200, body: 'OK' };
  }

  // חלץ uid מ-more_info שהכנסנו בעת יצירת הקישור
  const uid         = payload.more_info || payload.customer?.uid || '';
  const payplusToken = payload.token || payload.data?.token || '';

  if (!uid) {
    console.error('[payplus-webhook] missing uid');
    return { statusCode: 200, body: 'OK' };
  }

  // חשב תאריך חיוב הבא (חודש קדימה)
  const now  = new Date();
  const next = new Date(now);
  next.setMonth(next.getMonth() + 1);

  // עדכן Firestore
  await updateFirestore(uid, {
    status:          'active',
    planActivatedAt: now.toISOString(),
    lastPayment:     now.toISOString(),
    nextPayment:     next.toISOString(),
    payplusToken:    payplusToken,
    cancelledAt:     '',
  });

  console.log(`[payplus-webhook] activated subscription for uid: ${uid}`);
  return { statusCode: 200, body: 'OK' };
};
