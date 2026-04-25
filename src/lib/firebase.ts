import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  deleteUser,
  type User,
} from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import type { AppDB } from '../types';
import { uiStore } from './session';

// ── Config ────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app         = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);

const gProvider   = new GoogleAuthProvider();
gProvider.setCustomParameters({ prompt: 'select_account' });

// ── Default DB ────────────────────────────────────────
export const defaultDB = (): AppDB => ({
  settings: {
    profile:     { name: '', accountType: 'personal' },
    currency:    'ILS',
    budget:      { personal: 0, family: 0, startDay: 1, rollover: true },
    cats:        { personal: [], family: [], personal2: [] },
    incomeTypes: ['משכורת', 'עצמאי / פרילנס', 'נדל"ן', 'שוק ההון', 'פנסיה', 'קרן השתלמות', 'אחר'],
    goals:       {},
    onboardingDone: false,
  },
  fixed:       { personal: [], personal2: [], family: [] },
  variable:    [],
  incomes:     [],
  savings:     [],
  creditCards: [],
  tasks:       {},
});

// ── Firestore ─────────────────────────────────────────
const userDocRef = (uid: string) => doc(db, 'users', uid, 'data', 'main');

export const loadDB = async (uid: string): Promise<AppDB> => {
  const snap = await getDoc(userDocRef(uid));
  if (!snap.exists()) return defaultDB();
  const data = snap.data() as Partial<AppDB>;
  const def  = defaultDB();
  return {
    ...def, ...data,
    settings: {
      ...def.settings, ...data.settings,
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

export const saveDB = async (uid: string, data: AppDB): Promise<void> => {
  await setDoc(userDocRef(uid), JSON.parse(JSON.stringify(data)));
};

// ── Reset financial data (keep account, clear data, return to onboarding) ────
export const resetFinancialData = async (uid: string): Promise<void> => {
  const fresh = defaultDB();
  // onboardingDone = false כדי שהמשתמש יחזור לשאלון הראשוני
  await setDoc(userDocRef(uid), JSON.parse(JSON.stringify(fresh)));
  uiStore.clearAll();
};

// ── Delete account permanently (data + auth user) ────────────────────────────
export const deleteAccount = async (uid: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('No authenticated user');
  // מחק את הנתונים מ-Firestore
  await deleteDoc(userDocRef(uid));
  // נקה את ה-store המקומי
  uiStore.clearAll();
  // מחק את המשתמש מ-Firebase Auth
  await deleteUser(user);
};

// ── Auth ──────────────────────────────────────────────
export const authEmailSignIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const authEmailRegister = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

// Google Sign-In — ניסה popup קודם, אם נכשל עובר ל-redirect
export const authGoogle = async () => {
  try {
    return await signInWithPopup(auth, gProvider);
  } catch (err: any) {
    if (err.code === 'auth/popup-blocked' || err.code === 'auth/popup-closed-by-user') {
      await signInWithRedirect(auth, gProvider);
      return null;
    }
    throw err;
  }
};

// בדוק redirect result בטעינת הדף
export const checkGoogleRedirect = () => getRedirectResult(auth);

export const authSignOut = async (): Promise<void> => {
  uiStore.clearAll();
  await signOut(auth);
};

export const authForgot = (email: string) => sendPasswordResetEmail(auth, email);

export const authUpdateProfile = (user: User, name: string) =>
  updateProfile(user, { displayName: name });

export const authSendVerification = (user: User) =>
  sendEmailVerification(user, { url: window.location.origin });

export { onAuthStateChanged };
export type { User };
