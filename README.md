# Ledger Intelligence — Master Version

מערכת ניהול פיננסי חכמה, בנויה על עיצוב Google Stitch עם לוגיקה עסקית מלאה.

## Tech Stack
- **React 19** + TypeScript
- **Tailwind CSS v4** (Stitch design tokens)
- **Firebase** (Auth + Firestore)
- **Framer Motion** (animations)
- **Recharts** (charts)
- **Netlify Functions** (AI Advisor)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local and fill Firebase credentials
cp .env.example .env.local

# 3. Run dev server
npm run dev
```

## Firebase Setup
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a project → Web app
3. Enable **Authentication**: Email/Password + Google
4. Enable **Firestore** (production or test mode)
5. Copy credentials to `.env.local`

## Project Structure
```
src/
├── components/
│   ├── Navigation/     Sidebar + TopBar + MobileBottomNav
│   ├── Dashboard/      Main dashboard with real data
│   ├── Expenses/       Fixed & variable expense management
│   ├── Savings/        Savings plans with deposits & validation
│   ├── Advisor/        AI Financial Advisor (Claude)
│   ├── Freedom/        Rule-300 + Compound Interest calculator
│   ├── Settings/       App settings + credit cards
│   ├── Auth/           Login / Register / Google OAuth
│   └── Onboarding/     7-step setup wizard
├── context/
│   └── AppContext.tsx  Global state (user, db, lang, month/year)
├── lib/
│   ├── calculations.ts All financial math (totals, health score, compound interest)
│   ├── firebase.ts     Firebase auth + Firestore service layer
│   ├── i18n.ts         6-language translation system (he/en/ru/ar/de/fr)
│   └── utils.ts        cn() utility
└── types.ts            Full TypeScript types
```

## Key Features
- ✅ Multi-user (personal / partner / family)
- ✅ Fixed + variable expense tracking
- ✅ Savings plans with deposit history & validation
- ✅ AI Financial Advisor (Claude via Netlify)
- ✅ Rule-300 + compound interest calculator
- ✅ 6 languages with full RTL support
- ✅ Budget tracking with alerts
- ✅ Firebase real-time sync
- ✅ Mobile-first bottom navigation
- ✅ 7-step onboarding wizard
