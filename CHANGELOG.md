# ORCA Payroll Lite — Changelog

---

## [UX Ready] — 2026-05-13

### Gateway Functions — New (6 added)
- `portalListRuns` — returns all MPS records as typed Run objects, scope fields included
- `portalGetPayrollRecords` — per-employee financial records, enriched, filtered by `run_id`
- `portalUpdateMPSHolidays` — full holiday-list replacement for manual-source periods
- `portalListEmployees` — full employee profiles with exclusion flags and salary reference
- `portalUpdateEmployee` — upserts `Employee_Payroll_Config` exclusion flags per employee
- `portalGetDashboard` — aggregated dashboard data (employee summary, run history, alerts)

### Gateway Functions — Modified (7 updated)
- `portalGetSettings` — response shape rebuilt: `payroll_settings` now has correct sub-objects (`social_insurance`, `attendance`); `portal_config` now nests `portal_users`, `portal_roles`, and `allow_multiple_runs`
- `portalCreateMPS` — accepts `scope`, `selected_department`, `selected_employees`, `force`; returns `run_id`; stores scope on MPS record; `holidays` returned as `[{date, name}]` array; status stored as `"Draft"`
- `portalGetQueueStatus` — accepts optional `run_id`; returns `run_id`; enriches every record with `employee_name` + `department`; maps legacy `"Ready"` → `"Draft"`; error response includes `code: "no_run"`
- `portalSaveSettings` — replaced old `payroll_settings` section with 5 correct sections: `social_insurance`, `attendance`, `portal_config` (with `allow_multiple_runs`), `portal_roles`, `portal_users`; defunct `payroll_settings` section now returns error
- `portalTriggerOrchestrator` — returns `run_id`; lock error message matches frontend retry string exactly; accepts `"Draft"` status
- `portalGetPeriodReport` — empty period returns `status: "error"` (not empty success); `generated_at` is `"HH:MM"` only
- `portalUpdateMPS` — status guard accepts `"Draft"` (and legacy `"Ready"`)

### Scope Ownership — Architecture change
- Scope (`scope`, `selected_department`, `selected_employees`) moved from `PAYROLL_SETTINGS_JSON` org variable to the MPS record
- `portalCreateMPS` is the sole write point for scope; `portalListRuns` is the sole read point
- `portalSaveSettings` no longer handles scope; `section: "payroll_settings"` is explicitly rejected in both Deluge and mock

### Frontend — `useGateway.js`
- Production path now returns `{ status: "error", message }` on null responses and SDK exceptions instead of throwing, ensuring all feature error checks work identically in DEV and production

### Frontend — `RunPayroll/index.jsx`
- Removed pre-`portalCreateMPS` call to `portalSaveSettings` with defunct `section: "payroll_settings"`
- Scope params (`scope`, `selected_department`, `selected_employees`) now sent directly to `portalCreateMPS` in a single call
- `handleRunStarted` now matches the run to update by `run_id` instead of `period`, preventing sibling-run corruption when `allow_multiple_runs = true`

### Frontend — `Dashboard/index.jsx`
- Added `hasLastRun` guard: dashboard no longer crashes when `last_run` is empty (fresh install with no run history)
- "Last Payroll" and "Net Paid" KPI cards show `'—'` / `'No runs yet'` placeholder
- "Last Run Breakdown" card is not rendered when no run history exists

### Mock — `mockData.js`
- `mock_portalSaveSettings` now explicitly rejects `section: "payroll_settings"` with an error, matching production Deluge behaviour and exposing the bug in DEV_MODE

### Documentation
- `AI Docs/GATEWAY_FUNCTIONS.md` — fully updated: 6 new functions documented, 7 modified, scope ownership principle added, `PAYROLL_SETTINGS_JSON` variable structure corrected, `payroll_run` scope fields removed, summary table updated
- `AI Docs/Frontend Variable Structure.md` — created: canonical reference for all organisation-level settings variables
- `AI Docs/FRONTEND_ASPECTS.md` — unchanged (still current)

---

## [Post UX Ready] — 2026-05-13 (session 2)

### Bug Fixes

- **`portalGetPayrollRecords` (Deluge)** — added in-memory `run_id` filter (Step 2b): when `run_id` is provided, only records whose `pr_mps_id` matches are returned. Records without `pr_mps_id` (legacy) are always included. Prevents mixed records when `allow_multiple_runs = true` and two runs share the same period.

- **Dashboard — null crash on fresh install** — added `hasLastRun` guard (`!!(last_run?.period)`). "Last Payroll" and "Net Paid" KPI cards now render `'—'` / `'No runs yet'` when no run history exists. "Last Run Breakdown" card is not rendered at all when `hasLastRun` is false. Dashboard is now safe on a brand-new org with zero runs.

### Repository Structure

- **Root cleanup** — removed stale root-level markdown files committed in earlier sessions: `DELUGE_LOGIC.md`, `DEVELOPER_INSTRUCTIONS.md`, `PENDING_CONFIG.md`, `README.md`, `README-LOCAL-DEV.md`, `UPDATES.md`, `WEBTAB_SPEC.md`, `ui Audit log.md`, `ui Audit tasks.md`. `CHANGELOG.md` is now the only document at root.

- **Deluge Functions restructure** — created `Deluge Functions/Payroll Engine Functions/` subfolder. Moved all non-gateway engine functions into it: `calculateEmployeePayroll.js`, `onEmployeeTermination.js`, `processPayrollBatch.js`, `processTerminationRun.js`, `runPayrollOrchestrator.js`. Folder structure is now:
  ```
  Deluge Functions/
  ├── Gateway Functions/         — 15 portal* webtab-facing functions
  └── Payroll Engine Functions/  — 5 backend orchestration + calculation functions
  ```

### Documentation

- **`docs/Forms.md`** — rebuilt with `[FRONTEND]` / `[BACKEND]` section markers throughout. Added: `Employee_Payroll_Config` new form; 8 new MPS frontend fields (`mps_scope`, `mps_selected_department`, `mps_selected_employees`, `mps_batches`, `mps_gross`, `mps_net`, `mps_tax`, `mps_si`); `pr_mps_id` field requirement on `Monthly_Payroll_Record`; `pr_monthly_tax` → `pr_monthly_tax_withheld` alias table; frontend field-mapping tables for `Payroll_Queue` and `Monthly_Payroll_Record`. Total field count updated to 92.

- **`docs/Variables.md`** — rebuilt with `[FRONTEND]` / `[BACKEND]` section markers. Updated `PAYROLL_SETTINGS_JSON` to show new `social_insurance` and `attendance` blocks with correct frontend field names; `payroll_run` now contains only `lock`; scope fields explicitly noted as removed. Updated `PAYROLL_PORTAL_CONFIG` with `allow_multiple_runs`; full `roles` / `users` / `config` structure documented. Backend-only variables (`SI_CONFIG_JSON`, `TAX_CONFIG_JSON`, tax brackets, `ATTENDANCE_RULES_JSON`) marked as not read by any gateway function. Setup checklist split into frontend and backend responsibilities.

- **`docs/Run Scenarios.md`** — created. 35 scenarios across 11 categories covering every payroll run path a user can take through the UI: all scope types, Zoho/manual holiday source, working days override, lock-conflict auto-retry, live polling, records panel, multi-run per period, all error states, cross-feature navigation, and mobile drawer behaviour. Includes a coverage matrix.

- **`AI Docs/GATEWAY_FUNCTIONS.md`** — rev 2: scope ownership principle added to key principles; `portalGetSettings` response no longer documents `payroll_run` scope block; `portalCreateMPS` params marked as required for every call; `portalSaveSettings` warns that `"payroll_settings"` section is invalid and returns error; `PAYROLL_SETTINGS_JSON` variable structure updated to reflect scope field removal; summary table column updated to "Scope owner?".

### GitHub

- Repository pushed to **https://github.com/Atef-Orca-Estrate/ORCA-Payroll-Lite-UX-Ready** at commit `9f3f859`

---

## [UX Ready] — 2026-05-13 (session 1)

### Gateway Functions — New (6 added)
- `portalListRuns` — returns all MPS records as typed Run objects, scope fields included
- `portalGetPayrollRecords` — per-employee financial records, enriched, filtered by `run_id`
- `portalUpdateMPSHolidays` — full holiday-list replacement for manual-source periods
- `portalListEmployees` — full employee profiles with exclusion flags and salary reference
- `portalUpdateEmployee` — upserts `Employee_Payroll_Config` exclusion flags per employee
- `portalGetDashboard` — aggregated dashboard data (employee summary, run history, alerts)

### Gateway Functions — Modified (7 updated)
- `portalGetSettings` — response shape rebuilt: `payroll_settings` now has correct sub-objects (`social_insurance`, `attendance`); `portal_config` now nests `portal_users`, `portal_roles`, and `allow_multiple_runs`
- `portalCreateMPS` — accepts `scope`, `selected_department`, `selected_employees`, `force`; returns `run_id`; stores scope on MPS record; `holidays` returned as `[{date, name}]` array; status stored as `"Draft"`
- `portalGetQueueStatus` — accepts optional `run_id`; returns `run_id`; enriches every record with `employee_name` + `department`; maps legacy `"Ready"` → `"Draft"`; error response includes `code: "no_run"`
- `portalSaveSettings` — replaced old `payroll_settings` section with 5 correct sections: `social_insurance`, `attendance`, `portal_config` (with `allow_multiple_runs`), `portal_roles`, `portal_users`; defunct `payroll_settings` section now returns error
- `portalTriggerOrchestrator` — returns `run_id`; lock error message matches frontend retry string exactly; accepts `"Draft"` status
- `portalGetPeriodReport` — empty period returns `status: "error"` (not empty success); `generated_at` is `"HH:MM"` only
- `portalUpdateMPS` — status guard accepts `"Draft"` (and legacy `"Ready"`)

### Scope Ownership — Architecture change
- Scope (`scope`, `selected_department`, `selected_employees`) moved from `PAYROLL_SETTINGS_JSON` org variable to the MPS record
- `portalCreateMPS` is the sole write point for scope; `portalListRuns` is the sole read point
- `portalSaveSettings` no longer handles scope; `section: "payroll_settings"` is explicitly rejected in both Deluge and mock

### Frontend — `useGateway.js`
- Production path now returns `{ status: "error", message }` on null responses and SDK exceptions instead of throwing, ensuring all feature error checks work identically in DEV and production

### Frontend — `RunPayroll/index.jsx`
- Removed pre-`portalCreateMPS` call to `portalSaveSettings` with defunct `section: "payroll_settings"`
- Scope params (`scope`, `selected_department`, `selected_employees`) now sent directly to `portalCreateMPS` in a single call
- `handleRunStarted` now matches the run to update by `run_id` instead of `period`, preventing sibling-run corruption when `allow_multiple_runs = true`

### Frontend — `Dashboard/index.jsx`
- Added `hasLastRun` guard: dashboard no longer crashes when `last_run` is empty (fresh install with no run history)
- "Last Payroll" and "Net Paid" KPI cards show `'—'` / `'No runs yet'` placeholder
- "Last Run Breakdown" card is not rendered when no run history exists

### Mock — `mockData.js`
- `mock_portalSaveSettings` now explicitly rejects `section: "payroll_settings"` with an error, matching production Deluge behaviour and exposing the bug in DEV_MODE

### Documentation
- `AI Docs/GATEWAY_FUNCTIONS.md` — fully updated: 6 new functions documented, 7 modified, scope ownership principle added, `PAYROLL_SETTINGS_JSON` variable structure corrected, `payroll_run` scope fields removed, summary table updated
- `AI Docs/Frontend Variable Structure.md` — created: canonical reference for all organisation-level settings variables
- `AI Docs/FRONTEND_ASPECTS.md` — unchanged (still current)

---

## Prior commits (branch: ui/mock-frontend-sandbox)
See `git log` for full history of earlier UI build iterations.
