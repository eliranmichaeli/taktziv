import React, { useState, useEffect } from 'react';
import { Shield, Users, Plus, Trash2, Coins, RefreshCw, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { useApp } from '../../context/AppContext';
import { auth } from '../../lib/firebase';
import { cn } from '../../lib/utils';

const ADMIN_EMAIL = 'eliran1456@gmail.com';

interface AdminUser {
  uid:       string;
  email:     string;
  isAdmin:   boolean;
  credits:   number;
  createdAt: string;
}

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
const AdminContent: React.FC = () => {
  const { user } = useApp();
  const [users,      setUsers]      = useState<AdminUser[]>([]);
  const [admins,     setAdmins]     = useState<string[]>([ADMIN_EMAIL]);
  const [loading,    setLoading]    = useState(true);
  const [newAdmin,   setNewAdmin]   = useState('');
  const [creditUid,  setCreditUid]  = useState('');
  const [creditAmt,  setCreditAmt]  = useState('10');
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState('');
  const [activeTab,  setActiveTab]  = useState<'users' | 'admins' | 'credits'>('users');

  const getAuthHeaders = async () => {
    const token = await auth.currentUser?.getIdToken(true);
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  };

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const headers = await getAuthHeaders();
      const res     = await fetch('/.netlify/functions/admin?action=list_users', { headers });
      if (!res.ok) throw new Error('שגיאה בטעינת משתמשים');
      const data = await res.json() as { users: AdminUser[] };
      setUsers(data.users || []);
    } catch (e: any) {
      setError(e.message);
    }
    setLoading(false);
  };

  useEffect(() => { loadUsers(); }, []);

  const addAdmin = async () => {
    if (!newAdmin.trim()) return;
    setError(''); setSuccess('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/admin', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'add_admin', email: newAdmin.trim() }),
      });
      if (!res.ok) throw new Error('שגיאה בהוספת מנהל');
      setAdmins(prev => [...prev, newAdmin.trim()]);
      setNewAdmin('');
      setSuccess(`${newAdmin} נוסף כמנהל בהצלחה`);
    } catch (e: any) { setError(e.message); }
  };

  const removeAdmin = async (email: string) => {
    if (email === ADMIN_EMAIL) { setError('לא ניתן להסיר את מנהל הראשי'); return; }
    if (!confirm(`להסיר את ${email} מרשימת המנהלים?`)) return;
    setAdmins(prev => prev.filter(a => a !== email));
    setSuccess(`${email} הוסר מרשימת המנהלים`);
  };

  const addCredits = async () => {
    if (!creditUid.trim() || !creditAmt) return;
    setError(''); setSuccess('');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/.netlify/functions/admin', {
        method: 'POST', headers,
        body: JSON.stringify({ action: 'add_credits', uid: creditUid.trim(), amount: parseInt(creditAmt) }),
      });
      if (!res.ok) throw new Error('שגיאה בהוספת קרדיטים');
      setSuccess(`${creditAmt} קרדיטים נוספו בהצלחה`);
      setCreditUid('');
      loadUsers();
    } catch (e: any) { setError(e.message); }
  };

  const tabs = [
    { id: 'users'   as const, label: 'משתמשים',  icon: Users },
    { id: 'admins'  as const, label: 'מנהלים',   icon: Shield },
    { id: 'credits' as const, label: 'קרדיטים',  icon: Coins },
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
        <button onClick={loadUsers} className="ms-auto p-2 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Alerts */}
      {error   && <div className="p-3 bg-error/10 border border-error/20 rounded-xl text-error text-sm">{error}</div>}
      {success && <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-primary text-sm">✓ {success}</div>}

      {/* Tabs */}
      <div className="flex bg-surface-container-high rounded-xl p-1 gap-1">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all',
              activeTab === tab.id ? 'bg-surface text-on-surface shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
            )}>
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Users tab */}
      {activeTab === 'users' && (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/5 overflow-hidden">
          <div className="px-6 py-4 border-b border-outline-variant/8 flex items-center justify-between">
            <h3 className="font-bold">משתמשים רשומים</h3>
            <span className="text-xs text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">{users.length} משתמשים</span>
          </div>
          {loading ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">טוען...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-10 text-on-surface-variant text-sm">אין נתוני משתמשים זמינים</div>
          ) : (
            <div className="divide-y divide-outline-variant/5">
              {users.map(u => (
                <div key={u.uid} className="flex items-center justify-between px-6 py-4 hover:bg-surface-container-high/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-on-surface">{u.email}</span>
                      {u.isAdmin && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">מנהל</span>
                      )}
                    </div>
                    <div className="text-xs text-on-surface-variant mt-0.5">UID: {u.uid.slice(0, 12)}...</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-on-surface-variant">
                      <Coins size={12} className="text-primary" />
                      <span>{u.credits} קרדיטים</span>
                    </div>
                    <button
                      onClick={() => { setCreditUid(u.uid); setActiveTab('credits'); }}
                      className="text-xs text-primary hover:underline"
                    >
                      הוסף קרדיטים
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admins tab */}
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

          {/* הוספת מנהל */}
          <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
            <h4 className="font-bold mb-4">הוסף מנהל חדש</h4>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-surface-container-high border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder="כתובת דוא&quot;ל של המנהל החדש"
                value={newAdmin}
                onChange={e => setNewAdmin(e.target.value)}
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

      {/* Credits tab */}
      {activeTab === 'credits' && (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant/5">
          <h3 className="font-bold mb-2">הוספת קרדיטים למשתמש</h3>
          <p className="text-xs text-on-surface-variant mb-5">כל משתמש מקבל 10 קרדיטים חינם בחודש. ניתן להוסיף קרדיטים נוספים ידנית.</p>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">UID של המשתמש</label>
              <input
                className="w-full bg-surface-container-high border-0 rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-2 focus:ring-primary/30"
                placeholder="העתק UID מרשימת המשתמשים"
                value={creditUid}
                onChange={e => setCreditUid(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-on-surface-variant block mb-1.5">כמות קרדיטים</label>
              <div className="flex gap-2 mb-2">
                {[10, 25, 50, 100].map(n => (
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
                placeholder="או הזן כמות מותאמת"
                value={creditAmt}
                onChange={e => setCreditAmt(e.target.value)}
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
  <AdminGuard>
    <AdminContent />
  </AdminGuard>
);
