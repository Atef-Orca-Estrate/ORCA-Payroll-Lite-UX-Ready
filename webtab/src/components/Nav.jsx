import { useAuth } from '../context/AuthContext';
import { FEATURE_REGISTRY, FEATURE_ORDER } from '../config/featureRegistry';

// ─── Desktop Sidebar ─────────────────────────────────────────────────────────
export function Sidebar({ active, onNavigate }) {
  const { auth } = useAuth();
  const visibleFeatures = FEATURE_ORDER.filter(f => auth.features.includes(f));

  return (
    <aside className="hidden md:flex flex-col w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
      {/* Logo / header */}
      <div className="px-5 py-5 border-b border-gray-100 dark:border-gray-800">
        <div className="text-xs font-semibold text-blue-600 tracking-widest uppercase">Orca</div>
        <div className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">Payroll Portal</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleFeatures.map(featureKey => {
          const { label, Icon } = FEATURE_REGISTRY[featureKey];
          const isActive = active === featureKey;
          return (
            <button
              key={featureKey}
              onClick={() => onNavigate(featureKey)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'}`}
            >
              <span className={isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}>
                <Icon />
              </span>
              {label}
            </button>
          );
        })}
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
        {visibleFeatures.map(featureKey => {
          const { label, Icon } = FEATURE_REGISTRY[featureKey];
          const isActive = active === featureKey;
          return (
            <button
              key={featureKey}
              onClick={() => onNavigate(featureKey)}
              className={`flex-1 flex flex-col items-center justify-center py-2.5 gap-1 text-xs font-medium transition-colors
                ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400 dark:text-gray-600'}`}
            >
              <span><Icon /></span>
              <span className="text-[10px]">{label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
