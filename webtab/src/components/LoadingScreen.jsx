// ─── Branded loading / error screens ─────────────────────────────────────────
// All screens use the fixed dark brand background (#0F172A) for a consistent
// first impression regardless of the user's dark/light preference.

const SIDEBAR_BG = '#0F172A';
const ACCENT     = '#6366F1';
const ACCENT_DIM = 'rgba(99,102,241,0.12)';

function OrcaMark({ size = 48 }) {
  return (
    <img
      src="/orca-logo.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      style={{ display: 'block' }}
      draggable={false}
    />
  );
}

// ─── LoadingScreen ────────────────────────────────────────────────────────────
export function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100dvh',
      background: SIDEBAR_BG,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
    }}>
      {/* Logo mark */}
      <div style={{
        width: 56, height: 56,
        background: ACCENT_DIM,
        borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(99,102,241,0.18)',
      }}>
        <OrcaMark size={40} />
      </div>

      {/* Product identity */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          color: '#fff',
          fontSize: 15,
          fontWeight: 700,
          letterSpacing: '0.03em',
          lineHeight: 1.2,
        }}>
          ORCA Payroll
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.28)',
          fontSize: 9.5,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginTop: 3,
        }}>
          by Orca Estrate
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: 48,
        height: 2,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 99,
        overflow: 'hidden',
        marginTop: 4,
      }}>
        <div style={{
          height: '100%',
          width: '40%',
          background: ACCENT,
          borderRadius: 99,
          animation: 'orca-slide 1.4s ease-in-out infinite',
        }} />
      </div>

      <div style={{
        color: 'rgba(255,255,255,0.25)',
        fontSize: 10,
        letterSpacing: '0.02em',
      }}>
        Initialising portal…
      </div>

      <style>{`
        @keyframes orca-slide {
          0%   { transform: translateX(-120%); }
          50%  { transform: translateX(80%); }
          100% { transform: translateX(200%); }
        }
      `}</style>
    </div>
  );
}

// ─── AccessDenied ─────────────────────────────────────────────────────────────
export function AccessDenied({ employeeId }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: SIDEBAR_BG,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '0 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52,
        background: 'rgba(239,68,68,0.10)',
        border: '1px solid rgba(239,68,68,0.20)',
        borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
      }}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
          stroke="rgba(252,165,165,0.9)" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"/>
        </svg>
      </div>

      <div>
        <div style={{ marginBottom: 6 }}>
          <OrcaMark size={22} />
        </div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Access Denied</div>
        <div style={{
          color: 'rgba(255,255,255,0.28)',
          fontSize: 9,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          marginTop: 2,
        }}>ORCA Payroll · by Orca Estrate</div>
      </div>

      <p style={{
        color: 'rgba(255,255,255,0.45)',
        fontSize: 12.5,
        lineHeight: 1.55,
        maxWidth: 280,
        marginTop: 4,
      }}>
        Employee ID{' '}
        <span style={{
          fontFamily: 'monospace',
          color: 'rgba(255,255,255,0.65)',
          background: 'rgba(255,255,255,0.06)',
          padding: '1px 6px',
          borderRadius: 4,
        }}>
          {employeeId || '—'}
        </span>
        {' '}does not have access to this portal. Contact your system administrator.
      </p>
    </div>
  );
}

// ─── RoleRevokedScreen ────────────────────────────────────────────────────────
export function RoleRevokedScreen({ employeeId }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: SIDEBAR_BG,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', textAlign: 'center', gap: 0,
    }}>

      {/* Icon */}
      <div style={{
        width: 58, height: 58,
        background: 'rgba(245,158,11,0.10)',
        border: '1px solid rgba(245,158,11,0.22)',
        borderRadius: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 22,
      }}>
        <svg width="26" height="26" fill="none" viewBox="0 0 24 24"
          stroke="rgba(253,186,116,0.9)" strokeWidth={1.7}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
        </svg>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: '0.01em' }}>
          Access Suspended
        </div>
        <div style={{
          color: 'rgba(255,255,255,0.25)', fontSize: 9,
          letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4,
        }}>
          ORCA Payroll · by Orca Estrate
        </div>
      </div>

      {/* Message */}
      <p style={{
        color: 'rgba(255,255,255,0.42)', fontSize: 13,
        lineHeight: 1.65, maxWidth: 300, marginBottom: 32,
      }}>
        Your role access was suspended. Please contact your Admin.
      </p>

      {/* Contact card */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 14, padding: '18px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
        maxWidth: 310, width: '100%',
      }}>
        <OrcaMark size={34} />
        <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9.5, fontWeight: 700,
            color: 'rgba(255,255,255,0.30)',
            textTransform: 'uppercase', letterSpacing: '0.08em',
            marginBottom: 9,
          }}>
            Contact Orca
          </div>
          <div style={{
            fontSize: 12, color: 'rgba(255,255,255,0.62)',
            marginBottom: 5, wordBreak: 'break-all',
          }}>
            www.ORCA-estrate.com
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', wordBreak: 'break-all' }}>
            Payroll@ORCA-estrate.com
          </div>
        </div>
      </div>

    </div>
  );
}

// ─── ErrorScreen ─────────────────────────────────────────────────────────────
export function ErrorScreen({ message, onRetry }) {
  return (
    <div style={{
      minHeight: '100dvh',
      background: SIDEBAR_BG,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      padding: '0 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52,
        background: 'rgba(245,158,11,0.10)',
        border: '1px solid rgba(245,158,11,0.20)',
        borderRadius: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 4,
      }}>
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
          stroke="rgba(252,211,77,0.9)" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.924-.833-2.694 0L3.732 16.5c-.77.833.193 2.5 1.732 2.5z"/>
        </svg>
      </div>

      <div>
        <div style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>Something went wrong</div>
        <div style={{
          color: 'rgba(255,255,255,0.28)',
          fontSize: 9,
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          marginTop: 2,
        }}>ORCA Payroll · by Orca Estrate</div>
      </div>

      {message && (
        <p style={{
          color: 'rgba(255,255,255,0.40)',
          fontSize: 12.5,
          lineHeight: 1.55,
          maxWidth: 280,
          marginTop: 4,
        }}>
          {message}
        </p>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: 8,
            padding: '8px 20px',
            background: ACCENT,
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'opacity 120ms',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Retry
        </button>
      )}
    </div>
  );
}
