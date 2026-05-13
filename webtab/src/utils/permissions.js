// Resolve role and feature list from PAYROLL_PORTAL_CONFIG for a given employeeId.
// Returns { role, features[] } — role is null if employeeId not found in portal_users.
// Feature labels and display metadata live in featureRegistry.jsx — not here.
export function resolvePermissions(portalConfig, employeeId) {
  if (!portalConfig || !employeeId) return { role: null, features: [], roleRevoked: false };
  const users = portalConfig.portal_users || {};
  const roles = portalConfig.portal_roles || {};
  const role  = users[employeeId] || null;
  if (!role) return { role: null, features: [], roleRevoked: false };
  // User has a role assigned but that role was deleted from portal_roles
  if (!(role in roles)) return { role: null, features: [], roleRevoked: true };
  return { role, features: roles[role] || [], roleRevoked: false };
}
