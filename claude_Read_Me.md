# ORCA Payroll Lite 2.0 — Claude Handover

> **For the next AI working on this repo.**
> Read this file first. It tells you what the system is, how it is structured, what rules govern it, and where every detailed reference lives. All other `.md` files are referenced from here.

---

## 1. What This System Is

**ORCA Payroll Lite 2.0** is a payroll processing SaaS product built inside **Zoho People** as an embedded **web tab**. It is not a standalone app — it lives entirely within a client's Zoho People account and interacts with their employee and attendance data through the Zoho People API.

The product has two halves:

| Half | Tech | Location |
|---|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS | `webtab/src/` |
| **Backend** | Zoho Deluge functions | `Deluge Functions/` |

The frontend is deployed as a static build (`webtab/app/`) uploaded to Zoho People as a web tab. The backend is a set of Deluge functions registered in the Zoho People account. They communicate through a gateway pattern — the frontend never calls Zoho APIs directly.

---

## 2. Repository Structure

```
ORCA-Payroll---Lite-2.0/
│
├── claude_Read_Me.md              ← You are here
├── CHANGELOG.md                   ← Session-by-session change history
│
├── AI Docs/                       ← AI-oriented technical references
│   ├── FRONTEND_ASPECTS.md        ← Frontend architecture, component patterns, rules
│   ├── GATEWAY_FUNCTIONS.md       ← All 15 gateway functions: inputs, outputs, key principles
│   └── Frontend Variable Structure.md  ← Org-level settings variables (PAYROLL_SETTINGS_JSON etc.)
│
├── docs/                          ← Engineering reference (both teams)
│   ├── Forms.md                   ← Every Zoho form + field: type, owner, written by
│   ├── Variables.md               ← Org variables structure (frontend + backend separated)
│   ├── Backend Functions.md       ← Engine functions: full input/step/output spec
│   ├── Run Scenarios.md           ← 35 payroll run scenarios across 11 categories
│   └── Workflows.md               ← Zoho workflow triggers and conditions
│
└── Deluge Functions/
    ├── Gateway Functions/         ← 15 portal* functions (webtab ↔ backend bridge)
    │   ├── portalGetSettings.js
    │   ├── portalSaveSettings.js
    │   ├── portalCreateMPS.js
    │   ├── portalUpdateMPS.js
    │   ├── portalUpdateMPSHolidays.js
    │   ├── portalTriggerOrchestrator.js
    │   ├── portalGetQueueStatus.js
    │   ├── portalGetPayrollRecords.js
    │   ├── portalGetPeriodReport.js
    │   ├── portalListRuns.js
    │   ├── portalListEmployees.js
    │   ├── portalUpdateEmployee.js
    │   ├── portalGetDashboard.js
    │   ├── portalGetDepartments.js
    │   └── portalGetEmployees.js
    │
    └── Payroll Engine Functions/  ← 5 backend-only functions (never called by frontend)
        ├── runPayrollOrchestrator.js   ← Entry point; called by portalTriggerOrchestrator
        ├── processPayrollBatch.js      ← Called by Workflow A (time trigger per batch)
        ├── calculateEmployeePayroll.js ← Called by processPayrollBatch (SI + Tax + Attendance)
        ├── onEmployeeTermination.js    ← Zoho People workflow trigger on termination
        └── processTerminationRun.js   ← Called by Workflow B (termination path)

webtab/src/
├── App.jsx                        ← Root; initialises SDK, loads AuthContext
├── main.jsx
├── context/
│   ├── AuthContext.jsx            ← Global state: auth.payrollSettings, auth.portalConfig, auth.user
│   └── ThemeContext.jsx           ← Dark/light mode
├── hooks/
│   ├── useGateway.js              ← ALL gateway calls go through here. DEV_MODE switch lives here
│   ├── mockData.js                ← Full mock responses for all gateway functions (DEV_MODE=true)
│   └── useSDK.js                  ← Zoho SDK initialisation
├── components/
│   ├── Shell.jsx                  ← App layout: sidebar + content area
│   ├── Nav.jsx                    ← Sidebar navigation
│   ├── LoadingScreen.jsx          ← Initial SDK/auth load state
│   └── MonthPicker.jsx            ← Shared month selector component
├── config/
│   └── featureRegistry.jsx        ← Maps feature keys to components + permission requirements
├── features/
│   ├── Dashboard/index.jsx        ← KPI cards + last run summary
│   ├── RunPayroll/index.jsx       ← 3-step payroll wizard (scope → review → trigger → monitor)
│   ├── QueueMonitor/index.jsx     ← Live processing view with polling
│   ├── Employees/index.jsx        ← Employee list + exclusion flag management
│   ├── Reports/index.jsx          ← Period report viewer
│   └── Settings/index.jsx        ← Settings panels (SI, Attendance, Portal config, Users, Roles)
└── utils/
    └── permissions.js             ← Role-based access control helpers
```

---

## 3. How the System Works

### 3.1 The Gateway Pattern

The frontend **never** calls `window.ZOHO.PEOPLE` directly from feature components. Every backend interaction goes through:

```
Feature Component
  → gateway.invoke('portalFunctionName', params)        // useGateway.js
    → DEV_MODE=true  → mockData.js mock handler         // local dev
    → DEV_MODE=false → window.ZOHO.PEOPLE.invoke(...)   // production
      → Deluge Gateway Function                          // Zoho backend
        → Zoho People APIs / org variables / forms
```

`useGateway.js` normalises all responses: both paths always return `{ status: "success"|"error", ... }`. Feature components always check `result.status === 'success'` — no try/catch in feature code.

### 3.2 The Payroll Run Pipeline

A payroll run follows this sequence once triggered by HR:

```
1. HR fills Run Payroll wizard (scope, period, holidays, working days)
   → portalCreateMPS       — creates MPS record, stores scope on it, returns run_id + holidays

2. HR clicks Trigger
   → portalTriggerOrchestrator — acquires global lock, calls runPayrollOrchestrator

3. runPayrollOrchestrator (Deluge)
   — validates MPS (status must be Draft or Ready)
   — sets MPS status = Processing
   — reads scope from MPS record (NOT from org variables)
   — paginates P_Employee, builds snapshots + YTD + attendance maps
   — writes Payroll_Queue records (batches of 10, each tagged with pq_mps_id)
   — releases global lock

4. Workflow A fires per batch (time-based on pq_queue_at)
   → processPayrollBatch — fetches MPS by pq_mps_id, loads config once,
     loops over 10 employees, calls calculateEmployeePayroll per employee,
     writes Monthly_Payroll_Record per employee, updates progress counters

5. Last batch completes
   → processPayrollBatch — aggregates mps_gross/net/tax/si, sets MPS status = Completed

6. Frontend polls portalGetQueueStatus every N seconds
   → shows live progress, transitions to Completed view automatically
```

### 3.3 Scope Ownership (Critical Architecture Rule)

**Scope lives on the MPS record, not in org variables.**

| Field | Form | Written by | Read by |
|---|---|---|---|
| `mps_scope` | Monthly_Payroll_Setup | `portalCreateMPS` | `runPayrollOrchestrator`, `portalListRuns` |
| `mps_selected_department` | Monthly_Payroll_Setup | `portalCreateMPS` | `runPayrollOrchestrator` |
| `mps_selected_employees` | Monthly_Payroll_Setup | `portalCreateMPS` | `runPayrollOrchestrator` |

`PAYROLL_SETTINGS_JSON.active_settings.payroll_run` retains only `lock`. Scope fields were removed. Any code that reads scope from `PAYROLL_SETTINGS_JSON` is stale and wrong.

### 3.4 MPS Status Lifecycle

```
portalCreateMPS        → mps_status = "Draft"
runPayrollOrchestrator → mps_status = "Processing"
processPayrollBatch    → mps_status = "Completed"   (last batch, 0 Pending remain)
```

Both `"Draft"` and `"Ready"` are accepted as valid pre-run states (legacy compat). Any engine function that checks status must allow both.

### 3.5 DEV_MODE

Set at the top of `webtab/src/hooks/useGateway.js`:

```js
const DEV_MODE = true;   // local dev — all calls served from mockData.js
const DEV_MODE = false;  // production — calls go to window.ZOHO.PEOPLE.invoke()
```

**Never commit `DEV_MODE = false`** to the branch unless deploying. All mock handlers are in `mockData.js` and must mirror the production gateway function signatures exactly.

---

## 4. Key Forms (Zoho People)

Four custom forms drive the entire system. Full field tables are in `docs/Forms.md`.

| Form | Purpose | Record count |
|---|---|---|
| `P_Employee` (extended) | Custom payroll fields added to native employee form | 1 per employee |
| `Employee_Payroll_Config` | Per-employee exclusion flags (SI, tax, martyrs fund) | 1 per employee |
| `Monthly_Payroll_Setup` (MPS) | One record per payroll run — scope, progress, financial totals | 1 per run |
| `Payroll_Queue` | One record per employee per run — snapshot + status | N per run |
| `Monthly_Payroll_Record` | Final payroll output per employee per run | N per run |

**New fields added in the latest session (must exist in Zoho People before going live):**

| Field | Form | Type | Why |
|---|---|---|---|
| `pq_mps_id` | Payroll_Queue | Text | Links each queue record to its specific MPS run |
| `pr_mps_id` | Monthly_Payroll_Record | Text | Links each payroll record to its specific run |
| `pr_error` | Monthly_Payroll_Record | Multi-line Text | Stores error message on Error-status records |
| `mps_batches` | Monthly_Payroll_Setup | Integer | Total batch count written by orchestrator |
| `mps_gross` | Monthly_Payroll_Setup | Decimal | Aggregated gross at run completion |
| `mps_net` | Monthly_Payroll_Setup | Decimal | Aggregated net at run completion |
| `mps_tax` | Monthly_Payroll_Setup | Decimal | Aggregated tax at run completion |
| `mps_si` | Monthly_Payroll_Setup | Decimal | Aggregated SI at run completion |
| `mps_scope` | Monthly_Payroll_Setup | Text | `"all"` / `"by_department"` / `"by_employee"` |
| `mps_selected_department` | Monthly_Payroll_Setup | Text | Dept name when scope = by_department |
| `mps_selected_employees` | Monthly_Payroll_Setup | Multi-line Text | JSON array of employee IDs |

---

## 5. Org Variables

Five Zoho People org variables store all settings. Full structures are in `docs/Variables.md` and `AI Docs/Frontend Variable Structure.md`.

| Variable | Who reads it | Purpose |
|---|---|---|
| `PAYROLL_SETTINGS_JSON` | Frontend (via `portalGetSettings`) + Engine | Lock, apply_insurance, apply_tax, entity_type, attendance overrides, SI monthly_ceiling override |
| `PAYROLL_PORTAL_CONFIG` | Frontend (via `portalGetSettings`) | Portal users, roles, allow_multiple_runs, holiday source, working days override |
| `SI_CONFIG_JSON` | Engine only | employee_rate, employer_rate, martyrs_fund_rate, monthly_ceiling (baseline) |
| `TAX_CONFIG_JSON` | Engine only | personal_exemption_annual |
| `TAX_BRACKETS_STD_JSON` / `TAX_BRACKETS_HI_JSON` | Engine only | Income tax bracket tables |
| `ATTENDANCE_RULES_JSON` | Engine only | Attendance enabled flags, multipliers, if_worked modes (baseline) |

**Override layering:** `PAYROLL_SETTINGS_JSON.active_settings.social_insurance.monthly_ceiling` and `.attendance.*` override the backend-only variables when set. Engine functions check the PSJ overlay first.

---

## 6. Auth and Permissions

On app load, `AuthContext` calls `portalGetSettings` and stores the result:

```js
auth.payrollSettings   // social_insurance {}, attendance {}
auth.portalConfig      // { portal_users[], portal_roles[], allow_multiple_runs, ... }
auth.user              // { email, role, permissions[] }
```

`permissions.js` exports `can(action, auth)` helpers used throughout feature components to gate UI elements. Role matrix is defined in `PAYROLL_PORTAL_CONFIG.roles`.

---

## 7. Document Map — Read These in Order

Start here, then follow the path for your task:

```
claude_Read_Me.md  ← Start here (this file)
│
├── Understanding the frontend experience
│   └── AI Docs/FRONTEND_ASPECTS.md
│       → component patterns, styling rules, routing, responsive layout
│
├── Understanding gateway functions (frontend ↔ backend bridge)
│   └── AI Docs/GATEWAY_FUNCTIONS.md
│       → all 15 portal* functions: inputs, outputs, error shapes, key principles
│
├── Understanding org variable structures
│   └── AI Docs/Frontend Variable Structure.md
│       → PAYROLL_SETTINGS_JSON and PAYROLL_PORTAL_CONFIG shape as seen by frontend
│
├── Understanding forms and fields (what exists in Zoho People)
│   └── docs/Forms.md
│       → every form, every field, type, owner, written by, field count = 94
│
├── Understanding org variable structures (both teams)
│   └── docs/Variables.md
│       → [FRONTEND] and [BACKEND] sections, full variable JSON structure
│
├── Understanding the payroll engine (backend Deluge)
│   └── docs/Backend Functions.md
│       → runPayrollOrchestrator, processPayrollBatch, calculateEmployeePayroll
│       → full inputs, steps, outputs, forms written, org variables read
│
├── Understanding all user-facing scenarios
│   └── docs/Run Scenarios.md
│       → 35 scenarios, 11 categories — use this to validate any engine/gateway change
│
├── Understanding Zoho workflow triggers
│   └── docs/Workflows.md
│       → Workflow A (regular batch), Workflow B (termination), trigger conditions
│
└── Understanding what changed and when
    └── CHANGELOG.md
        → session-by-session history of every function modified or created
```

---

## 8. Current Status (as of 2026-05-13)

**Branch:** `ui/mock-frontend-sandbox`
**GitHub:** `https://github.com/Atef-Orca-Estrate/ORCA-Payroll-Lite-UX-Ready`
**State:** UX Ready — frontend and gateway functions are fully aligned. Engine functions aligned to frontend contracts.

### What is complete

- All 15 gateway functions implemented and documented
- All 6 frontend features implemented (Dashboard, RunPayroll, QueueMonitor, Employees, Reports, Settings)
- DEV_MODE mock layer complete — all gateway calls have mock handlers in `mockData.js`
- Scope ownership moved to MPS record (removed from PAYROLL_SETTINGS_JSON)
- Engine functions aligned: status values, holiday format, scope reading, field writes, multipliers, grace_minutes
- All documentation current: Forms.md (94 fields), Variables.md, Backend Functions.md, Run Scenarios.md

### What is not yet done (known gaps)

- **Termination functions not reviewed** — `onEmployeeTermination.js` and `processTerminationRun.js` were intentionally excluded from the engine alignment session. They may have the same misalignments (status values, scope reading, field writes) as the regular engine functions.
- **`Employee_Payroll_Config` not wired to engine** — the `epc_exclude_si`, `epc_exclude_martyrs_fund`, `epc_exclude_income_tax` flags exist on the form and are managed by the frontend, but the engine currently uses only `emp_si_override` and `emp_tax_override` on P_Employee. The `Employee_Payroll_Config` flags need to be resolved and applied in `processPayrollBatch`.
- **`pr_monthly_tax` field alias** — the Zoho form field is `pr_monthly_tax`; the gateway returns it as `pr_monthly_tax_withheld` to the frontend. This alias lives in the gateway response. The engine writes `pr_monthly_tax`. Both names are documented in `docs/Forms.md`.
- **Real dashboard data** — `Dashboard/index.jsx` calls `portalGetDashboard` but the dashboard is not required to show live data at this stage. It renders correctly with mock data.
- **Zoho form schema changes** — the 11 new fields listed in Section 4 must be added to the actual Zoho People form configuration before `DEV_MODE = false` will work end-to-end.

---

## 9. Rules for the Next AI

Follow these strictly — they represent deliberate architectural decisions.

### Code conventions

- **Gateway only** — never call `window.ZOHO.PEOPLE.invoke()` directly from a feature component. All calls go through `gateway.invoke()` from `useGateway.js`.
- **No DEV_MODE changes** — keep `DEV_MODE = true` unless explicitly deploying. Never commit `DEV_MODE = false`.
- **Mock parity** — every change to a gateway function must have a matching change in `mockData.js`. The mock must mirror the production response shape exactly.
- **All responses are `{status, ...}`** — gateway functions always return `{status:"success"|"error", message?}`. Feature components always check `result.status`. No exceptions.
- **Inline styles** — the frontend uses Tailwind utility classes only. No CSS modules, no styled-components, no external CSS files beyond `index.css`. All component-level styles are inline style props or Tailwind classes.
- **No Redux/Zustand** — state is managed via React context (`AuthContext`, `ThemeContext`) and prop drilling. Do not introduce state management libraries.

### Backend conventions

- **Scope is on MPS** — never read scope from `PAYROLL_SETTINGS_JSON.active_settings.payroll_run`. Read it from the MPS record fields `mps_scope`, `mps_selected_department`, `mps_selected_employees`.
- **Status values** — accepted pre-run statuses are `"Draft"` (new) and `"Ready"` (legacy). Always accept both. Never check for only one.
- **Holiday format** — `mps_public_holidays` is stored as a JSON array string `[{"date":"YYYY-MM-DD","name":"..."}]`. Always check `startsWith("[")` before parsing; fall back to newline format for legacy records.
- **`pq_mps_id` and `pr_mps_id`** — every queue record and every payroll record must carry the MPS record ID. These are the only reliable links when `allow_multiple_runs = true`.
- **Config reads once per batch** — in `processPayrollBatch`, all org variable reads happen in STEP 1. The per-employee loop reads nothing from external APIs except unpaid leave (1 call/employee). `calculateEmployeePayroll` receives all config as parameters — it makes no API calls.
- **Overlay order** — `PAYROLL_SETTINGS_JSON` overrides `SI_CONFIG_JSON` for `monthly_ceiling` and overrides `ATTENDANCE_RULES_JSON` for multipliers and `grace_minutes`. Always apply PSJ overlay after loading the base config.

### Documentation conventions

- **Forms.md** — owned jointly. Backend fields go in `[BACKEND]` sections; gateway-exposed fields go in `[FRONTEND]` sections. Update the field count at the bottom on every addition.
- **CHANGELOG.md** — add a new section at the top for each working session. List every function modified and every doc changed.
- **Backend Functions.md** — update when any engine function step, input, or output changes.
- **AI Docs/** — update when gateway function signatures or response shapes change.

---

## 10. How to Run Locally

```bash
cd webtab
npm install          # first time only
npm run dev          # starts Vite dev server at http://localhost:5173
```

With `DEV_MODE = true` (default), all gateway calls are served from `mockData.js`. No Zoho account connection needed. The full UI is usable without credentials.

To test with real Zoho data: set `DEV_MODE = false`, deploy the built `webtab/app/` to the Zoho People web tab, and ensure all 15 gateway functions and 5 engine functions are registered in the account.

---

*Last updated by Claude Sonnet 4.6 — 2026-05-13*
