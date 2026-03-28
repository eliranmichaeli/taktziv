import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppProvider, useApp } from './context/AppContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Sidebar, TopBar, MobileBottomNav } from './components/Navigation';
import { Dashboard }   from './components/Dashboard';
import { Expenses }    from './components/Expenses';
import { Incomes }     from './components/Incomes';
import { Cashflow }    from './components/Cashflow';
import { Savings }     from './components/Savings';
import { AnnualView }  from './components/Annual';
import { Advisor }     from './components/Advisor';
import { Freedom }     from './components/Freedom';
import { Settings }    from './components/Settings';
import { AuthScreen }  from './components/Auth';
import { Onboarding }  from './components/Onboarding';
import { isRTL }       from './lib/i18n';
import { cn }          from './lib/utils';

let _showToast: (msg: string) => void = () => {};
export const showToast = (msg: string) => _showToast(msg);

const ToastManager: React.FC = () => {
  const [toasts, setToasts] = React.useState<{ id: number; msg: string }[]>([]);
  const counter = useRef(0);
  useEffect(() => {
    _showToast = (msg: string) => {
      const id = ++counter.current;
      setToasts(t => [...t, { id, msg }]);
      setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
    };
  }, []);
  return (
    <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div key={toast.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="bg-surface-container-highest border border-outline-variant/15 text-on-surface text-sm font-medium px-5 py-3 rounded-full shadow-xl backdrop-blur-xl whitespace-nowrap"
          >{toast.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

const Content: React.FC = () => {
  const { tab } = useApp();
  switch (tab) {
    case 'dashboard':  return <Dashboard />;
    case 'personal':   return <Expenses scope="personal" />;
    case 'personal2':  return <Expenses scope="personal2" />;
    case 'family':     return <Expenses scope="family" />;
    case 'income':     return <Incomes />;
    case 'cashflow':   return <Cashflow />;
    case 'savings':    return <Savings />;
    case 'annual':     return <AnnualView />;
    case 'advisor':    return <Advisor />;
    case 'freedom':    return <Freedom />;
    case 'settings':   return <Settings />;
    default:           return <Dashboard />;
  }
};

const InnerApp: React.FC = () => {
  // Fix: original bug — tab was missing from destructuring, causing "tab is not defined"
  const { user, authReady, db, lang, tab } = useApp();
  const rtl = isRTL(lang);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <div className="text-on-surface-variant text-sm">טוען...</div>
        </div>
      </div>
    );
  }
  if (!user) return <AuthScreen />;
  if (!db.settings.onboardingDone) return <Onboarding />;

  return (
    <div className={cn('min-h-screen bg-surface', rtl ? 'direction-rtl' : 'direction-ltr')}>
      <div className="hidden md:block">
        <Sidebar />
        <TopBar />
      </div>
      <main className={cn('pt-0 md:pt-14', rtl ? 'md:mr-[200px]' : 'md:ml-[200px]')}>
        <div className="px-4 py-5 md:px-8 md:py-7 max-w-[1100px] mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={String(tab)}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.18 }}
            >
              <Content />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
      <div className="md:hidden"><MobileBottomNav /></div>
      <ToastManager />
    </div>
  );
};

// Fix: HIGH-04 — wrap everything in ErrorBoundary to prevent financial data
// from leaking in unhandled React render errors.
export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <InnerApp />
      </AppProvider>
    </ErrorBoundary>
  );
}
