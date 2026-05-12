# UI Audit Tasks
**Project:** ORCA Payroll Lite 2.0 — `ui/mock-frontend-sandbox`
**Auditor:** Frontend Auditor — Claude
**Audit Started:** 2026-05-12

---

## Instructions
- UI files only (`webtab/`) are modified in this workstream.
- Gateway Function changes and Org Variable schema changes are **tracked here but not applied**.
- Any gateway/variable change required as a result of a UI fix is logged in the **Gateway & Variable Changes Needed** section below.

---

## Status Legend
- 🔴 **CRITICAL** — Blocks production entirely
- 🟠 **HIGH** — Wrong gateway call; will error in production
- 🟡 **MEDIUM** — Data structure mismatch; silently wrong in production
- 🟢 **LOW** — Non-blocking; behavioural gap
- ✅ **Done** — UI fix applied (see Audit Log for details)
- 🔧 **Gateway Pending** — Tracked; requires Gateway Function or variable work

---

## UI Audit Tasks

| ID | Severity | Status | Location | Issue | Fix Reference |
|---|---|---|---|---|---|
| AUD-001 | 🔴 CRITICAL | Pending | `hooks/useGateway.js:4` | `DEV_MODE = true` — must be `false` before CLI packaging | — |
| AUD-002 | 🔴 CRITICAL | Pending | `components/Shell.jsx` + `utils/permissions.js` | `resolvePermissions` receives `settingsResult.portal_config` but real gateway returns `portal_users`/`portal_roles` at top level — 100% Access Denied in production | — |
| AUD-003 | 🟠 HIGH | 🔧 Gateway Pending | `features/RunPayroll/index.jsx` | Calls `portalListRuns` — no Gateway Function exists | See Gateway Needed: GW-001 |
| AUD-004 | 🟠 HIGH | 🔧 Gateway Pending | `features/RunPayroll/index.jsx` | Calls `portalGetPayrollRecords` — no Gateway Function exists | See Gateway Needed: GW-002 |
| AUD-005 | 🟠 HIGH | ✅ Done | `features/Settings/index.jsx` — `PortalUsersSection` | Was calling non-existent `portalAddPortalUser` / `portalRemovePortalUser` | Log: LOG-001 |
| AUD-006 | 🟠 HIGH | ✅ Done | `features/Settings/index.jsx` — `PayrollRunSection` | Was sending `section: 'payroll_run'` + wrong param names | Log: LOG-002 |
| AUD-007 | 🟠 HIGH | 🔧 Gateway Pending | `features/Settings/index.jsx` — `AttendanceSection` | UI sends `section: 'attendance'` — not handled in `portalSaveSettings`; gateway falls to unknown section guard | See Gateway Needed: GW-003 |
| AUD-008 | 🟠 HIGH | 🔧 Gateway Pending | `features/Settings/index.jsx` — `SocialInsuranceSection` | UI sends `section: 'social_insurance'` — not handled in `portalSaveSettings` | See Gateway Needed: GW-004 |
| AUD-009 | 🟡 MEDIUM | Pending | `hooks/mockData.js` vs real `portalGetSettings` | Mock returns nested schema; real gateway returns flat `payroll_settings` — entire settings schema mismatched | — |
| AUD-010 | 🟡 MEDIUM | ✅ Done | `features/Settings/index.jsx` — `PayrollRunSection` | UI was sending `department`; gateway expects `selected_department` | Log: LOG-002 |
| AUD-011 | 🟡 MEDIUM | 🔧 Gateway Pending | `features/Settings/index.jsx` — `PayrollRunSection` + `portalSaveSettings` | UI sends `selected_employees` but gateway never writes it to variable — silently dropped | See Gateway Needed: GW-005 |
| AUD-012 | 🟡 MEDIUM | Pending | `features/RunPayroll/index.jsx` — `StepReview` | Reads `auth.payrollSettings?.payroll_run?.scope` — real gateway returns flat `payroll_settings.scope` | — |
| AUD-013 | 🟢 LOW | Pending | `features/QueueMonitor/index.jsx` — `loadData` | Handles `result.code === 'no_run'` but `portalGetQueueStatus` never returns this code — empty state never renders | — |

---

## Gateway & Variable Changes Needed

> These items require work by the Deluge/backend consultant.
> Do not implement without reading `Variables.md` and `PENDING_CONFIG.md` first.

| ID | Type | Target | Required Change |
|---|---|---|---|
| GW-001 | New Gateway Function | `Gateway Functions/portalListRuns.js` | Create function. Reads `Monthly_Payroll_Setup` (all records, sorted newest first) + `Monthly_Payroll_Record` (financials for Completed periods). Returns: `{ status, runs: [ { period, status, employees, working_days, batches, done, error, pending, holidays, gross, net, tax, si } ] }`. Reads: `Monthly_Payroll_Setup`, `Monthly_Payroll_Record`. Writes: nothing. |
| GW-002 | New Gateway Function | `Gateway Functions/portalGetPayrollRecords.js` | Create function. Input: `payroll_period`. Reads `Payroll_Queue` (status, error, batch_number, processed_at) + `Monthly_Payroll_Record` (financials for Done records). Must map `pr_monthly_tax` → expose as `pr_monthly_tax_withheld` in response. Must compute `pr_total_deductions = employee_si + martyrs_fund + absence + unpaid_leave + late`. Returns: `{ status, records: [...] }`. |
| GW-003 | New section in `portalSaveSettings` | `Gateway Functions/portalSaveSettings.js` + `ATTENDANCE_RULES_JSON` | Add `section == "attendance"` block. Must read/write **`ATTENDANCE_RULES_JSON`** (not `PAYROLL_SETTINGS_JSON`). Must extend schema with new fields not currently in Variables.md: `absence.multiplier`, `unpaid_leave.multiplier`, `late_deduction.grace_minutes`, `late_deduction.multiplier`, `working_days_default`. Update `Variables.md` ATTENDANCE_RULES_JSON section once done. See PENDING_CONFIG.md PC-01 to PC-05. |
| GW-004 | New section in `portalSaveSettings` | `Gateway Functions/portalSaveSettings.js` + `SI_CONFIG_JSON` | Add `section == "social_insurance"` block. Must read **`SI_CONFIG_JSON`**, patch only `monthly_ceiling` (preserve `employee_rate`, `employer_rate`, `martyrs_fund_rate`), write back. Add `ceiling_updated` timestamp field to `SI_CONFIG_JSON`. Update `Variables.md` SI_CONFIG_JSON section once done. |
| GW-005 | Extend existing section | `Gateway Functions/portalSaveSettings.js` + `PAYROLL_SETTINGS_JSON` | In `section == "payroll_settings"` block: add write of `selected_employees` list to `active_settings.payroll_run`. Currently silently dropped. Aligns with AUD-011. |

---
*Last updated: 2026-05-12*
