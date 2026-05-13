import { useState, useEffect, useRef } from 'react';

const MONTHS     = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const ACCENT     = '#6366F1';
const ACCENT_BG  = '#EEF2FF';
const ACCENT_TEXT = '#3730A3';

// ─── MonthPicker ─────────────────────────────────────────────────────────────
// value:    "YYYY-MM" string (controlled)
// onChange: called with new "YYYY-MM" string
// align:    'left' | 'right' — which edge the dropdown anchors to
//
// Validation: future months (past current month) are disabled and unselectable.
// Scroll wheel on the trigger button cycles months backward/forward.
export function MonthPicker({ value, onChange, align = 'left' }) {
  const now      = new Date();
  const nowYear  = now.getFullYear();
  const nowMonth = now.getMonth(); // 0-indexed

  const selYear  = value ? parseInt(value.split('-')[0])     : null;
  const selMonth = value ? parseInt(value.split('-')[1]) - 1 : null; // 0-indexed

  const [open,     setOpen]     = useState(false);
  const [viewYear, setViewYear] = useState(selYear ?? nowYear);
  const containerRef = useRef(null);

  // Sync view year when controlled value changes
  useEffect(() => { if (selYear) setViewYear(selYear); }, [selYear]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const canNextYear = viewYear < nowYear;

  const displayText = (selYear !== null && selMonth !== null)
    ? `${MONTHS[selMonth]} ${selYear}`
    : 'Select period';

  // Scroll wheel on trigger — cycle months
  const handleWheel = e => {
    e.preventDefault();
    if (!value) return;
    let y = selYear, m = selMonth;
    if (e.deltaY < 0) { m--; if (m < 0)  { m = 11; y--; } }
    else               { m++; if (m > 11) { m = 0;  y++; } }
    if (y > nowYear || (y === nowYear && m > nowMonth)) return;
    onChange(`${y}-${String(m + 1).padStart(2, '0')}`);
  };

  const handleSelect = monthIdx => {
    if (viewYear > nowYear || (viewYear === nowYear && monthIdx > nowMonth)) return;
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-block' }}>

      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(o => !o)}
        onWheel={handleWheel}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px',
          background: open ? 'var(--surface-raised)' : 'var(--surface)',
          border: `1px solid ${open ? ACCENT : 'var(--border)'}`,
          borderRadius: 8, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'border-color 120ms, background 120ms',
          color: value ? 'var(--text-primary)' : 'var(--text-muted)',
          userSelect: 'none',
        }}
      >
        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} style={{ flexShrink: 0, opacity: 0.55 }}>
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
        <span style={{ fontSize: 13, fontWeight: value ? 500 : 400, minWidth: 76 }}>
          {displayText}
        </span>
        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', opacity: 0.4, flexShrink: 0 }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)',
          ...(align === 'right' ? { right: 0 } : { left: 0 }),
          zIndex: 200,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          boxShadow: '0 8px 28px rgba(0,0,0,0.13)',
          padding: 14,
          width: 216,
        }}>

          {/* Year navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button
              onClick={() => setViewYear(y => y - 1)}
              style={{
                width: 28, height: 28, borderRadius: 7, cursor: 'pointer',
                background: 'var(--surface-raised)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)',
              }}
            >
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
            </button>

            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>
              {viewYear}
            </span>

            <button
              onClick={() => { if (canNextYear) setViewYear(y => y + 1); }}
              style={{
                width: 28, height: 28, borderRadius: 7,
                cursor: canNextYear ? 'pointer' : 'not-allowed',
                background: canNextYear ? 'var(--surface-raised)' : 'transparent',
                border: `1px solid ${canNextYear ? 'var(--border)' : 'transparent'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--text-secondary)',
                opacity: canNextYear ? 1 : 0.25,
              }}
            >
              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
              </svg>
            </button>
          </div>

          {/* Scroll hint */}
          <p style={{ fontSize: 9.5, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 10, letterSpacing: '0.04em' }}>
            Scroll wheel on picker to cycle months
          </p>

          {/* Month grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
            {MONTHS.map((m, i) => {
              const isDisabled = viewYear > nowYear || (viewYear === nowYear && i > nowMonth);
              const isSelected = viewYear === selYear && i === selMonth;
              const isCurrent  = viewYear === nowYear && i === nowMonth;

              return (
                <button
                  key={m}
                  onClick={() => handleSelect(i)}
                  disabled={isDisabled}
                  style={{
                    padding: '8px 4px', borderRadius: 8,
                    fontSize: 12, fontWeight: isSelected ? 700 : 400,
                    background: isSelected ? ACCENT : isCurrent && !isSelected ? ACCENT_BG : 'transparent',
                    color: isSelected ? '#fff'
                      : isDisabled    ? 'var(--border-strong)'
                      : isCurrent     ? ACCENT_TEXT
                      : 'var(--text-primary)',
                    border: isCurrent && !isSelected ? `1px solid rgba(99,102,241,0.3)` : '1px solid transparent',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'background 120ms, color 120ms',
                  }}
                  onMouseEnter={e => { if (!isDisabled && !isSelected) e.currentTarget.style.background = 'var(--surface-raised)'; }}
                  onMouseLeave={e => {
                    if (!isSelected) e.currentTarget.style.background = isCurrent ? ACCENT_BG : 'transparent';
                  }}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
