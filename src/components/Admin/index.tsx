import React, { useState, useEffect } from 'react';
import { Shield, Users, Plus, Trash2, Coins, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  collection, getDocs, doc, setDoc, updateDoc, increment, getDoc,
} from 'firebase/firestore';
import { useApp } from '../../context/AppContext';
import { db as firestoreDB } from '../../lib/firebase';
import { cn } from '../../lib/utils';

const ADMIN_EMAIL = 'eliran1456@gmail.com';

// ── Admin Guard ───────────────────────────────────────
const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useApp();
  if (!user || user.email !== ADMIN_EMAIL) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="text-error" size={28} />
        </div>
        <h2 className="text-xl font-bold text-on-surface mb-2">גישה נדחתה</h2>
        <p className="text-sm text-on-surface-variant">פאנל זה מיועד למנהלי המערכת בלבד.</p>
      </div>
    );
  }
  return <>{children}</>;
};

// ── Main Admin ────────────────────────────────────────
interface UserRecord {
  uid: string; email: string; freeLeft: number; extra: number; isAdmin: boolean;
}

const AdminContent: React.FC = () => {
  const [users,     setUsers]     = useState<UserRecord[]>([]);
  const [admins,    setAdmins]    = useState<string[]>([ADMIN_EMAIL]);
  const [loading,   setLoading]   = useState(true);
  const [newAdmin,  setNewAdmin]  = useState('');
  const [creditUid, setCreditUid] = useState('');
  const [creditAmt, setCreditAmt] = useState('10');
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [activeTab, setActiveTab] = useState<'users'|'admins'|'credits'>('users');

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      // קרא כל מסמכי credits
      const snap = await getDocs(collection(firestoreDB, 'credits'));
      const now  = new Date();
      const curM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const list: UserRecord[] = snap.docs.map(d => {
        const data = d.data();
        const used = data.month === curM ? (data.used || 0) : 0;
        return {
          uid:      d.id,
          email:    data.email || d.id,
          freeLeft: Math.max(0, 10 - used),
          extra:    data.extra || 0,
          isAdmin:  data.email === ADMIN_EMAIL,
        };
      });
      setUsers(list);

      // קרא מנהלים
      const adminSnap = await getDocs(collection(firestoreDB, 'admins'));
      const adminList = [ADMIN_EMAIL, ...adminSnap.docs.map(d => d.data().email).filter(Boolean)];
      setAdmins([...new Set(adminList)]);
    } catch (e: any) {
      setError('שגיאה בטעינת נתונים: ' + e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const flash = (msg: string, isError = false) => {
    if (isError) { setError(msg); setTimeout(() => setError(''), 4000); }
    else { setSuccess(msg); setTimeout(() => setSuccess(''), 4000); }
  };

  const addAdmin = async () => {
    const email = newAdmin.trim();
    if (!email) return;
    try {
      await setDoc(doc(firestoreDB, 'admins', email.replace('@','_at_').replace('.','_dot_')), {
        email, addedAt: new Date().toISOString(),
      });
      setAdmins(prev => [...new Set([...prev, email])]);
      setNewAdmin('');
      flash(`${email} נוסף כמנהל`);
    } catch (e: any) { flash('שגיאה: ' + e.message, true); }
  };

  const removeAdmin = async (email: string) => {
    if (email === ADMIN_EMAIL) { flash('לא ניתן להסיר את מנהל הראשי', true); return; }
    if (!confirm(`להסיר את ${email}?`)) return;
    setAdmins(prev => prev.filter(a => a !== email));
    flash(`${email} הוסר`);
  };

  const addCredits = async () => {
    const amt = parseInt(creditAmt);
    if (!creditUid.trim() || !amt) return;
    try {
      const ref  = doc(firestoreDB, 'credits', creditUid.trim());
      const snap = await getDoc(ref);
      if (snap.exists()) {
        await updateDoc(ref, { extra: increment(amt) });
      } else {
        await setDoc(ref, { extra: amt, used: 0, month: '' });
      }
      flash(`${amt} קרדיטים נוספו בהצלחה`);
      setCreditUid('');
      loadData();
    } catch (e: any) { flash('שגיאה: ' + e.message, true); }
  };

  const tabs = [
    { id: 'users'   as const, label: 'משתמשים', icon: Users  },
    { id: 'admins'  as const, label: 'מנהלים',  icon: Shield },
    { id: 'credits' as const, label: 'קרדיטים', icon: Coins  },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Shield className="text-primary" size={20} />
        </div>
        <div>
          <h1 className="text-xl font-bold">פאנל ניהול</h1>
          <p className="text-xs text-on-surface-variant">גישה מוגבלת למנהלים בלבד</p>
        </div>
        <button onClick={loadData} className="ms-auto p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error   && <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">{error}</div>}
      {success && <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm">✓ {success}</div>}

      {/* Tabs */}
      <div className="flex bg-surface-container-high rounded-xl p-1 gap-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant'
            )}>
            <tab.icon size={15} />{tab.label}
          </button>
        ))}
      </div>

      {/* Users */}
      {activeTab === 'users' && (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/8 flex items-center justify-between">
            <h3 className="font-bold">משתמשים רשומים</h3>
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">{users.length} משתמשים</span>
          </div>
          {loading ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">טוען...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">
              <div className="mb-2 opacity-40 text-2xl">◎</div>
              אין נתוני משתמשים עדיין — הנתונים יופיעו לאחר שמשתמשים ישתמשו ביועץ ה-AI
            </div>
          ) : (
            <div className="divide-y divide-outline-variant/5">
              {users.map(u => (
                <div key={u.uid} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-high/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-on-surface truncate">{u.email}</span>
                      {u.isAdmin && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">מנהל</span>}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5 font-mono">{u.uid.slice(0,16)}...</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-xs text-on-surface-variant flex items-center gap-1">
                      <Coins size={12} className="text-primary" />
                      {u.freeLeft + u.extra} קרדיטים
                    </div>
                    <button onClick={() => { setCreditUid(u.uid); setActiveTab('credits'); }}
                      className="text-xs text-primary hover:underline">
                      הוסף קרדיטים
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admins */}
      {activeTab === 'admins' && (
        <div className="space-y-4">
          <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/8">
              <h3 className="font-bold">מנהלי מערכת</h3>
              <p className="text-xs text-on-surface-variant mt-0.5">מנהלים יכולים לגשת לפאנל זה</p>
            </div>
            <div className="divide-y divide-outline-variant/5">
              {admins.map(email => (
                <div key={email} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                      {email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-on-surface">{email}</div>
                      {email === ADMIN_EMAIL && <div className="text-[10px] text-primary font-bold">מנהל ראשי</div>}
                    </div>
                  </div>
                  {email !== ADMIN_EMAIL && (
                    <button onClick={() => removeAdmin(email)}
                      className="p-1.5 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h4 className="font-bold mb-4">הוסף מנהל חדש</h4>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-surface-container-high border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder='כתובת דוא"ל של המנהל החדש'
                value={newAdmin} onChange={e => setNewAdmin(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addAdmin()}
              />
              <button onClick={addAdmin} disabled={!newAdmin.trim()}
                className="px-5 py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2">
                <Plus size={16} /> הוסף
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credits */}
      {activeTab === 'credits' && (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
          <h3 className="font-bold mb-2">הוספת קרדיטים למשתמש</h3>
          <p className="text-xs text-on-surface-variant mb-5">כל משתמש מקבל 10 קרדיטים חינם בחודש.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">UID של המשתמש</label>
              <input
                className="w-full bg-surface-container-high border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30 font-mono"
                placeholder="העתק UID מרשימת המשתמשים למעלה"
                value={creditUid} onChange={e => setCreditUid(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">כמות קרדיטים</label>
              <div className="flex gap-2 mb-2 flex-wrap">
                {[10,25,50,100].map(n => (
                  <button key={n} onClick={() => setCreditAmt(String(n))}
                    className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all',
                      creditAmt === String(n) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-outline-variant/20 text-on-surface-variant'
                    )}>
                    {n}
                  </button>
                ))}
              </div>
              <input type="number"
                className="w-full bg-surface-container-high border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder="כמות מותאמת" value={creditAmt} onChange={e => setCreditAmt(e.target.value)}
              />
            </div>
            <button onClick={addCredits} disabled={!creditUid.trim() || !creditAmt}
              className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              <Coins size={16} /> הוסף {creditAmt} קרדיטים
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const Admin: React.FC = () => (
  <AdminGuard><AdminContent /></AdminGuard>
);
