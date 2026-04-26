import { useAuth } from '../context/AuthContext';
import { FEATURE_LABELS } from '../utils/permissions';

const FEATURE_ORDER = [
  'feature_run_payroll',
  'feature_queue_monitor',
  'feature_reports',
  'feature_settings'
];

const ICONS = {
  feature_run_payroll: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  feature_queue_monitor: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  ),
  feature_reports: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  feature_settings: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
};

// ─── Desktop Sidebar ─────────────────────────────────────────────────────────
export function Sidebar({ active, onNavigate }) {
  const { auth } = useAuth();
  const visibleFeatures = FEATURE_ORDER.filter(f => auth.features.includes(f));

  return (
    <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 min-h-screen">
      {/* Logo / header */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="text-xs font-semibold text-blue-600 tracking-widest uppercase">Orca</div>
        <div className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">Payroll Portal</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleFeatures.map(feature => (
          <button
            key={feature}
            onClick={() => onNavigate(feature)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
              ${active === feature
                ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`}
          >
            <span className={active === feature ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}>
              {ICONS[feature]}
            </span>
            {FEATURE_LABELS[feature]}
          </button>
        ))}
      </nav>

      {/* User badge */}
      <div className="px-4 py-4 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold text-blue-700 dark:text-blue-300">
            {auth.employeeId?.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-800 dark:text-gray-200">{auth.employeeId}</div>
            <div className="text-xs text-gray-400 dark:text-gray-600 capitalize">{auth.role}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Mobile Bottom Nav ───────────────────────────────────────────────────────
export function BottomNav({ active, onNavigate }) {
  const { auth } = useAuth();
  const visibleFeatures = FEATURE_ORDER.filter(f => auth.features.includes(f));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40">
      <div className="flex">
        {visibleFeatures.map(feature => (
          <button
            key={feature}
            onClick={() => onNavigate(feature)}
            className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors
              ${active === feature ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}
          >
            <span>{ICONS[feature]}</span>
            <span className="text-[10px]">{FEATURE_LABELS[feature]}</span>
            {active === feature && (
              <span className="absolute bottom-0 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t" />
            )}
          </button>
        ))}
      </div>
    </nav>
  );
}
