# Orca Payroll Lit 2.0

## What This Is

Orca Payroll Lit is a **custom Egyptian payroll compliance extension** built on top of Zoho People. It exists because Zoho does not offer a native payroll module for Egypt. The system implements Egyptian Income Tax Law 7/2024 and Social Insurance Law 148/2019, and runs entirely within the Zoho People platform using Deluge scripting, custom forms, org variables, and a React web tab served as a Zoho extension.

The "Lit" (Lite) designation means this is the stripped-down variant: no KPI tracking, no annual reconciliation, no loans module. It targets clients with simpler payroll needs while retaining the full calculation engine, attendance adjustments, and termination processing.

---

## Repository Structure

```
ORCA-Payroll---Lite-2.0/
│
├── Deluge Functions/                    ← Server-side Zoho Deluge scripts
│   ├── runPayrollOrchestrator.js        ← Entry point for a regular payroll run
│   ├── processPayrollBatch.js           ← Processes one batch of 10 employees
│   ├── calculateEmployeePayroll.js      ← Merged SI + Tax + Attendance calculation
│   ├── onEmployeeTermination.js         ← Fires on employee status change
│   ├── processTerminationRun.js         ← Calculates and records termination pay
│   │
│   └── Gateway Functions/              ← Web tab API layer (one per feature)
│       ├── portalGetSettings.js         ← Read PAYROLL_SETTINGS_JSON + portal config
│       ├── portalSaveSettings.js        ← Write settings / portal config / user map
│       ├── portalCreateMPS.js           ← Create Monthly_Payroll_Setup record
│       ├── portalUpdateMPS.js           ← Override working days on existing MPS
│       ├── portalTriggerOrchestrator.js ← Pre-flight check + fire Orchestrator
│       ├── portalGetQueueStatus.js      ← Read queue status for current period
│       └── portalGetPeriodReport.js     ← Aggregate period summary financials
│
├── docs/
│   ├── Variables.md                     ← All 7 org variables with full JSON structures
│   ├── Forms.md                         ← All 4 forms with every field documented
│   └── Workflows.md                     ← 3 workflow rules with deployment specs
│
├── webtab/                              ← React SPA (Zoho Extension CLI 1.0.28)
│   ├── plugin.json                      ← Zoho extension manifest
│   ├── package.json                     ← React 18 + Vite 4 + Tailwind 3
│   ├── index.html                       ← Loads Zoho People JS SDK
│   └── src/
│       ├── App.jsx                      ← Root: Auth + Toast providers
│       ├── context/AuthContext.jsx      ← Global auth state + toast system
│       ├── hooks/
│       │   ├── useGateway.js            ← All 7 gateway calls + full mock data
│       │   └── useSDK.js                ← Zoho SDK init + identity resolution
│       ├── utils/permissions.js         ← resolvePermissions(config, employeeId)
│       ├── components/
│       │   ├── Shell.jsx                ← Init flow + layout wrapper
│       │   ├── Nav.jsx                  ← Sidebar (desktop) + BottomNav (mobile)
│       │   └── LoadingScreen.jsx        ← LoadingScreen + AccessDenied + ErrorScreen
│       └── features/
│           ├── QueueMonitor/            ← Feature D1: 30s polling, Tab A + Tab B
│           ├── Reports/                 ← Feature D2: Period summary, 11 metrics
│           ├── RunPayroll/              ← Feature D3: 3-step stepper
│           └── Settings/               ← Feature D4: Toggles + user management
│
└── README.md                            ← This file
```

---

## System Architecture

The system has two completely independent execution paths and one shared data layer.

### Layer Model

```
┌──────────────────────────────────────────────────────────────────┐
│ LAYER 1 — Web Tab (React SPA)                                    │
│ Permission-driven shell. Zoho injects user_id at load.           │
│ Renders only permitted feature modules. Mobile + desktop.        │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 2 — Gateway Functions (Deluge API Layer)                   │
│ Browser never calls Zoho APIs directly. 7 Deluge functions,      │
│ one per feature. All credentials stay server-side.               │
│ Called via: ZOHO.PEOPLE.invoke(fnName, { params })               │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 3 — Config and Data Stores                                 │
│ 7 org variables (Orca_Payroll_Variables group)                   │
│ 3 custom forms: Monthly_Payroll_Setup, Payroll_Queue,            │
│                 Monthly_Payroll_Record                            │
│ 8 custom fields on P_Employee                                    │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 4 — Batch Engine                                           │
│ runPayrollOrchestrator: bulk-fetches all data once,              │
│ stores 7 snapshot fields per queue record.                       │
│ processPayrollBatch: reads snapshots locally, calls              │
│ calculateEmployeePayroll (1 invokeUrl per employee).             │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 5 — calculateEmployeePayroll (Merged Calculation)          │
│ SI + Tax + Attendance all inline. 1 invokeUrl per employee.      │
│ All config maps passed as parameters — no internal fetches.      │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 6 — Regular Payroll Output                                 │
│ Monthly_Payroll_Record (pr_is_final_settlement = false)          │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 7 — Termination Path (Event-driven, independent)           │
│ P_Employee status change → onEmployeeTermination →               │
│ Payroll_Queue record → Workflow B → processTerminationRun        │
│ Uses .workDaysBetween() native Deluge. 3 standalone calc fns.    │
├──────────────────────────────────────────────────────────────────┤
│ LAYER 8 — Termination Output                                     │
│ Monthly_Payroll_Record (pr_is_final_settlement = true)           │
└──────────────────────────────────────────────────────────────────┘
```

---

## Execution Paths

### Path A — Regular Monthly Payroll Run

```
HR opens web tab (feature_run_payroll)
  → selects period → clicks "Create Setup"
  → portalCreateMPS() fires
      if PORTAL_CONFIG.default_holiday_source = "zoho":
          fetches Zoho holiday API → .workDaysBetween() server-side
      if "manual":
          trusts HR-entered values from webtab JS
      → writes Monthly_Payroll_Setup (mps_status = Ready)
  → HR reviews MPS (working days, holiday list)
  → [optional] working days override → portalUpdateMPS()
  → HR clicks "Run Payroll"
  → portalTriggerOrchestrator()
      pre-flight: MPS status = Ready, lock = false
      → calls runPayrollOrchestrator(payroll_period)

runPayrollOrchestrator (11 steps):
  STEP 0  — Global lock check (PAYROLL_SETTINGS_JSON.lock)
  STEP 1  — Validate MPS exists + status = Ready
  STEP 2  — Set MPS status → Processing
  STEP 3  — Derive period_start / period_end
  STEP 4  — Parse public holidays from MPS → Date List
  STEP 5  — Read run scope (all / by_department / by_employee)
  STEP 6  — Paginate P_Employee (leftPad list, 200/call, 20 pages max)
              Build emp_map: EmployeeID → profile snapshot
  STEP 7  — Paginate YTD payroll records (leftPad list, 200/call, 50 pages max)
              Aggregate ytd_gross + ytd_tax_withheld per employee → ytd_map
  STEP 8  — Paginate bulk attendance API (leftPad list, 100/call, 40 pages max)
              Nested loop (employee → days) runs HERE ONCE
              Aggregate 4 fields per employee → att_map
  STEP 9  — Write Payroll_Queue records (batches of 10)
              Each record carries 6 snapshot fields (pq_employee_snapshot,
              pq_ytd_snapshot, pq_absent_days, pq_late_minutes,
              pq_overtime_hours, pq_ph_days_worked)
              First record of each batch: pq_queue_at set → fires Workflow A
              Batches staggered by 3 minutes
  STEP 10 — Update MPS progress total
  STEP 11 — Release global lock

Workflow A fires at pq_queue_at (one per batch of 10):
  → calls processPayrollBatch(batch_number, payroll_period)

processPayrollBatch (per employee in batch):
  STEP 1  — Read 6 config sources ONCE per batch
  STEP 2  — Read MPS for working_days + payslip_issue_date
  STEP 3  — Fetch batch queue records (Pending, this batch_number)
  STEP 4  — Per-employee loop:
    4a    — Parse 6 snapshot fields from queue record (zero extra reads)
    4a-2  — Fetch unpaid leave live (1 invokeUrl per employee)
            Moved from Orchestrator to reduce Orchestrator runtime
    4b    — calculateEmployeePayroll (1 invokeUrl — merged SI+Tax+Attendance)
    4c    — Compute final_net
    4d    — Rerun check: convert existing regular record to Draft if found
    4e    — Write Monthly_Payroll_Record (pr_status = Final)
    4f    — Mark queue record Done / Error
  STEP 5  — Update MPS counters (read-then-write, concurrent-safe)
  STEP 6  — Completion check: query remaining Pending → if 0, MPS = Completed
```

### Path B — Employee Termination Run

```
HR changes employee status → Terminated or Resigned (in Zoho People)
  ↓
Workflow Rule fires → onEmployeeTermination(employee_id)
  STEP 1 — Read P_Employee → get Date_of_Leaving (exit_date)
  STEP 2 — Derive payroll period from exit_date
  STEP 3 — Cancel any existing Pending regular queue record for this period
           (sets pq_status = Cancelled)
  STEP 4 — Write termination queue record:
           pq_is_final_settlement = true
           pq_exit_date = exit_date
           pq_status = Pending
  ↓
Workflow B fires immediately (on Payroll_Queue create, is_final_settlement = true)
  → calls processTerminationRun(employee_id, exit_date, queue_id)

processTerminationRun (15 steps):
  STEP 1  — Read PAYROLL_SETTINGS_JSON (apply_insurance, entity_type, apply_tax)
  STEP 2  — Derive payroll period from exit_date
  STEP 3  — Validate MPS exists for exit period (status check skipped)
  STEP 4  — Parse public holidays from MPS → Date List
  STEP 5  — Read P_Employee directly (no snapshot — termination path)
              Resolve per-employee SI/tax overrides
  STEP 6  — Compute YTD from prior Final records (current year filter)
  STEP 7  — Convert existing regular record to Draft if found (Fix 2)
  STEP 8  — Fetch attendance (month_start → exit_date)
  STEP 9  — Fetch unpaid leave (month_start → exit_date)
  STEP 10 — Count actual working days via .workDaysBetween()
              Egyptian weekend: Friday + Saturday
              month_start.subDay(1) compensates for exclusive-start behavior
  STEP 11 — Pro-rate gross: (gross / working_days) × days_worked
  STEP 12 — calculateSocialInsurance (on pro-rated gross, standalone)
              calculatePayroll (forward annualisation on pro-rated gross, standalone)
              calculateAttendanceAdjustments (working_days = days_worked, standalone)
  STEP 13 — Compute final_net (floor at 0)
  STEP 14 — Write Monthly_Payroll_Record (pr_is_final_settlement = true)
  STEP 15 — Mark queue record Done (function owns queue closure)
```

---

## Component Reference

### Deluge Functions — Core

| Function | Trigger | Inputs | Key Output |
|---|---|---|---|
| `runPayrollOrchestrator` | portalTriggerOrchestrator | payroll_period | Payroll_Queue records (N batches) |
| `processPayrollBatch` | Workflow A (time-based) | batch_number, payroll_period | Monthly_Payroll_Record per employee |
| `calculateEmployeePayroll` | processPayrollBatch | 20 params (gross, config maps, attendance) | Combined SI + Tax + Attendance result map |
| `onEmployeeTermination` | Workflow Rule (P_Employee edit) | employee_id | Payroll_Queue termination record |
| `processTerminationRun` | Workflow B (immediate) | employee_id, exit_date, queue_id | Monthly_Payroll_Record (termination) |

### Deluge Functions — Gateway (Web Tab API Layer)

| Function | Feature | Reads | Writes |
|---|---|---|---|
| `portalGetSettings` | feature_settings | PAYROLL_SETTINGS_JSON, PAYROLL_PORTAL_CONFIG | — |
| `portalSaveSettings` | feature_settings | — | PAYROLL_SETTINGS_JSON or PAYROLL_PORTAL_CONFIG |
| `portalCreateMPS` | feature_run_payroll | PAYROLL_PORTAL_CONFIG, Zoho holiday API | Monthly_Payroll_Setup |
| `portalUpdateMPS` | feature_run_payroll | Monthly_Payroll_Setup | Monthly_Payroll_Setup |
| `portalTriggerOrchestrator` | feature_run_payroll | Monthly_Payroll_Setup | calls runPayrollOrchestrator |
| `portalGetQueueStatus` | feature_queue_monitor | Payroll_Queue, Monthly_Payroll_Setup | — |
| `portalGetPeriodReport` | feature_reports | Monthly_Payroll_Record | — |

### Standalone Calculation Functions

These are called individually by `processTerminationRun`. They are **not** called by `processPayrollBatch` — the batch path uses the merged `calculateEmployeePayroll` instead.

- `calculateSocialInsurance` — Fetches SI_CONFIG_JSON internally. Applies ceiling cap, calculates employee SI (11%), employer SI (18.75%), martyrs fund (0.05% Legal Entity only).
- `calculatePayroll` — Fetches TAX_CONFIG_JSON + brackets internally. Forward annualisation (remaining months). Bracket lookup (STD ≤ 600,000 EGP / HI > 600,000 EGP).
- `calculateAttendanceAdjustments` — Fetches ATTENDANCE_RULES_JSON internally. Per-factor enabled flags. Modes: absence, unpaid leave, late, overtime, public holiday (3 modes).

---

## Data Model

### Org Variables (Group: `Orca_Payroll_Variables`)

All 7 variables are documented in full in `docs/Variables.md`. Summary:

| Variable | Purpose | Updated By |
|---|---|---|
| `PAYROLL_SETTINGS_JSON` | Run config: SI/tax flags, scope, lock | portalSaveSettings, Orchestrator (lock), processPayrollBatch (scope clear) |
| `SI_CONFIG_JSON` | Social insurance rates + annual ceiling | Manual — update ceiling each fiscal year |
| `TAX_CONFIG_JSON` | Personal exemption annual value | Manual |
| `TAX_BRACKETS_STD_JSON` | Law 7/2024 standard brackets (≤ 600,000 EGP) | Manual — update if law changes |
| `TAX_BRACKETS_HI_JSON` | Law 7/2024 high-income tiers (> 600,000 EGP) | Manual — update if law changes |
| `ATTENDANCE_RULES_JSON` | Per-factor attendance rules + overtime multiplier | Manual (per client policy) |
| `PAYROLL_PORTAL_CONFIG` | Web tab: roles map + users map + portal config | portalSaveSettings |

### Key Variable Structures

```json
// PAYROLL_SETTINGS_JSON
{
  "active_settings": {
    "social_insurance": { "apply_insurance": true, "entity_type": "Legal Entity" },
    "income_tax": { "apply_tax": true },
    "payroll_run": {
      "scope": "all",
      "selected_department": "",
      "selected_employees": [],
      "lock": false
    }
  }
}

// PAYROLL_PORTAL_CONFIG
{
  "roles": {
    "admin":   ["feature_settings","feature_run_payroll","feature_queue_monitor","feature_reports"],
    "manager": ["feature_run_payroll","feature_queue_monitor","feature_reports"]
  },
  "users": { "EMP001": "admin", "EMP002": "manager" },
  "config": {
    "default_holiday_source": "zoho",
    "allow_working_days_override": false
  }
}

// SI_CONFIG_JSON
{
  "employee_rate": 0.11,
  "employer_rate": 0.1875,
  "martyrs_fund_rate": 0.0005,
  "monthly_ceiling": 12600.00
}
```

### Forms

Full field specifications in `docs/Forms.md`.

| Form | Fields | Written By | Purpose |
|---|---|---|---|
| `P_Employee` | +8 custom fields | HR (manual) | Employee compensation profile |
| `Monthly_Payroll_Setup` | 10 fields | portalCreateMPS | One record per pay period — controls the run |
| `Payroll_Queue` | 17 fields | Orchestrator / onEmployeeTermination | One record per employee per run — carries snapshots |
| `Monthly_Payroll_Record` | 41 fields | processPayrollBatch / processTerminationRun | Final payroll record per employee per period |

### P_Employee Custom Fields

8 fields added to the native Zoho People employee form:

| Field | Type | Notes |
|---|---|---|
| `emp_basic_salary` | Decimal | Required |
| `emp_housing_allowance` | Decimal | Nullable → 0 |
| `emp_transport_allowance` | Decimal | Nullable → 0 |
| `emp_medical_allowance` | Decimal | Nullable → 0 |
| `emp_other_allowances` | Decimal | Nullable → 0 |
| `emp_si_subscription_wage` | Decimal | Nullable → falls back to gross |
| `emp_si_override` | Boolean | Nullable. null = use org setting. true/false = per-employee |
| `emp_tax_override` | Boolean | Nullable. null = use org setting. true/false = per-employee |

### Payroll_Queue Snapshot Fields (Lit 2.0 Addition)

The Orchestrator pre-populates these on every regular queue record. `processPayrollBatch` reads them locally — eliminating per-employee reads in the batch execution window.

| Field | Type | Content |
|---|---|---|
| `pq_employee_snapshot` | Multi-line (JSON) | basic_salary, total_allowances, gross_salary, subscription_wage, hire_month, hire_year, emp_si_override, emp_tax_override |
| `pq_ytd_snapshot` | Multi-line (JSON) | ytd_gross, ytd_tax_withheld |
| `pq_absent_days` | Integer | Aggregated from bulk attendance API |
| `pq_late_minutes` | Integer | Total late minutes for the period |
| `pq_overtime_hours` | Decimal | Total OT hours for the period |
| `pq_ph_days_worked` | Integer | Public holiday days worked |

Note: `pq_unpaid_leave_days` is NOT in the snapshot. Unpaid leave is fetched live per employee inside `processPayrollBatch` (moved from Orchestrator to reduce Orchestrator runtime).

---

## Workflow Rules

Three rules documented in full in `docs/Workflows.md`.

| Rule | Form | Condition | Action | Calls |
|---|---|---|---|---|
| Employee Termination Trigger | P_Employee | Employeestatus changed to Terminated or Resigned | Immediate | onEmployeeTermination(employee_id) |
| Workflow A — Regular Batch | Payroll_Queue | pq_queue_at not empty AND pq_is_final_settlement = false | Time-based at pq_queue_at | processPayrollBatch(batch_number, payroll_period) |
| Workflow B — Termination | Payroll_Queue | pq_is_final_settlement = true | Immediate | processTerminationRun(employee_id, exit_date, queue_id) |

---

## Web Tab

A React SPA delivered as a Zoho People extension (CLI 1.0.28). Served as a web tab inside Zoho People. Employees have no tab access — controlled at Zoho People tab visibility level.

### Permission Model

```
On load: Zoho SDK → user identity (employeeId)
  → read PAYROLL_PORTAL_CONFIG.users → resolve role
  → if no role: Access Denied screen (stop)
  → read PAYROLL_PORTAL_CONFIG.roles → resolve feature list
  → render only permitted nav items and feature modules
```

### Feature Modules

| Feature Key | Access | Capability |
|---|---|---|
| `feature_settings` | Admin only | Payroll settings, portal config, user management |
| `feature_run_payroll` | Admin + Manager | MPS creation, working days review, run trigger, live progress |
| `feature_queue_monitor` | Admin + Manager | Tab A: regular queue. Tab B: termination queue. 30s polling. |
| `feature_reports` | Admin + Manager | Period summary: 11 financial aggregates. No export (v1). |

### Key Technical Decisions — Web Tab

- **SDK Pattern:** ZOHO.PEOPLE.invoke(fnName, { params }) — Pattern X
- **Base URL:** https://people.zoho.com (hardcoded)
- **Identity:** ZOHO.embeddedApp.on("PageLoad") → data.employeeId
- **DEV_MODE flag:** Set `DEV_MODE = true` in `webtab/src/hooks/useGateway.js` for local development with full mock data. Set `false` before packaging.
- **Mobile nav:** Bottom tab bar on screens < 768px. Sidebar on desktop.
- **Data layer:** All 7 gateway functions have complete mock responses in `useGateway.js`.

### Local Development

```bash
cd webtab
npm install
npm run dev       # serves at http://localhost:5173 with mock data
```

### Production Build

```bash
# Set DEV_MODE = false in src/hooks/useGateway.js first
npm run build     # outputs to webtab/app/
zet pack          # Zoho CLI generates zip
# Upload via Zoho People → Setup → Extensions
# Assign tab visibility to Admin and Manager profiles only
```

---

## Key Design Decisions

### 1. Merged calculateEmployeePayroll — 1 invokeUrl per employee (batch path)

The batch path had 3 standalone function calls per employee (calculateSocialInsurance, calculatePayroll, calculateAttendanceAdjustments), each of which internally fetched its own config via invokeUrl. Total: 8 invokeUrl calls per employee.

`calculateEmployeePayroll` merges all three blocks inline. All 5 config maps are passed as parameters by `processPayrollBatch` which reads them once per batch. Result: 1 invokeUrl per employee.

The three standalone functions remain unchanged and are still used by `processTerminationRun` individually. Termination is always 1 employee — the N×8 problem does not exist there.

### 2. Orchestrator bulk-fetch architecture

All data that the batch processor needs is fetched once in the Orchestrator and stored in the queue record:
- P_Employee profiles: captured in the same pagination pass that builds the employee list
- YTD records: one paginated query aggregated in-memory per employee
- Attendance: one bulk API call with a nested aggregation loop (runs once in Orchestrator, never in batch)
- Unpaid leave: fetched per employee inside `processPayrollBatch` (moved from Orchestrator to reduce Orchestrator runtime — distributed across parallel batch windows)

### 3. No while() loops — leftPad list pattern

Deluge has no `while()` function. All pagination uses this pattern:

```
page_index = 0;
page_list  = leftPad(" ", N).replaceAll(" ", ",").removeLastOccurence(",").toList();
for each item in page_list {
    sindex = (page_index * pageSize) + offset;
    // fetch
    if(null or empty) { break; }
    page_index = page_index + 1;
    // process
    if(size < pageSize) { break; }
}
```

`leftPad(" ", N)` creates N spaces → `.replaceAll(" ", ",")` → N commas → `.removeLastOccurence(",")` → `.toList()` → N empty slots. The external `page_index` is the actual counter.

### 4. Always-queue termination routing

`onEmployeeTermination` always writes a queue record. It never calls `processTerminationRun` directly. Workflow B fires on the queue record create. `processTerminationRun` owns its own queue closure (pq_status = Done at Step 15).

### 5. workDaysBetween() native Deluge for termination

`processTerminationRun` uses Deluge's native `.workDaysBetween()` for partial-month day counting. Egyptian weekend passed explicitly as `{"Friday", "Saturday"}`. `month_start.subDay(1)` compensates for the function's exclusive-start behavior to include the first of the month.

### 6. Per-employee SI and tax override flags

`emp_si_override` and `emp_tax_override` on P_Employee allow per-employee exceptions to the org-level `apply_insurance` and `apply_tax` settings. Null means use the org setting; true/false overrides it. Resolution:
```
effective = (override != null) ? override : org_setting
```
Both overrides are captured in the Orchestrator's employee snapshot — `processPayrollBatch` never re-reads P_Employee.

### 7. Gateway pattern — Deluge as controlled API layer

The React web tab never calls Zoho APIs directly. All data access goes through 7 Deluge gateway functions. This keeps OAuth credentials server-side, makes each gateway function independently testable, and isolates the frontend from Zoho API changes.

### 8. Single merged portal config variable

PAYROLL_PORTAL_CONFIG contains three logical sections: roles map (role → feature list), users map (employeeId → role), and config (holiday source, override flag). Merged into one variable to simplify reads and writes.

### 9. Forward annualisation tax model

Tax is calculated using forward annualisation — the employee's current monthly taxable income is annualised based on remaining months in the year (or full 12 for employees hired before the current year). This is the approach chosen for the pilot. Known limitation: mid-year salary changes are not reconciled until December (December reconciliation is out of scope for Lit v1).

---

## Legal Compliance

- **Egyptian Income Tax Law 7/2024:** Implemented via `TAX_BRACKETS_STD_JSON` (standard brackets ≤ 600,000 EGP) and `TAX_BRACKETS_HI_JSON` (high-income tiers > 600,000 EGP). Personal exemption: EGP 20,000/year.
- **Egyptian Social Insurance Law 148/2019:** Implemented via `SI_CONFIG_JSON`. Employee rate: 11%. Employer rate: 18.75%. Martyrs Fund: 0.05% (Legal Entity only). Monthly ceiling is updated annually per the published schedule.

---

## Known Pilot Gaps

These are acknowledged limitations accepted for the initial deployment:

- No salary revision workflow — changes to emp_basic_salary take effect immediately on next run
- No payslip distribution — payroll records are viewable in the web tab but not sent to employees
- No bank disbursement layer — net salary figures are calculated but not transmitted to any payment system
- No reporting module export — CSV/PDF export is deferred (v1 web tab shows metrics in-browser only)
- No December annual reconciliation — forward annualisation accumulates silently; mid-year salary changes are not corrected until manually handled
- Per-employee SI/tax override has no UI — must be set directly on the P_Employee form field

---

## Runtime Constraints

Zoho Deluge has a 5-minute function execution timeout. The architecture is designed around this constraint:

- The Orchestrator runs once and writes queue records — it does not do per-employee calculations
- Each batch of 10 employees runs in its own execution window (one Workflow A trigger per batch)
- Batches are staggered by 3 minutes to prevent concurrent execution
- The merged `calculateEmployeePayroll` reduces invokeUrl calls from 8 to 1 per employee, leaving headroom well within the 5-minute window for a batch of 10

---

## Technology Stack

| Layer | Technology |
|---|---|
| Payroll engine | Zoho Deluge scripting language |
| Platform | Zoho People (custom extension) |
| Forms | Zoho People custom forms |
| Config | Zoho People org variables |
| Web tab | React 18 + Tailwind CSS 3 + Vite 4 |
| Extension delivery | Zoho Extension CLI 1.0.28 |
| SDK | Zoho People JS SDK (ZPWidget.js) |
| Source control | GitHub |

