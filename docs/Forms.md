# Orca Payroll Lit 2.0 — Form & Field Reference

All records are created exclusively through the web tab or Deluge functions.
No manual record creation is permitted through the native Zoho People UI.

---

## P_Employee — Custom Fields (8 fields)

Added to the native Zoho People P_Employee form as custom fields.
All written by HR or onboarding. Read by `runPayrollOrchestrator` and `processTerminationRun`.

| API Name | Zoho Type | Required | Default | Notes |
|---|---|:---:|---|---|
| `emp_basic_salary` | Decimal | Yes | — | Base monthly salary |
| `emp_housing_allowance` | Decimal | No | null → 0 | Fix A: null treated as 0 |
| `emp_transport_allowance` | Decimal | No | null → 0 | Fix A: null treated as 0 |
| `emp_medical_allowance` | Decimal | No | null → 0 | Fix A: null treated as 0 |
| `emp_other_allowances` | Decimal | No | null → 0 | Fix A: null treated as 0 |
| `emp_si_subscription_wage` | Decimal | No | null → gross | SI base wage if different from gross. Falls back to gross_salary if null or 0 |
| `emp_si_override` | Boolean | No | null | `null` = use org `apply_insurance`. `true`/`false` = per-employee override |
| `emp_tax_override` | Boolean | No | null | `null` = use org `apply_tax`. `true`/`false` = per-employee override |

### Override Resolution (batch + termination path)

```
effective_apply_insurance = (emp_si_override  != null) ? emp_si_override  : apply_insurance
effective_apply_tax       = (emp_tax_override != null) ? emp_tax_override : apply_tax
```

`emp_si_override` and `emp_tax_override` are captured in the Orchestrator's
`pq_employee_snapshot` — `processPayrollBatch` never re-reads P_Employee.

---

## Monthly_Payroll_Setup (10 fields)

Created by `portalCreateMPS`. One record per payroll period.
Controls the run — Orchestrator reads it, batch processor updates progress counters.

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `mps_payroll_period` | Text | portalCreateMPS | "YYYY-MM" — unique constraint per period |
| `mps_working_days` | Integer | portalCreateMPS / portalUpdateMPS | Full calendar working days in the month. Source: .workDaysBetween() (zoho) or HR JS calc (manual) |
| `mps_public_holidays` | Multi-line Text | portalCreateMPS | One "YYYY-MM-DD Name" per line. Parsed to Date list by Orchestrator and processTerminationRun |
| `mps_payslip_issue_date` | Date | portalCreateMPS | Auto-set to zoho.currenttime (run day). Copied into every pr_payslip_issue_date for the period |
| `mps_status` | Text | portalCreateMPS / runPayrollOrchestrator / processPayrollBatch | `Ready` → `Processing` → `Completed` |
| `mps_progress_total` | Integer | runPayrollOrchestrator | Total employees queued — set once at end of STEP 10 |
| `mps_progress_done` | Integer | processPayrollBatch | Incremented per batch on successful records |
| `mps_progress_error` | Integer | processPayrollBatch | Incremented per batch on errored records |
| `mps_created_by` | Text | portalCreateMPS | zoho.loginuserid of the HR user who triggered MPS creation |
| `mps_created_at` | Text | portalCreateMPS | Timestamp string "yyyy-MM-dd HH:mm:ss" |

### Status Flow

```
portalCreateMPS        → mps_status = Ready
runPayrollOrchestrator → mps_status = Processing  (STEP 2)
processPayrollBatch    → mps_status = Completed   (STEP 6, when 0 Pending remain)
```

---

## Payroll_Queue (17 fields)

One record per employee per run (regular) or per termination event.
Written by Orchestrator and onEmployeeTermination.
Updated by processPayrollBatch and processTerminationRun.

### Group 1 — Identity

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_employee_id` | Text | Orchestrator / onEmployeeTermination | EmployeeID string — not a lookup field |
| `pq_payroll_period` | Text | Orchestrator / onEmployeeTermination | "YYYY-MM" — used by portalGetQueueStatus query |
| `pq_is_final_settlement` | Boolean | Orchestrator / onEmployeeTermination | `false` = regular batch. `true` = termination. Workflow B condition on this field |

### Group 2 — Routing

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_batch_number` | Integer | Orchestrator | Regular path only. `null` for termination records |
| `pq_queue_at` | DateTime | Orchestrator | Set on first record of each batch only. Workflow A fires at this time. `null` for all other records and all termination records |
| `pq_exit_date` | Date | onEmployeeTermination | Termination path only. `null` for regular records. Passed to processTerminationRun as parameter |

### Group 3 — Lifecycle

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_status` | Select | All functions | `Pending` (gray) → `Processing` (amber) → `Done` (green) / `Error` (red) / `Cancelled` (blue) |
| `pq_queued_at` | DateTime | Orchestrator / onEmployeeTermination | Timestamp when record was created |
| `pq_processed_at` | DateTime | processPayrollBatch / processTerminationRun | Timestamp when Done or Error set |
| `pq_error` | Multi-line Text | processPayrollBatch / processTerminationRun | Error message truncated to 500 chars. Empty when status ≠ Error |

### Group 4 — Snapshots (Lit 2.0 — Orchestrator-written, batch-read only)

These fields are `null` for termination records.
`processTerminationRun` reads P_Employee and YTD directly — no snapshots needed.

| API Name | Zoho Type | Written By | Notes |
|---|---|---|---|
| `pq_employee_snapshot` | Multi-line Text | Orchestrator | JSON string: basic_salary, total_allowances, gross_salary, subscription_wage, hire_month, hire_year, emp_si_override, emp_tax_override |
| `pq_ytd_snapshot` | Multi-line Text | Orchestrator | JSON string: ytd_gross, ytd_tax_withheld |
| `pq_absent_days` | Integer | Orchestrator | Aggregated per employee from bulk attendance API call |
| `pq_late_minutes` | Integer | Orchestrator | Total late minutes for the full period |
| `pq_overtime_hours` | Decimal | Orchestrator | Total OT hours for the full period |
| `pq_ph_days_worked` | Integer | Orchestrator | Public holiday days worked |
| `pq_unpaid_leave_days` | Decimal | Orchestrator | From per-employee leave API fetch in Orchestrator STEP 9 |

### Status Flow

```
Regular path:
  Orchestrator            → pq_status = Pending
  processPayrollBatch     → pq_status = Processing   (on pick-up)
  processPayrollBatch     → pq_status = Done / Error (on completion)
  onEmployeeTermination   → pq_status = Cancelled    (existing Pending regular record)

Termination path:
  onEmployeeTermination   → pq_status = Pending
  Workflow B fires
  processTerminationRun   → pq_status = Done / Error (Step 15 — function owns queue closure)
```

---

## Monthly_Payroll_Record (41 fields)

One record per employee per period (regular) or per termination event.
Written by `processPayrollBatch` and `processTerminationRun`.
On rerun: existing record converted to Draft, new Final record written in its place.

### Group 1 — Identity (5 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_employee` | Text | EmployeeID string — not a lookup field |
| `pr_payroll_period` | Text | "YYYY-MM" |
| `pr_payslip_issue_date` | Date | Copied from `mps_payslip_issue_date` (run day) |
| `pr_status` | Select | `Draft` / `Final`. Draft only set during rerun conversion. |
| `pr_is_final_settlement` | Boolean | `false` = regular. `true` = termination |

### Group 2 — Salary (3 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_basic_salary` | Decimal | Full month value from emp snapshot / emp_rec |
| `pr_total_allowances` | Decimal | Sum of all 4 allowances — full month value |
| `pr_gross_salary` | Decimal | Pro-rated on termination. Full month on regular. |

### Group 3 — Social Insurance (6 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_si_subscription_wage` | Decimal | Pro-rated on termination |
| `pr_si_capped_wage` | Decimal | subscription_wage capped at monthly_ceiling |
| `pr_si_monthly_ceiling` | Decimal | From SI_CONFIG_JSON at run time — stored for audit trail |
| `pr_employee_si_deduction` | Decimal | 11% of capped_wage. 0 if effective_apply_insurance=false |
| `pr_martyrs_fund` | Decimal | 0.05% of gross. 0 for Sole Proprietorship or if apply_insurance=false |
| `pr_employer_si` | Decimal | 18.75% of capped_wage — company cost. Informational. Used in period cost report. |

### Group 4 — Income Tax (5 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_monthly_personal_exemption` | Decimal | EGP 20,000 / 12 |
| `pr_monthly_net_taxable` | Decimal | gross − employee_si − martyrs_fund − monthly_exemption |
| `pr_annual_net_taxable` | Decimal | monthly_net × months_remaining (forward annualisation) |
| `pr_annual_tax` | Decimal | From bracket lookup (STD or HI) |
| `pr_monthly_tax` | Decimal | annual_tax / months_remaining. 0 if effective_apply_tax=false |

### Group 5 — Attendance Inputs (6 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_working_days` | Integer | Full month working days from MPS — same for regular and termination |
| `pr_absent_days` | Integer | From snapshot (batch) or attendance API (termination) |
| `pr_unpaid_leave_days` | Decimal | From snapshot (batch) or leave API (termination) |
| `pr_late_minutes` | Integer | From snapshot (batch) or attendance API (termination) |
| `pr_overtime_hours` | Decimal | From snapshot (batch) or attendance API (termination) |
| `pr_ph_days_worked` | Integer | Public holiday days worked |

### Group 6 — Attendance Adjustments (6 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_absence_deduction` | Decimal | daily_rate × absent_days |
| `pr_unpaid_leave_deduction` | Decimal | daily_rate × unpaid_leave_days |
| `pr_late_deduction` | Decimal | minute_rate × late_minutes |
| `pr_overtime_addition` | Decimal | hourly_rate × multiplier × overtime_hours |
| `pr_public_holiday_addition` | Decimal | Based on ATTENDANCE_RULES_JSON.public_holiday.if_worked mode |
| `pr_total_attendance_adjustment` | Decimal | Net of all 5 above. Can be negative. |

### Group 7 — Totals and Net (3 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_total_deductions` | Decimal | employee_si + martyrs_fund + monthly_tax + absence + unpaid_leave + late |
| `pr_total_additions` | Decimal | overtime_addition + public_holiday_addition |
| `pr_net_salary` | Decimal | gross − total_deductions + total_additions. Floored at 0. |

### Group 8 — YTD (2 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_ytd_gross` | Decimal | Cumulative gross this calendar year including this record |
| `pr_ytd_tax_withheld` | Decimal | Cumulative tax withheld this calendar year including this record |

### Group 9 — Termination (1 field)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_final_settlement_days_worked` | Integer | Actual days worked in partial month via .workDaysBetween(). `null` for regular records. |

### Group 10 — Audit and Rerun (4 fields)

| API Name | Zoho Type | Notes |
|---|---|---|
| `pr_is_rerun` | Boolean | `true` when overwriting a prior Final record for the same period |
| `pr_run_sequence` | Integer | `null` on first write. Incremented on each subsequent rerun. |
| `pr_rerun_reason` | Text | Short description set on rerun conversion |
| `pr_generated_at` | DateTime | zoho.currenttime at the moment the record is written |

### Rerun Logic

```
On rerun (existing Final record found for same employee + period + is_final_settlement=false):
  1. Existing record → pr_status = Draft, pr_is_rerun = true, pr_run_sequence += 1
  2. New record written with pr_status = Final, pr_is_rerun = true
```

---

## Field Count Summary

| Form | Fields | Groups |
|---|---|---|
| P_Employee (custom additions) | 8 | — |
| Monthly_Payroll_Setup | 10 | — |
| Payroll_Queue | 17 | 4 |
| Monthly_Payroll_Record | 41 | 10 |
| **Total** | **76** | |
