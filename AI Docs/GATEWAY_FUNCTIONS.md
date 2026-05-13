# ORCA Payroll — Gateway Functions Reference
**Audience:** Backend developer (Deluge) and frontend developers.
**Purpose:** Canonical contract for every gateway function — inputs, outputs, error responses, and caching behaviour. All Deluge functions and frontend mock handlers must match this document exactly.
**Last updated:** 2026-05-13 rev 2 — scope ownership moved to MPS record.

---

## Architecture Overview

```
portalGetSettings    ──→  auth context (roles, permissions, all config)  ──→  ALL screens
portalListRuns       ──→  runs list (cached in RunPayroll)               ──→  RunPayroll + QueueMonitor tabs
portalListEmployees  ──→  employee profiles                              ──→  Employees screen + wizard picker
portalGetDashboard   ──→  dashboard aggregation                          ──→  Dashboard only (single call)
```

**Key principles:**
- `portalGetSettings` is the only call made before the user sees anything. Cached in `auth` context for the entire session.
- All responses include `status: "success" | "error"`. Error responses always include `message: string`.
- `run_id` (the Zoho MPS record ID) is the canonical run identifier. `period` alone is not unique when `allow_multiple_runs = true`.
- `employee_name` and `department` are never stored on the frontend. They are enriched server-side by Deluge in `portalGetQueueStatus` and `portalGetPayrollRecords`.
- **Scope is owned by the MPS record.** `scope`, `selected_department`, and `selected_employees` are passed to `portalCreateMPS` at creation time and stored on the MPS record. They are never read from or written to organisation variables (`PAYROLL_SETTINGS_JSON`). `portalListRuns` is the only source of scope data for the frontend.

---

## Function Catalogue

### 1. `portalGetSettings`
**Trigger:** App boot — Shell.jsx before any screen renders.
**Params:** none
**Reads:** `PAYROLL_SETTINGS_JSON`, `PAYROLL_PORTAL_CONFIG` Zoho variables

**Response:**
```json
{
  "status": "success",
  "payroll_settings": {
    "attendance": {
      "working_days_default": 22,
      "absence":        { "enabled": true,  "multiplier": 1.0 },
      "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
      "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
      "overtime":       { "enabled": true,  "multiplier": 1.5 },
      "public_holiday": { "enabled": true,  "if_worked": "overtime_rate" }
    },
    "social_insurance": {
      "monthly_ceiling":   9400,
      "employee_rate":     0.11,
      "employer_rate":     0.1875,
      "martyrs_fund_rate": 0.0005,
      "ceiling_updated":   "YYYY-MM-DD"
    }
  },
  "portal_config": {
    "portal_users":                { "EMP001": "admin", "EMP002": "manager" },
    "portal_roles":                { "admin": ["feature_dashboard", "..."], "manager": ["..."] },
    "default_holiday_source":      "zoho | manual",
    "allow_working_days_override": true,
    "allow_multiple_runs":         false
  }
}
```

**Error responses:**
```json
{ "status": "error", "message": "PAYROLL_SETTINGS_JSON not found. Run initial configuration first." }
{ "status": "error", "message": "PAYROLL_PORTAL_CONFIG not found. Run initial configuration first." }
```

**Notes:**
- Shell reads `response.payroll_settings` → `auth.payrollSettings`
- Shell reads `response.portal_config` → `auth.portalConfig`
- `portal_users` and `portal_roles` are nested inside `portal_config` (not top-level)
- All fields have safe defaults applied in Deluge if missing from the Zoho variable
- `payroll_settings` does **not** contain a `payroll_run` scope block — scope is owned by each MPS record, not by org settings

---

### 2. `portalGetDashboard`
**Trigger:** Dashboard feature mount (once per session).
**Params:** none
**Reads:** `Monthly_Payroll_Setup`, `Payroll_Queue`, Zoho People employee + leave APIs, `PAYROLL_SETTINGS_JSON`

**Response:**
```json
{
  "status": "success",
  "employee_summary": {
    "total_active":   142,
    "total_on_leave": 8,
    "new_this_month": 3
  },
  "last_run": {
    "period":         "YYYY-MM",
    "run_date":       "YYYY-MM-DD",
    "status":         "Completed | Processing",
    "employee_count": 139,
    "total_gross":    4820000,
    "total_net":      3945000,
    "total_tax":      486000,
    "total_si":       389000
  },
  "upcoming_run": {
    "period":         "YYYY-MM",
    "cutoff_date":    "YYYY-MM-DD",
    "scheduled_date": "YYYY-MM-DD"
  },
  "queue_summary": {
    "pending":         0,
    "processing":      0,
    "failed":          1,
    "completed_today": 0
  },
  "run_history": [
    {
      "period":         "YYYY-MM",
      "run_date":       "YYYY-MM-DD",
      "status":         "Completed",
      "employee_count": 139,
      "total_net":      3945000
    }
  ],
  "alerts": [
    { "id": 1, "severity": "error | warning | info", "message": "string" }
  ]
}
```

**Notes:**
- `run_history` contains at most 6 entries, sorted newest-period first.
- `last_run` is `null` / empty Map when no runs exist yet.
- Alerts are computed: failed queue items → `"error"` severity; SI ceiling year outdated → `"warning"` severity.

---

### 3. `portalListRuns`
**Trigger:** RunPayroll mount; QueueMonitor (to determine how many run tabs to show per period).
**Params:** none
**Reads:** `Monthly_Payroll_Setup` (all records)

**Response:**
```json
{
  "status": "success",
  "runs": [
    {
      "run_id":              "string  — Zoho MPS record ID (canonical run key)",
      "period":              "YYYY-MM",
      "status":              "Draft | Processing | Completed",
      "scope":               "all | by_department | by_employee",
      "selected_department": "string",
      "selected_employees":  ["EMP001"],
      "employees":           10,
      "working_days":        22,
      "batches":             2,
      "done":                8,
      "error":               2,
      "pending":             0,
      "holidays":            [{ "date": "YYYY-MM-DD", "name": "string" }],
      "gross":               360000,
      "net":                 295000,
      "tax":                 25000,
      "si":                  29000
    }
  ]
}
```

**Notes:**
- Sorted newest-period first.
- `gross`, `net`, `tax`, `si` are `null` when `status != "Completed"`.
- Multiple runs with the same `period` are valid when `allow_multiple_runs = true`.
- `run_id` is the stable canonical key — never use `period` alone to identify a run.
- Legacy MPS records with `mps_status = "Ready"` are returned as `status: "Draft"`.

---

### 4. `portalCreateMPS`
**Trigger:** RunPayroll wizard Step 1 — "Create" button.

**Params:**
```json
{
  "payroll_period":      "YYYY-MM",
  "scope":               "all | by_department | by_employee",
  "selected_department": "string  — empty string when scope ≠ by_department",
  "selected_employees":  ["EMP001", "EMP002"],
  "force":               false
}
```

> `scope`, `selected_department`, and `selected_employees` are **required for every call**, including `scope = "all"`. They are the sole source of truth for run scope — they are stored on the MPS record and returned by `portalListRuns`. They are never saved to or read from `PAYROLL_SETTINGS_JSON`.

**Response (success):**
```json
{
  "status":       "success",
  "run_id":       "string  — Zoho MPS record ID",
  "period":       "YYYY-MM",
  "working_days": 22,
  "holidays":     [{ "date": "YYYY-MM-DD", "name": "string" }],
  "message":      "string"
}
```

**Error responses:**
```json
{ "status": "error", "message": "A payroll run for YYYY-MM already exists." }
{ "status": "error", "message": "Invalid payroll_period: YYYY-MM. Expected format: YYYY-MM." }
{ "status": "error", "message": "working_days resolved to 0 — cannot create MPS with 0 or negative working days." }
{ "status": "error", "message": "PAYROLL_PORTAL_CONFIG not found. Run initial configuration first." }
```

**Notes:**
- `force = true` bypasses the duplicate guard. Only sent by the frontend when `allow_multiple_runs = true` in portal config.
- When `default_holiday_source = "zoho"`: holidays fetched from Zoho People holiday API for the period; `working_days` computed server-side (Egyptian weekend: Fri + Sat).
- When `default_holiday_source = "manual"`: `holidays` returns `[]`; `working_days` defaults from `attendance.working_days_default`.
- MPS is created with `status = "Draft"`.
- `scope`, `selected_department`, `selected_employees` are stored on the MPS record fields `mps_scope`, `mps_selected_department`, `mps_selected_employees` (JSON string).
- `holidays` stored as JSON string in `mps_public_holidays` field.

---

### 5. `portalUpdateMPS`
**Trigger:** RunPayroll wizard Step 2 — working days override field save.
**Condition:** Only reachable when `allow_working_days_override = true` in portal config.

**Params:**
```json
{
  "payroll_period":   "YYYY-MM",
  "new_working_days": 21
}
```

**Response:**
```json
{
  "status":       "success",
  "period":       "YYYY-MM",
  "working_days": 21,
  "message":      "string"
}
```

**Error responses:**
```json
{ "status": "error", "message": "new_working_days must be between 1 and 31. Received: 0." }
{ "status": "error", "message": "No Monthly_Payroll_Setup found for period YYYY-MM." }
{ "status": "error", "message": "Cannot override working_days — MPS status is Processing. Override only permitted on Draft runs." }
```

---

### 6. `portalUpdateMPSHolidays`
**Trigger:** RunPayroll wizard Step 2 — holiday Add / Edit / Delete actions.
**Condition:** Only reachable when `default_holiday_source = "manual"`.
**Always a full replacement — not a diff.**

**Params:**
```json
{
  "payroll_period": "YYYY-MM",
  "holidays": [
    { "date": "YYYY-MM-DD", "name": "string" }
  ]
}
```

**Response:**
```json
{ "status": "success", "message": "string" }
```

**Error responses:**
```json
{ "status": "error", "message": "payroll_period is required." }
{ "status": "error", "message": "No Monthly_Payroll_Setup found for period YYYY-MM." }
{ "status": "error", "message": "Cannot edit holidays — MPS status is Processing. Holiday edits only permitted on Draft runs." }
```

---

### 7. `portalTriggerOrchestrator`
**Trigger:** RunPayroll wizard Step 2 — "Run Payroll" button.
**Note:** Frontend retries once automatically on lock error (30s delay between attempts).

**Params:**
```json
{ "payroll_period": "YYYY-MM" }
```

**Response (success):**
```json
{
  "status":  "success",
  "run_id":  "string  — Zoho MPS record ID",
  "period":  "YYYY-MM",
  "queued":  10,
  "batches": 2,
  "message": "string"
}
```

**Error responses:**
```json
{ "status": "error", "message": "Orchestrator is locked by another process. Wait 30 seconds and try again." }
{ "status": "error", "message": "payroll_period is required." }
{ "status": "error", "message": "No Monthly_Payroll_Setup found for period YYYY-MM. Create the setup first using the period selector." }
{ "status": "error", "message": "Cannot trigger run — MPS status is Completed. Expected: Draft." }
{ "status": "error", "message": "Orchestrator error: string" }
```

**Notes:**
- The exact lock error message `"Orchestrator is locked by another process. Wait 30 seconds and try again."` is matched by the frontend to trigger automatic retry logic. Do not change this string.
- Pre-flight checks: MPS must exist with `status = "Draft"` (or legacy `"Ready"`); global run lock must be clear.
- `run_id` is always returned in the success response.

---

### 8. `portalGetQueueStatus`
**Trigger:** QueueMonitor load; RunPayroll auto-poll every 30s while `mps_status = Processing`.

**Params:**
```json
{
  "payroll_period": "YYYY-MM",
  "run_id":         "string  — required when multiple runs exist for the period"
}
```

**Response:**
```json
{
  "status":           "success",
  "run_id":           "string",
  "mps_status":       "Draft | Processing | Completed",
  "mps_working_days": 22,
  "progress": {
    "total":      10,
    "done":       8,
    "error":      2,
    "pending":    0,
    "processing": 0
  },
  "regular_run": {
    "summary": { "total": 10, "done": 8, "error": 2, "pending": 0 },
    "records": [
      {
        "employee_id":   "EMP001",
        "employee_name": "Ahmed Hassan",
        "department":    "Engineering",
        "status":        "Done | Processing | Pending | Error",
        "batch_number":  1,
        "processed_at":  "HH:MM  — empty string when not yet processed",
        "error":         "string  — empty string when no error"
      }
    ]
  },
  "termination_run": {
    "summary": { "total": 0, "done": 0, "error": 0, "pending": 0 },
    "records": []
  }
}
```

**Error responses:**
```json
{ "status": "error", "code": "no_run", "message": "No payroll run found for period YYYY-MM." }
{ "status": "error", "code": "no_run", "message": "payroll_period is required." }
```

**Notes:**
- `employee_name` and `department` are enriched by Deluge from Zoho People. The frontend does not hold an employee lookup table.
- If `run_id` is provided, the MPS record is fetched by ID directly (efficient for multi-run periods). Falls back to period search when `run_id` is omitted.
- Legacy `mps_status = "Ready"` is returned as `"Draft"`.
- Polled every 30s by the frontend while `mps_status = Processing`. Polling pauses when the browser tab is hidden.

---

### 9. `portalGetPayrollRecords`
**Trigger:** RunPayroll — selecting a run from the list; after Processing → Completed transition.
**Frontend caches by `run_id` — never re-fetched for the same run in the same session.**

**Params:**
```json
{
  "payroll_period": "YYYY-MM",
  "run_id":         "string"
}
```

**Response:**
```json
{
  "status":  "success",
  "period":  "YYYY-MM",
  "run_id":  "string",
  "records": [
    {
      "employee_id":               "EMP001",
      "employee_name":             "Ahmed Hassan",
      "department":                "Engineering",
      "status":                    "Done | Error | Processing | Pending",
      "pr_basic_salary":           30000,
      "pr_total_allowances":       11000,
      "pr_gross_salary":           41000,
      "pr_employee_si_deduction":  3300,
      "pr_martyrs_fund":           20.5,
      "pr_absence_deduction":      0,
      "pr_unpaid_leave_deduction": 0,
      "pr_late_deduction":         0,
      "pr_total_deductions":       6120,
      "pr_net_salary":             34200,
      "pr_monthly_tax_withheld":   2800,
      "pr_ytd_tax_withheld":       8400,
      "error":                     "string  — empty string when no error"
    }
  ]
}
```

**Error responses:**
```json
{ "status": "error", "message": "payroll_period is required." }
```

**Notes:**
- All `pr_*` fields are `null` for records with `status` of `Error`, `Processing`, or `Pending`.
- `pr_total_deductions` is computed server-side: `employee_si + martyrs_fund + absence + unpaid_leave + late_deduction`.
- The Zoho record field `pr_monthly_tax` is returned as `pr_monthly_tax_withheld` to match the frontend contract.
- `employee_name` and `department` enriched server-side.

---

### 10. `portalGetPeriodReport`
**Trigger:** Reports feature — period selection; auto-loads when navigated from wizard Step 4.

**Params:**
```json
{ "payroll_period": "YYYY-MM" }
```

**Response (success):**
```json
{
  "status":       "success",
  "period":       "YYYY-MM",
  "generated_at": "HH:MM",
  "summary": {
    "headcount":           43,
    "termination_count":   1,
    "total_gross":         1820000,
    "total_basic_salary":  1290000,
    "total_allowances":    530000,
    "total_net_salary":    1491000,
    "total_employee_si":   145600,
    "total_employer_si":   232400,
    "total_martyrs_fund":  910,
    "total_tax_withheld":  126000,
    "total_employer_cost": 2052400
  }
}
```

**Error responses:**
```json
{ "status": "error", "message": "No completed report available for period YYYY-MM." }
{ "status": "error", "message": "payroll_period is required." }
```

**Notes:**
- Returns `status: "error"` (not an empty success) when no `Final` payroll records exist for the period. The frontend renders the "No completed report" empty state on any error response.
- `generated_at` is time-only (`"HH:MM"`) — not a full datetime.
- `total_employer_cost = total_gross + total_employer_si + total_martyrs_fund`.

---

### 11. `portalListEmployees`
**Trigger:** Employees feature mount.
**Params:** none
**Reads:** Zoho People `P_Employee`, `Employee_Payroll_Config`, `P_Salary`

**Response:**
```json
{
  "status": "success",
  "employees": [
    {
      "employee_id":          "EMP001",
      "employee_name":        "Ahmed Hassan",
      "department":           "Engineering",
      "pr_basic_salary":      30000,
      "pr_gross_salary":      41000,
      "pr_net_salary":        34200,
      "exclude_si":           false,
      "exclude_martyrs_fund": false,
      "exclude_income_tax":   false
    }
  ]
}
```

**Error responses:**
```json
{ "status": "error", "message": "Failed to fetch employees from Zoho People." }
```

**Notes:**
- Only active employees are returned.
- Salary figures are reference/profile values from `P_Salary` — not period-specific actuals.
- Exclusion flags are read from `Employee_Payroll_Config` form. Default is `false` when no config record exists for an employee.
- The RunPayroll wizard derives its slim picker list from this response (client-side) when the Employees screen has already been visited in the session — `portalGetEmployees` is only called if `portalListEmployees` has not been called yet.

---

### 12. `portalUpdateEmployee`
**Trigger:** Employees feature — per-employee "Update" button (never batched).

**Params:**
```json
{
  "employee_id":          "EMP001",
  "exclude_si":           false,
  "exclude_martyrs_fund": true,
  "exclude_income_tax":   false
}
```

**Response:**
```json
{
  "status":      "success",
  "employee_id": "EMP001",
  "message":     "string"
}
```

**Error responses:**
```json
{ "status": "error", "message": "employee_id is required." }
```

**Notes:**
- Upserts the `Employee_Payroll_Config` record — creates if not exists, updates if exists.
- Boolean coercion applied server-side (handles `true`/`"true"` from Deluge serialisation).

---

### 13. `portalGetEmployees`
**Trigger:** RunPayroll wizard Step 1 — lazy, only when `scope = by_employee` and `portalListEmployees` has not been called in this session.

**Params:** none

**Response:**
```json
{
  "status": "success",
  "employees": [
    { "id": "EMP001", "name": "Ahmed Hassan", "department": "Engineering" }
  ]
}
```

**Error responses:**
```json
{ "status": "error", "message": "Failed to fetch employees from Zoho People." }
```

**Notes:**
- Shape intentionally uses short keys `id` / `name` (not `employee_id` / `employee_name`). This is the slim picker shape — different from the full profile in `portalListEmployees`.
- Returns up to 200 active employees. All loaded at once for client-side search filtering.

---

### 14. `portalGetDepartments`
**Trigger:** RunPayroll wizard Step 1 — lazy, only when `scope = by_department`.

**Params:** none

**Response:**
```json
{
  "status":      "success",
  "departments": [
    { "name": "Engineering" },
    { "name": "Finance" }
  ]
}
```

**Error responses:**
```json
{ "status": "error", "message": "Unexpected response from Zoho People department API." }
{ "status": "error", "message": "Department API returned error status: 1" }
```

**Notes:**
- Returns an array of `{ name: string }` objects — not a flat string array.

---

### 15. `portalSaveSettings`
**Trigger:** Settings feature — "Save" button per section card.
**Multiplexed by the `section` parameter.**

> **Scope is not handled here.** Passing `section: "payroll_settings"` returns an error. Scope (`scope`, `selected_department`, `selected_employees`) belongs to `portalCreateMPS`, not to settings.

#### Section: `"social_insurance"`
Saves monthly SI ceiling and stamps `ceiling_updated` to today.

**Params:**
```json
{
  "section":         "social_insurance",
  "monthly_ceiling": 9400
}
```

#### Section: `"attendance"`
Saves the full attendance configuration block.

**Params:**
```json
{
  "section":              "attendance",
  "working_days_default": 22,
  "absence":        { "enabled": true,  "multiplier": 1.0 },
  "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
  "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
  "overtime":       { "enabled": true,  "multiplier": 1.5 },
  "public_holiday": { "enabled": true,  "if_worked": "overtime_rate | double_rate | paid_day" }
}
```

#### Section: `"portal_config"`
Saves the three portal behaviour flags.

**Params:**
```json
{
  "section":                     "portal_config",
  "default_holiday_source":      "zoho | manual",
  "allow_working_days_override": true,
  "allow_multiple_runs":         false
}
```

#### Section: `"portal_roles"`
Full matrix replacement — all roles replaced at once.

**Params:**
```json
{
  "section":      "portal_roles",
  "portal_roles": {
    "admin":   ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_settings", "feature_employees"],
    "manager": ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_employees"]
  }
}
```

#### Section: `"portal_users"` — add user
**Params:**
```json
{
  "section": "portal_users",
  "user_id": "EMP005",
  "role":    "manager"
}
```

#### Section: `"portal_users"` — remove user
Empty string for `role` signals deletion.

**Params:**
```json
{
  "section": "portal_users",
  "user_id": "EMP005",
  "role":    ""
}
```

**Response (all sections):**
```json
{ "status": "success", "message": "string" }
```

**Error responses:**
```json
{ "status": "error", "message": "Cannot update settings while a payroll run is in progress. Wait for the current run to complete." }
{ "status": "error", "message": "monthly_ceiling is required." }
{ "status": "error", "message": "portal_roles map is required." }
{ "status": "error", "message": "user_id is required." }
{ "status": "error", "message": "Role 'viewer' does not exist. Create it in Roles & Permissions first." }
{ "status": "error", "message": "EMP005 already has a portal role." }
{ "status": "error", "message": "'payroll_settings' is not a valid section. Scope is owned by the MPS record — pass it to portalCreateMPS instead." }
{ "status": "error", "message": "Unknown section: 'xyz'. Valid sections: social_insurance, attendance, portal_config, portal_roles, portal_users." }
```

**Notes:**
- The run-in-progress guard applies to all sections except `portal_users` and `portal_roles`, which are safe to change at any time.
- Role validation in `portal_users` is dynamic — the role must already exist in `portal_roles`. This allows any admin-defined role name.
- `ceiling_updated` is auto-stamped to today's date when saving `social_insurance`. It is not sent by the frontend.

---

## Summary Table

| # | Function | Trigger | Cached? | Enriched? | Scope owner? |
|---|---|---|---|---|---|
| 1 | `portalGetSettings` | App boot | Yes — auth context, full session | No | — |
| 2 | `portalGetDashboard` | Dashboard mount | No | No | — |
| 3 | `portalListRuns` | RunPayroll, QueueMonitor | Yes — RunPayroll state, session | No | Reads from MPS |
| 4 | `portalCreateMPS` | Wizard Step 1 | No (write) | No | **Writes to MPS** |
| 5 | `portalUpdateMPS` | Wizard Step 2 | No (write) | No | — |
| 6 | `portalUpdateMPSHolidays` | Wizard Step 2 (manual holidays) | No (write) | No | — |
| 7 | `portalTriggerOrchestrator` | Wizard Step 2 | No (write) | No | — |
| 8 | `portalGetQueueStatus` | QueueMonitor, RunPayroll poll | No (real-time) | Yes | — |
| 9 | `portalGetPayrollRecords` | RunPayroll records panel | Yes — per `run_id`, session | Yes | — |
| 10 | `portalGetPeriodReport` | Reports | No | No | — |
| 11 | `portalListEmployees` | Employees screen | No (session-short) | No | — |
| 12 | `portalUpdateEmployee` | Employees screen | No (write) | No | — |
| 13 | `portalGetEmployees` | Wizard Step 1 (lazy) | No | No | — |
| 14 | `portalGetDepartments` | Wizard Step 1 (lazy) | No | No | — |
| 15 | `portalSaveSettings` | Settings screen | No (write) | No | — |

**Total: 15 functions — 6 read-only, 9 write/mutate.**
**Scope data flow: frontend → `portalCreateMPS` → MPS record → `portalListRuns` → frontend. No org variable involved.**

---

## Enrichment Contract

Two read functions require Deluge to enrich queue/payroll records with employee identity data from Zoho People. The frontend does not maintain an employee lookup table.

| Function | Enriched fields |
|---|---|
| `portalGetQueueStatus` | `employee_name`, `department` on every record in `regular_run.records` and `termination_run.records` |
| `portalGetPayrollRecords` | `employee_name`, `department` on every record |

---

## Zoho Variable Structure

### `PAYROLL_SETTINGS_JSON` (`active_settings` block)
```json
{
  "active_settings": {
    "social_insurance": {
      "monthly_ceiling":   9400,
      "employee_rate":     0.11,
      "employer_rate":     0.1875,
      "martyrs_fund_rate": 0.0005,
      "ceiling_updated":   "YYYY-MM-DD"
    },
    "attendance": {
      "working_days_default": 22,
      "absence":        { "enabled": true,  "multiplier": 1.0 },
      "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
      "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
      "overtime":       { "enabled": true,  "multiplier": 1.5 },
      "public_holiday": { "enabled": true,  "if_worked": "overtime_rate" }
    },
    "payroll_run": {
      "lock": false
    }
  }
}
```

> The `payroll_run` block retains only the `lock` field (used by `portalTriggerOrchestrator` to prevent concurrent runs). `scope`, `selected_department`, and `selected_employees` have been removed from this variable — they are stored per-run on the `Monthly_Payroll_Setup` record.

### `PAYROLL_PORTAL_CONFIG`
```json
{
  "config": {
    "default_holiday_source":      "zoho",
    "allow_working_days_override": true,
    "allow_multiple_runs":         false
  },
  "users": {
    "EMP001": "admin",
    "EMP002": "manager"
  },
  "roles": {
    "admin":   ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_settings", "feature_employees"],
    "manager": ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_employees"]
  }
}
```

---

## Zoho Form Fields Reference

### `Monthly_Payroll_Setup` (MPS)
| Field | Type | Description |
|---|---|---|
| `ID` | String | Zoho record ID — used as `run_id` |
| `mps_payroll_period` | String | `"YYYY-MM"` |
| `mps_status` | String | `"Draft"` \| `"Processing"` \| `"Completed"` |
| `mps_scope` | String | `"all"` \| `"by_department"` \| `"by_employee"` |
| `mps_selected_department` | String | Department name |
| `mps_selected_employees` | Text | JSON array string of employee IDs |
| `mps_working_days` | Integer | Working days for the period |
| `mps_public_holidays` | Text | JSON array string: `[{"date":"...","name":"..."}]` |
| `mps_progress_total` | Integer | Total employees queued |
| `mps_progress_done` | Integer | Employees processed successfully |
| `mps_progress_error` | Integer | Employees with processing errors |
| `mps_batches` | Integer | Total batch count (set by orchestrator) |
| `mps_gross` | Decimal | Total gross (set on Completed; null otherwise) |
| `mps_net` | Decimal | Total net (set on Completed; null otherwise) |
| `mps_tax` | Decimal | Total tax (set on Completed; null otherwise) |
| `mps_si` | Decimal | Total employee SI (set on Completed; null otherwise) |
| `mps_created_by` | String | Zoho login user ID |
| `mps_created_at` | String | `"YYYY-MM-DD HH:mm:ss"` |

### `Payroll_Queue`
| Field | Type | Description |
|---|---|---|
| `pq_payroll_period` | String | `"YYYY-MM"` |
| `pq_employee_id` | String | Employee ID |
| `pq_status` | String | `"Done"` \| `"Processing"` \| `"Pending"` \| `"Error"` |
| `pq_batch_number` | Integer | Batch assignment |
| `pq_processed_at` | String | `"HH:MM"` or empty |
| `pq_error` | String | Error message or empty |
| `pq_is_final_settlement` | Boolean | `true` for termination records |

### `Monthly_Payroll_Record`
| Field | Type | Description |
|---|---|---|
| `pr_payroll_period` | String | `"YYYY-MM"` |
| `pr_employee` | String | Employee ID |
| `pr_status` | String | `"Final"` \| `"Error"` \| `"Processing"` \| `"Pending"` |
| `pr_basic_salary` | Decimal | |
| `pr_total_allowances` | Decimal | |
| `pr_gross_salary` | Decimal | |
| `pr_employee_si_deduction` | Decimal | |
| `pr_martyrs_fund` | Decimal | |
| `pr_absence_deduction` | Decimal | |
| `pr_unpaid_leave_deduction` | Decimal | |
| `pr_late_deduction` | Decimal | |
| `pr_net_salary` | Decimal | |
| `pr_monthly_tax` | Decimal | Returned as `pr_monthly_tax_withheld` to frontend |
| `pr_ytd_tax_withheld` | Decimal | |
| `pr_employer_si` | Decimal | |
| `pr_is_final_settlement` | Boolean | `true` for termination records |
| `pr_error` | String | Error message or empty |

### `Employee_Payroll_Config`
| Field | Type | Description |
|---|---|---|
| `epc_employee` | String | Employee ID |
| `epc_exclude_si` | Boolean | Exclude from Social Insurance |
| `epc_exclude_martyrs_fund` | Boolean | Exclude from Martyrs' Fund |
| `epc_exclude_income_tax` | Boolean | Exclude from Income Tax |

---

*Last updated: 2026-05-13 rev 2 | Branch: `ui/mock-frontend-sandbox`*
