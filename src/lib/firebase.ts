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
  sendEmailVerification,
  type User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import type { AppDB } from '../types';

// ── Config ────────────────────────────────────────────
// Fill these from your .env.local
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
const gProvider   = new GoogleAuthProvider();

// ── Default DB ────────────────────────────────────────
export const defaultDB = (): AppDB => ({
  settings: {
    profile:     { name: '', accountType: 'personal' },
    currency:    'ILS',
    budget:      { personal: 0, family: 0, startDay: 1, rollover: true },
    cats:        { personal: [], family: [], personal2: [] },
    incomeTypes: ['משכורת'],
    goals:       {},
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
  // Deep merge with defaults
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
      personal:  data.fixed?.personal  || [],
      personal2: data.fixed?.personal2 || [],
      family:    data.fixed?.family    || [],
    },
  };
};

export const saveDB = async (uid: string, data: AppDB): Promise<void> => {
  await setDoc(userDocRef(uid), JSON.parse(JSON.stringify(data)));
};

export const subscribeDB = (uid: string, callback: (data: AppDB) => void): (() => void) => {
  return onSnapshot(userDocRef(uid), snap => {
    if (snap.exists()) callback(snap.data() as AppDB);
  });
};

// ── Auth methods ──────────────────────────────────────
export const authEmailSignIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const authEmailRegister = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const authGoogle = () => signInWithPopup(auth, gProvider);

export const authSignOut = () => signOut(auth);

export const authForgot = (email: string) => sendPasswordResetEmail(auth, email);

export const authUpdateName = (user: User, name: string) =>
  updateProfile(user, { displayName: name });

export { onAuthStateChanged };
export const authUpdateProfile = (user: User, name: string) => updateProfile(user, { displayName: name });

export const authSendVerification = (user: User) => sendEmailVerification(user, {
  url: window.location.origin,  // redirect back to app after verification
});
export type { User };
