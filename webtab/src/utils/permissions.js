// Resolve role and feature list from PAYROLL_PORTAL_CONFIG for a given employeeId
export function resolvePermissions(portalConfig, employeeId) {
  if (!portalConfig || !employeeId) return { role: null, features: [] };
  const users = portalConfig.portal_users || {};
  const roles = portalConfig.portal_roles || {};
  const role  = users[employeeId] || null;
  if (!role) return { role: null, features: [] };
  return { role, features: roles[role] || [] };
}

export const FEATURE_LABELS = {
  feature_settings:      'Settings',
  feature_run_payroll:   'Run Payroll',
  feature_queue_monitor: 'Queue',
  feature_reports:       'Reports'
};
