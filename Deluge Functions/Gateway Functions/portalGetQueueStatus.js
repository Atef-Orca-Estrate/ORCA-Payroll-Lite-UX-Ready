// ============================================================
// Function : portalGetQueueStatus
// Trigger  : QueueMonitor load + RunPayroll auto-poll (every 30s while Processing)
// Inputs   : payroll_period — String "YYYY-MM"
//            run_id         — String (optional; required when >1 run exists for period)
// Returns  : {
//     status          : "success" | "error"
//     run_id          : String
//     mps_status      : "Draft" | "Processing" | "Completed"
//     mps_working_days: Integer
//     progress        : { total, done, error, pending, processing }
//     regular_run     : {
//         summary : { total, done, error, pending }
//         records : [ { employee_id, employee_name, department,
//                       status, batch_number, processed_at, error } ]
//     }
//     termination_run : {
//         summary : { total, done, error, pending }
//         records : [ { employee_id, employee_name, department,
//                       status, batch_number, processed_at, error } ]
//     }
//   }
// Error:
//     { status: "error", code: "no_run", message: "No payroll run found for period YYYY-MM" }
// Reads    : Monthly_Payroll_Setup, Payroll_Queue, Zoho People (enrichment)
// Writes   : nothing
// ============================================================

info "INIT. portalGetQueueStatus | period=" + payroll_period + " | run_id=" + run_id;

result = Map();

// ── STEP 1: Validate period ───────────────────────────────────────────────────
if(ifnull(payroll_period, "") == "")
{
	result.put("status",  "error");
	result.put("code",    "no_run");
	result.put("message", "payroll_period is required.");
	return result;
}

// ── STEP 2: Resolve MPS record ────────────────────────────────────────────────
// If run_id provided, fetch by record ID directly (handles multi-run periods).
// Otherwise fall back to period search.
monthly_setup = null;
resolved_run_id = ifnull(run_id, "");

if(resolved_run_id != "")
{
	mps_by_id = zoho.people.getRecordById("Monthly_Payroll_Setup", resolved_run_id);
	if(mps_by_id != null && ifnull(mps_by_id.get("mps_payroll_period"), "") == payroll_period)
	{
		monthly_setup = mps_by_id;
	}
}

if(monthly_setup == null)
{
	mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
		{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

	if(mps_list.size() == 0)
	{
		result.put("status",  "error");
		result.put("code",    "no_run");
		result.put("message", "No payroll run found for period " + payroll_period + ".");
		return result;
	}
	monthly_setup   = mps_list.get(0);
	resolved_run_id = monthly_setup.get("ID");
}

// ── STEP 3: Read MPS fields ───────────────────────────────────────────────────
raw_status = monthly_setup.get("mps_status");
// Map legacy "Ready" to "Draft" for frontend alignment
mps_status = (raw_status == "Ready") ? "Draft" : ifnull(raw_status, "Draft");
mps_wd     = ifnull(monthly_setup.get("mps_working_days"),    "0").toInteger();
prog_total = ifnull(monthly_setup.get("mps_progress_total"),  "0").toInteger();
prog_done  = ifnull(monthly_setup.get("mps_progress_done"),   "0").toInteger();
prog_error = ifnull(monthly_setup.get("mps_progress_error"),  "0").toInteger();

// ── STEP 4: Fetch all queue records for this run ──────────────────────────────
all_queue = zoho.people.getRecords("Payroll_Queue",
	{"searchField":"pq_payroll_period","searchOperator":"Is","searchText":payroll_period});

info "Queue records found: " + all_queue.size();

// ── STEP 5: Collect unique employee IDs for enrichment ────────────────────────
emp_id_set = List();
for each q in all_queue
{
	e_id = ifnull(q.get("pq_employee_id"), "");
	if(e_id != "" && !emp_id_set.contains(e_id))
	{
		emp_id_set.add(e_id);
	}
}

// ── STEP 6: Bulk-fetch employee names and departments ─────────────────────────
emp_info_map = Map();

if(emp_id_set.size() > 0)
{
	emp_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/forms/json/P_Employee/getRecords"
		type :GET
		parameters:{"sIndex":"1","limit":"200","searchField":"EmployeeStatus","searchOperator":"Is","searchValue":"Active"}
		connection:"zoho_people_payroll_conn"
	];

	resp_body = ifnull(emp_response.get("response"), Map());
	if(ifnull(resp_body.get("status"), 1) == 0)
	{
		for each record in ifnull(resp_body.get("result"), List())
		{
			emp      = record.get("P_Employee");
			e_id     = ifnull(emp.get("EmployeeID"), "");
			f_name   = ifnull(emp.get("FirstName"),  "");
			l_name   = ifnull(emp.get("LastName"),   "");
			dept     = ifnull(emp.get("Department"),  "");
			disp_name = (f_name != "" && l_name != "") ? (f_name + " " + l_name) : ifnull(f_name, e_id);

			if(e_id != "")
			{
				info_entry = Map();
				info_entry.put("employee_name", disp_name);
				info_entry.put("department",    dept);
				emp_info_map.put(e_id, info_entry);
			}
		}
	}
}

// ── STEP 7: Partition queue records into regular and termination ───────────────
regular_records     = List();
termination_records = List();

reg_done = 0; reg_error = 0; reg_pending = 0; reg_processing = 0;
term_done = 0; term_error = 0; term_pending = 0;

for each q in all_queue
{
	is_term  = (ifnull(q.get("pq_is_final_settlement"), false) == true
	            || ifnull(q.get("pq_is_final_settlement"), "") == "true");
	q_status = ifnull(q.get("pq_status"), "Pending");
	q_emp_id = ifnull(q.get("pq_employee_id"), "");

	// Enrich with identity data
	emp_info   = ifnull(emp_info_map.get(q_emp_id), Map());
	emp_name   = ifnull(emp_info.get("employee_name"), q_emp_id);
	emp_dept   = ifnull(emp_info.get("department"),    "");

	rec = Map();
	rec.put("employee_id",   q_emp_id);
	rec.put("employee_name", emp_name);
	rec.put("department",    emp_dept);
	rec.put("status",        q_status);
	rec.put("batch_number",  ifnull(q.get("pq_batch_number"),  ""));
	rec.put("processed_at",  ifnull(q.get("pq_processed_at"),  ""));
	rec.put("error",         ifnull(q.get("pq_error"),         ""));

	if(is_term)
	{
		termination_records.add(rec);
		if(q_status == "Done")       { term_done    += 1; }
		else if(q_status == "Error") { term_error   += 1; }
		else                         { term_pending += 1; }
	}
	else
	{
		regular_records.add(rec);
		if(q_status == "Done")            { reg_done       += 1; }
		else if(q_status == "Error")      { reg_error      += 1; }
		else if(q_status == "Processing") { reg_processing += 1; }
		else                              { reg_pending    += 1; }
	}
}

// ── STEP 8: Assemble response ─────────────────────────────────────────────────
progress_map = Map();
progress_map.put("total",      prog_total);
progress_map.put("done",       prog_done);
progress_map.put("error",      prog_error);
progress_map.put("pending",    reg_pending);
progress_map.put("processing", reg_processing);

reg_summary = Map();
reg_summary.put("total",   regular_records.size());
reg_summary.put("done",    reg_done);
reg_summary.put("error",   reg_error);
reg_summary.put("pending", reg_pending);

term_summary = Map();
term_summary.put("total",   termination_records.size());
term_summary.put("done",    term_done);
term_summary.put("error",   term_error);
term_summary.put("pending", term_pending);

regular_section = Map();
regular_section.put("summary", reg_summary);
regular_section.put("records", regular_records);

termination_section = Map();
termination_section.put("summary", term_summary);
termination_section.put("records", termination_records);

result.put("status",           "success");
result.put("run_id",           resolved_run_id);
result.put("mps_status",       mps_status);
result.put("mps_working_days", mps_wd);
result.put("progress",         progress_map);
result.put("regular_run",      regular_section);
result.put("termination_run",  termination_section);

info "END. portalGetQueueStatus | run_id=" + resolved_run_id
   + " | mps_status=" + mps_status
   + " | regular=" + regular_records.size()
   + " | termination=" + termination_records.size();

return result;
