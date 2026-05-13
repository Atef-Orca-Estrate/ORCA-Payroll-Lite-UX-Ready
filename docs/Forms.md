# ORCA Payroll Lite 2.0 — Form & Field Reference

All records are created exclusively through the web tab or Deluge functions.
No manual record creation is permitted through the native Zoho People UI.

> **Document ownership:** Sections marked `[FRONTEND]` are maintained by the frontend team.
> Sections marked `[BACKEND]` are maintained by the backend/Deluge team.
> Each team adds notes to their own section only.

---

## P_Employee — Custom Fields

Added to the native Zoho People `P_Employee` form as custom fields.

---

### [BACKEND] Payroll Engine Fields (8 fields)

Written by HR or onboarding. Read by `runPayrollOrchestrator` and `processTerminationRun`.

| API Name | Zoho Type | Required | Default | Notes |
|---|---|:---:|---|---|
| `emp_basic_salary` | Decimal | Yes | — | Base monthly salary |
| `emp_housing_allowance` | Decimal | No | null → 0 | Null treated as 0 |
| `emp_transport_allowance` | Decimal | No | null → 0 | Null treated as 0 |
| `emp_medical_allowance` | Decimal | No | null → 0 | Null treated as 0 |
| `emp_other_allowances` | Decimal | No | null → 0 | Null treated as 0 |
| `emp_si_subscription_wage` | Decimal | No | null → gross | SI base wage if different from gross. Falls back to gross_salary if null or 0 |
| `emp_si_override` | Boolean | No | null | `null` = use org `apply_insurance`. `true`/`false` = per-employee override |
| `emp_tax_override` | Boolean | No | null | `null` = use org `apply_tax`. `true`/`false` = per-employee override |

**Override resolution (batch + termination path):**
```
effective_apply_insurance = (emp_si_override  != null) ? emp_si_override  : apply_insurance
effective_apply_tax       = (emp_tax_override != null) ? emp_tax_override : apply_tax
```
`emp_si_override` and `emp_tax_override` are captured in `pq_employee_snapshot` — `processPayrollBatch` never re-reads P_Employee.

---

### [FRONTEND] Salary Reference Fields (3 fields)

Read by `portalListEmployees` for the Employees screen salary reference tiles.
Not written by any gateway function — source is `P_Salary` form (most recent record per employee).

| P_Salary Field | Returned As | Notes |
|---|---|---|
| `BasicSalary` | `pr_basic_salary` | Profile reference value — not period-specific |
| `GrossSalary` | `pr_gross_salary` | Profile reference value |
| `NetSalary` | `pr_net_salary` | Profile reference value |

---

## Employee_Payroll_Config — New Form

### [FRONTEND]

Custom form created to store per-employee payroll exclusion flags.
Written by `portalUpdateEmployee`. Read by `portalListEmployees`.
One record per employee — upserted (create if not exists, update if exists).

| API Name | Zoho Type | Default | Notes |
|---|---|---|---|
| `epc_employee` | Text | — | Employee ID — used as the search key |
| `epc_exclude_si` | Boolean | `false` | Exclude employee from Social Insurance deduction |
| `epc_exclude_martyrs_fund` | Boolean | `false` | Exclude employee from Martyrs' Fund contribution |
| `epc_exclude_income_tax` | Boolean | `false` | Exclude employee from monthly income tax withholding |

### [BACKEND]

> _Add backend notes here — e.g. whether these flags need to feed into the payroll engine calculation, override resolution logic, or interaction with `emp_si_override` / `emp_tax_override`._

---

## Monthly_Payroll_Setup (MPS)

One record per payroll run. Created by `portalCreateMPS`.

---

### [BACKEND] Engine Fields (10 fields)

Controls the run. Orchestrator reads it; batch processor updates progress counters.

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `mps_payroll_period` | Text | portalCreateMPS | `"YYYY-MM"` |
| `mps_working_days` | Integer | portalCreateMPS / portalUpdateMPS | Full calendar working days. Source: `.workDaysBetween()` (zoho) or attendance default (manual) |
| `mps_public_holidays` | Multi-line Text | portalCreateMPS / portalUpdateMPSHolidays | **Backend path:** one `"YYYY-MM-DD Name"` per line — parsed to Date list by Orchestrator. **Frontend path:** stored as JSON string `[{"date":"...","name":"..."}]` — see Frontend section |
| `mps_payslip_issue_date` | Date | portalCreateMPS | Auto-set to zoho.currenttime. Copied into every `pr_payslip_issue_date` |
| `mps_status` | Text | portalCreateMPS / runPayrollOrchestrator / processPayrollBatch | `Draft` → `Processing` → `Completed` |
| `mps_progress_total` | Integer | runPayrollOrchestrator | Total employees queued — set once at end of STEP 10 |
| `mps_progress_done` | Integer | processPayrollBatch | Incremented per batch on successful records |
| `mps_progress_error` | Integer | processPayrollBatch | Incremented per batch on errored records |
| `mps_created_by` | Text | portalCreateMPS | `zoho.loginuserid` of the HR user |
| `mps_created_at` | Text | portalCreateMPS | Timestamp `"yyyy-MM-dd HH:mm:ss"` |

**Status flow:**
```
portalCreateMPS        → mps_status = Draft
runPayrollOrchestrator → mps_status = Processing  (STEP 2)
processPayrollBatch    → mps_status = Completed   (STEP 6, when 0 Pending remain)
```

---

### [FRONTEND] Scope & Financial Summary Fields (8 fields — new)

Written by `portalCreateMPS`. Read by `portalListRuns`.
Scope is the source of truth for which employees are in a run — stored on the MPS record, not in org variables.

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `mps_scope` | Text | portalCreateMPS | `"all"` \| `"by_department"` \| `"by_employee"` |
| `mps_selected_department` | Text | portalCreateMPS | Department name. Empty string when scope ≠ by_department |
| `mps_selected_employees` | Multi-line Text | portalCreateMPS | JSON array string of employee IDs. Empty array `[]` when scope ≠ by_employee |
| `mps_batches` | Integer | runPayrollOrchestrator | Total batch count — set when orchestrator queues employees |
| `mps_gross` | Decimal | runPayrollOrchestrator / processPayrollBatch | Total gross salary for the run. `null` until status = Completed |
| `mps_net` | Decimal | runPayrollOrchestrator / processPayrollBatch | Total net salary. `null` until Completed |
| `mps_tax` | Decimal | runPayrollOrchestrator / processPayrollBatch | Total tax withheld. `null` until Completed |
| `mps_si` | Decimal | runPayrollOrchestrator / processPayrollBatch | Total employee SI deduction. `null` until Completed |

**Holiday storage note:** `mps_public_holidays` stores holidays as a JSON array string `[{"date":"YYYY-MM-DD","name":"string"}]` in the frontend path. The backend engine must handle both formats (text lines for legacy records, JSON array for new records created via `portalCreateMPS`).

---

## Payroll_Queue (17 fields)

One record per employee per run (regular) or per termination event.

---

### [BACKEND] (17 fields)

Written by Orchestrator and `onEmployeeTermination`. Updated by `processPayrollBatch` and `processTerminationRun`.

#### Group 1 — Identity

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_employee_id` | Text | Orchestrator / onEmployeeTermination | EmployeeID string — not a lookup field |
| `pq_payroll_period` | Text | Orchestrator / onEmployeeTermination | `"YYYY-MM"` — used by `portalGetQueueStatus` query |
| `pq_is_final_settlement` | Boolean | Orchestrator / onEmployeeTermination | `false` = regular batch. `true` = termination |

#### Group 2 — Routing

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_batch_number` | Integer | Orchestrator | Regular path only. `null` for termination records |
| `pq_queue_at` | DateTime | Orchestrator | Set on first record of each batch. Workflow A fires at this time |
| `pq_exit_date` | Date | onEmployeeTermination | Termination path only. `null` for regular records |

#### Group 3 — Lifecycle

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_status` | Select | All functions | `Pending` → `Processing` → `Done` / `Error` / `Cancelled` |
| `pq_queued_at` | DateTime | Orchestrator / onEmployeeTermination | Timestamp when record was created |
| `pq_processed_at` | DateTime | processPayrollBatch / processTerminationRun | Timestamp when Done or Error set |
| `pq_error` | Multi-line Text | processPayrollBatch / processTerminationRun | Error message truncated to 500 chars. Empty when status ≠ Error |

#### Group 4 — Snapshots

`null` for termination records. `processTerminationRun` reads P_Employee and YTD directly.

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_employee_snapshot` | Multi-line Text | Orchestrator | JSON: basic_salary, total_allowances, gross_salary, subscription_wage, hire_month, hire_year, emp_si_override, emp_tax_override |
| `pq_ytd_snapshot` | Multi-line Text | Orchestrator | JSON: ytd_gross, ytd_tax_withheld |
| `pq_absent_days` | Integer | Orchestrator | Aggregated from bulk attendance API |
| `pq_late_minutes` | Integer | Orchestrator | Total late minutes for the period |
| `pq_overtime_hours` | Decimal | Orchestrator | Total OT hours for the period |
| `pq_ph_days_worked` | Integer | Orchestrator | Public holiday days worked |
| `pq_unpaid_leave_days` | Decimal | processPayrollBatch | Fetched live per employee inside batch loop |

**Status flow:**
```
Regular:
  Orchestrator          → pq_status = Pending
  processPayrollBatch   → pq_status = Processing → Done / Error
  onEmployeeTermination → pq_status = Cancelled (existing Pending regular record)

Termination:
  onEmployeeTermination → pq_status = Pending
  processTerminationRun → pq_status = Done / Error
```

---

### [FRONTEND] Fields read by gateway functions

`portalGetQueueStatus` reads and enriches these fields for the web tab:

| Field read | Returned as | Notes |
|---|---|---|
| `pq_employee_id` | `employee_id` | Used as enrichment key to look up name + department |
| `pq_status` | `status` | Displayed as status chip |
| `pq_batch_number` | `batch_number` | Used to group records into collapsible batch sections |
| `pq_processed_at` | `processed_at` | Displayed as `"HH:MM"` string |
| `pq_error` | `error` | Displayed inline under the employee row |
| `pq_is_final_settlement` | — | Used to route record to `regular_run` or `termination_run` block |

`employee_name` and `department` are **not** stored on the queue record — they are enriched at response time by `portalGetQueueStatus` via the Zoho People employee API.

---

## Monthly_Payroll_Record (41+ fields)

One record per employee per period. Written by `processPayrollBatch` and `processTerminationRun`.

---

### [BACKEND] Engine Fields (41 fields)

On rerun: existing record converted to Draft, new Final record written in its place.

#### Group 1 — Identity (5 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_employee` | Text | EmployeeID string |
| `pr_payroll_period` | Text | `"YYYY-MM"` |
| `pr_payslip_issue_date` | Date | Copied from `mps_payslip_issue_date` |
| `pr_status` | Select | `Draft` / `Final` |
| `pr_is_final_settlement` | Boolean | `false` = regular. `true` = termination |

#### Group 2 — Salary (3 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_basic_salary` | Decimal | Full month value from snapshot |
| `pr_total_allowances` | Decimal | Sum of all 4 allowances |
| `pr_gross_salary` | Decimal | Pro-rated on termination. Full month on regular |

#### Group 3 — Social Insurance (6 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_si_subscription_wage` | Decimal | Pro-rated on termination |
| `pr_si_capped_wage` | Decimal | subscription_wage capped at monthly_ceiling |
| `pr_si_monthly_ceiling` | Decimal | From config at run time — stored for audit trail |
| `pr_employee_si_deduction` | Decimal | 11% of capped_wage. 0 if effective_apply_insurance = false |
| `pr_martyrs_fund` | Decimal | 0.05% of gross. 0 for Sole Proprietorship |
| `pr_employer_si` | Decimal | 18.75% of capped_wage — company cost. Used in period cost report |

#### Group 4 — Income Tax (5 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_monthly_personal_exemption` | Decimal | EGP 20,000 / 12 |
| `pr_monthly_net_taxable` | Decimal | gross − employee_si − martyrs_fund − monthly_exemption |
| `pr_annual_net_taxable` | Decimal | monthly_net × months_remaining (forward annualisation) |
| `pr_annual_tax` | Decimal | From bracket lookup |
| `pr_monthly_tax` | Decimal | annual_tax / months_remaining. 0 if effective_apply_tax = false |

#### Group 5 — Attendance Inputs (6 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_working_days` | Integer | Full month working days from MPS |
| `pr_absent_days` | Integer | From snapshot (batch) or attendance API (termination) |
| `pr_unpaid_leave_days` | Decimal | From snapshot (batch) or leave API (termination) |
| `pr_late_minutes` | Integer | From snapshot (batch) or attendance API (termination) |
| `pr_overtime_hours` | Decimal | From snapshot (batch) or attendance API (termination) |
| `pr_ph_days_worked` | Integer | Public holiday days worked |

#### Group 6 — Attendance Adjustments (6 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_absence_deduction` | Decimal | daily_rate × absent_days |
| `pr_unpaid_leave_deduction` | Decimal | daily_rate × unpaid_leave_days |
| `pr_late_deduction` | Decimal | minute_rate × late_minutes |
| `pr_overtime_addition` | Decimal | hourly_rate × multiplier × overtime_hours |
| `pr_public_holiday_addition` | Decimal | Based on `ATTENDANCE_RULES_JSON.public_holiday.if_worked` mode |
| `pr_total_attendance_adjustment` | Decimal | Net of all 5 above. Can be negative |

#### Group 7 — Totals and Net (3 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_total_deductions` | Decimal | employee_si + martyrs_fund + monthly_tax + absence + unpaid_leave + late |
| `pr_total_additions` | Decimal | overtime_addition + public_holiday_addition |
| `pr_net_salary` | Decimal | gross − total_deductions + total_additions. Floored at 0 |

#### Group 8 — YTD (2 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_ytd_gross` | Decimal | Cumulative gross this calendar year |
| `pr_ytd_tax_withheld` | Decimal | Cumulative tax withheld this calendar year |

#### Group 9 — Termination (1 field)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_final_settlement_days_worked` | Integer | Actual days worked in partial month. `null` for regular records |

#### Group 10 — Audit and Rerun (4 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_is_rerun` | Boolean | `true` when overwriting a prior Final record |
| `pr_run_sequence` | Integer | `null` on first write. Incremented on each rerun |
| `pr_rerun_reason` | Text | Short description set on rerun conversion |
| `pr_generated_at` | DateTime | `zoho.currenttime` at record write time |

**Rerun logic:**
```
On rerun (existing Final record found for same employee + period + is_final_settlement=false):
  1. Existing record → pr_status = Draft, pr_is_rerun = true, pr_run_sequence += 1
  2. New record written with pr_status = Final, pr_is_rerun = true
```

---

### [FRONTEND] Fields read and aliased by gateway functions

`portalGetPayrollRecords` reads these fields and builds the Records Panel in the web tab.
`employee_name` and `department` are **not** stored on the record — enriched at response time.

| Zoho field | Returned as | Notes |
|---|---|---|
| `pr_employee` | `employee_id` | Enrichment key — name and dept fetched from Zoho People |
| `pr_status` (`Final`) | `status: "Done"` | `Final` is mapped to `"Done"` in the gateway response |
| `pr_basic_salary` | `pr_basic_salary` | `null` when status ≠ Done |
| `pr_total_allowances` | `pr_total_allowances` | `null` when status ≠ Done |
| `pr_gross_salary` | `pr_gross_salary` | `null` when status ≠ Done |
| `pr_employee_si_deduction` | `pr_employee_si_deduction` | `null` when status ≠ Done |
| `pr_martyrs_fund` | `pr_martyrs_fund` | `null` when status ≠ Done |
| `pr_absence_deduction` | `pr_absence_deduction` | `null` when status ≠ Done |
| `pr_unpaid_leave_deduction` | `pr_unpaid_leave_deduction` | `null` when status ≠ Done |
| `pr_late_deduction` | `pr_late_deduction` | `null` when status ≠ Done |
| `pr_net_salary` | `pr_net_salary` | `null` when status ≠ Done |
| `pr_monthly_tax` | **`pr_monthly_tax_withheld`** | Field is renamed in the response — frontend key is `pr_monthly_tax_withheld` |
| `pr_ytd_tax_withheld` | `pr_ytd_tax_withheld` | `null` when status ≠ Done |
| `pr_error` | `error` | Always included. Empty string when no error |
| `pr_total_deductions` | `pr_total_deductions` | Computed in gateway if not stored: `employee_si + martyrs_fund + absence + unpaid_leave + late` |

**`pr_mps_id` field required (new):**
To support `run_id` filtering in `portalGetPayrollRecords` (needed when `allow_multiple_runs = true`), each `Monthly_Payroll_Record` needs a field linking it to its MPS record:

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pr_mps_id` | Text | processPayrollBatch | Zoho record ID of the parent MPS record. Used by `portalGetPayrollRecords` to filter records by run when multiple runs exist for the same period |

> **Backend action required:** `processPayrollBatch` must write `pr_mps_id` when creating each `Monthly_Payroll_Record`.

---

## Field Count Summary

| Form | Fields | Owner |
|---|---|---|
| P_Employee — engine custom fields | 8 | Backend |
| P_Employee — salary reference (from P_Salary) | 3 | Frontend reads |
| Employee_Payroll_Config | 4 | Frontend |
| Monthly_Payroll_Setup — engine fields | 10 | Backend |
| Monthly_Payroll_Setup — scope + financial summary | 8 | Frontend |
| Payroll_Queue | 17 | Backend (frontend reads 6) |
| Monthly_Payroll_Record — engine fields | 41 | Backend |
| Monthly_Payroll_Record — `pr_mps_id` (new) | 1 | Backend writes, Frontend reads |
| **Total** | **92** | |
