# WEBTAB_SPEC.md — ORCA Payroll Lite 2.0 · Frontend Specification & Backend Contract

**Branch:** `ui/mock-frontend-sandbox`
**Maintained by:** Frontend Consultant
**Last updated:** 2026-05-07

> **This is the single source of truth for the web tab.**
> It is the handoff document for the Deluge/backend consultant building the real gateway functions.
> It is the living decision log for every UI change made on this branch.
> Read it fully before writing a single line of Deluge or JSX.

---

## Table of Contents

1. [How to Use This File](#1-how-to-use-this-file)
2. [System Context — What the Backend Consultant Must Know](#2-system-context)
3. [Frontend Architecture](#3-frontend-architecture)
4. [Permission Model](#4-permission-model)
5. [Gateway Function Contracts](#5-gateway-function-contracts)
6. [Mock-to-Real Data Shape Discrepancies](#6-mock-to-real-data-shape-discrepancies)
7. [Known Bugs & Issues](#7-known-bugs--issues)
8. [UI Decision Log](#8-ui-decision-log)
9. [Backend Implications Log](#9-backend-implications-log)
10. [Build Checklist — Backend](#10-build-checklist--backend)
11. [Open Items](#11-open-items)

---

## 1. How to Use This File

### If you are the Frontend Consultant
- Update **Section 8** (UI Decision Log) after every confirmed change, same session
- Update **Section 9** (Backend Implications Log) whenever a UI decision has a backend consequence
- Update **Section 7** (Known Bugs) when new issues are found or existing ones are resolved
- Update **Section 10** (Build Checklist) when function status changes
- Never duplicate data that already exists in README.md — cross-reference it instead

### If you are the Deluge / Backend Consultant
Read in this order:
1. `README.md` — full system architecture, Deluge execution paths, data model, org variables, forms
2. This file, Section 2 — what the web tab expects from the gateway layer
3. This file, Section 4 — the permission model the UI enforces
4. This file, Section 5 — exact request/response contracts per gateway function
5. This file, Section 6 — critical: mock shapes vs real shapes (you MUST read this)
6. This file, Section 7 — known bugs that affect your implementation
7. This file, Section 10 — your build checklist

`DELUGE_LOGIC.md` — supplementary backend notes, partially superseded by Section 5 of this file.
`docs/Variables.md`, `docs/Forms.md`, `docs/Workflows.md` — field-level reference.

---

## 2. System Context

### What the Web Tab Is
A React SPA embedded inside Zoho People as a custom extension (web tab). It is the HR admin and payroll manager interface for ORCA Payroll Lite. Employees do not have access to this tab — visibility is controlled at the Zoho People profile level.

### How the UI Calls the Backend
The browser NEVER calls Zoho APIs directly. All data flows through Deluge gateway functions via the Zoho People JS SDK:

```javascript
// Production call (in useGateway.js — production path)
const result = await window.ZOHO.PEOPLE.invoke(fnName, { params });
```

`fnName` is the exact Deluge function name. `params` is the input object. The function must return a JSON-serializable map.

### DEV_MODE Flag
In `webtab/src/hooks/useGateway.js`, `DEV_MODE = true` bypasses all real calls and routes to `mockData.js`. This must be set to `false` before packaging for production deployment. The real ZOHO.PEOPLE.invoke code is preserved in the file — never removed, only bypassed.

### User Identity
On tab load, the Zoho SDK fires the `PageLoad` event which contains the logged-in employee's identity:

```javascript
ZOHO.embeddedApp.on('PageLoad', (data) => {
  employeeId = data.employeeId || data.EmployeeID;
});
```

The `employeeId` is used to resolve the user's role from `portal_config.portal_users`.

### Response Convention
Every gateway function must return a map with at minimum:
```json
{ "status": "success" }
// or
{ "status": "error", "message": "Human-readable error description" }
```
The UI checks `result.status === 'success'` before using any other field. Any status value other than `'success'` is treated as an error.

---

## 3. Frontend Architecture

### Component Tree

```
App.jsx
└── ThemeProvider          (ThemeContext — dark/light, persisted to localStorage)
    └── AuthProvider       (AuthContext — auth state, employee identity, payroll settings)
        └── ToastProvider  (ToastContext — global toast notification system)
            └── Shell      (initialization, layout, feature routing)
                ├── Sidebar (desktop nav — hidden on mobile)
                ├── main
                │   ├── MobileHeader (mobile only)
                │   └── [ActiveFeature] (one of: RunPayroll, QueueMonitor, Reports, Settings)
                └── BottomNav (mobile tab bar — hidden on desktop)
```

### Initialization Sequence (Shell.jsx)
On mount, Shell runs this sequence:
1. `useSDK.init()` — resolves `employeeId` from Zoho SDK (or mock)
2. `gateway.invoke('portalGetSettings')` — fetches all config; stored in `AuthContext`
3. `resolvePermissions(portal_config, employeeId)` — returns `{ role, features[] }`
4. If no role found → render `AccessDenied` screen, stop
5. Set `activeFeature` to `features[0]` (first permitted feature)
6. Store full auth state: `employeeId`, `role`, `features[]`, `payrollSettings`, `portalConfig`

### AuthContext — What Gets Stored
```javascript
{
  loading:         Boolean,       // true during init
  denied:          Boolean,       // true if employeeId not in portal_users
  employeeId:      String,        // e.g. "EMP001"
  role:            String,        // "admin" | "manager"
  features:        String[],      // e.g. ["feature_settings", "feature_run_payroll", ...]
  payrollSettings: Object,        // raw payroll_settings from portalGetSettings response
  portalConfig:    Object,        // raw portal_config from portalGetSettings response
  error:           String|null    // init error message
}
```

### Gateway Hook (useGateway.js)
Single hook, single method:
```javascript
const { invoke } = useGateway();
const result = await invoke('functionName', { param1: value1 });
```
The hook handles DEV_MODE routing transparently. Features never import from mockData.js directly.

### Mock Data Layer (mockData.js)
One exported function per gateway function. Handlers are param-aware — they simulate different responses based on input (e.g. period-specific records, duplicate guards). Session state is maintained via module-level variables (`_createdPeriods`, `_triggerAttempts`, `_portalUsers`).

### Feature Registry — Planned Architecture
**Current state:** Feature registration is scattered across 4 files (FEATURE_ORDER array, ICONS object, FEATURE_LABELS map, FEATURE_COMPONENTS map). Adding a new feature requires touching all 4.

**Target state:** A single `featureRegistry.js` file. One entry per feature. All consumers read from it.

```javascript
// webtab/src/config/featureRegistry.js (PLANNED — not yet implemented)
export const FEATURE_REGISTRY = {
  feature_run_payroll: {
    label:     'Run Payroll',
    icon:      RunPayrollIcon,   // inline SVG component
    component: RunPayroll,       // lazy-imported feature component
    order:     1,
    // minRole: ['admin', 'manager']  — future: declarative role gate
  },
  feature_queue_monitor: { ... order: 2 },
  feature_reports:       { ... order: 3 },
  feature_settings:      { ... order: 4 },
};

// To add a new feature in the future:
// 1. Add one entry to FEATURE_REGISTRY
// 2. Add the feature's permissions to PAYROLL_PORTAL_CONFIG.roles in Zoho
// 3. Done — Shell, Sidebar, BottomNav, permissions all auto-update
```

---

## 4. Permission Model

### How It Works

```
portalGetSettings response
  └── portal_config.portal_users  →  { "EMP001": "admin", "EMP002": "manager" }
  └── portal_config.portal_roles  →  { "admin": [...features], "manager": [...features] }

resolvePermissions(portal_config, employeeId):
  1. Look up employeeId in portal_users → get role string
  2. If no role → { role: null, features: [] } → AccessDenied rendered
  3. Look up role in portal_roles → get features array
  4. Return { role, features }
```

### Current Role Definitions

| Role | Features Accessible |
|------|-------------------|
| `admin` | `feature_settings`, `feature_run_payroll`, `feature_queue_monitor`, `feature_reports` |
| `manager` | `feature_run_payroll`, `feature_queue_monitor`, `feature_reports` |

### Nav Rendering
Nav components filter the global `FEATURE_ORDER` array against `auth.features`. Only permitted features render as nav items. A user who gains `feature_settings` access automatically sees the Settings nav item on next load — no frontend code change required.

### Scalability Contract
**Adding a new feature:**
- Backend: Add the feature key to the relevant role arrays in `PAYROLL_PORTAL_CONFIG.roles`
- Frontend (after registry refactor): Add one entry to `featureRegistry.js`
- No other files need to change

**Adding a new role:**
- Backend: Add the role key and its feature array to `PAYROLL_PORTAL_CONFIG.roles`
- Frontend: No code change required — `resolvePermissions` is generic
- The new role takes effect for any employee assigned that role in `portal_users`

### portalGetSettings Response — Permission Fields Required
The gateway function MUST return `portal_config` in this exact shape for the permission system to work:

```json
{
  "portal_config": {
    "portal_users":  { "EMP001": "admin", "EMP002": "manager" },
    "portal_roles":  {
      "admin":   ["feature_settings", "feature_run_payroll", "feature_queue_monitor", "feature_reports"],
      "manager": ["feature_run_payroll", "feature_queue_monitor", "feature_reports"]
    },
    "allow_working_days_override": true
  }
}
```

See Section 6 for the mismatch between this shape and the raw `PAYROLL_PORTAL_CONFIG` org variable structure.

---

## 5. Gateway Function Contracts

Each entry below is the authoritative contract the UI depends on.
Format: inputs → expected response shapes → UI behaviour per outcome.

---

### `portalGetSettings`

**Called by:** Shell.jsx — once on mount, result stored in AuthContext for the session  
**Purpose:** Returns all config needed to initialize the portal: payroll settings, portal config (roles, users, feature gates)

**Input:** None

**Success response:**
```json
{
  "status": "success",
  "payroll_settings": {
    "apply_insurance":            true,
    "apply_tax":                  true,
    "entity_type":                "Legal Entity",
    "scope":                      "all",
    "allow_working_days_override": true
  },
  "portal_config": {
    "portal_users": { "EMP001": "admin", "EMP002": "manager" },
    "portal_roles": {
      "admin":   ["feature_settings","feature_run_payroll","feature_queue_monitor","feature_reports"],
      "manager": ["feature_run_payroll","feature_queue_monitor","feature_reports"]
    },
    "allow_working_days_override": true,
    "default_holiday_source":     "zoho"
  }
}
```

**Error response:**
```json
{ "status": "error", "message": "Failed to load settings" }
```

**UI behaviour:**
- Success → stores `payroll_settings` and `portal_config` in AuthContext; runs permission resolution
- Error → renders `ErrorScreen` with retry button
- `portal_config.portal_users` lookup fails for current user → renders `AccessDenied` screen

**Backend implementation notes:**
- Read `PAYROLL_SETTINGS_JSON` and `PAYROLL_PORTAL_CONFIG` org variables
- Translate org variable structure to the response shape above (see Section 6 for structural differences)
- `portal_roles` must be returned — the UI cannot function without it
- `entity_type` must be returned in `payroll_settings` — Settings screen reads it on mount

---

### `portalListRuns`

**Called by:** RunPayroll/index.jsx — once on mount, cached for the session  
**Purpose:** Returns all MPS records for the runs history list. Completed runs include financial totals used by the Step 4 wizard card.

**Input:** None

**Success response:**
```json
{
  "status": "success",
  "runs": [
    {
      "period":       "2026-04",
      "status":       "Processing",
      "employees":    10,
      "working_days": 22,
      "batches":      2,
      "done":         3,
      "error":        2,
      "pending":      5,
      "holidays":     "Sinai Liberation Day",
      "gross":        null,
      "net":          null,
      "tax":          null,
      "si":           null
    },
    {
      "period":       "2026-03",
      "status":       "Completed",
      "employees":    43,
      "working_days": 21,
      "batches":      5,
      "done":         43,
      "error":        0,
      "pending":      0,
      "holidays":     "Revolution Day",
      "gross":        1820000,
      "net":          1491000,
      "tax":          126000,
      "si":           200200
    }
  ]
}
```

**Field nullability:**
- `holidays`: String or `null` — UI renders a holidays section only if truthy
- `gross`, `net`, `tax`, `si`: Number or `null` — null for any non-Completed run; UI shows `—` for null
- `error`: Integer (0 = no errors; shown as a count in the run list subline)

**Error response:**
```json
{ "status": "error", "message": "..." }
```

**UI behaviour:**
- Renders runs list in sidebar; user taps a run to select it
- "New payroll run" row is always pinned at top
- Status dot: green (Completed), pulsing blue (Processing), gray (Draft)

**Backend implementation notes:**
- Query `Monthly_Payroll_Setup` form, all records, sorted by `mps_payroll_period` descending
- Count queue records per period from `Payroll_Queue` → `employees`, `done`, `error`, `pending`
- For Completed runs only: sum `pr_gross_salary`, `pr_net_salary`, `pr_monthly_tax_withheld`, `pr_employee_si_deduction` from `Monthly_Payroll_Record`
- `si` field = sum of `pr_employee_si_deduction` (employee portion only, not employer)

---

### `portalGetQueueStatus`

**Called by:**
- QueueMonitor/index.jsx — on mount (auto-loads current month), on period change, and polls every 30s when `mps_status === 'Processing'`
- RunPayroll/index.jsx — polls every 30s when selected run has status `Processing`

**Purpose:** Returns live queue state for a period — MPS status, progress counters, and per-employee record arrays for both run types. Handles all four possible states: no run, Draft, Processing, Completed.

**Input:**
```json
{ "payroll_period": "2026-04" }
```

**Success response — Processing or Completed:**
```json
{
  "status":           "success",
  "mps_status":       "Processing",
  "mps_working_days": 22,
  "progress": {
    "total":      10,
    "done":       3,
    "error":      2,
    "pending":    3,
    "processing": 2
  },
  "regular_run": {
    "summary": { "total": 10, "done": 3, "error": 2, "pending": 5 },
    "records": [
      { "employee_id": "EMP001", "status": "Done",       "batch_number": 1, "processed_at": "09:15", "error": "" },
      { "employee_id": "EMP004", "status": "Error",      "batch_number": 1, "processed_at": "09:16", "error": "Missing emp_basic_salary field" },
      { "employee_id": "EMP006", "status": "Processing", "batch_number": 2, "processed_at": "",      "error": "" },
      { "employee_id": "EMP009", "status": "Pending",    "batch_number": 3, "processed_at": "",      "error": "" }
    ]
  },
  "termination_run": {
    "summary": { "total": 0, "done": 0, "error": 0, "pending": 0 },
    "records": []
  }
}
```

**Success response — Draft (setup exists, run not triggered):**
```json
{
  "status":           "success",
  "mps_status":       "Draft",
  "mps_working_days": 22,
  "progress": { "total": 0, "done": 0, "error": 0, "pending": 0, "processing": 0 },
  "regular_run":     { "summary": { "total": 0, "done": 0, "error": 0, "pending": 0 }, "records": [] },
  "termination_run": { "summary": { "total": 0, "done": 0, "error": 0, "pending": 0 }, "records": [] }
}
```

**Error response — no MPS found for period:**
```json
{ "status": "error", "code": "no_run", "message": "No payroll run found for period 2026-05" }
```

**IMPORTANT:** The `code: "no_run"` field is required. The UI uses it to distinguish "no run found" (valid empty state → renders EmptyState component, no toast) from genuine errors (API failure, permissions etc → toast shown). Without `code`, the UI cannot tell the difference.

**Field notes:**
- `processed_at`: HH:MM string or empty string `""` — never null
- `error`: Error message string or empty string `""` — never null
- `batch_number`: Integer starting at 1. QueueMonitor groups records by batch_number client-side. No `total_batches` field required — derived as `Math.max(...records.map(r => r.batch_number))`
- `progress.processing`: Count of records with `pq_status = 'Processing'` — shown separately from `progress.pending` in QueueMonitor (four-tile stat row: Done / Processing / Pending / Errors)
- `termination_run.records`: Records where `pq_is_final_settlement = true`. No `exit_date` field — UI does not display it (decision: 2026-05-08)
- Financial totals: NOT required in this response. QueueMonitor does not display financial data — users navigate to Reports for that (decision: 2026-05-08)

**UI behaviour — QueueMonitor:**
- `mps_status: 'none'` (via `code: 'no_run'` error) → EmptyState "No payroll run for [period]" + navigate to Run Payroll button
- `mps_status: 'Draft'` → EmptyState "Setup exists, not triggered" + "Start run →" button navigating to Run Payroll
- `mps_status: 'Processing'` → Live view: progress bar, 4-stat tiles, batch-grouped collapsible records, polls every 30s (pauses when browser tab hidden)
- `mps_status: 'Completed'` → Final summary: green completed header with total/error/batch/working-days counts, batch-grouped records, polling stops

**UI behaviour — RunPayroll:**
- Updates `selectedRun` progress counts
- When `mps_status` transitions to `'Completed'` → triggers `portalGetPayrollRecords` with `forceRefresh: true`
- Polling stops automatically once `mps_status !== 'Processing'`

**Backend implementation notes:**
- Read `Monthly_Payroll_Setup` where `mps_payroll_period` = input period
- If no record found → return `{ status: 'error', code: 'no_run', message: '...' }`
- If found with `mps_status = 'Draft'` → return Draft response shape (zero counts, empty arrays)
- Otherwise read all `Payroll_Queue` records where `pq_payroll_period` = input period
- Separate by `pq_is_final_settlement`: false → regular_run, true → termination_run
- `processing` count = records with `pq_status = 'Processing'`
- `pending` = records with `pq_status = 'Pending'` only

---

### `portalGetPayrollRecords`

**Called by:** RunPayroll/index.jsx — on run selection; cached per period (no re-fetch unless `forceRefresh: true`)  
**Purpose:** Returns per-employee computed payroll results for the expandable record rows.

**Input:**
```json
{ "payroll_period": "2026-04" }
```

**Success response:**
```json
{
  "status": "success",
  "period": "2026-04",
  "records": [
    {
      "employee_id":                "EMP001",
      "status":                     "Done",
      "pr_basic_salary":            30000,
      "pr_total_allowances":        11000,
      "pr_gross_salary":            41000,
      "pr_employee_si_deduction":   3300,
      "pr_martyrs_fund":            20.5,
      "pr_absence_deduction":       0,
      "pr_unpaid_leave_deduction":  0,
      "pr_late_deduction":          0,
      "pr_total_deductions":        6120,
      "pr_net_salary":              34200,
      "pr_monthly_tax_withheld":    2800,
      "pr_ytd_tax_withheld":        8400,
      "error":                      ""
    },
    {
      "employee_id":                "EMP004",
      "status":                     "Error",
      "pr_basic_salary":            null,
      "pr_total_allowances":        null,
      "pr_gross_salary":            null,
      "pr_employee_si_deduction":   null,
      "pr_martyrs_fund":            null,
      "pr_absence_deduction":       null,
      "pr_unpaid_leave_deduction":  null,
      "pr_late_deduction":          null,
      "pr_total_deductions":        null,
      "pr_net_salary":              null,
      "pr_monthly_tax_withheld":    null,
      "pr_ytd_tax_withheld":        null,
      "error":                      "Missing emp_basic_salary field"
    }
  ]
}
```

**Field nullability:**
- ALL `pr_*` fields: `Number | null` — null for Error/Processing/Pending records
- `error`: String — empty `""` for non-Error records; populated error message for Error records
- The UI checks `rec.pr_gross_salary != null` to decide whether to render the expandable financial section

**UI behaviour:**
- Expandable row per employee — tap row to expand financial breakdown
- Rows with null financials (Error/Pending/Processing) are not expandable
- Filter tabs: All / Done / Processing / Pending / Errors

**Backend implementation notes:**
- Read `Monthly_Payroll_Record` where `pr_payroll_period` = input period
- Also read `Payroll_Queue` for the same period to get `status` and `error` per employee
- If a queue record exists but no payroll record (not yet processed) → return record with all `pr_*` = null
- `status` field in response corresponds to queue record `pq_status` (Done/Error/Processing/Pending)

---

### `portalGetPeriodReport`

**Called by:** Reports/index.jsx — on "Generate" button click  
**Purpose:** Returns org-level aggregated financial summary for a completed period.

**Input:**
```json
{ "payroll_period": "2026-03" }
```

**Success response:**
```json
{
  "status":       "success",
  "period":       "2026-03",
  "generated_at": "10:45",
  "summary": {
    "headcount":          43,
    "termination_count":  0,
    "total_gross":        1820000,
    "total_basic_salary": 1290000,
    "total_allowances":   530000,
    "total_net_salary":   1491000,
    "total_employee_si":  145600,
    "total_employer_si":  232400,
    "total_martyrs_fund": 910,
    "total_tax_withheld": 126000,
    "total_employer_cost":2052400
  }
}
```

**Error response (period not completed):**
```json
{ "status": "error", "message": "No completed report available for period 2026-04" }
```

**UI behaviour:**
- Error → toast notification shown; report area remains empty
- Success → renders 11 metric cards in grouped sections (Salary / Social Insurance / Tax & Cost)
- `generated_at` shown as "Generated at HH:MM — period YYYY-MM"

**Backend implementation notes:**
- Validate `Monthly_Payroll_Setup.mps_status = 'Completed'` for the period; return error if not
- Sum all `pr_*` fields from `Monthly_Payroll_Record` where `pr_payroll_period` = input period
- `termination_count` = count of `Payroll_Queue` records where `pq_is_final_settlement = true` AND `pq_status = 'Done'` for the period
- `total_employer_cost` = `total_gross` + `total_employer_si` + `total_martyrs_fund`
- `generated_at` = current time formatted as HH:MM (local to the Deluge execution context)

---

### `portalCreateMPS`

**Called by:** RunPayroll — Step 1 Setup, on "Create setup" button  
**Purpose:** Creates a new Monthly Payroll Setup record for the given period.

**Input:**
```json
{ "payroll_period": "2026-05" }
```

**Success response:**
```json
{
  "status":       "success",
  "period":       "2026-05",
  "working_days": 22,
  "holidays":     "Sinai Liberation Day",
  "message":      "MPS created for 2026-05"
}
```

**Error response (duplicate):**
```json
{
  "status":  "error",
  "message": "A payroll run for 2026-05 already exists. Delete it before creating a new one."
}
```

**Field notes:**
- `working_days`: Integer — used to pre-populate the working days display in Step 2
- `holidays`: String (newline-separated) or `null` — passed into the Step 2 run object

**UI behaviour:**
- Success → advances wizard to Step 2 (Review); new run appended to runs list as `Draft`
- Error → toast shown; wizard stays on Step 1

**Backend implementation notes:**
- Guard: check for existing `Monthly_Payroll_Setup` where `mps_payroll_period` = input period
- If `default_holiday_source = 'zoho'`: fetch Zoho People holiday API for the period dates
- Calculate working days: calendar days in period minus Fridays, Saturdays, and public holidays
- Create `Monthly_Payroll_Setup` record with `mps_status = 'Draft'`
- `holidays` in response = newline-separated string of holiday names that fall in the period

---

### `portalUpdateMPS`

**Called by:** RunPayroll — Step 2 Review, on "Save" after working days override  
**Purpose:** Updates the working days on an existing MPS record.

**Input:**
```json
{ "payroll_period": "2026-04", "new_working_days": 20 }
```

**Success response:**
```json
{
  "status":       "success",
  "period":       "2026-04",
  "working_days": 20,
  "message":      "Working days updated to 20 for 2026-04"
}
```

**Error response:**
```json
{ "status": "error", "message": "..." }
```

**UI behaviour:**
- Success → toast; override input closed; displayed working days updated
- Error → toast; override input stays open

**Backend implementation notes:**
- Fetch `Monthly_Payroll_Setup` where `mps_payroll_period` = input period
- Update `mps_working_days` = `new_working_days`
- Validate: `new_working_days` must be integer 1–31

---

### `portalTriggerOrchestrator`

**Called by:** RunPayroll — Step 2 Review, on "Run payroll" button  
**Purpose:** Runs pre-flight checks and fires `runPayrollOrchestrator`.

**Input:**
```json
{ "payroll_period": "2026-04" }
```

**Success response:**
```json
{
  "status":  "success",
  "period":  "2026-04",
  "queued":  10,
  "batches": 2,
  "message": "Payroll run started — 10 employees queued in 2 batches"
}
```

**Error response (lock conflict):**
```json
{
  "status":  "error",
  "message": "Orchestrator is locked by another process. Wait 30 seconds and try again."
}
```

**Field notes:**
- `queued`: Integer — total employees enqueued; used to set RunPayroll's `run.employees` count
- `batches`: Integer — batch count; displayed in Step 3 running card

**UI behaviour:**
- Success → advances wizard to Step 3 (Running); begins 30s polling
- Error → toast shown; wizard stays on Step 2; "Run payroll" button re-enabled

**Backend implementation notes:**
- Check `PAYROLL_SETTINGS_JSON.active_settings.payroll_run.lock` — return error if `true`
- Validate MPS exists and status is `'Draft'` or `'Ready'`
- Call `runPayrollOrchestrator(payroll_period)` — the Orchestrator handles queue writing and MPS status update
- `queued` and `batches` in response come from the Orchestrator's return values

---

### `portalSaveSettings`

**Called by:** Settings — Payroll Settings section and Portal Configuration section  
**Purpose:** Persists updated settings to org variables.

**Input (payroll settings section):**
```json
{
  "section":                    "payroll_settings",
  "apply_insurance":            true,
  "apply_tax":                  true,
  "entity_type":                "Legal Entity",
  "scope":                      "all",
  "selected_department":        ""
}
```

**Input (portal config section):**
```json
{
  "section":                     "portal_config",
  "default_holiday_source":      "zoho",
  "allow_working_days_override": true
}
```

**Success response:**
```json
{ "status": "success", "message": "Settings saved successfully." }
```

**Error response:**
```json
{ "status": "error", "message": "..." }
```

**UI behaviour:**
- Success → toast "Payroll settings saved" or "Portal config saved"; AuthContext updated locally
- Error → toast with error message

**Backend implementation notes:**
- Branch on `section` field to determine which org variable to update
- `payroll_settings` → update `PAYROLL_SETTINGS_JSON.active_settings`
- `portal_config` → update `PAYROLL_PORTAL_CONFIG.config`
- Do NOT accept `portal_users` section via this function (see bug #1 in Section 7)

---

### `portalAddPortalUser`

**Called by:** Settings — Portal Users section, "Add User" button  
**Purpose:** Adds an employee to the portal users map.

**Input:**
```json
{ "employee_id": "EMP003", "role": "manager" }
```

**Success response:**
```json
{
  "status":       "success",
  "employee_id":  "EMP003",
  "role":         "manager",
  "message":      "EMP003 added as manager",
  "portal_users": { "EMP001": "admin", "EMP002": "manager", "EMP003": "manager" }
}
```

**Error response (duplicate):**
```json
{
  "status":  "error",
  "message": "EMP003 already has portal access as manager."
}
```

**Field notes:**
- `portal_users`: The full updated users map — UI replaces its local state with this

**UI behaviour:**
- Success → updates local `portalUsers` state; input cleared; toast shown
- Error → toast with error message; no state change

**Backend implementation notes (IMPORTANT):**
- Settings component currently calls `portalSaveSettings` for this action — this is Bug #1, tracked in Section 7
- The correct call is `portalAddPortalUser` — will be fixed on the frontend
- Read `PAYROLL_PORTAL_CONFIG.users`, check for duplicate, add new entry, write back
- Return the full `portal_users` map after update

---

### `portalRemovePortalUser`

**Called by:** Settings — Portal Users section, "Remove" button per user row  
**Purpose:** Removes an employee from the portal users map.

**Input:**
```json
{ "employee_id": "EMP002" }
```

**Success response:**
```json
{
  "status":       "success",
  "employee_id":  "EMP002",
  "message":      "EMP002 removed from portal access",
  "portal_users": { "EMP001": "admin" }
}
```

**Error response (last admin protection):**
```json
{
  "status":  "error",
  "message": "Cannot remove the last admin user."
}
```

**Field notes:**
- `portal_users`: Full updated map — UI replaces its local state with this

**UI behaviour:**
- Current user's own ID is guarded on the frontend — "Remove" calls are blocked for `auth.employeeId`
- Backend SHOULD also guard against removing the last admin (belt-and-suspenders)
- Success → removes row from displayed list; toast shown

**Backend implementation notes:**
- Also guarded on frontend: `userId === auth.employeeId` check prevents self-removal
- Backend guard: if removing would leave zero admins → return error
- This function is currently not called correctly — see Bug #1 in Section 7

---

## 6. Mock-to-Real Data Shape Discrepancies

**CRITICAL — Read before implementing any gateway function.**

The mock data in `mockData.js` was written to match what the UI needs. The real `PAYROLL_PORTAL_CONFIG` org variable has a different internal structure. The gateway functions are the translation layer. They must transform org variable data into the shapes the UI expects.

### Discrepancy 1 — `portalGetSettings` portal_config keys

**What the mock returns (what the UI expects):**
```json
{
  "portal_config": {
    "portal_users":              { "EMP001": "admin" },
    "portal_roles":              { "admin": [...], "manager": [...] },
    "allow_working_days_override": true,
    "default_holiday_source":    "zoho"
  }
}
```

**What `PAYROLL_PORTAL_CONFIG` org variable actually stores (from README.md):**
```json
{
  "roles":  { "admin": [...], "manager": [...] },
  "users":  { "EMP001": "admin" },
  "config": {
    "default_holiday_source":    "zoho",
    "allow_working_days_override": false
  }
}
```

**What the gateway function must do:**
Transform org variable structure on read:
```
PAYROLL_PORTAL_CONFIG.users  →  portal_config.portal_users
PAYROLL_PORTAL_CONFIG.roles  →  portal_config.portal_roles
PAYROLL_PORTAL_CONFIG.config →  flattened into portal_config root level
```

And on write (`portalSaveSettings` with `section: 'portal_config'`):
Transform back from UI shape to org variable shape before saving.

### Discrepancy 2 — `payroll_settings` fields vs org variable structure

**What the UI reads from `payrollSettings` (AuthContext):**
```
payrollSettings.apply_insurance
payrollSettings.apply_tax
payrollSettings.entity_type
payrollSettings.scope
payrollSettings.allow_working_days_override
```

**What `PAYROLL_SETTINGS_JSON` actually stores:**
```json
{
  "active_settings": {
    "social_insurance": { "apply_insurance": true, "entity_type": "Legal Entity" },
    "income_tax":       { "apply_tax": true },
    "payroll_run":      { "scope": "all", "lock": false }
  }
}
```

**What the gateway function must do:**
Flatten nested structure into a flat `payroll_settings` map for the response:
```
active_settings.social_insurance.apply_insurance  →  payroll_settings.apply_insurance
active_settings.social_insurance.entity_type      →  payroll_settings.entity_type
active_settings.income_tax.apply_tax              →  payroll_settings.apply_tax
active_settings.payroll_run.scope                 →  payroll_settings.scope
PAYROLL_PORTAL_CONFIG.config.allow_working_days_override  →  payroll_settings.allow_working_days_override
```

And reverse the transformation on `portalSaveSettings`.

### Discrepancy 3 — `entity_type` missing from current mock `payroll_settings`

The mock's `portalGetSettings` does not include `entity_type` in `payroll_settings`. The Settings screen initializes `entityType` from `ps0.entity_type || 'Legal Entity'` — so it silently defaults to `'Legal Entity'`. The real gateway must include `entity_type` in the response (mapped from `PAYROLL_SETTINGS_JSON.active_settings.social_insurance.entity_type`).

---

## 7. Known Bugs & Issues

### Bug #1 — Settings: addUser/removeUser calls wrong gateway function
**Status:** Open — fix pending frontend confirmation  
**Location:** `webtab/src/features/Settings/index.jsx`  
**Description:** The `addUser` function calls `gateway.invoke('portalSaveSettings', { section: 'portal_users', ... })` and the `removeUser` function also routes through `portalSaveSettings`. The correct calls are `portalAddPortalUser` and `portalRemovePortalUser` respectively, which have dedicated mock handlers with proper duplicate-guard and state-management logic.  
**Impact:** In mock mode, add/remove appear to succeed (portalSaveSettings always returns success) but `_portalUsers` session state is never updated. After a fake "add", a re-fetch of settings would show the user was never actually added.  
**Fix:** Replace `portalSaveSettings` calls in `addUser` with `gateway.invoke('portalAddPortalUser', { employee_id, role })` and in `removeUser` with `gateway.invoke('portalRemovePortalUser', { employee_id })`. Update local `portalUsers` state from `result.portal_users` instead of managing it manually.  
**Backend implication:** None — `portalAddPortalUser` and `portalRemovePortalUser` gateway functions are already specified correctly. No backend change needed.

---

## 8. UI Decision Log

All confirmed frontend changes are logged here. Entries are added after each confirmed change — never before.
Format: `[YYYY-MM-DD | N] type: title`

---

### [2026-05-07 | 01] refactor: feature registry — single source of truth for all feature definitions

**Decision:** Replace scattered feature registration (FEATURE_ORDER array in Nav.jsx, ICONS object in Nav.jsx, FEATURE_LABELS map in permissions.js, FEATURE_COMPONENTS map in Shell.jsx) with a single `featureRegistry.jsx` file.

**Rationale:** Adding a new feature previously required touching 4 separate files — a maintenance liability that grows with every new feature. The registry pattern reduces that to one entry in one file. Confirmed approach after discussion on `minRoles` enforcement: the field is informational only. The server-returned `features[]` array is the sole runtime access gate — client-side role enforcement would require a frontend deploy for every new role added in Zoho, which is the wrong trade.

**Files changed:**
- `webtab/src/config/featureRegistry.jsx` — **new file**. Icons, components, labels, order, minRoles all co-located per feature. Exports `FEATURE_REGISTRY` object and derived `FEATURE_ORDER` array.
- `webtab/src/components/Shell.jsx` — removed 4 feature imports + `FEATURE_COMPONENTS` map. Added `FEATURE_REGISTRY` import. `ActiveComponent` now resolved via `FEATURE_REGISTRY[activeFeature]?.component`.
- `webtab/src/components/Nav.jsx` — removed `FEATURE_ORDER` array, `ICONS` object, `FEATURE_LABELS` import. Both `Sidebar` and `BottomNav` now read `label` and `Icon` directly from `FEATURE_REGISTRY`.
- `webtab/src/utils/permissions.js` — removed `FEATURE_LABELS` export (labels now live in registry). `resolvePermissions` function unchanged.

**Behaviour change:** None — zero visible difference to the user. Pure refactor.

**Backend implication:** None.

---

## 9. Backend Implications Log

Tracks any UI decision that creates, changes, or removes a backend requirement.
Entries are added at the same time as the corresponding UI Decision Log entry.

---

### [2026-05-08 | BI-01] QueueMonitor — three contract clarifications

**Decisions confirmed after UI design session:**

1. **`exit_date` field on termination records — NOT required.**
   `TerminationCard` previously rendered `rec.exit_date` which was never in the contract. Decision: UI drops this field entirely. Termination records shape is identical to regular records: `{ employee_id, status, batch_number, processed_at, error }`. Backend does NOT need to add exit_date to queue records.

2. **Financial totals in QueueMonitor — NOT required.**
   QueueMonitor is a counts-only monitoring screen. It does not display gross/net/tax/SI figures. Users navigate to Reports for financial data. `portalGetQueueStatus` does not need to return any financial totals for any status (including Completed).

3. **`total_batches` field — NOT required.**
   QueueMonitor derives batch count client-side: `Math.max(...records.map(r => r.batch_number || 0))`. Backend does not need to add this field.

**New contract requirement added:**
`code: 'no_run'` field on error response when no MPS exists for a period. This is required — the UI uses it to distinguish a valid empty state (no toast, render EmptyState component) from a genuine error (toast shown). See Section 5 `portalGetQueueStatus` for full detail.

---

## 10. Build Checklist — Backend

Gateway functions to implement. Updated as work progresses.

| # | Function | Status | Notes |
|---|----------|--------|-------|
| 1 | `portalGetSettings` | `[ ] Not built` | Must flatten nested org variable structure — see Section 6 |
| 2 | `portalListRuns` | `[ ] Not built` | Requires cross-form query: MPS + Queue + Payroll Record |
| 3 | `portalGetQueueStatus` | `[ ] Not built` | Two queue form reads (regular + termination) |
| 4 | `portalGetPayrollRecords` | `[ ] Not built` | Read Payroll Record + Queue for status/error fields |
| 5 | `portalGetPeriodReport` | `[ ] Not built` | Aggregate sums; validate Completed status first |
| 6 | `portalCreateMPS` | `[ ] Not built` | Two holiday source paths (zoho API / manual) |
| 7 | `portalUpdateMPS` | `[ ] Not built` | Simple field update |
| 8 | `portalTriggerOrchestrator` | `[ ] Not built` | Lock check + MPS status check + Orchestrator invoke |
| 9 | `portalSaveSettings` | `[ ] Not built` | Two sections: payroll_settings + portal_config; reverse Section 6 transform |
| 10 | `portalAddPortalUser` | `[ ] Not built` | Read-modify-write PAYROLL_PORTAL_CONFIG.users |
| 11 | `portalRemovePortalUser` | `[ ] Not built` | Read-modify-write; guard last-admin scenario |

Status values: `[ ] Not built` · `[~] In progress` · `[x] Built` · `[!] Needs review`

---

## 11. Open Items

### Frontend
| # | Item | Priority | Notes |
|---|------|----------|-------|
| F1 | Feature registry refactor (`featureRegistry.jsx`) | ~~High~~ **Done** | Completed 2026-05-07 |
| F2 | Fix Bug #1 — Settings addUser/removeUser gateway routing | High | — |
| F3 | RunPayroll mobile layout — `grid-cols-[260px_1fr]` needs responsive breakpoint | High | — |
| F4 | Typography — add custom font (Plus Jakarta Sans) | Medium | Layer 2 visual foundation work |
| F5 | Color system — CSS custom properties for design tokens | Medium | Layer 2 visual foundation work |
| F6 | Sidebar branding — logo mark + visual weight | Medium | Layer 3 shell work |
| F7 | Dark mode toggle — promote from Settings to sidebar footer | Medium | Layer 3 shell work |
| F8 | Stepper — increase touch targets, readable type | Medium | Layer 4 RunPayroll work |
| F9 | Records panel filter tab active state — change to brand blue | Low | — |
| F10 | LoadingScreen — brand identity on initial load | Low | Layer 5 polish |

### Backend
| # | Item | Priority | Notes |
|---|------|----------|-------|
| B1 | All 11 gateway functions | High | Section 10 checklist |
| B2 | `portalGetSettings` structure translation | High | Section 6 details |
| B3 | `portalRemovePortalUser` — last-admin guard | Medium | Prevent locking out all admins |
| B4 | `portalCreateMPS` — zoho holiday API integration | Medium | Only needed if `default_holiday_source = 'zoho'` |
