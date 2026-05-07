// webtab/src/config/featureRegistry.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all feature definitions.
//
// TO ADD A NEW FEATURE:
//   1. Add one entry to FEATURE_REGISTRY below (label, Icon, component, order, minRoles)
//   2. Add the feature key to PAYROLL_PORTAL_CONFIG.roles in Zoho (backend)
//   Shell, Sidebar, BottomNav all auto-update — no other frontend files change.
//
// minRoles is INFORMATIONAL ONLY — it documents intended access but never gates
// anything at runtime. The server-returned features[] array from portalGetSettings
// is the sole runtime access gate. This keeps role configuration server-driven:
// adding a new role in Zoho requires zero frontend code changes or deploys.
// ─────────────────────────────────────────────────────────────────────────────

import RunPayroll   from '../features/RunPayroll';
import QueueMonitor from '../features/QueueMonitor';
import Reports      from '../features/Reports';
import Settings     from '../features/Settings';

// ─── Icons ───────────────────────────────────────────────────────────────────
// Co-located with feature definitions. Stroke width 1.8 — consistent across all.

function IconRunPayroll() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function IconQueueMonitor() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function IconReports() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const FEATURE_REGISTRY = {
  feature_run_payroll: {
    label:     'Run Payroll',
    Icon:      IconRunPayroll,
    component: RunPayroll,
    order:     1,
    minRoles:  ['admin', 'manager'],
  },
  feature_queue_monitor: {
    label:     'Queue',
    Icon:      IconQueueMonitor,
    component: QueueMonitor,
    order:     2,
    minRoles:  ['admin', 'manager'],
  },
  feature_reports: {
    label:     'Reports',
    Icon:      IconReports,
    component: Reports,
    order:     3,
    minRoles:  ['admin', 'manager'],
  },
  feature_settings: {
    label:     'Settings',
    Icon:      IconSettings,
    component: Settings,
    order:     4,
    minRoles:  ['admin'],
  },
};

// ─── Derived exports ──────────────────────────────────────────────────────────

// Sorted array of feature keys by display order — consumed by nav components.
// Do not maintain a separate order array elsewhere.
export const FEATURE_ORDER = Object.entries(FEATURE_REGISTRY)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([key]) => key);
