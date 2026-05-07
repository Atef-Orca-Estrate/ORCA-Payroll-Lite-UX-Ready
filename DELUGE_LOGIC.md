# DELUGE_LOGIC.md — Backend Function Requirements

> **⚠️ SUPERSEDED — See `WEBTAB_SPEC.md`**
> `WEBTAB_SPEC.md` is the authoritative single source of truth for all gateway function contracts,
> data shapes, mock-to-real discrepancies, and the backend build checklist.
> This file is retained for historical reference only. Do not update it — update `WEBTAB_SPEC.md`.

---

Tracks every Deluge gateway function the UI depends on.
Updated with every UI change that adds or modifies a backend dependency.
No duplicate entries — each function appears once and is updated in place.

---

## Function Index

| Function | Called By | Status |
|---|---|---|
| `portalGetSettings` | Shell (init) | Needs implementation |
| `portalListRuns` | RunPayroll (mount) | Needs implementation |
| `portalGetQueueStatus` | RunPayroll (poll), QueueMonitor | Needs implementation |
| `portalGetPayrollRecords` | RunPayroll (run selection) | Needs implementation |
| `portalGetPeriodReport` | Reports | Needs implementation |
| `portalCreateMPS` | RunPayroll — Step 1 | Needs implementation |
| `portalUpdateMPS` | RunPayroll — Step 2 | Needs implementation |
| `portalTriggerOrchestrator` | RunPayroll — Step 2 | Needs implementation |
| `portalSaveSettings` | Settings | Needs implementation |
| `portalAddPortalUser` | Settings | Needs implementation |
| `portalRemovePortalUser` | Settings | Needs implementation |

---

## Function Specifications

---

### portalGetSettings

**Called by:** Shell.jsx on mount — once per session, result stored in AuthContext

**Purpose:** Returns all org-level payroll configuration and the portal user/role map used to determine which features each employee can access.

**Inputs:** None

**Expected output:**
```json
{
  "status": "success",
  "payroll_settings": {
    "ov_tax_table": "<JSON string of tax bracket array>",
    "ov_si_rates": "<JSON string with employee_rate, employer_rate, martyrs_fund, min/max_insurance_salary>",
    "ov_employer_si_variable": "<JSON string with variable SI rate>",
    "ov_default_working_days": 22,
    "ov_public_holidays": "<newline-separated holiday names>",
    "allow_working_days_override": true,
    "scope": "all"
  },
  "portal_config": {
    "portal_users": { "EMP001": "admin", "EMP002": "manager" },
    "allow_working_days_override": true
  }
}
```

**Logic required:**
- Read all org variables (ov_tax_table, ov_si_rates, ov_employer_si_variable, ov_default_working_days, ov_public_holidays)
- Read portal config variable (portal_users map, allow_working_days_override flag)
- Return as structured JSON — no calculations

---

### portalListRuns

**Called by:** RunPayroll/index.jsx on mount — once, cached for session

**Purpose:** Returns all existing Monthly Payroll Setup (MPS) records so the runs list can be populated. Includes financial totals for completed runs (used by Step 4 wizard card — avoids a separate Report call).

**Inputs:** None

**Expected output:**
```json
{
  "status": "success",
  "runs": [
    {
      "period": "2026-04",
      "status": "Processing",
      "employees": 10,
      "working_days": 22,
      "batches": 2,
      "done": 3,
      "error": 2,
      "pending": 5,
      "holidays": "Sinai Liberation Day",
      "gross": null,
      "net": null,
      "tax": null,
      "si": null
    },
    {
      "period": "2026-03",
      "status": "Completed",
      "employees": 43,
      "working_days": 21,
      "batches": 5,
      "done": 43,
      "error": 0,
      "pending": 0,
      "holidays": "Revolution Day",
      "gross": 1820000,
      "net": 1491000,
      "tax": 126000,
      "si": 200200
    }
  ]
}
```

**Logic required:**
- Query EP_Monthly_Payroll_Setup form — all records, sorted by mps_payroll_period descending
- For each record: read mps_payroll_period, mps_status, mps_working_days, mps_public_holidays
- Count queue records per period to get employees, done, error, pending counts
- For Completed periods: sum pr_gross_salary, pr_net_salary, pr_monthly_tax_withheld, pr_employee_si_deduction from EP_Payroll_Results
- Financial totals = null for non-Completed periods

---

### portalGetQueueStatus

**Called by:** RunPayroll polling (every 30s when status = Processing), QueueMonitor (every 30s always)

**Purpose:** Returns the current MPS status and per-employee queue record state for a given period.

**Inputs:**
```json
{ "payroll_period": "2026-04" }
```

**Expected output:**
```json
{
  "status": "success",
  "mps_status": "Processing",
  "mps_working_days": 22,
  "progress": {
    "total": 10,
    "done": 3,
    "error": 2,
    "pending": 3,
    "processing": 2
  },
  "regular_run": {
    "summary": { "total": 10, "done": 3, "error": 2, "pending": 5 },
    "records": [
      { "employee_id": "EMP001", "status": "Done", "batch_number": 1, "processed_at": "09:15", "error": "" }
    ]
  },
  "termination_run": {
    "summary": { "total": 0, "done": 0, "error": 0, "pending": 0 },
    "records": []
  }
}
```

**Logic required:**
- Read EP_Monthly_Payroll_Setup where mps_payroll_period = input period → get mps_status, mps_working_days
- Read EP_Regular_Queue where rq_payroll_period = input period → all records
- Read EP_Termination_Queue where tq_payroll_period = input period → all records
- Count statuses for progress and summary objects
- Return record arrays with employee_id, status, batch_number, processed_at, error fields

---

### portalGetPayrollRecords

**Called by:** RunPayroll/index.jsx on first selection of a run period — cached per period after that

**Purpose:** Returns per-employee computed payroll results (pr_* fields) for a given period. Used by the records panel expandable rows.

**Inputs:**
```json
{ "payroll_period": "2026-04" }
```

**Expected output:**
```json
{
  "status": "success",
  "period": "2026-04",
  "records": [
    {
      "employee_id": "EMP001",
      "status": "Done",
      "pr_basic_salary": 30000,
      "pr_total_allowances": 11000,
      "pr_gross_salary": 41000,
      "pr_employee_si_deduction": 3300,
      "pr_martyrs_fund": 20.5,
      "pr_absence_deduction": 0,
      "pr_unpaid_leave_deduction": 0,
      "pr_late_deduction": 0,
      "pr_total_deductions": 6120,
      "pr_net_salary": 34200,
      "pr_monthly_tax_withheld": 2800,
      "pr_ytd_tax_withheld": 8400,
      "error": ""
    }
  ]
}
```

**Logic required:**
- Read EP_Payroll_Results where pr_payroll_period = input period
- Also join with EP_Regular_Queue to get the queue status per employee
- Return all pr_* fields; set null for employees where calculation did not complete
- error field: populated from rq_error_message on the queue record

---

### portalGetPeriodReport

**Called by:** Reports/index.jsx on Generate button click

**Purpose:** Returns org-level aggregated financial totals for a completed period. Used exclusively by the Reports screen.

**Inputs:**
```json
{ "payroll_period": "2026-03" }
```

**Expected output:**
```json
{
  "status": "success",
  "period": "2026-03",
  "generated_at": "10:45",
  "summary": {
    "headcount": 43,
    "termination_count": 0,
    "total_gross": 1820000,
    "total_basic_salary": 1290000,
    "total_allowances": 530000,
    "total_net_salary": 1491000,
    "total_employee_si": 145600,
    "total_employer_si": 232400,
    "total_martyrs_fund": 910,
    "total_tax_withheld": 126000,
    "total_employer_cost": 2052400
  }
}
```

**Logic required:**
- Validate MPS record for period exists and status = Completed; return error if not
- Read all EP_Payroll_Results for the period — sum each pr_* field
- Read EP_Termination_Queue for the period — count Completed records
- total_employer_cost = total_gross + total_employer_si + total_martyrs_fund
- generated_at = current time at function execution

---

### portalCreateMPS

**Called by:** RunPayroll — Step 1 Setup, on "Create setup" button

**Purpose:** Creates a new EP_Monthly_Payroll_Setup record for the given period.

**Inputs:**
```json
{ "payroll_period": "2026-05" }
```

**Expected output (success):**
```json
{
  "status": "success",
  "period": "2026-05",
  "working_days": 22,
  "holidays": "Holiday Name",
  "message": "MPS created for 2026-05"
}
```

**Expected output (error — duplicate):**
```json
{
  "status": "error",
  "message": "A payroll run for 2026-05 already exists. Delete it before creating a new one."
}
```

**Logic required:**
- Check EP_Monthly_Payroll_Setup for existing record with mps_payroll_period = input period
- If exists → return error
- Calculate working days: calendar days in period minus weekends minus public holidays
- Read public holidays from ov_public_holidays org variable
- Create EP_Monthly_Payroll_Setup record: mps_payroll_period, mps_working_days, mps_public_holidays, mps_status = Draft
- Return period, working_days, holidays string

---

### portalUpdateMPS

**Called by:** RunPayroll — Step 2 Review, on working days Override save

**Purpose:** Updates the mps_working_days field on an existing MPS record.

**Inputs:**
```json
{ "payroll_period": "2026-04", "new_working_days": 20 }
```

**Expected output:**
```json
{
  "status": "success",
  "period": "2026-04",
  "working_days": 20,
  "message": "Working days updated to 20 for 2026-04"
}
```

**Logic required:**
- Fetch EP_Monthly_Payroll_Setup where mps_payroll_period = input period
- Update mps_working_days = new_working_days
- Return updated values

---

### portalTriggerOrchestrator

**Called by:** RunPayroll — Step 2 Review, on "Run payroll" button

**Purpose:** Enqueues all active employees into EP_Regular_Queue for the given period and triggers the orchestrator.

**Inputs:**
```json
{ "payroll_period": "2026-04" }
```

**Expected output (success):**
```json
{
  "status": "success",
  "period": "2026-04",
  "queued": 10,
  "batches": 2,
  "message": "Payroll run started — 10 employees queued in 2 batches"
}
```

**Expected output (error — lock conflict):**
```json
{
  "status": "error",
  "message": "Orchestrator is locked by another process. Wait 30 seconds and try again."
}
```

**Logic required:**
- Check orchestrator global lock (ov_orchestrator_lock) — return error if locked
- Fetch all active employees from Zoho People based on scope setting
- Create EP_Regular_Queue records per employee with rq_status = Pending, assign batch numbers
- Update MPS status to Processing
- Invoke runPayrollOrchestrator function
- Return queued count and batch count

---

### portalSaveSettings

**Called by:** Settings — Payroll Settings section and Portal Configuration section, on "Save Changes"

**Purpose:** Persists updated payroll settings and portal config back to org variables.

**Inputs:**
```json
{
  "payroll_settings": {
    "apply_insurance": true,
    "apply_tax": true,
    "scope": "all",
    "allow_working_days_override": true
  },
  "portal_config": {
    "allow_working_days_override": true
  }
}
```

**Expected output:**
```json
{ "status": "success", "message": "Settings saved successfully." }
```

**Logic required:**
- Validate inputs
- Update relevant org variables: ov_default_working_days, scope, apply_insurance, apply_tax flags
- Update portal config variable with allow_working_days_override
- Return success

---

### portalAddPortalUser

**Called by:** Settings — Portal Users section, on "Add User" button

**Purpose:** Adds an employee to the portal_users map in the portal config org variable.

**Inputs:**
```json
{ "employee_id": "EMP003", "role": "manager" }
```

**Expected output (success):**
```json
{
  "status": "success",
  "employee_id": "EMP003",
  "role": "manager",
  "message": "EMP003 added as manager",
  "portal_users": { "EMP001": "admin", "EMP002": "manager", "EMP003": "manager" }
}
```

**Expected output (error — duplicate):**
```json
{
  "status": "error",
  "message": "EMP003 already has portal access as manager."
}
```

**Logic required:**
- Read current portal_users map from portal config org variable
- Check if employee_id already exists → return error if so
- Add employee_id: role to the map
- Write updated map back to org variable
- Return updated portal_users map

---

### portalRemovePortalUser

**Called by:** Settings — Portal Users section, on "Remove" button per user row

**Purpose:** Removes an employee from the portal_users map in the portal config org variable.

**Inputs:**
```json
{ "employee_id": "EMP002" }
```

**Expected output:**
```json
{
  "status": "success",
  "employee_id": "EMP002",
  "message": "EMP002 removed from portal access",
  "portal_users": { "EMP001": "admin" }
}
```

**Logic required:**
- Read current portal_users map from portal config org variable
- Remove the employee_id key
- Write updated map back to org variable
- Prevent removing the last admin — return error if attempting to remove the only admin
- Return updated portal_users map
