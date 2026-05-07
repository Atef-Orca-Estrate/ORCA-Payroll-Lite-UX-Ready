// Resolve role and feature list from PAYROLL_PORTAL_CONFIG for a given employeeId.
// Returns { role, features[] } — role is null if employeeId not found in portal_users.
// Feature labels and display metadata live in featureRegistry.jsx — not here.
export function resolvePermissions(portalConfig, employeeId) {
  if (!portalConfig || !employeeId) return { role: null, features: [] };
  const users = portalConfig.portal_users || {};
  const roles = portalConfig.portal_roles || {};
  const role  = users[employeeId] || null;
  if (!role) return { role: null, features: [] };
  return { role, features: roles[role] || [] };
}
