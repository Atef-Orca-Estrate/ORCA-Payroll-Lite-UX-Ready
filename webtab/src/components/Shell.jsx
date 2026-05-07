import { useEffect, useState, useCallback } from 'react';
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
  const [navParams,     setNavParams]     = useState({});
  const [initError,     setInitError]     = useState(null);

  // ── Navigation handler — used by Nav, Sidebar, and features cross-navigating
  // Accepts optional params so features can deep-link into another feature's state
  // e.g. RunPayroll → Reports with { period: '2026-04' } pre-filled
  const handleNavigate = useCallback((featureKey, params = {}) => {
    setNavParams(params);
    setActiveFeature(featureKey);
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const user       = await init();
        const employeeId = user.employeeId;

        const settingsResult = await gateway.invoke('portalGetSettings');
        if (settingsResult.status !== 'success') {
          throw new Error(settingsResult.message || 'Failed to load settings');
        }

        const { role, features } = resolvePermissions(settingsResult.portal_config, employeeId);

        if (!role) {
          setAuth(prev => ({ ...prev, loading: false, denied: true, employeeId }));
          return;
        }

        setActiveFeature(features[0] || null);
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

  if (auth.loading) return <LoadingScreen />;
  if (initError)    return <ErrorScreen message={initError} onRetry={() => window.location.reload()} />;
  if (auth.denied)  return <AccessDenied employeeId={auth.employeeId} />;

  const ActiveComponent = activeFeature ? FEATURE_REGISTRY[activeFeature]?.component : null;
  const isRunPayroll    = activeFeature === 'feature_run_payroll';

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface-raised)' }}>
      <Sidebar active={activeFeature} onNavigate={handleNavigate} />

      <main className="flex-1 min-w-0 flex flex-col overflow-hidden pb-16 md:pb-0">
        {/* Mobile brand header */}
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

        <div className={
          isRunPayroll
            ? 'flex-1 min-h-0 overflow-hidden flex flex-col p-3 md:p-6'
            : 'flex-1 overflow-y-auto p-4 md:p-6'
        }>
          {ActiveComponent ? (
            <ActiveComponent onNavigate={handleNavigate} navParams={navParams} />
          ) : (
            <div className="flex items-center justify-center h-64 text-sm"
              style={{ color: 'var(--text-muted)' }}>
              Select a feature to get started
            </div>
          )}
        </div>
      </main>

      <BottomNav active={activeFeature} onNavigate={handleNavigate} />
    </div>
  );
}
