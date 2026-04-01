// netlify/functions/list-users.ts
// מביא רשימת משתמשים מ-Firebase Auth
// דורש FIREBASE_SERVICE_ACCOUNT_JSON ב-Netlify environment variables

// קבלת access token מ-Service Account
async function getAccessToken(serviceAccount: any): Promise<string | null> {
  try {
    const now    = Math.floor(Date.now() / 1000);
    const header = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      iss: serviceAccount.client_email,
      sub: serviceAccount.client_email,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/firebase.readonly',
    }));

    // חתימה — דורש Web Crypto API
    const pemKey  = serviceAccount.private_key;
    const keyData = pemKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\n/g, '');
    const binaryKey = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));

    const cryptoKey = await crypto.subtle.importKey(
      'pkcs8', binaryKey,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false, ['sign']
    );

    const signInput    = new TextEncoder().encode(`${header}.${payload}`);
    const signatureArr = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, signInput);
    const signature    = btoa(String.fromCharCode(...new Uint8Array(signatureArr)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

    const jwt = `${header}.${payload}.${signature}`;

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenRes.json() as any;
    return tokenData.access_token ?? null;
  } catch { return null; }
}

export const handler: Handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: cors, body: '' };

  // אימות מנהל
  const token = (event.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const isAdmin = await verifyAdmin(token);
  if (!isAdmin) return { statusCode: 403, headers: cors, body: JSON.stringify({ error: 'גישה נדחתה' }) };

  // קרא Service Account
  const saJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!saJson) {
    return {
      statusCode: 200, headers: cors,
      body: JSON.stringify({
        users: [],
        message: 'FIREBASE_SERVICE_ACCOUNT_JSON לא מוגדר — ראה הוראות הגדרה',
      }),
    };
  }

  let serviceAccount: any;
  try { serviceAccount = JSON.parse(saJson); }
  catch { return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'Service Account JSON לא תקין' }) }; }

  const accessToken = await getAccessToken(serviceAccount);
  if (!accessToken) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'שגיאה בקבלת access token' }) };

  // קרא משתמשים מ-Firebase Auth REST API
  try {
    const projectId = serviceAccount.project_id;
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:query`,
      {
        method:  'POST',
        headers: {
          Authorization:  `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnSecureToken: false }),
      }
    );

    if (!res.ok) {
      // fallback — נסה endpoint אחר
      const res2 = await fetch(
        `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`,
        {
          method:  'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body:    JSON.stringify({ returnSecureToken: false }),
        }
      );
      const data2 = await res2.json() as any;
      return { statusCode: 200, headers: cors, body: JSON.stringify({ users: data2.users || [] }) };
    }

    const data = await res.json() as any;
    const users = (data.userInfo || data.users || []).map((u: any) => ({
      uid:          u.localId,
      email:        u.email || '',
      displayName:  u.displayName || '',
      createdAt:    u.createdAt,
      lastSignIn:   u.lastLoginAt,
      provider:     u.providerUserInfo?.[0]?.providerId || 'email',
    }));

    return { statusCode: 200, headers: cors, body: JSON.stringify({ users }) };
  } catch (e: any) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
