import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useToast }   from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const ACCENT       = '#6366F1';
const ACCENT_BG    = '#EEF2FF';
const ACCENT_TEXT  = '#3730A3';
const ACCENT_MUTED = '#818CF8';
const POLL_INTERVAL = 30;

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmtTime = (date) =>
  date ? date.toLocaleTimeString('en-EG', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—';

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner({ size = 20 }) {
  return (
    <div style={{
      width: size, height: size,
      border: `2px solid rgba(99,102,241,0.2)`,
      borderTopColor: ACCENT,
      borderRadius: '50%',
      animation: 'orca-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
}

// ─── Period Header — always visible ──────────────────────────────────────────
function PeriodHeader({ period, onChange, mpsStatus, countdown, lastUpdated, onRefresh, loading, onNavigateRunPayroll }) {
  const isLive = mpsStatus === 'Processing';

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: 'space-between', gap: 10,
      marginBottom: 16,
    }}>
      {/* Left: title + live dot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Queue Monitor
            </h1>
            {isLive && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(99,102,241,0.10)', border: '1px solid rgba(99,102,241,0.20)',
                borderRadius: 99, padding: '2px 8px', fontSize: 10.5, fontWeight: 600, color: ACCENT }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', background: ACCENT,
                  boxShadow: `0 0 0 2px rgba(99,102,241,0.3)`,
                  animation: 'orca-pulse 1.8s ease-in-out infinite',
                  flexShrink: 0,
                }} />
                Live
              </span>
            )}
          </div>
          <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
            Real-time payroll queue status
          </p>
        </div>
      </div>

      {/* Right: period picker + refresh controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {/* Cross-navigate to RunPayroll */}
        {mpsStatus && mpsStatus !== 'none' && (
          <button onClick={onNavigateRunPayroll}
            style={{
              fontSize: 11.5, color: ACCENT, background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0',
              fontWeight: 500, textDecoration: 'none',
            }}
            onMouseEnter={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseLeave={e => e.currentTarget.style.textDecoration = 'none'}
          >
            View in Run Payroll →
          </button>
        )}

        {/* Period picker */}
        <input type="month" value={period} onChange={e => onChange(e.target.value)}
          style={{
            border: '1px solid var(--border)', borderRadius: 7,
            padding: '6px 10px', fontSize: 12.5,
            background: 'var(--surface)', color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = ACCENT}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />

        {/* Refresh button + countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {lastUpdated && (
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              Updated {fmtTime(lastUpdated)}{isLive ? ` · ↻ in ${countdown}s` : ''}
            </span>
          )}
          <button onClick={onRefresh} disabled={loading}
            style={{
              width: 30, height: 30, borderRadius: '50%',
              background: 'var(--surface-inset)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1, transition: 'background 120ms',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--border)'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'var(--surface-inset)'; }}
            title="Refresh now"
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              style={{ animation: loading ? 'orca-spin 0.7s linear infinite' : 'none' }}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stat Tile ────────────────────────────────────────────────────────────────
function StatTile({ label, value, color, bg }) {
  return (
    <div style={{ flex: 1, background: bg, borderRadius: 9, padding: '10px 12px', textAlign: 'center', minWidth: 60 }}>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1.2 }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3, fontWeight: 500 }}>{label}</div>
    </div>
  );
}

// ─── Overview Card — Processing ───────────────────────────────────────────────
function ProcessingOverview({ data }) {
  const p    = data.progress;
  const pct  = p.total ? Math.round((p.done / p.total) * 100) : 0;
  const allRecords = [
    ...(data.regular_run?.records     || []),
    ...(data.termination_run?.records || []),
  ];
  const totalBatches = allRecords.length
    ? Math.max(...allRecords.map(r => r.batch_number || 0))
    : 0;

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 14,
    }}>
      {/* Progress bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, marginBottom: 6 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            {p.done} of {p.total} processed
            {totalBatches > 0 && ` · ${totalBatches} batch${totalBatches !== 1 ? 'es' : ''}`}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{pct}%</span>
        </div>
        <div style={{ width: '100%', height: 8, background: 'var(--surface-inset)', borderRadius: 99, overflow: 'hidden' }}>
          <div style={{
            width: `${pct}%`, height: '100%', background: ACCENT,
            borderRadius: 99, transition: 'width 500ms ease',
          }} />
        </div>
      </div>

      {/* 4 stat tiles */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatTile label="Done"       value={p.done}       color="#16A34A" bg="rgba(22,163,74,0.08)"   />
        <StatTile label="Processing" value={p.processing} color={ACCENT}  bg={ACCENT_BG}              />
        <StatTile label="Pending"    value={p.pending}    color="#B45309" bg="rgba(245,158,11,0.08)"  />
        <StatTile label="Errors"     value={p.error}      color="#DC2626" bg="rgba(239,68,68,0.08)"   />
      </div>

      {/* Working days */}
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)' }}>
        Working days: {data.mps_working_days}
      </div>
    </div>
  );
}

// ─── Overview Card — Completed ────────────────────────────────────────────────
function CompletedOverview({ data, period }) {
  const p    = data.progress;
  const allRecords = [
    ...(data.regular_run?.records     || []),
    ...(data.termination_run?.records || []),
  ];
  const totalBatches = allRecords.length
    ? Math.max(...allRecords.map(r => r.batch_number || 0))
    : 0;

  return (
    <div style={{
      background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.18)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 14,
    }}>
      {/* Completed header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div style={{
          width: 22, height: 22, borderRadius: '50%',
          background: '#16A34A', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#fff" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#15803D' }}>
            Run complete — {period}
          </div>
          <div style={{ fontSize: 11, color: '#16A34A', marginTop: 1 }}>
            {p.total} employees · {totalBatches} batch{totalBatches !== 1 ? 'es' : ''} · {data.mps_working_days} working days
          </div>
        </div>
      </div>

      {/* Final counts */}
      <div style={{ display: 'flex', gap: 8 }}>
        <StatTile label="Done"   value={p.done}  color="#16A34A" bg="rgba(22,163,74,0.10)"  />
        <StatTile label="Errors" value={p.error} color="#DC2626" bg="rgba(239,68,68,0.08)"  />
      </div>

      {p.error > 0 && (
        <p style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 10 }}>
          {p.error} employee{p.error > 1 ? 's' : ''} require manual review — errors will not auto-retry.
        </p>
      )}
    </div>
  );
}

// ─── Queue Row — compact ──────────────────────────────────────────────────────
function QueueRow({ rec, type }) {
  const statusColor = rec.status === 'Done'       ? '#16A34A'
    : rec.status === 'Error'                       ? '#DC2626'
    : rec.status === 'Processing'                  ? ACCENT
    : 'var(--text-muted)';
  const statusBg = rec.status === 'Done'           ? 'rgba(22,163,74,0.10)'
    : rec.status === 'Error'                       ? 'rgba(239,68,68,0.10)'
    : rec.status === 'Processing'                  ? ACCENT_BG
    : 'var(--surface-inset)';

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '9px 16px', gap: 12,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)',
              fontFamily: 'monospace',
            }}>
              {rec.employee_id}
            </span>
            {type === 'termination' && (
              <span style={{
                fontSize: 9.5, fontWeight: 600, color: '#B45309',
                background: 'rgba(245,158,11,0.10)', padding: '1px 6px',
                borderRadius: 99, flexShrink: 0,
              }}>
                Final settlement
              </span>
            )}
          </div>
          {rec.error ? (
            <div style={{ marginTop: 3 }}>
              <div style={{ fontSize: 11, color: '#DC2626' }}>{rec.error}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 1 }}>
                Requires manual review
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {rec.processed_at ? `Processed at ${rec.processed_at}` : rec.status.toLowerCase()}
            </div>
          )}
        </div>
        <span style={{
          fontSize: 10.5, fontWeight: 500, padding: '2px 8px',
          borderRadius: 99, flexShrink: 0,
          background: statusBg, color: statusColor,
        }}>
          {rec.status}
        </span>
      </div>
    </div>
  );
}

// ─── Batch Group — collapsible ────────────────────────────────────────────────
function BatchGroup({ batchNum, records, type, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);

  const done       = records.filter(r => r.status === 'Done').length;
  const errors     = records.filter(r => r.status === 'Error').length;
  const processing = records.filter(r => r.status === 'Processing').length;
  const total      = records.length;

  const batchStatus = errors > 0 && done + errors === total ? 'has-errors'
    : processing > 0 ? 'processing'
    : done === total ? 'done'
    : 'pending';

  const headerColor = batchStatus === 'done'       ? '#16A34A'
    : batchStatus === 'has-errors'                 ? '#DC2626'
    : batchStatus === 'processing'                 ? ACCENT
    : 'var(--text-secondary)';

  const headerBg = batchStatus === 'done'          ? 'rgba(22,163,74,0.05)'
    : batchStatus === 'has-errors'                 ? 'rgba(239,68,68,0.05)'
    : batchStatus === 'processing'                 ? 'rgba(99,102,241,0.05)'
    : 'var(--surface-raised)';

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Batch header — clickable */}
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: headerBg,
        border: 'none', borderBottom: '1px solid var(--border)',
        cursor: 'pointer', fontFamily: 'inherit', gap: 8,
        transition: 'background 120ms',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24"
            stroke={headerColor} strokeWidth={2}
            style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 180ms', flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
          </svg>
          <span style={{ fontSize: 12, fontWeight: 600, color: headerColor }}>
            Batch {batchNum}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {total} employee{total !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {done > 0 && (
            <span style={{ fontSize: 10.5, color: '#16A34A', fontWeight: 500 }}>{done} done</span>
          )}
          {errors > 0 && (
            <span style={{ fontSize: 10.5, color: '#DC2626', fontWeight: 600 }}>{errors} error{errors > 1 ? 's' : ''}</span>
          )}
          {processing > 0 && (
            <span style={{ fontSize: 10.5, color: ACCENT, fontWeight: 500 }}>{processing} active</span>
          )}
          {batchStatus === 'pending' && (
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>pending</span>
          )}
        </div>
      </button>

      {/* Records */}
      {open && (
        <div>
          {records.map((rec, i) => (
            <QueueRow key={`${rec.employee_id}-${i}`} rec={rec} type={type} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Records Section — tabs + batch groups + error filter ─────────────────────
function RecordsSection({ data, mpsStatus }) {
  const [activeTab,   setActiveTab]   = useState('regular');
  const [errorsOnly,  setErrorsOnly]  = useState(false);

  const reg  = data?.regular_run;
  const term = data?.termination_run;

  const activeRecords = (activeTab === 'regular' ? reg?.records : term?.records) || [];
  const hasErrors     = activeRecords.some(r => r.status === 'Error');

  // Group by batch number
  const batchMap = activeRecords.reduce((acc, rec) => {
    const bn = rec.batch_number || 1;
    if (!acc[bn]) acc[bn] = [];
    acc[bn].push(rec);
    return acc;
  }, {});
  const batchNums = Object.keys(batchMap).map(Number).sort((a, b) => a - b);

  // Errors-only: flat list across all batches
  const errorRecords = activeRecords.filter(r => r.status === 'Error');

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, overflow: 'hidden', flex: 1, minHeight: 0,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Tab bar + errors toggle */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', padding: '0 4px 0 0',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex' }}>
          {[
            { id: 'regular',     label: 'Regular',     count: reg?.summary?.total  || 0 },
            { id: 'termination', label: 'Termination', count: term?.summary?.total || 0 },
          ].map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id}
                onClick={() => { setActiveTab(tab.id); setErrorsOnly(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px', fontSize: 12.5, fontWeight: isActive ? 600 : 400,
                  borderBottom: `2px solid ${isActive ? ACCENT : 'transparent'}`,
                  color: isActive ? ACCENT : 'var(--text-muted)',
                  background: 'none', border: 'none',
                  borderBottomWidth: 2, borderBottomStyle: 'solid',
                  borderBottomColor: isActive ? ACCENT : 'transparent',
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'color 120ms',
                }}>
                {tab.label}
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
                  background: isActive ? ACCENT_BG : 'var(--surface-inset)',
                  color: isActive ? ACCENT_TEXT : 'var(--text-secondary)',
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Errors only toggle */}
        {hasErrors && (
          <button onClick={() => setErrorsOnly(e => !e)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '4px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600,
            background: errorsOnly ? 'rgba(239,68,68,0.10)' : 'var(--surface-inset)',
            border: `1px solid ${errorsOnly ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`,
            color: errorsOnly ? '#DC2626' : 'var(--text-secondary)',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 120ms', marginRight: 8,
          }}>
            <svg width="11" height="11" fill="none" viewBox="0 0 24 24"
              stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.924-.833-2.694 0L3.732 16.5c-.77.833.193 2.5 1.732 2.5z"/>
            </svg>
            Errors only {errorsOnly && `(${errorRecords.length})`}
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {activeRecords.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 8, padding: '48px 0' }}>
            <svg width="36" height="36" fill="none" viewBox="0 0 24 24"
              stroke="var(--border-strong)" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>No records found</p>
          </div>
        ) : errorsOnly ? (
          /* Flat error list across all batches */
          errorRecords.length === 0 ? (
            <p style={{ fontSize: 12.5, color: 'var(--text-muted)', textAlign: 'center', padding: '48px 0' }}>
              No errors found
            </p>
          ) : (
            <div>
              <div style={{
                padding: '8px 16px', fontSize: 10.5, fontWeight: 600,
                color: '#DC2626', background: 'rgba(239,68,68,0.05)',
                borderBottom: '1px solid var(--border)',
              }}>
                {errorRecords.length} error{errorRecords.length > 1 ? 's' : ''} across all batches — requires manual review
              </div>
              {errorRecords.map((rec, i) => (
                <QueueRow key={`${rec.employee_id}-${i}`} rec={rec} type={activeTab} />
              ))}
            </div>
          )
        ) : (
          /* Batch-grouped collapsible view */
          batchNums.map(bn => (
            <BatchGroup
              key={bn}
              batchNum={bn}
              records={batchMap[bn]}
              type={activeTab}
              defaultOpen={batchMap[bn].some(r => r.status === 'Error' || r.status === 'Processing')}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Empty States ─────────────────────────────────────────────────────────────
function EmptyState({ type, period, onNavigate }) {
  const isNone  = type === 'none';
  const isDraft = type === 'draft';

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 10, padding: '48px 24px', textAlign: 'center',
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 13,
        background: isDraft ? ACCENT_BG : 'var(--surface-inset)',
        border: `1px solid ${isDraft ? 'var(--accent-border)' : 'var(--border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {isDraft ? (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke={ACCENT} strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
        ) : (
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
          </svg>
        )}
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
          {isNone  && `No payroll run for ${period}`}
          {isDraft && `${period} — Ready to run`}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', maxWidth: 280, lineHeight: 1.5 }}>
          {isNone  && 'No payroll setup found for this period.'}
          {isDraft && 'Payroll setup exists but the run hasn\'t been triggered yet.'}
        </div>
      </div>

      <button onClick={() => onNavigate('feature_run_payroll', { period })}
        style={{
          marginTop: 4, padding: '8px 18px',
          background: isDraft ? ACCENT : '#111827',
          color: '#fff', border: 'none', borderRadius: 8,
          fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'opacity 120ms',
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
        onMouseLeave={e => e.currentTarget.style.opacity = '1'}
      >
        {isNone  ? 'Go to Run Payroll' : 'Start run →'}
      </button>
    </div>
  );
}

// ─── Main QueueMonitor ────────────────────────────────────────────────────────
export default function QueueMonitor({ onNavigate }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [period,      setPeriod]      = useState(currentMonth());
  const [data,        setData]        = useState(null);
  const [initLoading, setInitLoading] = useState(true);
  const [loading,     setLoading]     = useState(false);
  const [countdown,   setCountdown]   = useState(POLL_INTERVAL);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef  = useRef(null);
  const countRef = useRef(null);

  const clearTimers = () => {
    if (pollRef.current)  clearInterval(pollRef.current);
    if (countRef.current) clearInterval(countRef.current);
  };

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const result = await gateway.invoke('portalGetQueueStatus', { payroll_period: period });
      if (result.status === 'success') {
        setData(result);
        setLastUpdated(new Date());
        setCountdown(POLL_INTERVAL);
      } else {
        // 'no_run' is a valid non-error state — set data with mps_status 'none'
        if (result.code === 'no_run') {
          setData({ mps_status: 'none' });
        } else {
          showToast(result.message || 'Failed to load queue', 'error');
        }
      }
    } catch {
      showToast('Queue load failed', 'error');
    } finally {
      setLoading(false);
      setInitLoading(false);
    }
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load on period change
  useEffect(() => {
    setData(null);
    setInitLoading(true);
    setLastUpdated(null);
    clearTimers();
    loadData(true);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Polling — only when Processing
  useEffect(() => {
    clearTimers();
    if (data?.mps_status !== 'Processing') return;

    pollRef.current  = setInterval(() => loadData(false), POLL_INTERVAL * 1000);
    countRef.current = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : POLL_INTERVAL)), 1000);

    // Pause when tab is hidden, resume on visibility
    const onVisibility = () => {
      if (document.hidden) {
        clearTimers();
      } else {
        loadData(false);
        pollRef.current  = setInterval(() => loadData(false), POLL_INTERVAL * 1000);
        countRef.current = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : POLL_INTERVAL)), 1000);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimers();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [data?.mps_status, loadData]);

  const handleNavigateRunPayroll = () => {
    if (onNavigate) onNavigate('feature_run_payroll', { period });
  };

  const mpsStatus = data?.mps_status || null;
  const showRecords = mpsStatus === 'Processing' || mpsStatus === 'Completed';

  return (
    <>
      <div style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <PeriodHeader
          period={period}
          onChange={setPeriod}
          mpsStatus={mpsStatus}
          countdown={countdown}
          lastUpdated={lastUpdated}
          onRefresh={() => loadData(true)}
          loading={loading}
          onNavigateRunPayroll={handleNavigateRunPayroll}
        />

        {/* Content area */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Initial load */}
          {initLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 0' }}>
              <Spinner size={24} />
            </div>
          )}

          {/* Empty states */}
          {!initLoading && (mpsStatus === 'none' || mpsStatus === 'Draft') && (
            <EmptyState
              type={mpsStatus === 'none' ? 'none' : 'draft'}
              period={period}
              onNavigate={onNavigate}
            />
          )}

          {/* Live / Completed view */}
          {!initLoading && showRecords && (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'hidden' }}>
              {mpsStatus === 'Processing' && <ProcessingOverview data={data} />}
              {mpsStatus === 'Completed'  && <CompletedOverview  data={data} period={period} />}
              <RecordsSection data={data} mpsStatus={mpsStatus} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
