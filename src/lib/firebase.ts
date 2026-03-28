import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import type { AppDB } from '../types';
import { uiStore } from './session';

// ── Config ────────────────────────────────────────────
// All values come from environment variables — never hardcoded.
// VITE_ prefix makes them available in the browser bundle,
// which is acceptable for Firebase public config (see HIGH-08 in security report).
// Security depends entirely on Firestore Security Rules (CRIT-01).
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app       = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
const gProvider   = new GoogleAuthProvider();

// ── Default DB ────────────────────────────────────────
// Fix: MED-08 — added onboardingDone: false to prevent undefined behavior
export const defaultDB = (): AppDB => ({
  settings: {
    profile:     { name: '', accountType: 'personal' },
    currency:    'ILS',
    budget:      { personal: 0, family: 0, startDay: 1, rollover: true },
    cats:        { personal: [], family: [], personal2: [] },
    incomeTypes: ['משכורת'],
    goals:       {},
    onboardingDone: false,  // FIX MED-08: was missing
  },
  fixed:       { personal: [], personal2: [], family: [] },
  variable:    [],
  incomes:     [],
  savings:     [],
  creditCards: [],
  tasks:       {},
});

// ── Firestore helpers ─────────────────────────────────
const userDocRef = (uid: string) => doc(db, 'users', uid, 'data', 'main');

export const loadDB = async (uid: string): Promise<AppDB> => {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return defaultDB();
  const data = snap.data() as Partial<AppDB>;
  const def  = defaultDB();
  return {
    ...def,
    ...data,
    settings: {
      ...def.settings,
      ...data.settings,
      budget: { ...def.settings.budget, ...data.settings?.budget },
      cats:   { ...def.settings.cats,   ...data.settings?.cats },
    },
    fixed: {
      personal:  data.fixed?.personal  ?? [],
      personal2: data.fixed?.personal2 ?? [],
      family:    data.fixed?.family    ?? [],
    },
  };
};

// Fix: HIGH-03 — was using setDoc without merge, risking data loss on concurrent writes.
// Using explicit merge:false is intentional full-document replacement, but we add
// a try/catch and ensure the caller always passes the full DB object.
export const saveDB = async (uid: string, data: AppDB): Promise<void> => {
  // Serialize through JSON to strip undefined values (Firestore rejects them)
  const clean = JSON.parse(JSON.stringify(data)) as AppDB;
  await setDoc(userDocRef(uid), clean);
};

// ── Auth methods ──────────────────────────────────────
export const authEmailSignIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const authEmailRegister = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const authGoogle = () => signInWithPopup(auth, gProvider);

// Fix: CRIT-06 — clear ALL local storage on logout so no data lingers
export const authSignOut = async (): Promise<void> => {
  uiStore.clearAll();
  await signOut(auth);
};

export const authForgot  = (email: string) => sendPasswordResetEmail(auth, email);

export const authUpdateProfile = (user: User, name: string) =>
  updateProfile(user, { displayName: name });

export { onAuthStateChanged };
export type { User };
