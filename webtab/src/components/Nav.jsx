import { useState, useEffect } from 'react';
import { useAuth }   from '../context/AuthContext';
import { useTheme }  from '../context/ThemeContext';
import { FEATURE_REGISTRY, FEATURE_ORDER } from '../config/featureRegistry';

// ─── Nav group config — defines which features collapse under a parent label ──
const NAV_GROUPS = {
  payroll_engine: {
    label:    'Payroll Engine',
    Icon:     IconPayrollEngine,
    features: ['feature_run_payroll', 'feature_queue_monitor'],
  },
};

function IconPayrollEngine() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

// ─── OrcaLogo ─────────────────────────────────────────────────────────────────
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

// ─── ContactCard ──────────────────────────────────────────────────────────────
function ContactCard() {
  const [flipped, setFlipped] = useState(false);

  return (
    <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      <div
        onClick={() => setFlipped(f => !f)}
        style={{ position: 'relative', height: 76, cursor: 'pointer', perspective: 800 }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          transformStyle: 'preserve-3d',
          transition: 'transform 380ms ease',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}>

          {/* Front */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24"
              stroke="rgba(255,255,255,0.35)" strokeWidth={1.8}
              style={{ opacity: flipped ? 0 : 1, transition: 'opacity 120ms' }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span style={{
              fontSize: 11.5, fontWeight: 500, color: 'rgba(255,255,255,0.40)',
              opacity: flipped ? 0 : 1, transition: 'opacity 120ms',
            }}>
              Contact Us
            </span>
          </div>

          {/* Back */}
          <div style={{
            position: 'absolute', inset: 0,
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', gap: 9,
            padding: '0 10px',
          }}>
            <OrcaLogo size={22} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                fontSize: 10, color: 'rgba(255,255,255,0.65)',
                marginBottom: 4, lineHeight: 1.35,
                wordBreak: 'break-all',
              }}>
                www.ORCA-estrate.com
              </div>
              <div style={{
                fontSize: 10, color: 'rgba(255,255,255,0.40)',
                lineHeight: 1.35, wordBreak: 'break-all',
              }}>
                Payroll@ORCA-estrate.com
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Sidebar (desktop) ───────────────────────────────────────────────────────
export function Sidebar({ active, onNavigate }) {
  const { auth } = useAuth();
  const visibleFeatures = FEATURE_ORDER.filter(f => auth.features.includes(f));
  const visibleMain     = visibleFeatures.filter(f => f !== 'feature_settings');
  const initials = auth.employeeId
    ? auth.employeeId.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'U'
    : 'U';

  // Open groups that contain the active feature
  const [openGroups, setOpenGroups] = useState(() => {
    const init = {};
    Object.keys(NAV_GROUPS).forEach(gk => {
      if (NAV_GROUPS[gk].features.includes(active)) init[gk] = true;
    });
    return init;
  });

  // Auto-open group when navigation lands on a child feature
  useEffect(() => {
    const gk = Object.keys(NAV_GROUPS).find(k => NAV_GROUPS[k].features.includes(active));
    if (gk) setOpenGroups(prev => prev[gk] ? prev : { ...prev, [gk]: true });
  }, [active]);

  // Build flat render list: group headers + ungrouped features in order
  const featuresInGroups = new Set(Object.values(NAV_GROUPS).flatMap(g => g.features));
  const renderedGroups   = new Set();
  const navItems = [];
  visibleMain.forEach(fk => {
    const gk = Object.keys(NAV_GROUPS).find(k => NAV_GROUPS[k].features.includes(fk));
    if (gk) {
      if (!renderedGroups.has(gk)) {
        renderedGroups.add(gk);
        navItems.push({ type: 'group', gk, children: NAV_GROUPS[gk].features.filter(f => visibleMain.includes(f)) });
      }
    } else {
      navItems.push({ type: 'feature', fk });
    }
  });

  // Shared button style factory
  const navBtn = (isActive) => ({
    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
    padding: '8px 10px', borderRadius: 0,
    background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
    borderLeft: isActive ? '2.5px solid #6366F1' : '2.5px solid transparent',
    color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
    fontSize: 12.5, fontWeight: isActive ? 500 : 400,
    cursor: 'pointer', transition: 'all 120ms',
    textAlign: 'left', fontFamily: 'inherit',
    border: 'none',
  });
  const navBtnHover  = { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.65)' };
  const navBtnLeave  = { background: 'transparent',            color: 'rgba(255,255,255,0.35)' };

  return (
    <aside style={{
      width: 220, flexShrink: 0, background: '#0F172A',
      flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.05)',
    }}
    className="hidden md:flex"
    >
      {/* Brand header */}
      <div style={{
        padding: '18px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 11,
      }}>
        <OrcaLogo size={34} />
        <div style={{ minWidth: 0 }}>
          <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 700, letterSpacing: '0.025em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
            ORCA Payroll
          </div>
          <div style={{ color: 'rgba(255,255,255,0.30)', fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 2, whiteSpace: 'nowrap' }}>
            by Orca Estrate
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(item => {

          // ── Ungrouped feature ──────────────────────────────────────────────
          if (item.type === 'feature') {
            const { label, Icon } = FEATURE_REGISTRY[item.fk];
            const isActive = active === item.fk;
            return (
              <button key={item.fk} onClick={() => onNavigate(item.fk)}
                style={navBtn(isActive)}
                onMouseEnter={e => { if (!isActive) Object.assign(e.currentTarget.style, navBtnHover); }}
                onMouseLeave={e => { if (!isActive) Object.assign(e.currentTarget.style, navBtnLeave); }}
              >
                <span style={{ color: isActive ? '#818CF8' : 'rgba(255,255,255,0.30)', flexShrink: 0 }}><Icon /></span>
                {label}
              </button>
            );
          }

          // ── Group (accordion) ──────────────────────────────────────────────
          const { label, Icon } = NAV_GROUPS[item.gk];
          const isGroupActive = item.children.some(f => f === active);
          const isOpen        = openGroups[item.gk];
          const toggleGroup   = () => setOpenGroups(prev => ({ ...prev, [item.gk]: !prev[item.gk] }));

          return (
            <div key={item.gk}>
              {/* Group header */}
              <button onClick={toggleGroup}
                style={{
                  ...navBtn(isGroupActive),
                  justifyContent: 'space-between',
                  borderLeft: isGroupActive ? '2.5px solid #6366F1' : '2.5px solid transparent',
                }}
                onMouseEnter={e => { if (!isGroupActive) Object.assign(e.currentTarget.style, { ...navBtnHover, borderLeft: '2.5px solid transparent' }); }}
                onMouseLeave={e => { if (!isGroupActive) Object.assign(e.currentTarget.style, { ...navBtnLeave, borderLeft: '2.5px solid transparent' }); }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ color: isGroupActive ? '#818CF8' : 'rgba(255,255,255,0.30)', flexShrink: 0 }}><Icon /></span>
                  <span style={{ fontSize: 12.5, fontWeight: isGroupActive ? 500 : 400, whiteSpace: 'nowrap' }}>{label}</span>
                </span>
                {/* Chevron */}
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24"
                  stroke={isGroupActive ? 'rgba(255,255,255,0.50)' : 'rgba(255,255,255,0.20)'} strokeWidth={2.2}
                  style={{ flexShrink: 0, transition: 'transform 220ms ease', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                </svg>
              </button>

              {/* Sub-items */}
              {isOpen && (
                <div style={{
                  marginLeft: 20, marginTop: 1, marginBottom: 2,
                  paddingLeft: 8,
                  borderLeft: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {item.children.map(fk => {
                    const { label: subLabel, Icon: SubIcon } = FEATURE_REGISTRY[fk];
                    const isActive = active === fk;
                    return (
                      <button key={fk} onClick={() => onNavigate(fk)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 8px', borderRadius: 0, border: 'none',
                          borderLeft: isActive ? '2px solid #6366F1' : '2px solid transparent',
                          background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                          color: isActive ? '#fff' : 'rgba(255,255,255,0.30)',
                          fontSize: 12, fontWeight: isActive ? 500 : 400,
                          cursor: 'pointer', transition: 'all 120ms',
                          textAlign: 'left', fontFamily: 'inherit',
                        }}
                        onMouseEnter={e => { if (!isActive) Object.assign(e.currentTarget.style, { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.60)' }); }}
                        onMouseLeave={e => { if (!isActive) Object.assign(e.currentTarget.style, { background: 'transparent', color: 'rgba(255,255,255,0.30)' }); }}
                      >
                        <span style={{ color: isActive ? '#818CF8' : 'rgba(255,255,255,0.22)', flexShrink: 0 }}><SubIcon /></span>
                        {subLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Settings — pinned just above user card */}
      {visibleFeatures.includes('feature_settings') && (() => {
        const { label, Icon } = FEATURE_REGISTRY['feature_settings'];
        const isActive = active === 'feature_settings';
        return (
          <div style={{ padding: '0 8px 6px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <button
              onClick={() => onNavigate('feature_settings')}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 0, marginTop: 6,
                background: isActive ? 'rgba(99,102,241,0.10)' : 'transparent',
                borderLeft: isActive ? '2.5px solid #6366F1' : '2.5px solid transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.35)',
                fontSize: 12.5, fontWeight: isActive ? 500 : 400,
                cursor: 'pointer', transition: 'all 120ms',
                textAlign: 'left', fontFamily: 'inherit',
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
          </div>
        );
      })()}

      {/* User + theme toggle */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 9,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'rgba(99,102,241,0.18)',
          border: '1px solid rgba(99,102,241,0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span style={{ color: '#A5B4FC', fontSize: 10, fontWeight: 600 }}>{initials}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {auth.employeeId || '—'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 10, textTransform: 'capitalize' }}>
            {auth.role || '—'}
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Contact card */}
      <ContactCard />
    </aside>
  );
}

// ─── Bottom Nav (mobile) ─────────────────────────────────────────────────────
export function BottomNav() {
  return null;
}
