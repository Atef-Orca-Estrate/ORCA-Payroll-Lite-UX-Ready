import { useEffect, useState } from 'react';
import { useGateway } from '../../hooks/useGateway';

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtEGP(n) {
  if (n >= 1_000_000) return `EGP ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `EGP ${(n / 1_000).toFixed(0)}K`;
  return `EGP ${n}`;
}

function fmtPeriod(p) {
  const [y, m] = p.split('-');
  return new Date(+y, +m - 1).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const styles = {
    Completed:  { bg: 'rgba(22,163,74,0.10)',   color: '#15803D' },
    Processing: { bg: 'rgba(99,102,241,0.10)',  color: '#4338CA' },
    Failed:     { bg: 'rgba(239,68,68,0.10)',   color: '#DC2626' },
    Pending:    { bg: 'rgba(245,158,11,0.10)',  color: '#B45309' },
  };
  const s = styles[status] || { bg: 'var(--surface-inset)', color: 'var(--text-muted)' };
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 8px',
      borderRadius: 99, background: s.bg, color: s.color,
    }}>
      {status}
    </span>
  );
}

function KPICard({ accent, label, value, sub, subColor }) {
  return (
    <div style={{
      flex: 1,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      borderTop: `3px solid ${accent}`,
      padding: '18px 20px',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1, marginBottom: 8 }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: subColor || 'var(--text-muted)' }}>
        {sub}
      </div>
    </div>
  );
}

function SectionCard({ title, children, style }) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      overflow: 'hidden',
      ...style,
    }}>
      <div style={{
        padding: '11px 18px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-raised)',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Gateway function spec ───────────────────────────────────────────────────
//
// portalGetDashboard — no input params
//
// Returns:
//   employee_summary
//     .total_active        — count of active employees (from Zoho People roster)
//     .total_on_leave      — employees on approved leave today
//     .new_this_month      — employees whose start date falls in the current month
//
//   last_run
//     .period              — most recent payroll period (YYYY-MM)
//     .run_date            — ISO date the run completed
//     .status              — Completed | Processing | Failed | Pending
//     .employee_count      — number of employees processed
//     .total_gross         — sum of gross salaries (EGP)
//     .total_net           — sum of net salaries (EGP)
//     .total_tax           — sum of income tax withheld (EGP)
//     .total_si            — sum of employee + employer SI contributions (EGP)
//
//   upcoming_run
//     .period              — next payroll period (YYYY-MM)
//     .cutoff_date         — attendance data cutoff (ISO date)
//     .scheduled_date      — planned run date (ISO date)
//
//   queue_summary
//     .pending             — items waiting to be picked up by the orchestrator
//     .processing          — items currently being processed
//     .failed              — items that errored out and need attention
//     .completed_today     — items completed in the current calendar day
//
//   run_history            — array of last 6 payroll runs, newest first
//     [].period            — YYYY-MM
//     [].run_date          — ISO date
//     [].status            — Completed | Failed
//     [].employee_count
//     [].total_net         — EGP
//
//   alerts                 — actionable notices surfaced to the dashboard
//     [].id
//     [].severity          — error | warning | info
//     [].message

// ─── Dashboard ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const gateway = useGateway();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    gateway.invoke('portalGetDashboard')
      .then(r => {
        if (r.status === 'success') setData(r);
        else setError(r.message || 'Failed to load dashboard');
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2.5px solid var(--border)',
          borderTopColor: '#6366F1',
          animation: 'orca-spin 0.7s linear infinite',
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', flexDirection: 'column', gap: 8 }}>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Failed to load dashboard</p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{error}</p>
      </div>
    );
  }

  const { employee_summary, last_run, upcoming_run, queue_summary, run_history, alerts } = data;
  const hasLastRun = !!(last_run?.period);

  const queueIssues = queue_summary.failed + queue_summary.processing + queue_summary.pending;
  const queueLabel  = queue_summary.failed > 0
    ? `${queue_summary.failed} failed`
    : queue_summary.processing > 0
    ? `${queue_summary.processing} processing`
    : queue_summary.pending > 0
    ? `${queue_summary.pending} pending`
    : 'All clear';
  const queueColor = queue_summary.failed > 0 ? '#DC2626' : queue_summary.processing > 0 ? '#4338CA' : '#15803D';
  const queueAccent = queue_summary.failed > 0 ? '#EF4444' : queue_summary.processing > 0 ? '#6366F1' : '#16A34A';

  const alertSeverityStyle = {
    error:   { border: '#FCA5A5', bg: 'rgba(239,68,68,0.05)',   dot: '#DC2626', text: '#B91C1C' },
    warning: { border: '#FCD34D', bg: 'rgba(245,158,11,0.05)',  dot: '#D97706', text: '#92400E' },
    info:    { border: 'var(--border)', bg: 'var(--surface-raised)', dot: '#6366F1', text: 'var(--text-secondary)' },
  };

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 }}>
          Dashboard
        </h1>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Payroll summary — as of {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* KPI row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <KPICard
          accent="#6366F1"
          label="Active Employees"
          value={employee_summary.total_active}
          sub={`${employee_summary.new_this_month} joined this month · ${employee_summary.total_on_leave} on leave`}
        />
        <KPICard
          accent="#16A34A"
          label="Last Payroll"
          value={hasLastRun ? fmtPeriod(last_run.period) : '—'}
          sub={hasLastRun ? <StatusBadge status={last_run.status} /> : 'No runs yet'}
        />
        <KPICard
          accent="#0EA5E9"
          label="Net Paid — Last Run"
          value={hasLastRun ? fmtEGP(last_run.total_net) : '—'}
          sub={hasLastRun ? `Gross ${fmtEGP(last_run.total_gross)} · ${last_run.employee_count} employees` : 'No runs yet'}
        />
        <KPICard
          accent={queueAccent}
          label="Queue Status"
          value={queueLabel}
          sub={queueIssues === 0 ? 'No items require attention' : `${queue_summary.completed_today} completed today`}
          subColor={queueIssues === 0 ? '#15803D' : undefined}
        />
      </div>

      {/* Main content */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

        {/* Run history table */}
        <SectionCard title="Recent Payroll Runs" style={{ flex: '1 1 0', minWidth: 0 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-raised)' }}>
                {['Period', 'Run Date', 'Employees', 'Net Paid', 'Status'].map(col => (
                  <th key={col} style={{
                    padding: '9px 18px', textAlign: 'left',
                    fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {run_history.map((run, i) => (
                <tr key={run.period} style={{
                  borderBottom: i < run_history.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <td style={{ padding: '11px 18px', fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {fmtPeriod(run.period)}
                  </td>
                  <td style={{ padding: '11px 18px', fontSize: 12.5, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                    {fmtDate(run.run_date)}
                  </td>
                  <td style={{ padding: '11px 18px', fontSize: 12.5, color: 'var(--text-secondary)' }}>
                    {run.employee_count}
                  </td>
                  <td style={{ padding: '11px 18px', fontSize: 12.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                    {fmtEGP(run.total_net)}
                  </td>
                  <td style={{ padding: '11px 18px' }}>
                    <StatusBadge status={run.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>

        {/* Right column */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Upcoming run */}
          <SectionCard title="Upcoming Payroll">
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Period</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {fmtPeriod(upcoming_run.period)}
                </span>
              </div>
              <div style={{ height: 1, background: 'var(--border)' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Cutoff date</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {fmtDate(upcoming_run.cutoff_date)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Scheduled run</span>
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {fmtDate(upcoming_run.scheduled_date)}
                </span>
              </div>
            </div>
          </SectionCard>

          {/* Last run breakdown — only rendered when a run exists */}
          {hasLastRun && (
            <SectionCard title="Last Run Breakdown">
              <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Gross Salary',    value: fmtEGP(last_run.total_gross) },
                  { label: 'Tax Withheld',    value: fmtEGP(last_run.total_tax)   },
                  { label: 'SI (Emp + Empr)', value: fmtEGP(last_run.total_si)    },
                  { label: 'Net Paid',        value: fmtEGP(last_run.total_net), bold: true },
                ].map(({ label, value, bold }, i, arr) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
                      <span style={{ fontSize: bold ? 13 : 12, fontWeight: bold ? 700 : 500, color: bold ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {value}
                      </span>
                    </div>
                    {i < arr.length - 1 && <div style={{ height: 1, background: 'var(--border)', marginTop: 10 }} />}
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <SectionCard title="Notices">
              <div style={{ padding: '8px 0' }}>
                {alerts.map(alert => {
                  const s = alertSeverityStyle[alert.severity] || alertSeverityStyle.info;
                  return (
                    <div key={alert.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 18px',
                      background: s.bg,
                      borderLeft: `3px solid ${s.border}`,
                      marginBottom: 1,
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: s.dot, flexShrink: 0, marginTop: 4,
                      }} />
                      <span style={{ fontSize: 11.5, color: s.text, lineHeight: 1.5 }}>
                        {alert.message}
                      </span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  );
}
