// ─── LoadingScreen ────────────────────────────────────────────────────────────
export function LoadingScreen({ message = 'Loading Payroll Portal…' }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}

// ─── AccessDenied ─────────────────────────────────────────────────────────────
export function AccessDenied({ employeeId }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center">
        <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-gray-900">Access Denied</h1>
      <p className="text-sm text-gray-500 max-w-xs">
        Your employee ID <span className="font-mono text-gray-700">{employeeId || '—'}</span> does not have access to the Payroll Portal.
        Contact your system administrator to request access.
      </p>
    </div>
  );
}

// ─── ErrorScreen ─────────────────────────────────────────────────────────────
export function ErrorScreen({ message, onRetry }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center">
        <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.924-.833-2.694 0L3.732 16.5c-.77.833.193 2.5 1.732 2.5z" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
      <p className="text-sm text-gray-500 max-w-xs">{message}</p>
      {onRetry && (
        <button onClick={onRetry}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 active:scale-95 transition-all">
          Retry
        </button>
      )}
    </div>
  );
}
