import { createContext, useContext, useState, useCallback } from 'react';

// ─── Auth Context ─────────────────────────────────────────────────────────────
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    loading:         true,
    denied:          false,
    employeeId:      null,
    role:            null,
    features:        [],
    payrollSettings: null,
    portalConfig:    null,
    error:           null
  });

  return (
    <AuthContext.Provider value={{ auth, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ─── Toast Context ────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ─── Toast config ─────────────────────────────────────────────────────────────
const TOAST_CONFIG = {
  success: { border: '#16A34A', iconBg: 'rgba(22,163,74,0.18)',  icon: '✓' },
  error:   { border: '#DC2626', iconBg: 'rgba(220,38,38,0.18)',  icon: '✕' },
  warning: { border: '#D97706', iconBg: 'rgba(217,119,6,0.18)',  icon: '!' },
  info:    { border: '#6366F1', iconBg: 'rgba(99,102,241,0.18)', icon: 'i' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const show = useCallback((message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {/* Toast container — fixed, above bottom nav on mobile, top-right on desktop */}
      <div style={{
        position: 'fixed',
        bottom: 80,   /* above mobile bottom nav (64px) */
        right: 16,
        zIndex: 60,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxWidth: 320,
        width: 'calc(100vw - 32px)',
      }}
      className="md:bottom-6"
      >
        {toasts.map(t => {
          const cfg = TOAST_CONFIG[t.type] || TOAST_CONFIG.info;
          return (
            <div key={t.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#0F172A',
              border: '1px solid rgba(255,255,255,0.08)',
              borderLeft: `3px solid ${cfg.border}`,
              borderRadius: 9,
              padding: '10px 14px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
              animation: 'orca-toast-slide 200ms ease forwards',
              fontFamily: "'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
            }}>
              {/* Type icon */}
              <span style={{
                width: 20, height: 20, borderRadius: '50%',
                background: cfg.iconBg, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10.5, fontWeight: 700, color: cfg.border,
              }}>
                {cfg.icon}
              </span>
              {/* Message */}
              <span style={{ fontSize: 12.5, color: '#F1F5F9', flex: 1, lineHeight: 1.45 }}>
                {t.message}
              </span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
