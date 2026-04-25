# Orca Payroll Lit 2.0

Egyptian payroll compliance extension built on **Zoho People**, implemented entirely in **Deluge scripting language** with a **React web tab** portal. This is a custom-built solution — Zoho does not offer a native Egyptian payroll module.

---

## What This Is

A production payroll system for Egyptian labor law compliance, covering:
- Egyptian Income Tax Law 7/2024 (forward annualisation, bracket-based tax)
- Social Insurance Law 148/2019 (employee 11%, employer 18.75%, martyrs fund 0.05%)
- Attendance-driven deductions and additions (absence, unpaid leave, late, overtime, public holidays)
- Termination (partial-month pro-rated payroll on employee exit)
- A permission-driven HR web portal (React SPA embedded as a Zoho People web tab)

**Orca Payroll Lit** is a stripped-down variant of the full system. Removed: KPI tracking, Annual Reconciliation, Loans. Retained: core payroll, attendance adjustments, termination run.

---

## Platform and Language

| Layer | Technology |
|---|---|
| Platform | Zoho People (HR SaaS) |
| Scripting | Deluge (Zoho's proprietary language — no while(), no npm, 5-min execution timeout) |
| Web portal | React 18 + Vite 4 + Tailwind CSS |
| Extension packaging | Zoho Extension CLI 1.0.28 |
| Data center | US — `https://people.zoho.com` |
| Authentication | Zoho OAuth 2.0 via `zoho_people_payroll_conn` connection |

---

## Repository Structure

```
ORCA-Payroll---Lite-2.0/
│
├── README.md                          ← This file
│
├── Deluge Functions/
│   ├── onEmployeeTermination.js       ← Workflow Rule: fires on P_Employee status change
│   ├── runPayrollOrchestrator.js      ← Batch engine entry point: bulk fetch, queue build
│   ├── processPayrollBatch.js         ← Per-batch processor: reads snapshots, runs calc
│   ├── calculateEmployeePayroll.js    ← Merged calc: SI + Tax + Attendance inline (1 invokeUrl)
│   ├── processTerminationRun.js       ← Termination path: pro-rate, 3 standalone calcs
│   │
│   └── Gateway Functions/             ← Web tab API layer (browser never touches Zoho APIs)
│       ├── portalGetSettings.js       ← Read PAYROLL_SETTINGS_JSON + PAYROLL_PORTAL_CONFIG
│       ├── portalSaveSettings.js      ← Write settings/config/users (3 sections)
│       ├── portalCreateMPS.js         ← Create Monthly_Payroll_Setup record
│       ├── portalUpdateMPS.js         ← Override working days on MPS
│       ├── portalTriggerOrchestrator.js ← Pre-flight check + trigger runPayrollOrchestrator
│       ├── portalGetQueueStatus.js    ← Read Payroll_Queue — regular + termination tabs
│       └── portalGetPeriodReport.js   ← Aggregate period summary for reports feature
│
├── docs/
│   ├── Variables.md                   ← All 7 org variable structures with field references
│   ├── Forms.md                       ← All 4 forms with 76 field specs across 10 groups
│   └── Workflows.md                   ← Deployment spec for 3 workflow rules
│
└── webtab/
    ├── plugin.json                    ← Zoho extension manifest
    ├── package.json                   ← React 18 + Vite 4 + Tailwind 3
    ├── vite.config.js                 ← Builds to webtab/app/ for CLI packaging
    ├── index.html                     ← Loads Zoho JS SDK script
    └── src/
        ├── App.jsx                    ← Root: AuthProvider + ToastProvider + Shell
        ├── main.jsx                   ← React root mount
        ├── index.css                  ← Tailwind directives
        ├── context/
        │   └── AuthContext.jsx        ← Global auth state + Toast system
        ├── hooks/
        │   ├── useSDK.js              ← Zoho SDK init + user identity resolution
        │   └── useGateway.js          ← All 7 gateway calls + DEV_MODE mock data
        ├── utils/
        │   └── permissions.js         ← resolvePermissions(config, employeeId)
        ├── components/
        │   ├── Shell.jsx              ← Init flow, layout wrapper, routing
        │   ├── Nav.jsx                ← Sidebar (desktop) + BottomNav (mobile)
        │   └── LoadingScreen.jsx      ← LoadingScreen + AccessDenied + ErrorScreen
        └── features/
            ├── QueueMonitor/          ← 30s polling, Tab A regular, Tab B termination
            ├── Reports/               ← Period picker, 11 metric cards
            ├── RunPayroll/            ← 3-step stepper: Setup → Review → Running
            └── Settings/              ← Payroll settings, portal config, user management
```

---

## System Architecture — 8 Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 1 — Web Tab (React SPA · Extension CLI zip)                   │
│ Permission shell. Zoho injects user_id at load.                     │
│ Sidebar nav (desktop) / Bottom tab bar (mobile).                    │
│ 4 features: feature_settings, feature_run_payroll,                  │
│             feature_queue_monitor, feature_reports                   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ ZOHO.PEOPLE.invoke (Pattern X)
┌───────────────────────────▼─────────────────────────────────────────┐
│ LAYER 2 — Gateway Functions (Deluge API layer)                      │
│ 7 functions. Browser never calls Zoho APIs directly.                │
│ portalGetSettings, portalSaveSettings, portalCreateMPS,             │
│ portalUpdateMPS, portalTriggerOrchestrator,                         │
│ portalGetQueueStatus, portalGetPeriodReport                         │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ LAYER 3 — Config and Data Stores                                    │
│ PAYROLL_PORTAL_CONFIG (roles + users + config)                      │
│ PAYROLL_SETTINGS_JSON · SI_CONFIG_JSON · TAX_CONFIG_JSON            │
│ TAX_BRACKETS_STD_JSON · TAX_BRACKETS_HI_JSON · ATTENDANCE_RULES_JSON│
│ Monthly_Payroll_Setup form                                          │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ LAYER 4 — Batch Engine                                              │
│ runPayrollOrchestrator: bulk-fetches ALL data once (employees,      │
│ YTD, attendance). Writes Payroll_Queue with 6 snapshot fields.      │
│ Workflow A fires processPayrollBatch per batch (time-based).        │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ LAYER 5 — calculateEmployeePayroll (Merged)                         │
│ 1 invokeUrl per employee. SI + Tax + Attendance all inline.         │
│ Receives all 5 config maps as parameters — zero internal fetches.   │
│ apply_insurance and apply_tax guards. Per-factor att_rules flags.   │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ LAYER 6 — Batch Payroll Output                                      │
│ Monthly_Payroll_Record · pr_status=Final · pr_is_final_settlement=false │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 7 — Termination Path (event-driven · independent of batch)    │
│ P_Employee status change → onEmployeeTermination →                  │
│ Payroll_Queue (pq_is_final_settlement=true) → Workflow B →          │
│ processTerminationRun → 3 standalone calc functions                 │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────────┐
│ LAYER 8 — Termination Payroll Output                                │
│ Monthly_Payroll_Record · pr_is_final_settlement=true                │
│ pr_final_settlement_days_worked populated                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Full Run Cycle — Execution Trace

### Stage 1: HR Creates Setup (Web Tab)
```
HR selects period → clicks "Create Setup"
  → portalCreateMPS(payroll_period, holiday_list, working_days)
    → reads PAYROLL_PORTAL_CONFIG.config.default_holiday_source
    → if "zoho": fetches Zoho holiday API, runs .workDaysBetween() server-side
    → if "manual": trusts HR-entered values from webtab JS
    → duplicate period guard
    → writes Monthly_Payroll_Setup: mps_status=Ready, mps_payslip_issue_date=today
    → returns {mps_id, working_days, holidays} to webtab
  → HR reviews MPS (optional working days override via portalUpdateMPS)
  → HR clicks "Run Payroll"
  → portalTriggerOrchestrator(payroll_period)
    → pre-flight: MPS must be Ready, lock must be false
    → calls runPayrollOrchestrator
```

### Stage 2: Orchestrator (Deluge — STEPS 0–11)
```
STEP 0 : Read PAYROLL_SETTINGS_JSON → global lock check → set lock=true
STEP 1 : Validate MPS exists and status=Ready
STEP 2 : Set MPS status → Processing
STEP 3 : Derive period_start, period_end strings
STEP 4 : Parse mps_public_holidays → public_holiday_dates List<Date>
STEP 5 : Read scope (all/by_department/by_employee) + selected filters
STEP 6 : Paginate P_Employee (200/call, leftPad list, 20 pages max)
          → build all_employees List + emp_map{emp_id → profile snapshot}
          → profile snapshot: basic_salary, allowances, gross, sub_wage,
            hire_month, hire_year, emp_si_override, emp_tax_override
STEP 7 : Paginate Monthly_Payroll_Record Finals (200/call, 50 pages max)
          → aggregate ytd_gross + ytd_tax_withheld per employee → ytd_map
STEP 8 : Paginate attendance API (100/call, 40 pages max, leftPad list)
          → nested loop (employee → days) runs HERE ONCE
          → aggregates: absent_days, late_minutes, overtime_hours, ph_days_worked
          → att_map keyed by employee_id
STEP 9 : Write Payroll_Queue records (batches of 10)
          → per record: pq_employee_snapshot (JSON), pq_ytd_snapshot (JSON),
            pq_absent_days, pq_late_minutes, pq_overtime_hours, pq_ph_days_worked
          → first of each batch: pq_queue_at set → Workflow A fires time-based
          → batches staggered 3 min apart
STEP 10: Update MPS mps_progress_total = total_queued
STEP 11: Release global lock (lock=false)
```

### Stage 3: Batch Processing (Deluge — per Workflow A trigger)
```
processPayrollBatch(batch_number, payroll_period)
  STEP 1 : Read all 6 config sources ONCE (SI, tax, attendance, settings)
  STEP 2 : Read MPS record for working_days and payslip_issue_date
  STEP 3 : Fetch Pending queue records for this batch_number
  STEP 4 : Per-employee loop (10 employees max per batch):
    4a    : Parse 6 snapshot fields from queue record → zero extra API calls
    4a-2  : Fetch unpaid leave via API (moved from Orchestrator to reduce runtime)
            → period_start = payroll_period + "-01"
            → period_end   = first day of next month - 1 day
    4b    : Resolve effective_apply_insurance and effective_apply_tax
            (emp_si_override / emp_tax_override override org-level flags)
    4c    : invokeUrl calculateEmployeePayroll — 1 call covers SI+Tax+Attendance
    4d    : Compute final_net = gross - deductions + additions (floor 0)
    4e    : Rerun check → convert existing Final record to Draft if found
    4f    : Write Monthly_Payroll_Record (pr_status=Final)
    4g    : Mark queue record Done/Error
  STEP 5 : Update MPS mps_progress_done and mps_progress_error (read-then-write)
  STEP 6 : Completion check → query remaining Pending → if 0: MPS=Completed
```

### Termination Path (event-driven, independent of batch cycle)
```
HR changes P_Employee.Employeestatus → Terminated or Resigned
  → Workflow Rule fires → onEmployeeTermination(employee_id)
    → reads Date_of_Leaving → derives exit period
    → cancels existing Pending regular queue record → pq_status=Cancelled
    → writes Payroll_Queue: pq_is_final_settlement=true, pq_exit_date, pq_status=Pending
  → Workflow B fires immediately (on pq_is_final_settlement=true record create)
    → calls processTerminationRun(employee_id, exit_date, queue_id)
      STEP 1  : Load PAYROLL_SETTINGS_JSON
      STEP 2  : Derive current_period from exit_date
      STEP 3  : Validate MPS exists for exit period
      STEP 4  : Build public_holiday_dates from MPS
      STEP 5  : Read P_Employee record directly
                → resolve effective_apply_insurance / effective_apply_tax
      STEP 6  : Aggregate YTD from prior Final records
      STEP 7  : Fix 2 — convert existing regular record to Draft if found
      STEP 8  : Fetch attendance (month_start → exit_date)
      STEP 9  : Fetch unpaid leave (month_start → exit_date)
      STEP 10 : .workDaysBetween(exit_date, {Friday,Saturday}, public_holiday_dates)
                on month_start.subDay(1) — exclusive-start compensation
      STEP 11 : Pro-rate gross: (gross / working_days) * days_worked
      STEP 12 : calculateSocialInsurance (on pro-rated gross)
                calculatePayroll (on pro-rated gross)
                calculateAttendanceAdjustments (working_days = days_worked)
      STEP 13 : Compute final_net
      STEP 14 : Write Monthly_Payroll_Record (pr_is_final_settlement=true)
      STEP 15 : Mark queue record Done — function owns queue closure
```

---

## Function Registry — All Functions

### Core Batch Path

| Function | Trigger | Inputs | Key Output |
|---|---|---|---|
| `runPayrollOrchestrator` | portalTriggerOrchestrator | payroll_period | Payroll_Queue records (N batches) |
| `processPayrollBatch` | Workflow A (time-based at pq_queue_at) | batch_number, payroll_period | Monthly_Payroll_Record per employee |
| `calculateEmployeePayroll` | processPayrollBatch (invokeUrl) | 20 params: gross, config maps, attendance integers | Combined result map (SI+Tax+Att) |

### Standalone Calculation (Termination Path Only)

| Function | Called By | Key Logic |
|---|---|---|
| `calculateSocialInsurance` | processTerminationRun | Reads SI_CONFIG_JSON internally. Caps wage at monthly_ceiling. Martyrs fund for Legal Entity only. |
| `calculatePayroll` | processTerminationRun | Reads TAX_CONFIG_JSON + brackets internally. Forward annualisation: hire year = 13-hire_month, others = 12. |
| `calculateAttendanceAdjustments` | processTerminationRun | Reads ATTENDANCE_RULES_JSON internally. daily_rate=gross/working_days, hourly=daily/8, minute=hourly/60. |

### Termination Path

| Function | Trigger | Key Differences from Batch |
|---|---|---|
| `onEmployeeTermination` | Workflow Rule on P_Employee edit | Cancels existing Pending regular queue records. Writes termination queue record. Does NOT call processTerminationRun directly. |
| `processTerminationRun` | Workflow B (immediate on queue create) | Pro-rates gross. Reads P_Employee directly (no snapshots). Calls 3 standalones. Owns queue closure at Step 15. |

### Gateway Functions (Web Tab API Layer)

| Function | Feature | Reads | Writes |
|---|---|---|---|
| `portalGetSettings` | feature_settings | PAYROLL_SETTINGS_JSON, PAYROLL_PORTAL_CONFIG | — |
| `portalSaveSettings` | feature_settings | Current variable values | PAYROLL_SETTINGS_JSON or PAYROLL_PORTAL_CONFIG |
| `portalCreateMPS` | feature_run_payroll | PAYROLL_PORTAL_CONFIG, Zoho holiday API | Monthly_Payroll_Setup |
| `portalUpdateMPS` | feature_run_payroll | Monthly_Payroll_Setup | Monthly_Payroll_Setup.mps_working_days |
| `portalTriggerOrchestrator` | feature_run_payroll | MPS status, lock status | calls runPayrollOrchestrator |
| `portalGetQueueStatus` | feature_queue_monitor | Monthly_Payroll_Setup, Payroll_Queue | — |
| `portalGetPeriodReport` | feature_reports | Monthly_Payroll_Record (Final, by period) | — |

---

## Org Variable Registry — All 7 Variables

Group: `Orca_Payroll_Variables`
Access pattern: `https://people.zoho.com/people/api/v3/variables/{NAME}/view?group=Orca_Payroll_Variables`

### PAYROLL_SETTINGS_JSON
Runtime engine config. Written by `portalSaveSettings`. Read by Orchestrator and processPayrollBatch.
```json
{
  "active_settings": {
    "social_insurance": { "apply_insurance": true, "entity_type": "Legal Entity" },
    "income_tax":       { "apply_tax": true },
    "payroll_run":      { "scope": "all", "selected_department": "", "selected_employees": [], "lock": false }
  }
}
```
- `lock`: set true by Orchestrator on start, false on finish. Blocks concurrent runs.
- `entity_type`: "Legal Entity" → Martyrs Fund applies. "Sole Proprietorship" → Martyrs Fund = 0.

### SI_CONFIG_JSON
Social Insurance rates per Law 148/2019. Update `monthly_ceiling` annually.
```json
{ "employee_rate": 0.11, "employer_rate": 0.1875, "martyrs_fund_rate": 0.0005, "monthly_ceiling": 12600.00 }
```

### TAX_CONFIG_JSON
```json
{ "personal_exemption_annual": 20000.00 }
```

### TAX_BRACKETS_STD_JSON
Applied when annual_net_taxable ≤ 600,000 EGP. Formula: `annual_tax = annual_net × rate − constant`.
Match rule: `annual_net > min AND (max == null OR annual_net ≤ max)`. First match wins.
```json
{
  "standard_brackets": [
    { "min": 0,      "max": 40000,  "rate": 0.00,  "constant": 0.00     },
    { "min": 40000,  "max": 55000,  "rate": 0.025, "constant": 1000.00  },
    { "min": 55000,  "max": 70000,  "rate": 0.10,  "constant": 5125.00  },
    { "min": 70000,  "max": 200000, "rate": 0.15,  "constant": 8625.00  },
    { "min": 200000, "max": 400000, "rate": 0.20,  "constant": 18625.00 },
    { "min": 400000, "max": 600000, "rate": 0.225, "constant": 28625.00 }
  ]
}
```

### TAX_BRACKETS_HI_JSON
Applied when annual_net_taxable > 600,000 EGP. Same formula.
```json
{
  "high_income_tiers": [
    { "min": 600000, "max": 700000, "rate": 0.25,  "constant": 43625.00 },
    { "min": 700000, "max": 900000, "rate": 0.275, "constant": 61125.00 },
    { "min": 900000, "max": null,   "rate": 0.30,  "constant": 83625.00 }
  ]
}
```

### ATTENDANCE_RULES_JSON
Per-factor flags. All independently toggled.
```json
{
  "absence":       { "enabled": true },
  "unpaid_leave":  { "enabled": true },
  "late_deduction":{ "enabled": true },
  "overtime":      { "enabled": true, "multiplier": 1.5 },
  "public_holiday":{ "enabled": true, "if_worked": "overtime_rate" }
}
```
`public_holiday.if_worked`: "overtime_rate" | "double_rate" | "paid_day" (no extra pay).

### PAYROLL_PORTAL_CONFIG
Web tab permission model + portal runtime config. Single merged variable.
```json
{
  "roles": {
    "admin":   ["feature_settings","feature_run_payroll","feature_queue_monitor","feature_reports"],
    "manager": ["feature_run_payroll","feature_queue_monitor","feature_reports"]
  },
  "users": { "EMP001": "admin", "EMP002": "manager" },
  "config": { "default_holiday_source": "zoho", "allow_working_days_override": false }
}
```
- `users`: keyed by Zoho People EmployeeID. Not in map = Access Denied.
- `default_holiday_source`: "zoho" → server-side .workDaysBetween(). "manual" → HR JS calc.
- `allow_working_days_override`: shows Override button on MPS review screen.

---

## Form Registry — Key Fields

Full field specs in `docs/Forms.md`.

### P_Employee — 8 Custom Fields Added

| API Name | Type | Notes |
|---|---|---|
| `emp_basic_salary` | Decimal | Required |
| `emp_housing_allowance` | Decimal | null → 0 |
| `emp_transport_allowance` | Decimal | null → 0 |
| `emp_medical_allowance` | Decimal | null → 0 |
| `emp_other_allowances` | Decimal | null → 0 |
| `emp_si_subscription_wage` | Decimal | null → falls back to gross |
| `emp_si_override` | Boolean | null=use org setting, true/false=per-employee |
| `emp_tax_override` | Boolean | null=use org setting, true/false=per-employee |

### Monthly_Payroll_Setup — 10 Fields
Status flow: `Ready → Processing → Completed`
Key fields: `mps_payroll_period` (YYYY-MM), `mps_working_days`, `mps_public_holidays` (one "YYYY-MM-DD Name" per line), `mps_payslip_issue_date` (auto-set to run day), `mps_progress_total/done/error`.

### Payroll_Queue — 17 Fields
Status values: `Pending` | `Processing` | `Done` | `Error` | `Cancelled`
Routing fields: `pq_is_final_settlement` (false=regular, true=termination), `pq_queue_at` (trigger record only, Workflow A condition), `pq_exit_date` (termination only), `pq_batch_number`.
Snapshot fields (null for termination): `pq_employee_snapshot`, `pq_ytd_snapshot`, `pq_absent_days`, `pq_late_minutes`, `pq_overtime_hours`, `pq_ph_days_worked`. Note: `pq_unpaid_leave_days` is NOT stored — fetched live in processPayrollBatch.

### Monthly_Payroll_Record — 41 Fields in 10 Groups
Groups: Identity (5) · Salary (3) · Social Insurance (6) · Income Tax (5) · Attendance Inputs (6) · Attendance Adjustments (6) · Totals+Net (3) · YTD (2) · Termination (1) · Audit+Rerun (4)
Key: `pr_is_final_settlement` partitions regular vs termination records throughout the system.

---

## Workflow Rules — 3 Rules

Full deployment spec in `docs/Workflows.md`.

| Rule | Form | Execute When | Condition | Action | Calls |
|---|---|---|---|---|---|
| Employee Termination Trigger | P_Employee | Edit | Employeestatus changed to Terminated OR Resigned | Immediate | `onEmployeeTermination(${EmployeeID})` |
| Workflow A — Regular Batch | Payroll_Queue | Create | pq_queue_at not empty AND pq_is_final_settlement=false | Time-based at pq_queue_at | `processPayrollBatch(${pq_batch_number}, ${pq_payroll_period})` |
| Workflow B — Termination | Payroll_Queue | Create | pq_is_final_settlement=true | Immediate | `processTerminationRun(${pq_employee_id}, ${pq_exit_date}, ${ID})` |

---

## Key Design Decisions

### 1. Queue Architecture (Fundamental)
Zoho Deluge has a 5-minute execution timeout. Processing 50+ employees in one call is impossible. The queue-based design — Orchestrator builds queue records, Workflow A fires batches of 10 — is what makes the system viable. Without this, the system cannot function at any meaningful scale.

### 2. Merged calculateEmployeePayroll (Batch Path Only)
Before: 3 separate invokeUrl calls per employee (calculateSocialInsurance, calculatePayroll, calculateAttendanceAdjustments), each also fetching their own config internally = 8 invokeUrls per employee.
After: 1 invokeUrl. All 3 calculation blocks merged inline. All 5 config maps passed as parameters from processPayrollBatch which reads them once per batch. `apply_insurance` and `apply_tax` guards preserved. Per-factor `att_rules` flags preserved.
**Termination path is unaffected** — 3 standalone functions remain for processTerminationRun.

### 3. Orchestrator Bulk Fetch
All data captured once before any batch fires: P_Employee paginated (200/call), YTD Finals paginated (200/call), attendance bulk API (100/call). Stored as snapshot fields in each queue record. processPayrollBatch reads locally — zero extra API calls per employee for these sources.

### 4. Leave Fetch in processPayrollBatch (Not Orchestrator)
Originally N sequential leave API calls (one per employee) were in the Orchestrator. Moved to processPayrollBatch (Step 4a-2) to reduce Orchestrator runtime. 10 leave calls per batch, distributed across batches running in parallel — no longer blocking the single Orchestrator window.

### 5. No while() — leftPad List Pattern
Deluge has no while() function. Pagination implemented with:
```
page_index = 0;
page_list  = leftPad(" ", N).replaceAll(" ", ",").removeLastOccurence(",").toList();
for each item in page_list {
    sindex = (page_index * pageSize) + offset;
    fetch → if null/empty { break; }
    page_index = page_index + 1;
    process → if size < pageSize { break; }
}
```
Applied to STEP 6 (P_Employee, 20 pages), STEP 7 (YTD, 50 pages), STEP 8 (Attendance, 40 pages).

### 6. workDaysBetween() Native Deluge
Egyptian weekend = Friday + Saturday (passed explicitly — Deluge default is Sat+Sun).
`workDaysBetween` is exclusive of start date. Compensation: `month_start.subDay(1).workDaysBetween(exit_date, {"Friday","Saturday"}, public_holidays)`.
Replaces the retired `count_working_days` custom function in the termination path.

### 7. Always-Queue Termination Routing
`onEmployeeTermination` always writes a Payroll_Queue record. Workflow B fires immediately. `processTerminationRun` owns queue closure (Step 15, marks pq_status=Done). No Scheduler involvement. No immediate-mode branch.

### 8. Gateway Pattern — Deluge as API Layer
Browser never calls Zoho APIs directly. All data through Deluge gateway functions. SDK invocation: `ZOHO.PEOPLE.invoke("functionName", { params: {} })` (Pattern X). Credentials stay server-side. DEV_MODE flag in useGateway.js enables full mock operation without Zoho connection.

### 9. Per-Employee SI/Tax Overrides
Org-level flags (`apply_insurance`, `apply_tax`, `entity_type`) apply globally. Per-employee overrides stored in `emp_si_override` and `emp_tax_override` on P_Employee. Null = use org setting. Resolution: `effective = (override != null) ? override : org_setting`. Captured in `pq_employee_snapshot` by Orchestrator — processPayrollBatch never re-reads P_Employee.

### 10. Forward Annualisation for Tax
Tax is computed on an annualised basis. Hire year: `months_remaining = 13 - hire_month`. All other years: `months_remaining = 12`. `annual_net = monthly_net × months_remaining`. Tax bracket applied to `annual_net`. `monthly_tax = annual_tax / months_remaining`. Mid-year salary changes accumulate silently until December — known and accepted gap for pilot.

### 11. PAYROLL_PORTAL_CONFIG — Single Merged Variable
Three logical sections (roles, users, config) merged into one org variable. Was originally designed as two variables. Single variable reduces read operations in gateway functions.

### 12. MPS Payslip Issue Date = Run Day
`mps_payslip_issue_date` is auto-set to `zoho.currenttime` inside `portalCreateMPS`. Not HR-entered. Copied into every `pr_payslip_issue_date` for the period.

---

## Deluge Patterns Used Throughout

### Date Safety (Fix 8)
Always call `.toDate()` before comparing or using date values. String vs Date type mismatches caused real runtime bugs. Public holiday comparison: `public_holiday_dates.contains(day_key.toDate())`.

### Null Allowances (Fix A)
`ifnull(emp.get("fieldName"), "0").toDecimal()` on all allowance fields. Null treated as 0.

### Config Map Serialization
Config Maps passed via invokeUrl POST as `.toString()` (JSON string). Receiving function calls `.toMap()` at entry: `si_config = ifnull(si_config, "{}").toString().toMap()`. Empty string guard handles disabled features.

### Rerun Record Conversion (Fix 2)
When a new run overwrites an existing Final record: existing record → `pr_status=Draft, pr_is_rerun=true, pr_run_sequence+=1`. New record written as Final.

### Concurrent Batch Safety (MPS Counters)
processPayrollBatch reads MPS fresh before incrementing progress counters. Multiple batches may run near-simultaneously — read-then-write prevents counter overwrites.

---

## Web Tab Architecture

### Permission Resolution at Load
```
1. ZOHO.embeddedApp.on("PageLoad") → user.employeeId
2. portalGetSettings() → PAYROLL_PORTAL_CONFIG
3. role = config.users[employeeId]     → null = Access Denied
4. features = config.roles[role]       → permitted feature list
5. Render sidebar/bottom nav with permitted features only
```

### Mobile vs Desktop
- Desktop: left sidebar (icons + labels, collapsible)
- Mobile < 768px: bottom tab bar (4 icons, always visible)
- Queue monitor: card list (not tables) on all screen sizes
- Run payroll: 3-step stepper with full-width steps

### feature_run_payroll — 3-Step Flow
- Step 1: Period picker → "Create Setup" button → portalCreateMPS
- Step 2: MPS review (working days + holidays) → optional override → "Run Payroll" button → portalTriggerOrchestrator
- Step 3: Live progress polling every 30 seconds → done/pending/error counters

### DEV_MODE
`DEV_MODE = true` in `webtab/src/hooks/useGateway.js`. All 7 gateway functions return realistic mock data. Set to `false` before packaging with `zet pack`. Mock identity: EMP001 = admin.

### Build and Deploy
```bash
cd webtab
npm install
npm run build        # → webtab/app/
# Set DEV_MODE = false in src/hooks/useGateway.js
zet pack             # → ZIP for Zoho Extension upload
# Upload via Zoho People → Setup → Extensions
# Assign tab to HR Admin + Manager profiles only
```

---

## Known Gaps — Pilot Scope

These are acknowledged limitations accepted for the initial pilot deployment:

| Gap | Impact | Notes |
|---|---|---|
| No salary revision workflow | Mid-year changes accumulate silently until December | Forward annualisation design consequence |
| No payslip distribution | Employees cannot see payslips | No feature_payslip in Lit scope |
| No bank disbursement | Net salary calculated but not disbursed | Deferred |
| No reporting module (export) | Period report is view-only in browser | CSV/PDF export deferred |
| No December annual reconciliation | Year-end tax true-up not implemented | Dropped in Lit scope |
| No Final Settlement | Gratuity/EOSC not calculated on termination | Dropped in Lit scope |
| Org-level SI/Tax flags | Per-employee overrides added but complex cases (foreign workers, etc.) may need extension | Pilot acceptable |
| getRecords pagination | zoho.people.getRecords with sIndex/limit support must be verified against actual Zoho People API version | Verify before go-live |

---

## Compliance Reference

| Law | Coverage |
|---|---|
| Egyptian Income Tax Law 7/2024 | Tax brackets (STD and HI), personal exemption (EGP 20,000), forward annualisation |
| Social Insurance Law 148/2019 | Employee rate (11%), employer rate (18.75%), martyrs fund (0.05%), monthly ceiling (EGP 12,600) |

**Annual maintenance required:**
- Update `SI_CONFIG_JSON.monthly_ceiling` each fiscal year (ceiling changes per Law 148/2019 schedule)
- Update tax brackets if Tax Law changes

---

## Build Status

| Phase | Deliverable | Status |
|---|---|---|
| 1 | 6 org variables | Specified + documented |
| 2 | P_Employee 8 custom fields | Specified + documented |
| 3 | 3 forms (76 fields) | Specified + documented |
| 4 | calculateSocialInsurance, calculatePayroll, calculateAttendanceAdjustments | Skipped (implement separately in Zoho) |
| 5 | onEmployeeTermination | In repo |
| 6 | runPayrollOrchestrator + processPayrollBatch | In repo |
| 7 | processTerminationRun | In repo |
| 8 | Workflow A + Workflow B | Deployment spec in docs/Workflows.md |
| A | PAYROLL_PORTAL_CONFIG org variable | Specified + documented |
| B | 7 gateway functions | In repo |
| C | Webtab shell | In repo |
| D1–D4 | 4 feature modules | In repo |
| E | Extension package + deploy | Ready — flip DEV_MODE, npm run build, zet pack |

**calculateEmployeePayroll depends on the 3 standalone functions being deployed first in Zoho People as custom functions before the batch path can run.**
