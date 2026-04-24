import { useEffect, useState } from 'react';
import { useAuth }       from '../context/AuthContext';
import { useSDK }        from '../hooks/useSDK';
import { useGateway }    from '../hooks/useGateway';
import { resolvePermissions } from '../utils/permissions';
import { LoadingScreen, AccessDenied, ErrorScreen } from './LoadingScreen';
import { Sidebar, BottomNav } from './Nav';
import QueueMonitor from '../features/QueueMonitor';
import Reports      from '../features/Reports';
import RunPayroll   from '../features/RunPayroll';
import Settings     from '../features/Settings';

const FEATURE_COMPONENTS = {
  feature_run_payroll:   RunPayroll,
  feature_queue_monitor: QueueMonitor,
  feature_reports:       Reports,
  feature_settings:      Settings
};

export default function Shell() {
  const { auth, setAuth } = useAuth();
  const { init }          = useSDK();
  const gateway           = useGateway();
  const [activeFeature, setActiveFeature] = useState(null);
  const [initError, setInitError]         = useState(null);

  useEffect(() => {
    async function initialize() {
      try {
        // Step 1: Get user identity from SDK
        const user = await init();
        const employeeId = user.employeeId;

        // Step 2: Fetch settings (includes portal config with roles + users map)
        const settingsResult = await gateway.invoke('portalGetSettings');

        if (settingsResult.status !== 'success') {
          throw new Error(settingsResult.message || 'Failed to load settings');
        }

        // Step 3: Resolve permissions
        const { role, features } = resolvePermissions(settingsResult, employeeId);

        if (!role) {
          setAuth(prev => ({ ...prev, loading: false, denied: true, employeeId }));
          return;
        }

        // Step 4: Set default feature (first in features list)
        const defaultFeature = features[0] || null;
        setActiveFeature(defaultFeature);

        setAuth({
          loading:         false,
          denied:          false,
          employeeId,
          role,
          features,
          payrollSettings: settingsResult.payroll_settings,
          portalConfig:    settingsResult.portal_config,
          error:           null
        });
      } catch (err) {
        console.error('[Shell] Initialization failed:', err);
        setInitError(err.message || 'Initialization failed');
        setAuth(prev => ({ ...prev, loading: false }));
      }
    }

    initialize();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Loading ──────────────────────────────────────────────────────────────
  if (auth.loading) return <LoadingScreen />;

  // ── Error ────────────────────────────────────────────────────────────────
  if (initError) return <ErrorScreen message={initError} onRetry={() => window.location.reload()} />;

  // ── Access Denied ────────────────────────────────────────────────────────
  if (auth.denied) return <AccessDenied employeeId={auth.employeeId} />;

  // ── Main Layout ──────────────────────────────────────────────────────────
  const ActiveComponent = activeFeature ? FEATURE_COMPONENTS[activeFeature] : null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar active={activeFeature} onNavigate={setActiveFeature} />

      {/* Main content area — padded at bottom for mobile nav */}
      <main className="flex-1 min-w-0 pb-20 md:pb-0">
        {/* Mobile page header */}
        <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold text-blue-600 tracking-widest uppercase">Orca</div>
            <div className="text-sm font-semibold text-gray-900">Payroll Portal</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-semibold text-blue-700">
              {auth.employeeId?.slice(0, 2).toUpperCase()}
            </div>
          </div>
        </div>

        {/* Feature content */}
        <div className="p-4 md:p-6">
          {ActiveComponent ? (
            <ActiveComponent />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
              Select a feature to get started
            </div>
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <BottomNav active={activeFeature} onNavigate={setActiveFeature} />
    </div>
  );
}
