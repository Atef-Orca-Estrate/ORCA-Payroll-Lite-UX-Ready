// ============================================================
// Function : onEmployeeTermination
// Version  : Orca Payroll Lit 2.0
// Trigger  : Workflow Rule — P_Employee form, record edit
//            Condition: Employeestatus changed to "Terminated" OR "Resigned"
//            Action   : Immediate custom function
// Inputs   : employee_id  ← P_Employee.EmployeeID  (passed by workflow rule)
//
// Responsibilities:
//   STEP 1 — Read employee record to get Date_of_Leaving (exit_date)
//   STEP 2 — Derive payroll period from exit_date
//   STEP 3 — Cancel any existing Pending regular queue record for this
//             employee in the exit period
//             (prevents double-processing if regular batch already queued them)
//   STEP 4 — Write termination Payroll_Queue record
//             pq_is_final_settlement = true → Workflow B fires immediately
//             processTerminationRun is called by Workflow B, not here
//
// Important:
//   This function does NOT call processTerminationRun directly.
//   Writing the queue record with pq_is_final_settlement = true is what
//   triggers Workflow B, which calls processTerminationRun.
//
//   Snapshot fields (pq_employee_snapshot etc.) are NOT written here.
//   processTerminationRun reads P_Employee and YTD directly — no snapshots needed
//   on the termination path.
// ============================================================

info "INIT. onEmployeeTermination | employee_id=" + employee_id;

// ── STEP 1: Read employee record ──────────────────────────────────────────────
emp_rec = zoho.people.getRecordById("P_Employee", employee_id);

if(emp_rec == null || emp_rec.isEmpty())
{
	info "ERROR. Employee record not found for ID=" + employee_id + ". Aborting.";
	return;
}

// Date_of_Leaving is the native Zoho People exit date field
exit_date_raw = emp_rec.get("Date_of_Leaving");

if(ifnull(exit_date_raw, "") == "")
{
	info "ERROR. Date_of_Leaving is empty for employee=" + employee_id
	   + ". Cannot derive exit period. Aborting.";
	return;
}

// Fix 8: .toDate() for safe parsing
exit_date = exit_date_raw.toDate();

info "STEP 1: exit_date=" + exit_date.toString("yyyy-MM-dd");

// ── STEP 2: Derive payroll period from exit_date ───────────────────────────────
period_year    = exit_date.year().toString();
period_month   = exit_date.month().toString("00");
current_period = period_year + "-" + period_month;

info "STEP 2: current_period=" + current_period;

// ── STEP 3: Cancel existing Pending regular queue record ──────────────────────
// If the regular batch Orchestrator already queued this employee for the exit
// period, that record must be cancelled. processPayrollBatch only picks up
// Pending records — Cancelled records are skipped entirely.
//
// Only cancel records where:
//   pq_employee_id      = this employee
//   pq_payroll_period   = exit period
//   pq_status           = Pending
//   pq_is_final_settlement = false  (regular records only — never cancel termination records)
existing_pending = zoho.people.getRecords("Payroll_Queue",
	{"searchField": "pq_employee_id",         "searchOperator":"Is","searchText":employee_id,
	 "searchField2":"pq_payroll_period",       "searchOperator2":"Is","searchText2":current_period,
	 "searchField3":"pq_status",               "searchOperator3":"Is","searchText3":"Pending",
	 "searchField4":"pq_is_final_settlement",  "searchOperator4":"Is","searchText4":"false"});

if(existing_pending.size() > 0)
{
	for each pq in existing_pending
	{
		zoho.people.update("Payroll_Queue",
			{"recordid":  pq.get("ID"),
			 "pq_status": "Cancelled",
			 "pq_error":  "Cancelled — employee terminated on "
			            + exit_date.toString("yyyy-MM-dd")
			            + ". Termination run will process this period."},
			"zoho_people_payroll_conn");
		info "STEP 3: Cancelled existing Pending queue record ID=" + pq.get("ID");
	}
}
else
{
	info "STEP 3: No existing Pending regular records found for this period. Nothing to cancel.";
}

// ── STEP 4: Write termination Payroll_Queue record ────────────────────────────
// pq_is_final_settlement = true → Workflow B fires immediately on record create
// Workflow B calls: processTerminationRun(pq_employee_id, pq_exit_date, pq_ID)
//
// pq_queue_at   = null (Workflow B is immediate — no time-based delay)
// pq_batch_number = null (termination records are not part of any batch)
// Snapshot fields = null (processTerminationRun reads P_Employee directly)

term_queue = Map();
term_queue.put("pq_employee_id",        employee_id);
term_queue.put("pq_payroll_period",     current_period);
term_queue.put("pq_is_final_settlement",true);
term_queue.put("pq_exit_date",          exit_date.toString("yyyy-MM-dd"));
term_queue.put("pq_status",             "Pending");
term_queue.put("pq_queued_at",          zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));

create_response = zoho.people.addRecord("Payroll_Queue", term_queue, "zoho_people_payroll_conn");
new_queue_id    = create_response.get("ID");

info "END. onEmployeeTermination | employee=" + employee_id
   + " | period=" + current_period
   + " | exit_date=" + exit_date.toString("yyyy-MM-dd")
   + " | queue_id=" + new_queue_id
   + " | Workflow B will fire processTerminationRun immediately.";
