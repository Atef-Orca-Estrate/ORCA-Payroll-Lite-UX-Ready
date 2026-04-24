import { useState, useEffect, useCallback } from 'react';
import { useAuth, useToast } from '../../context/AuthContext';
import { useGateway }        from '../../hooks/useGateway';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// ─── Step indicator ───────────────────────────────────────────────────────────
function Stepper({ step }) {
  const steps = ['Setup', 'Review', 'Running'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((label, i) => {
        const idx   = i + 1;
        const done  = step > idx;
        const active = step === idx;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold
              ${done   ? 'bg-green-500 text-white'
              : active ? 'bg-blue-600 text-white'
              :          'bg-gray-200 text-gray-500'}`}>
              {done ? '✓' : idx}
            </div>
            <span className={`text-xs font-medium ${active ? 'text-blue-700' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < steps.length - 1 && <div className="flex-1 h-px bg-gray-200 w-6" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Select Period + Create Setup ─────────────────────────────────────
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
      if (result.status === 'success') {
        showToast('Setup created', 'success');
        onCreated(result);
      } else {
        showToast(result.message || 'Failed to create setup', 'error');
      }
    } catch {
      showToast('Error creating setup', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Payroll period</label>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <button
        onClick={handleCreate}
        disabled={loading}
        className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {loading ? 'Creating…' : 'Create Setup'}
      </button>
    </div>
  );
}

// ─── Step 2: Review MPS + optional override + Run ────────────────────────────
function StepReview({ mps, onRun }) {
  const gateway = useGateway();
  const { auth } = useAuth();
  const { show: showToast } = useToast();

  const allowOverride = auth.portalConfig?.allow_working_days_override;
  const [overriding,   setOverriding]   = useState(false);
  const [newWorkingDays, setNewWorkingDays] = useState(mps.working_days);
  const [saving,       setSaving]       = useState(false);
  const [running,      setRunning]      = useState(false);

  const handleSaveOverride = async () => {
    setSaving(true);
    try {
      const result = await gateway.invoke('portalUpdateMPS', {
        payroll_period:   mps.period,
        new_working_days: newWorkingDays
      });
      if (result.status === 'success') {
        showToast('Working days updated', 'success');
        setOverriding(false);
      } else {
        showToast(result.message || 'Override failed', 'error');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await gateway.invoke('portalTriggerOrchestrator', { payroll_period: mps.period });
      if (result.status === 'success') {
        showToast(`Run started — ${result.queued} employees queued`, 'success');
        onRun(result);
      } else {
        showToast(result.message || 'Run failed', 'error');
        setRunning(false);
      }
    } catch {
      showToast('Failed to trigger run', 'error');
      setRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* MPS summary card */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Period</span>
          <span className="text-sm font-semibold text-gray-900">{mps.period}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Working days</span>
          <div className="flex items-center gap-2">
            {overriding ? (
              <input
                type="number"
                min={1} max={31}
                value={newWorkingDays}
                onChange={e => setNewWorkingDays(Number(e.target.value))}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            ) : (
              <span className="text-sm font-semibold text-gray-900">{mps.working_days}</span>
            )}
            {allowOverride && !overriding && (
              <button
                onClick={() => setOverriding(true)}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Override
              </button>
            )}
          </div>
        </div>
        {overriding && (
          <div className="flex gap-2">
            <button
              onClick={handleSaveOverride}
              disabled={saving}
              className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => { setOverriding(false); setNewWorkingDays(mps.working_days); }}
              className="flex-1 py-1.5 border border-gray-300 text-gray-600 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Holidays */}
      {mps.holidays && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Public holidays</p>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            {mps.holidays.split('\n').map((h, i) => (
              <p key={i} className="text-sm text-gray-700 py-0.5 font-mono">{h}</p>
            ))}
          </div>
        </div>
      )}

      {/* Run button */}
      <button
        onClick={handleRun}
        disabled={running || overriding}
        className="w-full py-3 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {running && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
        {running ? 'Starting run…' : 'Run Payroll'}
      </button>
    </div>
  );
}

// ─── Step 3: Progress polling ─────────────────────────────────────────────────
function StepProgress({ period, orchResult }) {
  const gateway = useGateway();
  const [data,      setData]      = useState(null);
  const [countdown, setCountdown] = useState(30);

  const loadStatus = useCallback(async () => {
    try {
      const r = await gateway.invoke('portalGetQueueStatus', { payroll_period: period });
      if (r.status === 'success') setData(r);
    } catch { /* silent */ }
    setCountdown(30);
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadStatus(); }, [loadStatus]);

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => { if (c <= 1) { loadStatus(); return 30; } return c - 1; });
    }, 1000);
    return () => clearInterval(tick);
  }, [loadStatus]);

  const progress = data?.progress;
  const pct = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0;
  const complete = data?.mps_status === 'Completed';

  return (
    <div className="space-y-4">
      {/* Orchestrator summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm font-medium text-blue-800">
          Run started — {orchResult.queued} employees across {orchResult.batches} batch{orchResult.batches > 1 ? 'es' : ''}
        </p>
      </div>

      {/* Live progress */}
      {data ? (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">
              {complete ? '✅ Completed' : `Processing — ${countdown}s`}
            </span>
            <span className="text-sm font-semibold text-gray-900">{pct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all duration-500 ${complete ? 'bg-green-500' : 'bg-blue-600'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {progress && (
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="bg-green-50 rounded-lg py-2">
                <div className="font-semibold text-green-700">{progress.done}</div>
                <div className="text-gray-500">Done</div>
              </div>
              <div className="bg-amber-50 rounded-lg py-2">
                <div className="font-semibold text-amber-700">{progress.pending + progress.processing}</div>
                <div className="text-gray-500">Remaining</div>
              </div>
              <div className="bg-red-50 rounded-lg py-2">
                <div className="font-semibold text-red-700">{progress.error}</div>
                <div className="text-gray-500">Errors</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex justify-center py-8">
          <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}

// ─── Main RunPayroll component ────────────────────────────────────────────────
export default function RunPayroll() {
  const [step,       setStep]       = useState(1);
  const [mpsData,    setMpsData]    = useState(null);
  const [orchResult, setOrchResult] = useState(null);

  const handleMpsCreated = (result) => { setMpsData(result); setStep(2); };
  const handleRunStarted = (result) => { setOrchResult(result); setStep(3); };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-lg font-semibold text-gray-900 mb-6">Run Payroll</h1>
      <Stepper step={step} />

      {step === 1 && <StepSetup onCreated={handleMpsCreated} />}
      {step === 2 && mpsData && <StepReview mps={mpsData} onRun={handleRunStarted} />}
      {step === 3 && orchResult && <StepProgress period={mpsData.period} orchResult={orchResult} />}
    </div>
  );
}
