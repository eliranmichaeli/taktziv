# הוראות הגדרה — ללא טרמינל

## קובץ זה מסביר איך להשלים את ההגדרה דרך ממשקי האינטרנט בלבד.

## מה צריך למלא ב-Netlify (Environment Variables)

לאחר שחיברת את ה-repo ל-Netlify:
1. כנס ל-Site → Site configuration → Environment variables
2. הוסף את המשתנים הבאים עם הערכים מ-Firebase:

| שם המשתנה                     | ערך (מ-Firebase Project Settings) |
|-------------------------------|------------------------------------|
| VITE_FIREBASE_API_KEY         | apiKey מהקוד של Firebase           |
| VITE_FIREBASE_AUTH_DOMAIN     | authDomain                         |
| VITE_FIREBASE_PROJECT_ID      | projectId                          |
| VITE_FIREBASE_STORAGE_BUCKET  | storageBucket                      |
| VITE_FIREBASE_MESSAGING_SENDER_ID | messagingSenderId              |
| VITE_FIREBASE_APP_ID          | appId                              |
| ANTHROPIC_API_KEY             | ה-API key שלך מ-Anthropic          |

## לקבלת ANTHROPIC_API_KEY
1. כנס ל: https://console.anthropic.com
2. לחץ "API Keys" → "Create Key"
3. העתק את ה-key (מתחיל ב-sk-ant-...)
