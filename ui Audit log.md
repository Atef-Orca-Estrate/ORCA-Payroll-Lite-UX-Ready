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

---

### LOG-003 — 2026-05-12 — Feature: Scope selection in Run Payroll wizard + AUD-012
**File:** `webtab/src/features/RunPayroll/index.jsx`

**Feature added:**
Step 1 (Setup) of the wizard now has two internal sub-screens. Stepper unchanged (4 steps).

Sub-screen `period_scope`:
- Existing period picker retained unchanged.
- New scope selector: 3 radio-style option buttons — All employees / By department / By employee.
- "All employees": CTA = "Create setup" → calls `portalCreateMPS` directly (existing flow).
- "By department" / "By employee": CTA = "Next →" → transitions to sub-screen `selection`.

Sub-screen `selection`:
- Back link returns to sub-screen 1.
- Read-only period badge for confirmation.
- By department: text input for department name (must match Zoho People exactly).
- By employee: textarea for comma-separated employee IDs. Live count shown below.
- CTA disabled until input is non-empty.
- On submit: calls `portalSaveSettings(section:'payroll_settings', scope, ...)` to write scope to `PAYROLL_SETTINGS_JSON`, then `portalCreateMPS`. Two-call approach (GW-006 tracked to consolidate).

`onCreated` callback extended to `onCreated(result, scopeInfo)`. `scopeInfo = { scope, selected_department, selected_employees }`.

`handleMpsCreated` updated to accept `scopeInfo` and carry `scope`, `selected_department`, `selected_employees` on the `newRun` object.

**AUD-012 resolved (side effect):**
`StepReview.scopeLabel` now reads from `run.scope` / `run.selected_department` / `run.selected_employees` instead of `auth.payrollSettings?.payroll_run?.scope`. Gives accurate per-run scope detail (e.g. "Dept: Engineering", "3 selected employees").

**Gateway tracked:**
- GW-007: `portalGetEmployees` — for future live employee picker upgrade.
- GW-008: `portalGetDepartments` — for future department dropdown upgrade.

**Status:** ✅ Done

---

### LOG-004 — 2026-05-12 — List pickers for department and employee scope selection
**Files:** `features/RunPayroll/index.jsx`, `hooks/mockData.js`, `hooks/useGateway.js`, `Gateway Functions/portalGetDepartments.js`, `Gateway Functions/portalGetEmployees.js`

**Change:**
Replaced text inputs in StepSetup `selection` sub-screen with live-fetched list pickers.

**Department picker (by_department scope):**
- Fetches `portalGetDepartments` on sub-screen entry. Loading spinner shown during fetch.
- Client-side search filter (no re-fetch on keystroke). Search icon in input.
- Radio-style single-select rows. Selected row highlighted in accent colour.
- CTA disabled until one department is selected.

**Employee picker (by_employee scope):**
- Fetches `portalGetEmployees` on sub-screen entry.
- Client-side search by name or employee ID.
- Checkbox multi-select rows. Name + ID + department shown per row.
- Selected count badge shown below list.
- CTA disabled until at least one employee is selected.

**useEffect cleanup:** `cancelled` flag prevents state updates after unmount or scope change.

**Gateway Functions created:**
- `portalGetDepartments`: calls Zoho People department API, returns `[{ name }]`.
- `portalGetEmployees`: calls P_Employee forms API, filters active, limit 200, returns `[{ id, name, department }]`.

**Mock added:** `mock_portalGetDepartments` (8 sample departments), `mock_portalGetEmployees` (10 sample employees). Registered in `MOCK_HANDLERS`.

**GW-007 and GW-008 closed.**

**Status:** ✅ Done

---

### LOG-005 — 2026-05-12 — AUD-009: Direction decision — variable schema to match mock
**Status change:** Pending → 🔧 Variable Pending

**Decision:**
`PAYROLL_SETTINGS_JSON` org variable structure will be **expanded** to match the mock schema. The mock is the design target. The real gateway and variable must catch up — the UI is not being simplified.

**What this means for the backend consultant (GW-009):**
`PAYROLL_SETTINGS_JSON.active_settings` must be expanded from its current flat structure to a nested schema matching `mock_portalGetSettings`:

```
active_settings: {
  payroll_run: {
    scope, selected_department, selected_employees, lock
  },
  attendance: {
    working_days_default,
    absence:        { enabled, multiplier },
    unpaid_leave:   { enabled, multiplier },
    late_deduction: { enabled, grace_minutes, multiplier },
    overtime:       { enabled, multiplier },
    public_holiday: { enabled, if_worked }
  },
  social_insurance: {
    monthly_ceiling, ceiling_updated,
    employee_rate, employer_rate, martyrs_fund_rate
  },
  income_tax: {
    apply_tax
  }
}
```

Three files must change together atomically:
1. `docs/Variables.md` — update PAYROLL_SETTINGS_JSON schema section
2. `portalGetSettings` — return full nested structure from expanded variable
3. `portalSaveSettings` — all three sections (payroll_settings, attendance, social_insurance) read/write the correct nested paths

**UI is already aligned to this schema.** No UI changes needed once GW-009 is implemented.

**Status:** 🔧 Variable Pending — blocked on backend/variable work (GW-009)
