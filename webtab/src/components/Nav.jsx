import { useAuth }  from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { FEATURE_REGISTRY, FEATURE_ORDER } from '../config/featureRegistry';

// ─── OrcaLogo ─────────────────────────────────────────────────────────────────
// Uses the real Orca Estrate SVG mark. On the dark sidebar (#0F172A) the logo's
// own dark circular border (#0F1B31) blends with the background, leaving a clean
// floating white orca silhouette — no extra styling required.
function OrcaLogo({ size = 32 }) {
  return (
    <img
      src="/orca-logo.svg"
      alt="Orca Estrate"
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0 }}
      draggable={false}
    />
  );
}

// ─── ThemeToggle ──────────────────────────────────────────────────────────────
// Exported — used in both Sidebar (desktop) and Shell mobile header (mobile)
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        width: 28, height: 28,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', flexShrink: 0,
        transition: 'background 150ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.10)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
    >
      {dark ? (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.55)" strokeWidth={1.8}>
          <circle cx="12" cy="12" r="5"/>
          <path strokeLinecap="round" d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      ) : (
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.55)" strokeWidth={1.8}>
          <path strokeLinecap="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
        </svg>
      )}
    </button>
  );
}

// ─── Sidebar (desktop) ───────────────────────────────────────────────────────
export function Sidebar({ active, onNavigate }) {
  const { auth }  = useAuth();
  const visibleFeatures = FEATURE_ORDER.filter(f => auth.features.includes(f));
  const initials = auth.employeeId
    ? auth.employeeId.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'U'
    : 'U';

  return (
    <aside style={{
      width: 220,
      flexShrink: 0,
      background: '#0F172A',
      flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.05)',
    }}
    className="hidden md:flex"
    >
      {/* Brand header */}
      <div style={{
        padding: '18px 16px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 11,
      }}>
        <OrcaLogo size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: '#fff',
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: '0.025em',
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}>
            ORCA Payroll
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.30)',
            fontSize: 9,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            marginTop: 2,
            whiteSpace: 'nowrap',
          }}>
            by Orca Estrate
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {visibleFeatures.map(featureKey => {
          const { label, Icon } = FEATURE_REGISTRY[featureKey];
          const isActive = active === featureKey;
          return (
            <button
              key={featureKey}
              onClick={() => onNavigate(featureKey)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '8px 10px',
                borderRadius: 0,
                background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                borderLeft: isActive ? '2.5px solid #6366F1' : '2.5px solid transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                fontSize: 12.5,
                fontWeight: isActive ? 500 : 400,
                cursor: 'pointer',
                transition: 'all 120ms',
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.65)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.35)';
                }
              }}
            >
              <span style={{ color: isActive ? '#818CF8' : 'rgba(255,255,255,0.30)', flexShrink: 0 }}>
                <Icon />
              </span>
              {label}
            </button>
          );
        })}
      </nav>

      {/* User + theme toggle footer */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}>
        {/* Avatar */}
        <div style={{
          width: 28, height: 28,
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.18)',
          border: '1px solid rgba(99,102,241,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{ color: '#A5B4FC', fontSize: 10, fontWeight: 600 }}>{initials}</span>
        </div>

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'rgba(255,255,255,0.75)',
            fontSize: 11,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {auth.employeeId || '—'}
          </div>
          <div style={{
            color: 'rgba(255,255,255,0.28)',
            fontSize: 10,
            textTransform: 'capitalize',
          }}>
            {auth.role || '—'}
          </div>
        </div>

        {/* Theme toggle */}
        <ThemeToggle />
      </div>
    </aside>
  );
}

// ─── Bottom Nav (mobile) ─────────────────────────────────────────────────────
export function BottomNav({ active, onNavigate }) {
  const { auth } = useAuth();
  const visibleFeatures = FEATURE_ORDER.filter(f => auth.features.includes(f));

  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#0F172A',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      zIndex: 40,
      display: 'flex',
    }}
    className="md:hidden"
    >
      {visibleFeatures.map(featureKey => {
        const { label, Icon } = FEATURE_REGISTRY[featureKey];
        const isActive = active === featureKey;
        return (
          <button
            key={featureKey}
            onClick={() => onNavigate(featureKey)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 4px',
              gap: 3,
              color: isActive ? '#818CF8' : 'rgba(255,255,255,0.30)',
              fontSize: 10,
              fontWeight: isActive ? 500 : 400,
              cursor: 'pointer',
              background: 'transparent',
              position: 'relative',
              fontFamily: 'inherit',
              transition: 'color 120ms',
              borderTop: isActive ? '2px solid #6366F1' : '2px solid transparent',
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
