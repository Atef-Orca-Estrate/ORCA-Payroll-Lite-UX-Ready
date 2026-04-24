# Orca Payroll Lit 2.0 — Workflow Rules Deployment Spec

Three workflow rules must be configured in Zoho People.
All are created under: **Zoho People → Setup → Automation → Workflow Rules**

---

## Rule 1 — Employee Termination Trigger

Fires when an employee's status changes to Terminated or Resigned.
Writes a termination Payroll_Queue record. Workflow B then fires automatically on that record.

### Configuration

| Setting | Value |
|---|---|
| **Rule Name** | `Orca — Employee Termination Trigger` |
| **Form** | P_Employee |
| **Execute When** | Record Edit |
| **Condition** | Employeestatus **changed to** Terminated **OR** Employeestatus **changed to** Resigned |
| **Action Type** | Immediate Custom Function |
| **Function** | `onEmployeeTermination` |

### Parameters Passed to Function

| Parameter Name | Field / Value |
|---|---|
| `employee_id` | `${EmployeeID}` |

### Notes

- `Date_of_Leaving` must be populated on the employee record before or at the same time as the status change. The function reads this field to derive the exit period. If empty, the function aborts and logs an error.
- Only one termination queue record is created per event. If the function fires twice (e.g., status toggled), Step 3 ensures no duplicate queue records cause double-processing — `pq_is_final_settlement=true` records are never cancelled by this function.

---

## Rule 2 — Workflow A (Regular Batch Trigger)

Fires on Payroll_Queue record creation for regular batch records.
Time-based trigger at `pq_queue_at` — fires `processPayrollBatch` for that batch.

### Configuration

| Setting | Value |
|---|---|
| **Rule Name** | `Orca — Regular Batch Trigger` |
| **Form** | Payroll_Queue |
| **Execute When** | Record Create |
| **Condition** | `pq_queue_at` **is not empty** AND `pq_is_final_settlement` **is** `false` |
| **Action Type** | Time-based Custom Function |
| **Schedule** | At `pq_queue_at` field value (offset: 0 minutes) |
| **Function** | `processPayrollBatch` |

### Parameters Passed to Function

| Parameter Name | Field / Value |
|---|---|
| `batch_number` | `${pq_batch_number}` |
| `payroll_period` | `${pq_payroll_period}` |

### How It Works

The Orchestrator writes 10 queue records per batch. Only the **first record** of each batch has `pq_queue_at` set — the remaining 9 have `pq_queue_at = null`. Workflow A fires once per batch (not once per employee). `processPayrollBatch` queries all 10 Pending records for that batch_number internally.

Batches are staggered by 3 minutes:
- Batch 1 fires at `currenttime + 1 min`
- Batch 2 fires at `currenttime + 4 min`
- Batch N fires at `currenttime + 1 + (N-1)*3 min`

This prevents concurrent batch execution within Zoho's 5-minute function timeout window.

### Condition Logic

```
pq_queue_at is not empty     → selects only trigger records (first of each batch)
pq_is_final_settlement = false → excludes termination records (handled by Workflow B)
```

---

## Rule 3 — Workflow B (Termination Immediate Trigger)

Fires on Payroll_Queue record creation for termination records.
Immediate — calls `processTerminationRun` with no delay.

### Configuration

| Setting | Value |
|---|---|
| **Rule Name** | `Orca — Termination Immediate Trigger` |
| **Form** | Payroll_Queue |
| **Execute When** | Record Create |
| **Condition** | `pq_is_final_settlement` **is** `true` |
| **Action Type** | Immediate Custom Function |
| **Function** | `processTerminationRun` |

### Parameters Passed to Function

| Parameter Name | Field / Value |
|---|---|
| `employee_id` | `${pq_employee_id}` |
| `exit_date` | `${pq_exit_date}` |
| `queue_id` | `${ID}` |

### Why `queue_id` is Passed

`processTerminationRun` owns its own queue closure — it marks `pq_status = Done` at Step 15.
`${ID}` is the record ID of the queue record being created, passed so the function can close it.
No Scheduler is involved in the termination path.

---

## Execution Summary

```
Employee status → Terminated / Resigned
  ↓
Rule 1 fires → onEmployeeTermination(employee_id)
  → cancels existing Pending regular queue record (if any) → pq_status = Cancelled
  → creates termination queue record → pq_is_final_settlement = true

  ↓ (record create fires Rule 3 immediately)

Rule 3 fires → processTerminationRun(employee_id, exit_date, queue_id)
  → 15-step calculation
  → writes Monthly_Payroll_Record (pr_is_final_settlement = true)
  → marks queue record Done

─────────────────────────────────────────────────────────

HR selects period in web tab → portalCreateMPS → portalTriggerOrchestrator
  ↓
runPayrollOrchestrator
  → builds Payroll_Queue records (batches of 10)
  → first record of each batch: pq_queue_at set

  ↓ (record create fires Rule 2 at pq_queue_at time)

Rule 2 fires → processPayrollBatch(batch_number, payroll_period)
  → reads 7 snapshots from queue records
  → calls calculateEmployeePayroll (1 invokeUrl per employee)
  → writes Monthly_Payroll_Record (pr_is_final_settlement = false)
  → marks each queue record Done / Error
```

---

## Deployment Checklist

- [ ] Rule 1: Employee Termination Trigger — P_Employee, on edit, condition on Employeestatus
- [ ] Rule 2: Regular Batch Trigger — Payroll_Queue, on create, time-based at pq_queue_at
- [ ] Rule 3: Termination Immediate Trigger — Payroll_Queue, on create, immediate

**Rule order matters for Payroll_Queue:** Rules 2 and 3 both fire on Payroll_Queue create.
Zoho evaluates conditions independently — both rules check their own conditions.
A regular record (`pq_is_final_settlement=false`) only matches Rule 2.
A termination record (`pq_is_final_settlement=true`) only matches Rule 3.
No overlap is possible.
