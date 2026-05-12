# UI Audit Log
**Project:** ORCA Payroll Lite 2.0 — `ui/mock-frontend-sandbox`
**Auditor:** Frontend Auditor — Claude

---

## Format
`ID | Timestamp | Case | Finding | Fix Applied | Status`

---

## Log Entries

---

### LOG-000 — 2026-05-12 — Initial Audit Pass
**Scope:** Full read of `webtab/src/`, `Gateway Functions/`, `docs/Variables.md`, `mockData.js`
**Finding:** 13 issues identified across 4 severity levels. No fixes applied.
**Tasks created:** AUD-001 through AUD-013.
**Status:** Reference only.

---

### LOG-001 — 2026-05-12 — AUD-005: PortalUsersSection gateway calls
**File:** `webtab/src/features/Settings/index.jsx`

**Finding:**
`handleAdd` was invoking non-existent `portalAddPortalUser` with param `employee_id`.
`handleRemove` was invoking non-existent `portalRemovePortalUser` with param `employee_id`.
Both used `result.portal_users` to update state — real `portalSaveSettings` returns only `{ status, message }`.

**Fix Applied:**
- `handleAdd`: now calls `portalSaveSettings` with `section: 'portal_users'`, `user_id`, `role`. Local state updated manually via `setPortalUsers(prev => ({ ...prev, [empId]: newRole }))`.
- `handleRemove`: now calls `portalSaveSettings` with `section: 'portal_users'`, `user_id`, `role: ''` (empty = remove). Local state updated manually via delete from spread copy.
- Param renamed `employee_id` → `user_id` to match gateway signature.

**Status:** ✅ Done

---

### LOG-002 — 2026-05-12 — AUD-006 + AUD-010: PayrollRunSection save
**File:** `webtab/src/features/Settings/index.jsx`

**Finding (AUD-006):**
`handleSave` was sending `section: 'payroll_run'` — not a valid section in `portalSaveSettings`. Falls to unknown section guard → error response in production.

**Finding (AUD-010):**
UI was sending `department` param; gateway expects `selected_department`.

**Fix Applied:**
- Section changed to `'payroll_settings'`.
- Added pass-through of `apply_insurance`, `entity_type`, `apply_tax` read from `auth.payrollSettings` with safe defaults (`true`, `'Legal Entity'`, `true`). This prevents null-overwrite of SI/tax settings when only scope fields are being saved.
- `department` param renamed to `selected_department`.
- Auth state update key aligned: `department` → `selected_department`.
- Inline comment added: `selected_employees` is sent but silently dropped by gateway (AUD-011 / GW-005 — tracked for backend fix).

**Note:** `apply_insurance`, `entity_type`, `apply_tax` resolve to `undefined` in mock mode (mock schema is nested — AUD-009). The mock `portalSaveSettings` returns success regardless of params, so DEV_MODE behaviour is unchanged. In production the flat real gateway schema populates these correctly.

**Status:** ✅ Done

---
*Last updated: 2026-05-12*
