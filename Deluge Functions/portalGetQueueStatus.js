// ============================================================
// Function : portalGetQueueStatus
// Phase    : B6
// Trigger  : Webtab — feature_queue_monitor load + polling
// Inputs   : payroll_period — String "YYYY-MM"
// Returns  : {
//     status          : "success" | "error"
//     period          : String
//     mps_status      : String — current MPS run status
//     mps_working_days: Integer
//     progress        : { total, done, error, pending, processing }
//     regular_run     : {
//         summary : { total, done, error, pending, processing }
//         records : [ { employee_id, status, batch_number, processed_at, error } ]
//     }
//     termination_run : {
//         summary : { total, done, error, pending }
//         records : [ { employee_id, exit_date, status, processed_at, error } ]
//     }
//   }
// Reads    : Monthly_Payroll_Setup, Payroll_Queue
// Writes   : nothing
// Note     : Current period only — no cross-period history
// ============================================================

info "INIT. portalGetQueueStatus | period=" + payroll_period;

result = Map();

// ── STEP 1: Validate period ───────────────────────────────────────────────────
if(ifnull(payroll_period, "") == "")
{
	result.put("status",  "error");
	result.put("message", "payroll_period is required.");
	return result;
}

// ── STEP 2: Read MPS record ───────────────────────────────────────────────────
mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(mps_list.size() == 0)
{
	result.put("status",  "error");
	result.put("message", "No Monthly_Payroll_Setup found for period " + payroll_period + ".");
	return result;
}

monthly_setup = mps_list.get(0);
mps_status    = monthly_setup.get("mps_status");
mps_wd        = ifnull(monthly_setup.get("mps_working_days"), "0").toInteger();
prog_total    = ifnull(monthly_setup.get("mps_progress_total"), "0").toInteger();
prog_done     = ifnull(monthly_setup.get("mps_progress_done"),  "0").toInteger();
prog_error    = ifnull(monthly_setup.get("mps_progress_error"), "0").toInteger();

// ── STEP 3: Read all queue records for this period ────────────────────────────
// One query returns both regular and termination records — split in memory below
all_queue = zoho.people.getRecords("Payroll_Queue",
	{"searchField":"pq_payroll_period","searchOperator":"Is","searchText":payroll_period});

info "Total queue records found: " + all_queue.size();

// ── STEP 4: Partition and aggregate ──────────────────────────────────────────
regular_records     = List();
termination_records = List();

reg_done       = 0; reg_error  = 0; reg_pending = 0; reg_processing = 0;
term_done      = 0; term_error = 0; term_pending = 0;

for each q in all_queue
{
	is_term  = ifnull(q.get("pq_is_final_settlement"), false);
	q_status = q.get("pq_status");

	if(is_term == true || is_term == "true")
	{
		// Termination record
		rec = Map();
		rec.put("employee_id",  q.get("pq_employee_id"));
		rec.put("exit_date",    ifnull(q.get("pq_exit_date"), ""));
		rec.put("status",       q_status);
		rec.put("processed_at", ifnull(q.get("pq_processed_at"), ""));
		rec.put("error",        ifnull(q.get("pq_error"), ""));
		termination_records.add(rec);

		if(q_status == "Done")              { term_done    += 1; }
		else if(q_status == "Error")        { term_error   += 1; }
		else                                { term_pending += 1; }
	}
	else
	{
		// Regular batch record
		rec = Map();
		rec.put("employee_id",  q.get("pq_employee_id"));
		rec.put("status",       q_status);
		rec.put("batch_number", ifnull(q.get("pq_batch_number"), ""));
		rec.put("processed_at", ifnull(q.get("pq_processed_at"), ""));
		rec.put("error",        ifnull(q.get("pq_error"), ""));
		regular_records.add(rec);

		if(q_status == "Done")              { reg_done       += 1; }
		else if(q_status == "Error")        { reg_error      += 1; }
		else if(q_status == "Processing")   { reg_processing += 1; }
		else                                { reg_pending    += 1; }
	}
}

// ── STEP 5: Assemble response ─────────────────────────────────────────────────
progress_map = Map();
progress_map.put("total",      prog_total);
progress_map.put("done",       prog_done);
progress_map.put("error",      prog_error);
progress_map.put("pending",    reg_pending);
progress_map.put("processing", reg_processing);

reg_summary = Map();
reg_summary.put("total",      regular_records.size());
reg_summary.put("done",       reg_done);
reg_summary.put("error",      reg_error);
reg_summary.put("pending",    reg_pending);
reg_summary.put("processing", reg_processing);

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
result.put("period",           payroll_period);
result.put("mps_status",       mps_status);
result.put("mps_working_days", mps_wd);
result.put("progress",         progress_map);
result.put("regular_run",      regular_section);
result.put("termination_run",  termination_section);

info "END. portalGetQueueStatus | mps_status=" + mps_status
   + " | regular=" + regular_records.size()
   + " | termination=" + termination_records.size();

return result;
