# Backend Functions Specification

[BACKEND]

> Payroll Engine — Orca Payroll Lite 2.0
> Last updated: 2026-05-13 (post engine-alignment session)
>
> These three functions form the payroll processing pipeline.
> They are never called directly by the frontend.
> Entry point is always `runPayrollOrchestrator`, triggered by the gateway function `portalTriggerOrchestrator`.

---

## Table of Contents

1. [runPayrollOrchestrator](#1-runpayrollorchestrator)
2. [processPayrollBatch](#2-processpayrollbatch)
3. [calculateEmployeePayroll](#3-calculateemployeepayroll)
4. [Data Flow Overview](#4-data-flow-overview)
5. [Forms Written Summary](#5-forms-written-summary)
6. [Org Variables Read Summary](#6-org-variables-read-summary)

---

## 1. runPayrollOrchestrator

**Type:** Deluge function
**Called by:** `portalTriggerOrchestrator` (gateway)
**Trigger:** Manual — HR clicks "Trigger" in Run Payroll wizard

### Inputs

| Parameter | Type | Description |
|---|---|---|
| `payroll_period` | String `"YYYY-MM"` | The payroll month to process |
| `run_id` | String | MPS record ID (passed by gateway for lock-error retry path) |

> `payroll_period` is the primary key. `run_id` passed by gateway for future direct-ID support.

### Steps

**STEP 0 — Global lock check**
- Reads `PAYROLL_SETTINGS_JSON.active_settings.payroll_run.lock` via org variable API
- If `lock == true` → returns error immediately (no lock acquired)
- Sets `lock = true` and writes back to `PAYROLL_SETTINGS_JSON` before any other work
- All early-return paths release the lock before returning

**STEP 1 — Validate MPS record**
- Queries `Monthly_Payroll_Setup` by `mps_payroll_period`
- Guard: no record found → release lock, return error
- Reads `mps_status` — accepted values: `"Draft"` or `"Ready"` (legacy compat)
- Any other status → release lock, return error
- Reads `mps_working_days` — must be > 0 or release lock, return error

**STEP 2 — Set MPS status → Processing**
- Writes `mps_status = "Processing"` on the MPS record
- Done before any employee work so frontend polling shows live state immediately

**STEP 3 — Derive period boundaries**
- Splits `payroll_period` into `payroll_year` and `payroll_month`
- Computes `period_start` = `"YYYY-MM-01"`
- Computes `period_end` = last day of month (add 1 month, subtract 1 day)

**STEP 4 — Parse public holidays from MPS**
- Reads `mps_public_holidays` from the MPS record
- **JSON format** (current): `[{"date":"YYYY-MM-DD","name":"..."}]` — parsed via `toJSONList()`
- **Legacy format** (fallback): newline-separated `"YYYY-MM-DD name\n..."` — parsed via `split("\n")`
- Output: `public_holiday_dates` — List of Date objects for attendance comparison

**STEP 5 — Read run scope from MPS record**
- Reads `mps_scope` → `"all"` | `"by_department"` | `"by_employee"` (defaults to `"all"`)
- Reads `mps_selected_department` (String)
- Reads `mps_selected_employees` (JSON array string) → parsed to List via `toJSONList()`
- Reads `apply_insurance`, `entity_type` from `PAYROLL_SETTINGS_JSON.active_settings.social_insurance`
- Reads `apply_tax` from `PAYROLL_SETTINGS_JSON.active_settings.income_tax`

> Scope is owned by the MPS record — never read from `PAYROLL_SETTINGS_JSON.payroll_run`.

**STEP 6 — Build employee list + profile snapshot**
- Paginates `P_Employee` API (200/call, max 20 pages = 4,000 employees)
- Applies scope filter per employee:
  - `by_department`: skip if `Department != selected_dept`
  - `by_employee`: skip if `EmployeeID` not in `selected_emps`
  - `all`: no filter
- Captures per-employee profile snapshot into `emp_map` (keyed by `EmployeeID`):

| Snapshot Field | Source | Notes |
|---|---|---|
| `basic_salary` | `emp_basic_salary` | Decimal |
| `total_allowances` | Sum of housing + transport + medical + other | Computed |
| `gross_salary` | `basic_salary + total_allowances` | Computed |
| `subscription_wage` | `emp_si_subscription_wage` or `gross_salary` | SI base |
| `hire_month` | `DateofJoining.month()` | Integer |
| `hire_year` | `DateofJoining.year()` | Integer |
| `emp_si_override` | `emp_si_override` | null / true / false |
| `emp_tax_override` | `emp_tax_override` | null / true / false |

- Guard: no employees found for scope → reset MPS to `"Draft"`, release lock, return error

**STEP 7 — Bulk YTD aggregation**
- Queries all `Monthly_Payroll_Record` with `pr_status = "Final"` (paginated, 200/call, max 50 pages)
- Filters to current calendar year by `pr_payroll_period` prefix
- Excludes termination records (`pr_is_final_settlement = true`)
- Builds `ytd_map` keyed by employee: `{ytd_gross, ytd_tax_withheld}`

**STEP 8 — Bulk attendance aggregation**
- Initialises all-zero `att_map` for every in-scope employee
- Calls Zoho People attendance API (`getUserReport`) paginated (100 employees/page, max 40 pages)
- For each employee × day in the period:
  - `Absent` status → increments `absent_days`
  - Positive `DeviationTime` → accumulates `late_minutes` (negative / early arrival excluded)
  - `OverTime` → accumulates `overtime_hours`
  - Day key matches `public_holiday_dates` → increments `ph_days_worked`
- Result per employee: `{absent_days, late_minutes, overtime_hours, ph_days_worked}`

> `unpaid_leave_days` is NOT collected here — fetched live per employee in `processPayrollBatch` (reduces orchestrator runtime).

**STEP 9 — Write Payroll_Queue records**
- Batches of 10 employees per batch
- First record in each batch gets `pq_queue_at` set → fires Workflow A time trigger
- Batch trigger times staggered: batch 1 fires in +1 min, batch N fires in +(1 + (N-1)×3) min
- Fields written per queue record:

| Field | Value |
|---|---|
| `pq_employee_id` | EmployeeID |
| `pq_payroll_period` | payroll_period |
| `pq_mps_id` | MPS record ID (links queue to its specific run) |
| `pq_batch_number` | Integer (1-based) |
| `pq_is_final_settlement` | false |
| `pq_status` | `"Pending"` |
| `pq_queued_at` | current datetime |
| `pq_employee_snapshot` | JSON string of emp_map entry |
| `pq_ytd_snapshot` | JSON string of `{ytd_gross, ytd_tax_withheld}` |
| `pq_absent_days` | Integer |
| `pq_late_minutes` | Integer |
| `pq_overtime_hours` | Decimal |
| `pq_ph_days_worked` | Integer |
| `pq_queue_at` | trigger datetime (first record of batch only) |

- Computes `total_batches = batch_pos > 0 ? batch_number : batch_number - 1`

**STEP 10 — Update MPS progress counters**
- Writes to MPS record:

| Field | Value |
|---|---|
| `mps_progress_total` | total employees queued |
| `mps_progress_done` | 0 |
| `mps_progress_error` | 0 |
| `mps_batches` | total batch count |

**STEP 11 — Release global lock**
- Writes `lock = false` back to `PAYROLL_SETTINGS_JSON.active_settings.payroll_run`

### Output

```json
{
  "status":  "success" | "error",
  "period":  "YYYY-MM",
  "queued":  Integer,
  "batches": Integer,
  "message": "String (on error only)"
}
```

### Error conditions

| Condition | MPS reset | Lock released |
|---|---|---|
| Lock already active | — | No (lock not acquired) |
| No MPS record found | — | Yes |
| MPS status not Draft/Ready | — | Yes |
| `mps_working_days` ≤ 0 | — | Yes |
| No employees in scope | → `"Draft"` | Yes |

---

## 2. processPayrollBatch

**Type:** Deluge function
**Called by:** Workflow A (time-based trigger on `Payroll_Queue.pq_queue_at`)
**Trigger condition:** `pq_queue_at` is not empty AND `pq_is_final_settlement = false`
**Runs once per batch** — Workflow A fires on the first record of each batch

### Inputs

| Parameter | Type | Source field on queue record |
|---|---|---|
| `batch_number` | Integer | `pq_batch_number` |
| `payroll_period` | String `"YYYY-MM"` | `pq_payroll_period` |

### Steps

**STEP 1 — Load all config once (not per employee)**
- Reads `PAYROLL_SETTINGS_JSON`:
  - `apply_insurance` (Boolean)
  - `entity_type` (`"Legal Entity"` | `"Sole Proprietorship"`)
  - `apply_tax` (Boolean)
  - `active_settings.social_insurance.monthly_ceiling` → H-1 overlay onto `si_config` if present and > 0
  - `active_settings.attendance` → H-2 overlay onto `att_rules` (multipliers, grace_minutes, if_worked)
- Reads `SI_CONFIG_JSON` (only if `apply_insurance = true`):
  - `monthly_ceiling`, `employee_rate`, `employer_rate`, `martyrs_fund_rate`
  - **H-1**: if `PAYROLL_SETTINGS_JSON` has `social_insurance.monthly_ceiling`, overwrites `si_config.monthly_ceiling`
- Reads `TAX_CONFIG_JSON`, `TAX_BRACKETS_STD_JSON`, `TAX_BRACKETS_HI_JSON` (only if `apply_tax = true`)
- Reads `ATTENDANCE_RULES_JSON`:
  - **H-2**: overlays from `PAYROLL_SETTINGS_JSON.active_settings.attendance`:
    - `absence.multiplier`
    - `unpaid_leave.multiplier`
    - `late_deduction.multiplier` and `late_deduction.grace_minutes`
    - `overtime.multiplier`
    - `public_holiday.if_worked`

**STEP 2 — Read MPS record**
- Probes one queue record for `pq_mps_id` to identify the specific MPS run
- If `pq_mps_id` is present → fetches MPS by record ID (`getRecordById`) — accurate when `allow_multiple_runs = true`
- If `pq_mps_id` is absent (legacy) → queries by `mps_payroll_period` (first match)
- Extracts: `mps_id`, `working_days`, `payslip_issue_date`, `payroll_year`

**STEP 3 — Fetch batch queue records**
- Queries `Payroll_Queue` by `pq_batch_number` AND `pq_status = "Pending"`
- Returns up to 10 records (one batch)
- Guard: 0 records → already processed, return early

**STEP 4 — Per-employee loop**

Each employee in the batch:

**4. Mark Processing** — writes `pq_status = "Processing"` immediately to prevent duplicate processing if Workflow A fires twice

**4a. Parse snapshot** — reads from queue record (zero extra API calls):
- `emp_snap.get("basic_salary")` → `emp_basic_salary`
- `emp_snap.get("total_allowances")`
- `emp_snap.get("gross_salary")`
- `emp_snap.get("subscription_wage")`
- `emp_snap.get("hire_month")`, `hire_year`
- `emp_snap.get("emp_si_override")`, `emp_snap.get("emp_tax_override")`
- `ytd_snap.get("ytd_gross")`, `ytd_snap.get("ytd_tax_withheld")`
- Flat attendance: `pq_absent_days`, `pq_late_minutes`, `pq_overtime_hours`, `pq_ph_days_worked`

Resolves effective flags:
- `effective_apply_insurance = emp_si_override ?? apply_insurance`
- `effective_apply_tax = emp_tax_override ?? apply_tax`

**4a-2. Fetch unpaid leave (live)** — 1 `invokeUrl` per employee:
- Calls `zoho.people.api/leave/v2/getLeaveDetails` for the period, type `"UNPAID"`
- Sums `noOfDays` across all matching leave records → `unpaid_leave_days`

**4b. Call calculateEmployeePayroll** — 1 `invokeUrl` per employee:
- Passes all snapshot values + config maps (as JSON strings) as parameters
- Returns combined result map (SI + Tax + Attendance blocks)

**4c. Compute final net**
```
total_deductions = total_employee_deduction + monthly_tax
                 + absence_deduction + unpaid_leave_deduction + late_deduction

total_additions  = overtime_addition + public_holiday_addition

net_salary = max(gross_salary - total_deductions + total_additions, 0)
```

**4d. Rerun check**
- Queries `Monthly_Payroll_Record` by `pr_employee + pr_payroll_period + pr_is_final_settlement = false`
- If existing record found → sets it to `pr_status = "Draft"`, `pr_is_rerun = true`, increments `pr_run_sequence`
- Reuses the same record ID (`target_record_id`)

**4e. Write Monthly_Payroll_Record**

| Field | Value |
|---|---|
| `pr_employee` | EmployeeID |
| `pr_payroll_period` | payroll_period |
| `pr_mps_id` | mps_id (links record to its specific run) |
| `pr_payslip_issue_date` | from MPS |
| `pr_basic_salary` | from snapshot |
| `pr_total_allowances` | from snapshot |
| `pr_gross_salary` | from snapshot |
| `pr_si_subscription_wage` | from calc result |
| `pr_si_capped_wage` | from calc result |
| `pr_si_monthly_ceiling` | from calc result |
| `pr_employee_si_deduction` | from calc result |
| `pr_martyrs_fund` | from calc result |
| `pr_employer_si` | from calc result |
| `pr_monthly_personal_exemption` | from calc result |
| `pr_monthly_net_taxable` | from calc result |
| `pr_annual_net_taxable` | from calc result |
| `pr_annual_tax` | from calc result |
| `pr_monthly_tax` | from calc result |
| `pr_working_days` | from MPS |
| `pr_absent_days` | from snapshot |
| `pr_unpaid_leave_days` | fetched live |
| `pr_late_minutes` | from snapshot |
| `pr_overtime_hours` | from snapshot |
| `pr_ph_days_worked` | from snapshot |
| `pr_absence_deduction` | from calc result |
| `pr_unpaid_leave_deduction` | from calc result |
| `pr_late_deduction` | from calc result |
| `pr_overtime_addition` | from calc result |
| `pr_public_holiday_addition` | from calc result |
| `pr_total_attendance_adjustment` | from calc result |
| `pr_total_deductions` | computed |
| `pr_total_additions` | computed |
| `pr_net_salary` | computed |
| `pr_ytd_gross` | ytd_gross + gross_salary |
| `pr_ytd_tax_withheld` | ytd_tax_withheld + monthly_tax |
| `pr_status` | `"Final"` |
| `pr_is_final_settlement` | false |
| `pr_is_rerun` | true if rerun |
| `pr_generated_at` | current datetime |

**4f. Mark queue Done**
- Writes `pq_status = "Done"`, `pq_processed_at` = current datetime

**4 (catch). Error path**
- Writes `pq_status = "Error"`, `pq_error` = truncated exception string
- Writes a `Monthly_Payroll_Record` with:
  - `pr_status = "Error"`, `pr_mps_id = mps_id`, `pr_employee`, `pr_payroll_period`
  - `pr_error` = truncated exception string
  - All financial fields absent (null)
  - This allows the frontend records panel to display an error row for the employee

**STEP 5 — Update MPS progress counters (concurrent safe)**
- Re-fetches MPS fresh (other batches may have written concurrently)
- Increments `mps_progress_done` and `mps_progress_error` by this batch's counts

**STEP 6 — Completion check**
- Queries all `Payroll_Queue` records for the period with `pq_status = "Pending"`
- Filters in-memory by `pq_mps_id` to count only records belonging to THIS run
- If count = 0 → all batches for this run are complete:
  - Queries `Monthly_Payroll_Record` for period + `pr_status = "Final"`
  - Filters by `pr_mps_id` in-memory
  - Aggregates: `mps_gross`, `mps_net`, `mps_tax`, `mps_si`
  - Writes to MPS: `mps_status = "Completed"`, all four financial totals
- If count > 0 → other batches still running, no action

### Output

No return value — all output is written to Zoho People forms (`Monthly_Payroll_Record`, `Payroll_Queue`, `Monthly_Payroll_Setup`).

---

## 3. calculateEmployeePayroll

**Type:** Deluge function
**Called by:** `processPayrollBatch` only (1 call per employee)
**Purpose:** Merged SI + Tax + Attendance calculation in a single function body (eliminates 3 separate function calls per employee)

### Inputs

All config maps are passed as JSON strings from `processPayrollBatch` and converted to Maps internally.

| Parameter | Type | Source |
|---|---|---|
| `employee_id` | String | queue snapshot |
| `gross_salary` | Decimal | queue snapshot |
| `subscription_wage` | Decimal | queue snapshot (SI base; may differ from gross) |
| `hire_month` | Integer | queue snapshot |
| `hire_year` | Integer | queue snapshot |
| `payroll_year` | Integer | derived from payroll_period |
| `working_days` | Integer | `mps_working_days` |
| `absent_days` | Integer | queue snapshot |
| `unpaid_leave_days` | Decimal | fetched live in processPayrollBatch |
| `late_minutes` | Integer | queue snapshot |
| `overtime_hours` | Decimal | queue snapshot |
| `ph_days_worked` | Integer | queue snapshot |
| `apply_insurance` | Boolean | resolved effective flag |
| `apply_tax` | Boolean | resolved effective flag |
| `entity_type` | String | `"Legal Entity"` \| `"Sole Proprietorship"` |
| `si_config` | Map (JSON string) | SI_CONFIG_JSON, H-1 overlay applied |
| `tax_config` | Map (JSON string) | TAX_CONFIG_JSON |
| `tax_std` | Map (JSON string) | TAX_BRACKETS_STD_JSON |
| `tax_hi` | Map (JSON string) | TAX_BRACKETS_HI_JSON |
| `att_rules` | Map (JSON string) | ATTENDANCE_RULES_JSON, H-2 overlay applied |

### Blocks

**BLOCK 1 — Social Insurance**

If `apply_insurance = true`:
- `monthly_ceiling` from `si_config` (may be overridden via H-1)
- `capped_wage = min(subscription_wage, monthly_ceiling)`
- `employee_si = capped_wage × employee_rate`
- `employer_si = capped_wage × employer_rate`
- `martyrs_fund = gross_salary × martyrs_fund_rate` (Legal Entity only; 0 for Sole Proprietorship)

Outputs: `subscription_wage`, `monthly_ceiling`, `capped_wage`, `employee_si`, `employer_si`, `martyrs_fund`, `total_employee_deduction`, `total_employer_cost`

**BLOCK 2 — Income Tax (Forward Annualisation)**

Depends on BLOCK 1 (SI deductions reduce taxable income).

- `monthly_personal_exemption = personal_exemption_annual / 12`
- `monthly_net = gross_salary − employee_si − martyrs_fund − monthly_personal_exemption` (floor 0)

If `apply_tax = true`:
- `months_remaining = 13 − hire_month` (hire year) or `12` (all other years)
- `annual_net = monthly_net × months_remaining`
- Bracket selection: `annual_net ≤ 600,000` → `TAX_BRACKETS_STD_JSON`; above → `TAX_BRACKETS_HI_JSON`
- Bracket match: `annual_net > bracket.min AND ≤ bracket.max` (last tier has no max)
- `annual_tax = annual_net × rate − constant`; floor 0
- `monthly_tax = annual_tax / months_remaining`

Outputs: `monthly_personal_exemption`, `monthly_net_taxable`, `months_remaining`, `annual_net_taxable`, `annual_tax`, `monthly_tax`

**BLOCK 3 — Attendance Adjustments**

No dependency on BLOCKS 1 or 2 — operates on `gross_salary` only.

- `daily_rate = gross_salary / working_days`
- `hourly_rate = daily_rate / 8`
- `minute_rate = hourly_rate / 60`

| Adjustment | Enabled flag | Formula |
|---|---|---|
| `absence_deduction` | `att_rules.absence.enabled` | `daily_rate × absent_days × absence.multiplier` |
| `unpaid_leave_deduction` | `att_rules.unpaid_leave.enabled` | `daily_rate × unpaid_leave_days × unpaid_leave.multiplier` |
| `late_deduction` | `att_rules.late_deduction.enabled` | `minute_rate × max(late_minutes − grace_minutes, 0) × late_deduction.multiplier` |
| `overtime_addition` | `att_rules.overtime.enabled` | `hourly_rate × overtime.multiplier × overtime_hours` |
| `public_holiday_addition` | `att_rules.public_holiday.enabled` | mode-based (see below) |

Public holiday modes (`att_rules.public_holiday.if_worked`):
- `"overtime_rate"` → `daily_rate × overtime.multiplier × ph_days_worked`
- `"double_rate"` → `daily_rate × 2 × ph_days_worked`
- `"paid_day"` → 0 (employee already compensated by base salary)

Multiplier defaults: if any multiplier key is absent from `att_rules`, defaults to `1`. Grace minutes defaults to `0`.

`total_adjustment = overtime_addition + public_holiday_addition − absence_deduction − unpaid_leave_deduction − late_deduction`

> Net salary floor (≥ 0) is applied by `processPayrollBatch`, not here.

### Output Map

| Key | Block | Type |
|---|---|---|
| `employee_id` | — | String |
| `subscription_wage` | SI | Decimal |
| `monthly_ceiling` | SI | Decimal |
| `capped_wage` | SI | Decimal |
| `employee_si` | SI | Decimal |
| `employer_si` | SI | Decimal |
| `martyrs_fund` | SI | Decimal |
| `total_employee_deduction` | SI | Decimal |
| `total_employer_cost` | SI | Decimal |
| `monthly_personal_exemption` | Tax | Decimal |
| `monthly_net_taxable` | Tax | Decimal |
| `months_remaining` | Tax | Integer |
| `annual_net_taxable` | Tax | Decimal |
| `annual_tax` | Tax | Decimal |
| `monthly_tax` | Tax | Decimal |
| `daily_rate` | Att | Decimal (4dp) |
| `hourly_rate` | Att | Decimal (4dp) |
| `minute_rate` | Att | Decimal (4dp) |
| `absence_deduction` | Att | Decimal |
| `unpaid_leave_deduction` | Att | Decimal |
| `late_deduction` | Att | Decimal |
| `overtime_addition` | Att | Decimal |
| `public_holiday_addition` | Att | Decimal |
| `total_adjustment` | Att | Decimal |

---

## 4. Data Flow Overview

```
portalTriggerOrchestrator (gateway)
        │
        ▼
runPayrollOrchestrator
  Reads:  PAYROLL_SETTINGS_JSON (lock, apply_*, entity_type, si/att overlays)
          Monthly_Payroll_Setup  (scope, holidays, working_days)
          P_Employee API         (profiles, paginated)
          Monthly_Payroll_Record (YTD Final records, paginated)
          Attendance API         (bulk, paginated)
  Writes: PAYROLL_SETTINGS_JSON  (lock = true → false)
          Monthly_Payroll_Setup  (status=Processing, progress total, mps_batches)
          Payroll_Queue          (one record per employee, pq_mps_id set)
        │
        │  Workflow A fires once per batch (time-based on pq_queue_at)
        ▼
processPayrollBatch  [runs N times, once per batch of 10]
  Reads:  PAYROLL_SETTINGS_JSON  (apply_*, si/att overlays)
          SI_CONFIG_JSON, TAX_CONFIG_JSON, TAX_BRACKETS_*, ATTENDANCE_RULES_JSON
          Payroll_Queue          (pq_mps_id → MPS by ID)
          Monthly_Payroll_Setup  (working_days, payslip_issue_date)
          Leave API              (unpaid leave per employee)
          Monthly_Payroll_Record (rerun check)
  Writes: Payroll_Queue          (status=Processing/Done/Error)
          Monthly_Payroll_Record (Final or Error record, pr_mps_id set)
          Monthly_Payroll_Setup  (progress counters; on last batch: status=Completed, mps_gross/net/tax/si)
        │
        │  1 invokeUrl call per employee
        ▼
calculateEmployeePayroll
  Reads:  (nothing — all config passed as params)
  Writes: (nothing — returns result Map)
```

---

## 5. Forms Written Summary

### Monthly_Payroll_Setup (MPS)

| Field | Written by | Value |
|---|---|---|
| `mps_status` | Orchestrator | `"Processing"` (start); reset to `"Draft"` on abort |
| `mps_progress_total` | Orchestrator STEP 10 | Total employees queued |
| `mps_progress_done` | Orchestrator STEP 10 | 0 (reset) |
| `mps_progress_error` | Orchestrator STEP 10 | 0 (reset) |
| `mps_batches` | Orchestrator STEP 10 | Total batch count |
| `mps_progress_done` | processPayrollBatch STEP 5 | Incremented per batch |
| `mps_progress_error` | processPayrollBatch STEP 5 | Incremented per batch |
| `mps_status` | processPayrollBatch STEP 6 | `"Completed"` (last batch) |
| `mps_gross` | processPayrollBatch STEP 6 | Aggregated from Final records |
| `mps_net` | processPayrollBatch STEP 6 | Aggregated from Final records |
| `mps_tax` | processPayrollBatch STEP 6 | Aggregated from Final records |
| `mps_si` | processPayrollBatch STEP 6 | Aggregated from Final records |

### Payroll_Queue

| Field | Written by | Value |
|---|---|---|
| All `pq_*` fields | Orchestrator STEP 9 | See STEP 9 field table above |
| `pq_status` | processPayrollBatch | `"Processing"` → `"Done"` or `"Error"` |
| `pq_processed_at` | processPayrollBatch | Datetime on Done |
| `pq_error` | processPayrollBatch | Truncated exception on Error |

### Monthly_Payroll_Record

| Field | Written by | Value |
|---|---|---|
| All `pr_*` fields | processPayrollBatch STEP 4e | See STEP 4e field table above |
| `pr_mps_id` | processPayrollBatch STEP 4e | Links record to its specific run |
| `pr_status` | processPayrollBatch | `"Final"` (success) or `"Error"` (catch) |
| `pr_error` | processPayrollBatch (catch) | Truncated exception on Error |

---

## 6. Org Variables Read Summary

| Variable | Read by | Purpose |
|---|---|---|
| `PAYROLL_SETTINGS_JSON` | Orchestrator, processPayrollBatch | Lock, apply_*, entity_type, si/att overlays, social_insurance.monthly_ceiling |
| `SI_CONFIG_JSON` | processPayrollBatch | employee_rate, employer_rate, martyrs_fund_rate, monthly_ceiling (baseline) |
| `TAX_CONFIG_JSON` | processPayrollBatch | personal_exemption_annual |
| `TAX_BRACKETS_STD_JSON` | processPayrollBatch → calculateEmployeePayroll | Standard income brackets |
| `TAX_BRACKETS_HI_JSON` | processPayrollBatch → calculateEmployeePayroll | High-income brackets |
| `ATTENDANCE_RULES_JSON` | processPayrollBatch → calculateEmployeePayroll | enabled flags, multipliers, if_worked (baseline) |

> `PAYROLL_PORTAL_CONFIG` is not read by any engine function — gateway functions only.
> Org variables are read once per batch in processPayrollBatch and passed as params to calculateEmployeePayroll — zero variable reads inside the per-employee loop.

---

*End of Backend Functions Specification*
