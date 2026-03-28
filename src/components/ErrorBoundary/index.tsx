import React, { type ReactNode } from 'react';

// Fix: HIGH-04 — Error Boundary prevents financial data from leaking
// in stack traces and gives users a graceful recovery path.

interface Props   { children: ReactNode }
interface State   { hasError: boolean; errorId: string }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, errorId: '' };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true, errorId: crypto.randomUUID().slice(0, 8) };
  }

  componentDidCatch(error: Error) {
    // Log only the error message — never the full stack or component state,
    // which could contain financial data.
    console.error('[App Error]', error.message);
    // TODO: send error.message + errorId to your monitoring service (e.g. Sentry)
    // Never send props/state snapshots — they may contain financial data.
  }

  handleReload = () => {
    this.setState({ hasError: false, errorId: '' });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-surface flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface-container-low rounded-2xl p-8 border border-outline-variant/15 text-center space-y-4">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold text-on-surface">אירעה שגיאה בלתי צפויה</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            לא ניתן לטעון את האפליקציה. הנתונים שלך שמורים ולא הושפעו.
          </p>
          <p className="text-xs text-on-surface-variant font-mono bg-surface-container-high px-3 py-1 rounded-lg">
            קוד שגיאה: {this.state.errorId}
          </p>
          <button
            onClick={this.handleReload}
            className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-sm hover:opacity-90 transition-opacity"
          >
            רענן ונסה שוב
          </button>
        </div>
      </div>
    );
  }
}
