import { useEffect, useState } from 'react';
import { useAuth }       from '../context/AuthContext';
import { useSDK }        from '../hooks/useSDK';
import { useGateway }    from '../hooks/useGateway';
import { resolvePermissions } from '../utils/permissions';
import { LoadingScreen, AccessDenied, ErrorScreen } from './LoadingScreen';
import { Sidebar, BottomNav } from './Nav';
import { FEATURE_REGISTRY }   from '../config/featureRegistry';

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

        // Step 3: Resolve permissions from portal_config
        const { role, features } = resolvePermissions(settingsResult.portal_config, employeeId);

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
  const ActiveComponent = activeFeature ? FEATURE_REGISTRY[activeFeature]?.component : null;

  const isRunPayroll = activeFeature === 'feature_run_payroll';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* Desktop sidebar */}
      <Sidebar active={activeFeature} onNavigate={setActiveFeature} />

      {/* Main content — flex column so RunPayroll can fill remaining height */}
      <main className="flex-1 min-w-0 flex flex-col overflow-hidden pb-16 md:pb-0">
        {/* Mobile page header — fixed dark brand bar */}
        <div className="md:hidden flex-shrink-0 flex items-center justify-between px-4 py-3"
          style={{ background: '#0F172A', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <img src="/orca-logo.svg" alt="" aria-hidden="true" width={26} height={26}
              style={{ display: 'block', flexShrink: 0 }} draggable={false} />
            <div>
              <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: '0.025em', lineHeight: 1.2 }}>
                ORCA Payroll
              </div>
              <div style={{ color: 'rgba(255,255,255,0.28)', fontSize: 8.5, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 1 }}>
                by Orca Estrate
              </div>
            </div>
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(99,102,241,0.18)',
            border: '1px solid rgba(99,102,241,0.30)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#A5B4FC', fontSize: 10, fontWeight: 600 }}>
              {auth.employeeId?.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'U'}
            </span>
          </div>
        </div>

        {/* Feature content
            RunPayroll: fixed height, no scroll — component manages its own overflow
            All others: natural scroll */}
        <div className={
          isRunPayroll
            ? 'flex-1 min-h-0 overflow-hidden flex flex-col p-4 md:p-6'
            : 'flex-1 overflow-y-auto p-4 md:p-6'
        }>
          {ActiveComponent ? (
            <ActiveComponent />
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-400 dark:text-gray-600 text-sm">
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
