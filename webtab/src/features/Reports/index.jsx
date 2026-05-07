import { useState, useEffect } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useToast }   from '../../context/AuthContext';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmt = (val) =>
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

const ACCENT      = '#6366F1';
const ACCENT_BG   = '#EEF2FF';
const ACCENT_TEXT = '#3730A3';

function MetricCard({ label, value, accent = false }) {
  return (
    <div style={{
      borderRadius: 10, padding: '14px 16px',
      background: 'var(--surface)',
      border: `1px solid ${accent ? 'var(--accent-border)' : 'var(--border)'}`,
    }}>
      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: accent ? ACCENT_TEXT : 'var(--text-primary)' }}>
        {typeof value === 'number' ? `EGP ${fmt(value)}` : value}
      </p>
    </div>
  );
}

function CountCard({ label, value }) {
  return (
    <div style={{
      borderRadius: 10, padding: '14px 16px',
      background: 'var(--surface)', border: '1px solid var(--border)',
    }}>
      <p style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 600, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
      marginTop: 20, marginBottom: 8,
    }}>
      {children}
    </p>
  );
}

export default function Reports({ navParams = {} }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [period,  setPeriod]  = useState(navParams?.period || currentMonth());
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);

  // Pre-fill and auto-load when navigated from RunPayroll with a period
  useEffect(() => {
    if (navParams?.period) {
      setPeriod(navParams.period);
      setReport(null);
    }
  }, [navParams?.period]);

  const loadReport = async () => {
    setLoading(true);
    try {
      const result = await gateway.invoke('portalGetPeriodReport', { payroll_period: period });
      if (result.status === 'success') setReport(result);
      else showToast(result.message || 'Failed to load report', 'error');
    } catch {
      showToast('Report load failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const s = report?.summary;

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <h1 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 16 }}>Period Report</h1>

      {/* Period picker + generate */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input
          type="month" value={period} onChange={e => setPeriod(e.target.value)}
          style={{
            border: '1px solid var(--border)', borderRadius: 8,
            padding: '8px 12px', fontSize: 13,
            background: 'var(--surface)', color: 'var(--text-primary)',
            outline: 'none', fontFamily: 'inherit',
          }}
          onFocus={e => e.target.style.borderColor = ACCENT}
          onBlur={e  => e.target.style.borderColor = 'var(--border)'}
        />
        <button onClick={loadReport} disabled={loading}
          style={{
            padding: '8px 20px',
            background: loading ? 'var(--surface-inset)' : '#111827',
            color: loading ? 'var(--text-muted)' : '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: 'inherit', transition: 'background 120ms',
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.background = '#1F2937'; }}
          onMouseLeave={e => { if (!loading) e.currentTarget.style.background = '#111827'; }}
        >
          {loading && (
            <div style={{
              width: 14, height: 14,
              border: '2px solid rgba(255,255,255,0.25)',
              borderTopColor: '#fff',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }} />
          )}
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>

      {report && s && (
        <>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
            Generated at {report.generated_at} — period {report.period}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 4 }}>
            <CountCard label="Headcount"    value={s.headcount} />
            <CountCard label="Terminations" value={s.termination_count} />
          </div>

          <SectionTitle>Salary</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <MetricCard label="Total Gross"  value={s.total_gross} />
            <MetricCard label="Basic Salary" value={s.total_basic_salary} />
            <MetricCard label="Allowances"   value={s.total_allowances} />
            <MetricCard label="Net Salary"   value={s.total_net_salary} accent />
          </div>

          <SectionTitle>Social Insurance</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
            <MetricCard label="Employee SI"  value={s.total_employee_si} />
            <MetricCard label="Employer SI"  value={s.total_employer_si} />
            <MetricCard label="Martyrs Fund" value={s.total_martyrs_fund} />
          </div>

          <SectionTitle>Tax & Cost</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 32 }}>
            <MetricCard label="Tax Withheld"       value={s.total_tax_withheld} />
            <MetricCard label="Total Employer Cost" value={s.total_employer_cost} accent />
          </div>
        </>
      )}

      {!report && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', gap: 12 }}>
          <svg width="44" height="44" fill="none" viewBox="0 0 24 24" stroke="var(--border-strong)" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            {navParams?.period ? `Period ${navParams.period} loaded — click Generate` : 'Select a period and click Generate'}
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
