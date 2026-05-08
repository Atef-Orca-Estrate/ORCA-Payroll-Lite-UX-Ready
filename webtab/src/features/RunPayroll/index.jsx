import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT       = '#6366F1';
const ACCENT_BG    = '#EEF2FF';
const ACCENT_TEXT  = '#3730A3';
const ACCENT_MUTED = '#818CF8';
const GRAPHITE     = '#111827';
const GRAPHITE_H   = '#1F2937';

const fmtEGP = (val) =>
  val == null ? '—'
  : 'EGP ' + Number(val).toLocaleString('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STEP_FOR_STATUS = { Draft: 2, Processing: 3, Completed: 4 };

// ─── Stepper ──────────────────────────────────────────────────────────────────
function Stepper({ step }) {
  const steps = ['Setup', 'Review', 'Running', 'Complete'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px 10px', flexShrink: 0 }}>
      {steps.map((label, i) => {
        const idx    = i + 1;
        const done   = step > idx;
        const active = step === idx;
        const circleBg = done ? '#16A34A' : active ? ACCENT : 'var(--surface-inset)';
        const circleColor = done || active ? '#fff' : 'var(--text-muted)';
        const labelColor  = active ? ACCENT : done ? '#16A34A' : 'var(--text-muted)';
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
              <div style={{
                width: 28, height: 28,
                borderRadius: '50%',
                background: circleBg,
                border: !done && !active ? '1.5px solid var(--border-strong)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                fontSize: 11, fontWeight: 600,
                color: circleColor,
                transition: 'all 200ms',
              }}>
                {done ? (
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
                  </svg>
                ) : idx}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: active ? 600 : 400, color: labelColor, whiteSpace: 'nowrap', transition: 'color 200ms' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{
                flex: 1, height: 2, borderRadius: 99,
                background: step > idx + 1 ? '#16A34A' : step === idx + 1 ? ACCENT : 'var(--border)',
                margin: '0 10px',
                transition: 'background 200ms',
              }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shared button styles ─────────────────────────────────────────────────────
function PrimaryBtn({ onClick, disabled, loading, children, style = {} }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '10px 16px',
        background: disabled ? 'var(--surface-inset)' : GRAPHITE,
        color: disabled ? 'var(--text-muted)' : '#fff',
        border: 'none', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'inherit', transition: 'background 120ms',
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = GRAPHITE_H; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = GRAPHITE; }}
    >
      {loading && <Spinner size={14} color="#fff" />}
      {children}
    </button>
  );
}

function GreenBtn({ onClick, disabled, loading, children }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{
        width: '100%', padding: '10px 16px',
        background: disabled ? 'var(--surface-inset)' : '#16A34A',
        color: disabled ? 'var(--text-muted)' : '#fff',
        border: 'none', borderRadius: 8,
        fontSize: 13, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        fontFamily: 'inherit', transition: 'background 120ms',
      }}
      onMouseEnter={e => { if (!disabled) e.currentTarget.style.background = '#15803D'; }}
      onMouseLeave={e => { if (!disabled) e.currentTarget.style.background = '#16A34A'; }}
    >
      {loading && <Spinner size={14} color="#fff" />}
      {children}
    </button>
  );
}

function Spinner({ size = 14, color = ACCENT }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(255,255,255,0.25)`,
      borderTopColor: color,
      borderRadius: '50%',
      animation: 'orca-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ─── Step 1 — Setup ───────────────────────────────────────────────────────────
function StepSetup({ onCreated }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();
  const [period,  setPeriod]  = useState(currentMonth());
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!period) { showToast('Select a period first', 'warning'); return; }
    setLoading(true);
    try {
      const result = await gateway.invoke('portalCreateMPS', { payroll_period: period });
      if (result.status === 'success') { showToast('Payroll setup created', 'success'); onCreated(result); }
      else showToast(result.message || 'Failed to create setup', 'error');
    } catch { showToast('Error creating setup', 'error'); }
    finally  { setLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, padding: '4px 0 12px' }}>
        <label style={{ display: 'block', fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
          Payroll period
        </label>
        <input type="month" value={period} onChange={e => setPeriod(e.target.value)}
          style={{
            width: '100%', border: '1px solid var(--border)',
            borderRadius: 8, padding: '8px 12px', fontSize: 13,
            background: 'var(--surface)', color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = ACCENT}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />
      </div>
      {/* Sticky CTA */}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'var(--surface)' }}>
        <PrimaryBtn onClick={handleCreate} disabled={loading} loading={loading}>
          {loading ? 'Creating…' : 'Create setup'}
        </PrimaryBtn>
      </div>
    </div>
  );
}

// ─── Step 2 — Review ──────────────────────────────────────────────────────────
function StepReview({ run, onRun }) {
  const gateway = useGateway();
  const { auth } = useAuth();
  const { show: showToast } = useToast();
  const allowOverride = auth.portalConfig?.allow_working_days_override;
  const [overriding,   setOverriding]   = useState(false);
  const [workingDays,  setWorkingDays]  = useState(run.working_days);
  const [saving,       setSaving]       = useState(false);
  const [running,      setRunning]      = useState(false);

  const handleSaveOverride = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalUpdateMPS', { payroll_period: run.period, new_working_days: workingDays });
      if (result.status === 'success') { showToast('Working days updated', 'success'); setOverriding(false); }
      else showToast(result.message || 'Override failed', 'error');
    } finally { setSaving(false); }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await gateway.invoke('portalTriggerOrchestrator', { payroll_period: run.period });
      if (result.status === 'success') {
        showToast(`Run started — ${result.queued} employees queued`, 'success');
        onRun(result);
      } else { showToast(result.message || 'Run failed', 'error'); setRunning(false); }
    } catch { showToast('Failed to trigger run', 'error'); setRunning(false); }
  };

  const scopeLabel = { all: 'All active employees', by_department: 'By department', by_employee: 'Selected employees' }[auth?.payrollSettings?.payroll_run?.scope] || 'All active employees';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, paddingBottom: 12 }}>
        {/* Config rows */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
          {[['Period', run.period], ['Scope', scopeLabel]].map(([label, value]) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', background: 'var(--surface-raised)',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
            </div>
          ))}
          {/* Working days row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: 'var(--surface-raised)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Working days</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {overriding ? (
                <input type="number" min={1} max={31} value={workingDays}
                  onChange={e => setWorkingDays(Number(e.target.value))}
                  style={{
                    width: 52, border: '1px solid var(--border)', borderRadius: 6,
                    padding: '2px 8px', fontSize: 12, textAlign: 'right',
                    background: 'var(--surface)', color: 'var(--text-primary)',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => e.target.style.borderColor = ACCENT}
                  onBlur={e  => e.target.style.borderColor = 'var(--border)'}
                />
              ) : (
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{workingDays}</span>
              )}
              {allowOverride && !overriding && (
                <button onClick={() => setOverriding(true)}
                  style={{ fontSize: 11, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  Override
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Override save/cancel */}
        {overriding && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={handleSaveOverride} disabled={saving}
              style={{
                flex: 1, padding: '7px 12px', background: ACCENT, color: '#fff',
                border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 500,
                cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontFamily: 'inherit',
              }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setOverriding(false); setWorkingDays(run.working_days); }}
              style={{
                flex: 1, padding: '7px 12px', background: 'none',
                border: '1px solid var(--border)', borderRadius: 7, fontSize: 12, fontWeight: 500,
                color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Cancel
            </button>
          </div>
        )}

        {/* Holidays */}
        {run.holidays && (
          <div style={{ marginBottom: 8 }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
              Public holidays
            </p>
            <div style={{
              background: 'var(--surface-raised)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 12px',
            }}>
              {run.holidays.split('\n').map((h, i) => (
                <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace', padding: '2px 0' }}>{h}</p>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'var(--surface)' }}>
        <GreenBtn onClick={handleRun} disabled={running || overriding} loading={running}>
          {running ? 'Starting…' : 'Run payroll'}
        </GreenBtn>
      </div>
    </div>
  );
}

// ─── Step 3 — Running ─────────────────────────────────────────────────────────
function StepRunning({ run, countdown }) {
  const total = run.employees || 1;
  const done  = run.done  || 0;
  const err   = run.error || 0;
  const rem   = run.pending || 0;
  const pct   = Math.round((done / total) * 100);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
      <div style={{
        background: ACCENT_BG, border: `1px solid var(--accent-border)`,
        borderRadius: 8, padding: '10px 12px',
      }}>
        <p style={{ fontSize: 12.5, fontWeight: 500, color: ACCENT_TEXT }}>
          {run.employees} employees · {run.batches} batch{run.batches !== 1 ? 'es' : ''}
        </p>
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>Processing — refresh in {countdown}s</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: ACCENT, borderRadius: 99, transition: 'width 500ms ease' }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Done',      val: done, bg: 'rgba(22,163,74,0.08)',   color: '#16A34A' },
          { label: 'Remaining', val: rem,  bg: 'rgba(245,158,11,0.08)',  color: '#B45309' },
          { label: 'Errors',    val: err,  bg: 'rgba(239,68,68,0.08)',   color: '#DC2626' },
        ].map(({ label, val, bg, color }) => (
          <div key={label} style={{ background: bg, borderRadius: 8, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            <div style={{ fontSize: 10.5, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4 — Complete ────────────────────────────────────────────────────────
function StepComplete({ run, onViewReport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.20)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2.5} style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
          <p style={{ fontSize: 12.5, fontWeight: 500, color: '#15803D' }}>
            {run.employees} employees processed — {run.period}
          </p>
        </div>

        {run.error > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)',
            borderRadius: 8, padding: '8px 12px',
          }}>
            <p style={{ fontSize: 12, color: '#DC2626' }}>
              {run.error} employee{run.error > 1 ? 's' : ''} errored — check records
            </p>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Gross salary', val: run.gross, accent: false },
            { label: 'Net paid',     val: run.net,   accent: true  },
            { label: 'Tax withheld', val: run.tax,   accent: false },
            { label: 'Employee SI',  val: run.si,    accent: false },
          ].map(({ label, val, accent }) => (
            <div key={label} style={{
              borderRadius: 8, padding: '10px 12px',
              background: accent ? ACCENT_BG : 'var(--surface-raised)',
              border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
            }}>
              <div style={{ fontSize: 10.5, color: accent ? ACCENT : 'var(--text-muted)' }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 600, marginTop: 3, color: accent ? ACCENT_TEXT : 'var(--text-primary)' }}>
                {fmtEGP(val)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky CTA */}
      <div style={{ position: 'sticky', bottom: 0, paddingTop: 8, background: 'var(--surface)' }}>
        <button onClick={onViewReport}
          style={{
            width: '100%', padding: '9px 16px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 8, fontSize: 12.5, fontWeight: 500,
            color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'inherit',
            transition: 'background 120ms, color 120ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-raised)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          View period report →
        </button>
      </div>
    </div>
  );
}

// ─── Wizard Card ──────────────────────────────────────────────────────────────
function WizardCard({ run, isNew, countdown, onCreated, onRun, onViewReport }) {
  const step = isNew ? 1 : (STEP_FOR_STATUS[run?.status] ?? 1);
  return (
    <div style={{
      flex: '1 1 0', minHeight: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Payroll wizard
        </span>
        {!isNew && run && (
          <span style={{
            fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 99,
            background: ACCENT_BG, color: ACCENT,
          }}>
            {run.period}
          </span>
        )}
      </div>

      <Stepper step={step} />

      {/* Scrollable step content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 16px' }}>
        {step === 1 && <StepSetup onCreated={onCreated} />}
        {step === 2 && run && <StepReview run={run} onRun={onRun} />}
        {step === 3 && run && <StepRunning run={run} countdown={countdown} />}
        {step === 4 && run && <StepComplete run={run} onViewReport={onViewReport} />}
      </div>
    </div>
  );
}

// ─── Runs List ────────────────────────────────────────────────────────────────
const STATUS_DOT = {
  Completed:  { bg: '#16A34A' },
  Processing: { bg: ACCENT, pulse: true },
  Draft:      { bg: 'var(--text-muted)' },
};

function RunsList({ runs, selectedPeriod, isNew, onSelectNew, onSelectRun }) {
  return (
    <div style={{
      flex: '1 1 0', minHeight: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    }}>
      <div style={{ flexShrink: 0, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Previous runs
        </span>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* New run row */}
        <div onClick={onSelectNew} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', cursor: 'pointer',
          borderBottom: '1px solid var(--border)',
          background: isNew ? ACCENT_BG : 'transparent',
          transition: 'background 120ms',
        }}
        onMouseEnter={e => { if (!isNew) e.currentTarget.style.background = 'var(--surface-raised)'; }}
        onMouseLeave={e => { if (!isNew) e.currentTarget.style.background = 'transparent'; }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            border: `2px dashed ${isNew ? ACCENT : 'var(--border-strong)'}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke={isNew ? ACCENT : 'var(--text-muted)'} strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: isNew ? ACCENT_TEXT : 'var(--text-secondary)' }}>
            New payroll run
          </span>
        </div>

        {/* Historical runs */}
        {runs === null ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <Spinner size={18} color={ACCENT} />
          </div>
        ) : runs.length === 0 ? (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>No previous runs</p>
        ) : runs.map(run => {
          const dot     = STATUS_DOT[run.status] || STATUS_DOT.Draft;
          const isSelected = !isNew && selectedPeriod === run.period;
          return (
            <div key={run.period} onClick={() => onSelectRun(run)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '11px 16px', cursor: 'pointer',
              borderBottom: '1px solid var(--border)',
              background: isSelected ? ACCENT_BG : 'transparent',
              transition: 'background 120ms',
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-raised)'; }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: dot.bg,
                boxShadow: dot.pulse ? `0 0 0 2px rgba(99,102,241,0.3)` : 'none',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: isSelected ? ACCENT_TEXT : 'var(--text-primary)' }}>{run.period}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  {run.employees} employees · {run.working_days} days
                </div>
              </div>
              <span style={{
                fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, flexShrink: 0,
                background: run.status === 'Completed' ? 'rgba(22,163,74,0.10)'
                  : run.status === 'Processing' ? ACCENT_BG : 'var(--surface-inset)',
                color: run.status === 'Completed' ? '#16A34A'
                  : run.status === 'Processing' ? ACCENT : 'var(--text-muted)',
              }}>
                {run.status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Record Row ───────────────────────────────────────────────────────────────
function RecordRow({ rec, isExpanded, onToggle }) {
  const hasFinancials = rec.pr_gross_salary != null;
  const statusColor = rec.status === 'Done' ? '#16A34A'
    : rec.status === 'Error' ? '#DC2626'
    : rec.status === 'Processing' ? ACCENT : 'var(--text-muted)';
  const statusBg = rec.status === 'Done' ? 'rgba(22,163,74,0.10)'
    : rec.status === 'Error' ? 'rgba(239,68,68,0.10)'
    : rec.status === 'Processing' ? ACCENT_BG : 'var(--surface-inset)';

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div onClick={hasFinancials ? onToggle : undefined} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '11px 16px',
        cursor: hasFinancials ? 'pointer' : 'default',
        background: isExpanded ? 'var(--surface-raised)' : 'transparent',
        transition: 'background 120ms',
      }}
      onMouseEnter={e => { if (hasFinancials && !isExpanded) e.currentTarget.style.background = 'var(--surface-raised)'; }}
      onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = 'transparent'; }}>
        <div style={{ minWidth: 0, marginRight: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{rec.employee_id}</div>
          {rec.error ? (
            <div style={{ fontSize: 11, color: '#DC2626', marginTop: 2 }}>{rec.error}</div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, textTransform: 'capitalize' }}>
              {rec.status.toLowerCase()}{rec.processed_at ? ` · ${rec.processed_at}` : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: statusBg, color: statusColor }}>
            {rec.status}
          </span>
          {hasFinancials && (
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={2}
              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 200ms', flexShrink: 0 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
            </svg>
          )}
        </div>
      </div>

      {isExpanded && hasFinancials && (
        <div style={{ padding: '4px 16px 16px', background: 'var(--surface-raised)' }}>
          {[
            { title: 'Earnings', rows: [
              ['Basic salary', rec.pr_basic_salary],
              ['Allowances', rec.pr_total_allowances],
              ['Gross salary', rec.pr_gross_salary],
            ]},
            { title: 'Deductions', rows: [
              ['Employee SI', rec.pr_employee_si_deduction],
              ["Martyrs' fund", rec.pr_martyrs_fund],
              ['Absence', rec.pr_absence_deduction],
              ['Unpaid leave', rec.pr_unpaid_leave_deduction],
              ['Late', rec.pr_late_deduction],
              ['Total deductions', rec.pr_total_deductions],
            ]},
            { title: 'Result', rows: [
              ['Net salary', rec.pr_net_salary, true],
              ['Monthly tax', rec.pr_monthly_tax_withheld],
              ['YTD tax', rec.pr_ytd_tax_withheld],
            ]},
          ].map(({ title, rows }) => (
            <div key={title} style={{ marginTop: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
                {title}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {rows.map(([label, val, accent]) => (
                  <div key={label} style={{
                    background: accent ? ACCENT_BG : 'var(--surface)',
                    border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
                    borderRadius: 7, padding: '8px 10px',
                  }}>
                    <div style={{ fontSize: 10, color: accent ? ACCENT : 'var(--text-muted)' }}>{label}</div>
                    <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, color: accent ? ACCENT_TEXT : 'var(--text-primary)' }}>
                      {fmtEGP(val)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Records Panel ────────────────────────────────────────────────────────────
const FILTERS = ['All', 'Done', 'Processing', 'Pending', 'Errors'];

function RecordsPanel({ records, loading, period }) {
  const [activeFilter, setActiveFilter] = useState('All');
  const [expandedId,   setExpandedId]   = useState(null);

  useEffect(() => { setActiveFilter('All'); setExpandedId(null); }, [period]);

  const counts = {
    All:        records.length,
    Done:       records.filter(r => r.status === 'Done').length,
    Processing: records.filter(r => r.status === 'Processing').length,
    Pending:    records.filter(r => r.status === 'Pending').length,
    Errors:     records.filter(r => r.status === 'Error').length,
  };

  const filtered =
    activeFilter === 'All'    ? records :
    activeFilter === 'Errors' ? records.filter(r => r.status === 'Error') :
    records.filter(r => r.status === activeFilter);

  return (
    <div style={{
      flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
      background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12,
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Payroll records
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
          {period ? `${counts.All} employees` : '—'}
        </span>
      </div>

      {/* Filter tabs */}
      <div style={{ flexShrink: 0, display: 'flex', borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f;
          return (
            <button key={f} onClick={() => { setActiveFilter(f); setExpandedId(null); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 14px', fontSize: 12, fontWeight: isActive ? 600 : 400,
                borderBottom: `2px solid ${isActive ? ACCENT : 'transparent'}`,
                color: isActive ? ACCENT : 'var(--text-muted)',
                background: 'none', border: 'none',
                borderBottomWidth: 2,
                borderBottomStyle: 'solid',
                borderBottomColor: isActive ? ACCENT : 'transparent',
                cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                fontFamily: 'inherit', transition: 'color 120ms',
              }}>
              {f}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 99,
                background: isActive ? ACCENT_BG : 'var(--surface-inset)',
                color: isActive ? ACCENT_TEXT : 'var(--text-secondary)',
                fontWeight: 600,
              }}>
                {counts[f]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Records list */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {!period ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: '48px 0' }}>
            <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="var(--border-strong)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Select a run to view records</p>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <Spinner size={22} color={ACCENT} />
          </div>
        ) : filtered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0' }}>
            No records match this filter
          </p>
        ) : filtered.map(rec => (
          <RecordRow
            key={rec.employee_id} rec={rec}
            isExpanded={expandedId === rec.employee_id}
            onToggle={() => setExpandedId(id => id === rec.employee_id ? null : rec.employee_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main RunPayroll ──────────────────────────────────────────────────────────
export default function RunPayroll({ onNavigate }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [runs,           setRuns]           = useState(null);
  const [selectedRun,    setSelectedRun]    = useState(null);
  const [isNew,          setIsNew]          = useState(true);
  const [recordsCache,   setRecordsCache]   = useState({});
  const [activeRecords,  setActiveRecords]  = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [countdown,      setCountdown]      = useState(30);
  const [showDrawer,     setShowDrawer]     = useState(false);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = showDrawer ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showDrawer]);

  useEffect(() => {
    (async () => {
      try {
        const result = await gateway.invoke('portalListRuns');
        if (result.status === 'success') setRuns(result.runs);
        else { showToast('Failed to load runs', 'error'); setRuns([]); }
      } catch { showToast('Failed to load runs', 'error'); setRuns([]); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecords = useCallback(async (period, forceRefresh = false) => {
    if (!forceRefresh && recordsCache[period]) { setActiveRecords(recordsCache[period]); return; }
    setRecordsLoading(true);
    try {
      const result = await gateway.invoke('portalGetPayrollRecords', { payroll_period: period });
      if (result.status === 'success') {
        setRecordsCache(prev => ({ ...prev, [period]: result.records }));
        setActiveRecords(result.records);
      }
    } catch { showToast('Failed to load records', 'error'); }
    finally { setRecordsLoading(false); }
  }, [recordsCache]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'Processing') return;
    const poll = async () => {
      try {
        const result = await gateway.invoke('portalGetQueueStatus', { payroll_period: selectedRun.period });
        if (result.status !== 'success') return;
        const updated = {
          ...selectedRun,
          done:    result.progress?.done    ?? selectedRun.done,
          error:   result.progress?.error   ?? selectedRun.error,
          pending: (result.progress?.pending ?? 0) + (result.progress?.processing ?? 0),
          status:  result.mps_status,
        };
        setSelectedRun(updated);
        setRuns(prev => prev?.map(r => r.period === updated.period ? updated : r) ?? prev);
        setCountdown(30);
        if (result.mps_status === 'Completed') loadRecords(selectedRun.period, true);
      } catch { /* silent */ }
    };
    const pollTimer  = setInterval(poll, 30000);
    const countTimer = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : 30)), 1000);
    return () => { clearInterval(pollTimer); clearInterval(countTimer); };
  }, [selectedRun?.period, selectedRun?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectNew = () => { setIsNew(true); setSelectedRun(null); setActiveRecords([]); setShowDrawer(false); };
  const handleSelectRun = (run) => { setIsNew(false); setSelectedRun(run); setCountdown(30); loadRecords(run.period); };

  const handleMpsCreated = (result) => {
    const newRun = { period: result.period, status: 'Draft', employees: 0, working_days: result.working_days, batches: 0, done: 0, error: 0, pending: 0, holidays: result.holidays };
    setRuns(prev => [newRun, ...(prev ?? [])]);
    setIsNew(false); setSelectedRun(newRun); setActiveRecords([]);
  };

  const handleRunStarted = (orchResult) => {
    const updated = { ...selectedRun, status: 'Processing', employees: orchResult.queued, batches: orchResult.batches, pending: orchResult.queued, done: 0, error: 0 };
    setSelectedRun(updated);
    setRuns(prev => prev?.map(r => r.period === selectedRun.period ? updated : r) ?? prev);
    setCountdown(30);
  };

  const handleViewReport = () => {
    if (onNavigate && selectedRun?.period) {
      onNavigate('feature_reports', { period: selectedRun.period });
    }
  };

  return (
    <>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Page header */}
        <div style={{ flexShrink: 0, marginBottom: 12 }}>
          <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Run payroll</h1>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Select a previous run or create a new one</p>
        </div>

        {/* Layout — mobile: stacked flex, desktop: two-column grid */}
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gap: 12, overflow: 'hidden' }}
          className="grid-layout-run">
          {/* Left column: wizard + runs list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, overflow: 'hidden' }}>
            <WizardCard
              run={selectedRun} isNew={isNew} countdown={countdown}
              onCreated={handleMpsCreated} onRun={handleRunStarted}
              onViewReport={handleViewReport}
            />
            <RunsList
              runs={runs} selectedPeriod={selectedRun?.period} isNew={isNew}
              onSelectNew={handleSelectNew} onSelectRun={handleSelectRun}
            />
          </div>

          {/* Right column: records panel — hidden on mobile (shown in drawer) */}
          <div className="records-desktop" style={{ display: 'none', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <RecordsPanel records={activeRecords} loading={recordsLoading} period={isNew ? null : selectedRun?.period} />
          </div>
        </div>
      </div>

      {/* ── Floating "View Records" button — mobile only ────────────────────── */}
      {!isNew && selectedRun && (
        <div className="records-fab" style={{ position: 'fixed', bottom: 76, right: 16, zIndex: 45 }}>
          <button onClick={() => setShowDrawer(true)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#0F172A', border: '1px solid rgba(99,102,241,0.45)',
            borderRadius: 99, padding: '10px 18px',
            color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
            boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
          }}>
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke={ACCENT_MUTED} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            Records
            {activeRecords.length > 0 && (
              <span style={{
                background: ACCENT, color: '#fff',
                fontSize: 10, fontWeight: 700,
                padding: '1px 7px', borderRadius: 99, minWidth: 20, textAlign: 'center',
              }}>
                {activeRecords.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* ── Records bottom drawer — mobile only ────────────────────────────── */}
      {/* Backdrop */}
      <div className="records-fab"
        onClick={() => setShowDrawer(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 48,
          background: 'rgba(0,0,0,0.55)',
          opacity: showDrawer ? 1 : 0,
          pointerEvents: showDrawer ? 'auto' : 'none',
          transition: 'opacity 280ms ease',
        }} />

      {/* Drawer */}
      <div className="records-fab" style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 49,
        background: 'var(--surface)',
        borderRadius: '16px 16px 0 0',
        border: '1px solid var(--border)',
        maxHeight: '85dvh',
        display: 'flex', flexDirection: 'column',
        transform: showDrawer ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, background: 'var(--border-strong)', borderRadius: 99 }} />
        </div>

        {/* Drawer header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 16px 12px', borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Records</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {selectedRun?.period} · {activeRecords.length} employees
            </div>
          </div>
          <button onClick={() => setShowDrawer(false)} style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'var(--surface-inset)', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)', fontFamily: 'inherit',
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Records content */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <RecordsPanel records={activeRecords} loading={recordsLoading} period={isNew ? null : selectedRun?.period} />
        </div>
      </div>

      {/* Responsive layout styles */}
      <style>{`
        @media (min-width: 768px) {
          .grid-layout-run { grid-template-columns: 260px 1fr !important; }
          .records-desktop  { display: flex !important; }
          .records-fab      { display: none !important; }
        }
      `}</style>
    </>
  );
}
