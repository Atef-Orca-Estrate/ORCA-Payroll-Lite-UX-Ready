import { useState, useEffect, useCallback } from 'react';
import { useGateway } from '../../hooks/useGateway';
import { useToast }   from '../../context/AuthContext';

const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const STATUS_STYLES = {
  Done:       'bg-green-50  text-green-700  border-green-200',
  Processing: 'bg-amber-50  text-amber-700  border-amber-200',
  Pending:    'bg-gray-50   text-gray-600   border-gray-200',
  Error:      'bg-red-50    text-red-700    border-red-200',
  Cancelled:  'bg-blue-50   text-blue-700   border-blue-200'
};

function StatusBadge({ status }) {
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${STATUS_STYLES[status] || STATUS_STYLES.Pending}`}>
      {status}
    </span>
  );
}

function ProgressBar({ progress }) {
  if (!progress || !progress.total) return null;
  const pct = Math.round((progress.done / progress.total) * 100);
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{progress.done} / {progress.total} processed</span>
        <span>{pct}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4 mt-1.5 text-xs text-gray-400">
        {progress.error > 0 && <span className="text-red-500">{progress.error} error{progress.error > 1 ? 's' : ''}</span>}
        {progress.pending > 0 && <span>{progress.pending} pending</span>}
        {progress.processing > 0 && <span className="text-amber-600">{progress.processing} processing</span>}
      </div>
    </div>
  );
}

function RegularCard({ rec }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-gray-800">{rec.employee_id}</span>
        <StatusBadge status={rec.status} />
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span>Batch {rec.batch_number || '—'}</span>
        {rec.processed_at && <span>{rec.processed_at}</span>}
      </div>
      {rec.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{rec.error}</p>
      )}
    </div>
  );
}

function TerminationCard({ rec }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-medium text-gray-800">{rec.employee_id}</span>
        <StatusBadge status={rec.status} />
      </div>
      <div className="flex gap-4 text-xs text-gray-500">
        <span>Exit: {rec.exit_date}</span>
        {rec.processed_at && <span>{rec.processed_at}</span>}
      </div>
      {rec.error && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-1.5">{rec.error}</p>
      )}
    </div>
  );
}

export default function QueueMonitor() {
  const gateway = useGateway();
  const { show: showToast } = useToast();

  const [period,     setPeriod]    = useState(currentMonth());
  const [data,       setData]      = useState(null);
  const [loading,    setLoading]   = useState(false);
  const [activeTab,  setActiveTab] = useState('regular');
  const [countdown,  setCountdown] = useState(30);

  const loadData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const result = await gateway.invoke('portalGetQueueStatus', { payroll_period: period });
      if (result.status === 'success') setData(result);
      else showToast(result.message || 'Failed to load queue', 'error');
    } catch {
      showToast('Queue load failed', 'error');
    } finally {
      setLoading(false);
      setCountdown(30);
    }
  }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // Initial load when period changes
  useEffect(() => { loadData(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  // 30-second countdown + auto-refresh
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { loadData(false); return 30; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [loadData]);

  const reg  = data?.regular_run;
  const term = data?.termination_run;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-gray-900">Queue Monitor</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Refresh in {countdown}s</span>
          <button
            onClick={() => loadData()}
            className="text-xs text-blue-600 font-medium hover:text-blue-700"
          >
            ↻ Now
          </button>
        </div>
      </div>

      {/* Period picker */}
      <div className="mb-4">
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {loading && !data && (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* MPS Status */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Run status</p>
                <p className="text-sm font-semibold text-gray-800">{data.mps_status}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 mb-0.5">Working days</p>
                <p className="text-sm font-semibold text-gray-800">{data.mps_working_days}</p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar progress={data.progress} />
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            {[
              { id: 'regular',     label: `Regular (${reg?.summary?.total || 0})` },
              { id: 'termination', label: `Termination (${term?.summary?.total || 0})` }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Record cards */}
          <div className="space-y-3">
            {activeTab === 'regular' && (
              reg?.records?.length > 0
                ? reg.records.map((r, i) => <RegularCard key={i} rec={r} />)
                : <p className="text-sm text-gray-400 text-center py-8">No regular records found</p>
            )}
            {activeTab === 'termination' && (
              term?.records?.length > 0
                ? term.records.map((r, i) => <TerminationCard key={i} rec={r} />)
                : <p className="text-sm text-gray-400 text-center py-8">No termination records found</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
