import { useState } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useToast }   from '../../context/AuthContext';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const fmt = (val) =>
  new Intl.NumberFormat('en-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(val || 0);

function MetricCard({ label, value, accent = false }) {
  return (
    <div className={`rounded-xl p-4 border
      ${accent
        ? 'bg-white dark:bg-gray-900 border-blue-200 dark:border-blue-900/50'
        : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800'}`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-lg font-semibold ${accent ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
        {typeof value === 'number' ? `EGP ${fmt(value)}` : value}
      </p>
    </div>
  );
}

function CountCard({ label, value }) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

export default function Reports() {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [period,  setPeriod]  = useState(currentMonth());
  const [report,  setReport]  = useState(null);
  const [loading, setLoading] = useState(false);

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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Period Report</h1>

      {/* Period picker + generate */}
      <div className="flex gap-3 mb-6">
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={loadReport}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium
            hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center gap-2"
        >
          {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
          {loading ? 'Loading…' : 'Generate'}
        </button>
      </div>

      {report && s && (
        <>
          {/* Generated timestamp */}
          <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">
            Generated at {report.generated_at} — period {report.period}
          </p>

          {/* Headcount row */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <CountCard label="Headcount"    value={s.headcount} />
            <CountCard label="Terminations" value={s.termination_count} />
          </div>

          {/* Financial metrics */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2">Salary</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MetricCard label="Total Gross"   value={s.total_gross} />
              <MetricCard label="Basic Salary"  value={s.total_basic_salary} />
              <MetricCard label="Allowances"    value={s.total_allowances} />
              <MetricCard label="Net Salary"    value={s.total_net_salary} accent />
            </div>

            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2">Social Insurance</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MetricCard label="Employee SI"   value={s.total_employee_si} />
              <MetricCard label="Employer SI"   value={s.total_employer_si} />
              <MetricCard label="Martyrs Fund"  value={s.total_martyrs_fund} />
            </div>

            <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-4 mb-2">Tax & Cost</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <MetricCard label="Tax Withheld"       value={s.total_tax_withheld} />
              <MetricCard label="Total Employer Cost" value={s.total_employer_cost} accent />
            </div>
          </div>
        </>
      )}

      {!report && !loading && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-600">
          <svg className="w-12 h-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-sm">Select a period and click Generate</p>
        </div>
      )}
    </div>
  );
}
