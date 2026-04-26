import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtEGP = (val) =>
  val == null
    ? '—'
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
    <div className="flex items-center flex-shrink-0 px-4 pt-3 pb-2">
      {steps.map((label, i) => {
        const idx = i + 1;
        const done = step > idx;
        const active = step === idx;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-1.5 min-w-0">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0
                ${done ? 'bg-green-600 dark:bg-green-700 text-white'
                : active ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border border-gray-200 dark:border-gray-700'}`}>
                {done ? '✓' : idx}
              </div>
              <span className={`text-[10px] font-medium truncate
                ${active ? 'text-blue-700 dark:text-blue-400'
                : done ? 'text-green-700 dark:text-green-500'
                : 'text-gray-400 dark:text-gray-600'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 mx-2 min-w-2" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1 — Setup ───────────────────────────────────────────────────────────
function StepSetup({ onCreated }) {
  const gateway = useGateway();
  const { show: showToast } = useToast();
  const [period, setPeriod] = useState(currentMonth());
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!period) { showToast('Select a period first', 'warning'); return; }
    setLoading(true);
    try {
      const result = await gateway.invoke('portalCreateMPS', { payroll_period: period });
      if (result.status === 'success') {
        showToast('Payroll setup created', 'success');
        onCreated(result);
      } else {
        showToast(result.message || 'Failed to create setup', 'error');
      }
    } catch { showToast('Error creating setup', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Payroll period</label>
        <input
          type="month" value={period} onChange={e => setPeriod(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm
            bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button onClick={handleCreate} disabled={loading}
        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium
          transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {loading && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {loading ? 'Creating…' : 'Create setup'}
      </button>
    </div>
  );
}

// ─── Step 2 — Review ──────────────────────────────────────────────────────────
function StepReview({ run, onRun }) {
  const gateway = useGateway();
  const { auth } = useAuth();
  const { show: showToast } = useToast();
  const allowOverride = auth.portalConfig?.allow_working_days_override;
  const [overriding, setOverriding] = useState(false);
  const [workingDays, setWorkingDays] = useState(run.working_days);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

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

  const scopeLabel = { all: 'All active employees', by_department: 'By department', by_employee: 'Selected employees' }[auth.payrollSettings?.scope] || 'All active employees';

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-100 dark:border-gray-700/60 divide-y divide-gray-100 dark:divide-gray-700/60 overflow-hidden">
        {[['Period', run.period], ['Scope', scopeLabel]].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
            <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50">
          <span className="text-xs text-gray-500 dark:text-gray-400">Working days</span>
          <div className="flex items-center gap-2">
            {overriding ? (
              <input type="number" min={1} max={31} value={workingDays}
                onChange={e => setWorkingDays(Number(e.target.value))}
                className="w-14 border border-gray-300 dark:border-gray-600 rounded px-2 py-0.5 text-xs text-right
                  bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500" />
            ) : (
              <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{workingDays}</span>
            )}
            {allowOverride && !overriding && (
              <button onClick={() => setOverriding(true)} className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline">Override</button>
            )}
          </div>
        </div>
      </div>

      {overriding && (
        <div className="flex gap-2">
          <button onClick={handleSaveOverride} disabled={saving}
            className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setOverriding(false); setWorkingDays(run.working_days); }}
            className="flex-1 py-1.5 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 rounded-lg text-xs font-medium">
            Cancel
          </button>
        </div>
      )}

      {run.holidays && (
        <div>
          <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-1">Public holidays</p>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700/60">
            {run.holidays.split('\n').map((h, i) => (
              <p key={i} className="text-xs text-gray-600 dark:text-gray-400 font-mono py-0.5">{h}</p>
            ))}
          </div>
        </div>
      )}

      <button onClick={handleRun} disabled={running || overriding}
        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium
          transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {running && <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {running ? 'Starting…' : 'Run payroll'}
      </button>
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
    <div className="space-y-3">
      <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 rounded-lg px-3 py-2.5">
        <p className="text-xs font-medium text-blue-800 dark:text-blue-300">
          {run.employees} employees · {run.batches} batch{run.batches !== 1 ? 'es' : ''}
        </p>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-gray-500 dark:text-gray-400">Processing — refresh in {countdown}s</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{pct}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Done',      val: done, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40' },
          { label: 'Remaining', val: rem,  color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40' },
          { label: 'Errors',    val: err,  color: 'text-red-700 dark:text-red-400',     bg: 'bg-red-50 dark:bg-red-950/40'    },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} rounded-lg py-2 text-center`}>
            <div className={`text-base font-semibold ${color}`}>{val}</div>
            <div className="text-[10px] text-gray-500 dark:text-gray-400">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 4 — Complete ────────────────────────────────────────────────────────
function StepComplete({ run, onViewReport }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-900/50 rounded-lg px-3 py-2.5">
        <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-xs font-medium text-green-800 dark:text-green-300">
          {run.employees} employees processed — {run.period}
        </p>
      </div>
      {run.error > 0 && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 rounded-lg px-3 py-2">
          <p className="text-xs text-red-700 dark:text-red-400">
            {run.error} employee{run.error > 1 ? 's' : ''} errored — check records panel
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Gross salary', val: run.gross, accent: false },
          { label: 'Net paid',     val: run.net,   accent: true  },
          { label: 'Tax withheld', val: run.tax,   accent: false },
          { label: 'Employee SI',  val: run.si,    accent: false },
        ].map(({ label, val, accent }) => (
          <div key={label} className={`rounded-lg px-3 py-2 border
            ${accent
              ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50'
              : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/60'}`}>
            <div className="text-[10px] text-gray-400 dark:text-gray-500">{label}</div>
            <div className={`text-xs font-semibold mt-0.5 ${accent ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
              {fmtEGP(val)}
            </div>
          </div>
        ))}
      </div>
      <button onClick={onViewReport}
        className="w-full py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400
          hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg text-xs font-medium transition-colors">
        View period report
      </button>
    </div>
  );
}

// ─── Wizard Card ──────────────────────────────────────────────────────────────
function WizardCard({ run, isNew, countdown, onCreated, onRun, onViewReport }) {
  const step = isNew ? 1 : (STEP_FOR_STATUS[run?.status] ?? 1);
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Payroll wizard</span>
        {!isNew && run && (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
            {run.period}
          </span>
        )}
      </div>
      <Stepper step={step} />
      {/* Only this area scrolls — header and stepper are always visible */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
        {step === 1 && <StepSetup onCreated={onCreated} />}
        {step === 2 && run && <StepReview run={run} onRun={onRun} />}
        {step === 3 && run && <StepRunning run={run} countdown={countdown} />}
        {step === 4 && run && <StepComplete run={run} onViewReport={onViewReport} />}
      </div>
    </div>
  );
}

// ─── Runs List ────────────────────────────────────────────────────────────────
const STATUS_DOT = { Completed: 'bg-green-500', Processing: 'bg-blue-500 animate-pulse', Draft: 'bg-gray-400 dark:bg-gray-600' };
const STATUS_BADGE = {
  Completed:  'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400',
  Processing: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400',
  Draft:      'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function RunsList({ runs, selectedPeriod, isNew, onSelectNew, onSelectRun }) {
  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Previous runs</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Pinned new run row */}
        <div onClick={onSelectNew}
          className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors
            ${isNew ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
          <div className="w-5 h-5 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-2.5 h-2.5 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className={`text-sm font-medium ${isNew ? 'text-blue-700 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}>
            New payroll run
          </span>
        </div>
        {/* Historical runs */}
        {runs === null ? (
          <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : runs.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-gray-600 text-center py-6">No previous runs</p>
        ) : runs.map(run => (
          <div key={run.period} onClick={() => onSelectRun(run)}
            className={`flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0 transition-colors
              ${!isNew && selectedPeriod === run.period ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'}`}>
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[run.status] || 'bg-gray-400'}`} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{run.period}</div>
              <div className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">{run.employees} employees · {run.working_days} days</div>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${STATUS_BADGE[run.status] || ''}`}>
              {run.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Record Row ───────────────────────────────────────────────────────────────
const REC_BADGE = {
  Done:       'bg-green-50 dark:bg-green-950/50 text-green-700 dark:text-green-400',
  Error:      'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400',
  Processing: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400',
  Pending:    'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

function RecordRow({ rec, isExpanded, onToggle }) {
  const hasFinancials = rec.pr_gross_salary != null;
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <div onClick={hasFinancials ? onToggle : undefined}
        className={`flex items-center justify-between px-4 py-3 transition-colors
          ${hasFinancials ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50' : 'cursor-default'}
          ${isExpanded ? 'bg-gray-50 dark:bg-gray-800/40' : ''}`}>
        <div className="min-w-0 mr-3">
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{rec.employee_id}</div>
          <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5 truncate">
            {rec.status.toLowerCase()}{rec.error ? ` · ${rec.error}` : ''}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${REC_BADGE[rec.status] || ''}`}>{rec.status}</span>
          {hasFinancials && (
            <svg className={`w-3.5 h-3.5 text-gray-400 dark:text-gray-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
      </div>
      {isExpanded && hasFinancials && (
        <div className="px-4 pb-4 pt-1 bg-gray-50 dark:bg-gray-800/40 space-y-3">
          {/* Earnings */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Earnings</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Basic salary',     val: rec.pr_basic_salary },
                { label: 'Allowances',       val: rec.pr_total_allowances },
                { label: 'Gross salary',     val: rec.pr_gross_salary },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-gray-700/60">
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{label}</div>
                  <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{fmtEGP(val)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Deductions */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Deductions</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Employee SI',      val: rec.pr_employee_si_deduction },
                { label: "Martyrs' fund",    val: rec.pr_martyrs_fund },
                { label: 'Absence',          val: rec.pr_absence_deduction },
                { label: 'Unpaid leave',     val: rec.pr_unpaid_leave_deduction },
                { label: 'Late',             val: rec.pr_late_deduction },
                { label: 'Total deductions', val: rec.pr_total_deductions },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white dark:bg-gray-900 rounded-lg px-2.5 py-2 border border-gray-100 dark:border-gray-700/60">
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{label}</div>
                  <div className="text-[11px] font-semibold text-gray-900 dark:text-gray-100 mt-0.5">{fmtEGP(val)}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Result */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-1.5">Result</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Net salary',       val: rec.pr_net_salary,           accent: true  },
                { label: 'Monthly tax',      val: rec.pr_monthly_tax_withheld, accent: false },
                { label: 'YTD tax withheld', val: rec.pr_ytd_tax_withheld,     accent: false },
              ].map(({ label, val, accent }) => (
                <div key={label} className={`rounded-lg px-2.5 py-2 border
                  ${accent
                    ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-100 dark:border-blue-900/50'
                    : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-700/60'}`}>
                  <div className="text-[10px] text-gray-400 dark:text-gray-500">{label}</div>
                  <div className={`text-[11px] font-semibold mt-0.5 ${accent ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                    {fmtEGP(val)}
                  </div>
                </div>
              ))}
            </div>
          </div>
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-gray-800">
        <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Payroll records</span>
        <span className="text-[11px] text-gray-400 dark:text-gray-600">{period ? `${counts.All} employees` : '—'}</span>
      </div>
      <div className="flex-shrink-0 flex border-b border-gray-100 dark:border-gray-800 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => { setActiveFilter(f); setExpandedId(null); }}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 whitespace-nowrap flex-shrink-0 transition-colors
              ${activeFilter === f
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-gray-100'
                : 'border-transparent text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400'}`}>
            {f}
            <span className="text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
              {counts[f]}
            </span>
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {!period ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-300 dark:text-gray-700 py-12">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Select a run to view records</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-600 text-center py-12">No records match this filter</p>
        ) : filtered.map(rec => (
          <RecordRow
            key={rec.employee_id}
            rec={rec}
            isExpanded={expandedId === rec.employee_id}
            onToggle={() => setExpandedId(id => id === rec.employee_id ? null : rec.employee_id)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main RunPayroll ──────────────────────────────────────────────────────────
export default function RunPayroll() {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [runs,           setRuns]           = useState(null);
  const [selectedRun,    setSelectedRun]    = useState(null);
  const [isNew,          setIsNew]          = useState(true);
  const [recordsCache,   setRecordsCache]   = useState({});
  const [activeRecords,  setActiveRecords]  = useState([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [countdown,      setCountdown]      = useState(30);

  // Fetch runs list ONCE on mount — cached for the session
  useEffect(() => {
    (async () => {
      try {
        const result = await gateway.invoke('portalListRuns');
        if (result.status === 'success') setRuns(result.runs);
        else { showToast('Failed to load runs', 'error'); setRuns([]); }
      } catch { showToast('Failed to load runs', 'error'); setRuns([]); }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load records — cache hit = zero API call
  const loadRecords = useCallback(async (period, forceRefresh = false) => {
    if (!forceRefresh && recordsCache[period]) {
      setActiveRecords(recordsCache[period]);
      return;
    }
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

  // Poll only when selected run is Processing — stops automatically on completion
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
        // Run just completed — refresh records once to get final state
        if (result.mps_status === 'Completed') loadRecords(selectedRun.period, true);
      } catch { /* silent */ }
    };

    const pollTimer  = setInterval(poll, 30000);
    const countTimer = setInterval(() => setCountdown(c => (c > 1 ? c - 1 : 30)), 1000);
    return () => { clearInterval(pollTimer); clearInterval(countTimer); };
  }, [selectedRun?.period, selectedRun?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectNew = () => { setIsNew(true); setSelectedRun(null); setActiveRecords([]); };

  const handleSelectRun = (run) => {
    setIsNew(false); setSelectedRun(run); setCountdown(30);
    loadRecords(run.period);
  };

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

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
      <div className="flex-shrink-0 mb-3">
        <h1 className="text-base font-semibold text-gray-900 dark:text-gray-100">Run payroll</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Select a previous run or create a new one</p>
      </div>
      <div className="flex-1 min-h-0 grid grid-cols-[260px_1fr] gap-3 overflow-hidden">
        <div className="flex flex-col gap-3 min-h-0 overflow-hidden">
          <WizardCard run={selectedRun} isNew={isNew} countdown={countdown}
            onCreated={handleMpsCreated} onRun={handleRunStarted} onViewReport={() => {}} />
          <RunsList runs={runs} selectedPeriod={selectedRun?.period} isNew={isNew}
            onSelectNew={handleSelectNew} onSelectRun={handleSelectRun} />
        </div>
        <div className="flex flex-col min-h-0 overflow-hidden">
          <RecordsPanel records={activeRecords} loading={recordsLoading} period={isNew ? null : selectedRun?.period} />
        </div>
      </div>
    </div>
  );
}
