# UI Audit Tasks
**Project:** ORCA Payroll Lite 2.0 — `ui/mock-frontend-sandbox`
**Auditor:** Frontend Auditor — Claude
**Audit Started:** 2026-05-12

---

## Status Legend
- 🔴 **CRITICAL** — Blocks production entirely
- 🟠 **HIGH** — Wrong gateway call; will error in production
- 🟡 **MEDIUM** — Data structure mismatch; silently wrong in production
- 🟢 **LOW** — Non-blocking; behavioural gap

---

## Tasks

| ID | Severity | Status | Location | Issue | Fix Reference |
|---|---|---|---|---|---|
| AUD-001 | 🔴 CRITICAL | Pending | `hooks/useGateway.js:4` | `DEV_MODE = true` — all gateway calls intercepted by mock in production | — |
| AUD-002 | 🔴 CRITICAL | Pending | `components/Shell.jsx` + `utils/permissions.js` | `resolvePermissions` receives `settingsResult.portal_config` but real gateway returns `portal_users`/`portal_roles` at response top-level — 100% Access Denied in production | — |
| AUD-003 | 🟠 HIGH | Pending | `features/RunPayroll/index.jsx` | Calls `portalListRuns` — no Gateway Function exists for this name | — |
| AUD-004 | 🟠 HIGH | Pending | `features/RunPayroll/index.jsx` | Calls `portalGetPayrollRecords` — no Gateway Function exists | — |
| AUD-005 | 🟠 HIGH | Pending | `features/Settings/index.jsx` — `PortalUsersSection` | Calls `portalAddPortalUser` / `portalRemovePortalUser` — neither Gateway Function exists; real gateway uses `portalSaveSettings` with `section: 'portal_users'` | — |
| AUD-006 | 🟠 HIGH | Pending | `features/Settings/index.jsx` — `PayrollRunSection.handleSave` | Sends `section: 'payroll_run'` — not a valid section; `portalSaveSettings` only accepts `payroll_settings`, `portal_config`, `portal_users` | — |
| AUD-007 | 🟠 HIGH | Pending | `features/Settings/index.jsx` — `AttendanceSection.handleSave` | Sends `section: 'attendance'` — not a valid section in `portalSaveSettings`; falls to unknown section guard, returns error | — |
| AUD-008 | 🟠 HIGH | Pending | `features/Settings/index.jsx` — `SocialInsuranceSection.handleSave` | Sends `section: 'social_insurance'` — not a valid section in `portalSaveSettings` | — |
| AUD-009 | 🟡 MEDIUM | Pending | `hooks/mockData.js` + real `portalGetSettings` | Mock returns nested `payroll_settings.payroll_run / .attendance / .social_insurance`; real gateway returns flat `payroll_settings` with `apply_insurance`, `entity_type`, `apply_tax`, `scope`, `selected_department`, `lock` — entire settings schema is mismatched | — |
| AUD-010 | 🟡 MEDIUM | Pending | `features/Settings/index.jsx` — `PayrollRunSection` + `portalSaveSettings` | UI sends `department` param; gateway expects `selected_department` — field silently null in production | — |
| AUD-011 | 🟡 MEDIUM | Pending | `features/Settings/index.jsx` — `PayrollRunSection` + `portalSaveSettings` | UI sends `selected_employees` to `portalSaveSettings`; gateway never writes it to the variable — silently dropped | — |
| AUD-012 | 🟡 MEDIUM | Pending | `features/RunPayroll/index.jsx` — `StepReview` | Reads `auth.payrollSettings?.payroll_run?.scope` — real gateway returns flat `payroll_settings.scope`, not nested; scope label always falls back to "All active employees" | — |
| AUD-013 | 🟢 LOW | Pending | `features/QueueMonitor/index.jsx` — `loadData` | Handles `result.code === 'no_run'` for empty state, but `portalGetQueueStatus` never returns this code — returns `status: 'error'` with a message when no MPS exists; empty state never renders, toast fires instead | — |

---
*Last updated: 2026-05-12*
