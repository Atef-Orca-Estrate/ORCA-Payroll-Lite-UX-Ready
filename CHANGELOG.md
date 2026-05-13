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

## Prior commits (branch: ui/mock-frontend-sandbox)
See `git log` for full history of earlier UI build iterations.
