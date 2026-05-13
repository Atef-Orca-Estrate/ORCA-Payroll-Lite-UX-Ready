// ============================================================
// Function : portalListRuns
// Trigger  : RunPayroll mount; QueueMonitor (for period tab counts)
// Inputs   : none
// Returns  : {
//     status : "success" | "error"
//     runs   : [
//       {
//         run_id              : String
//         period              : String "YYYY-MM"
//         status              : "Draft" | "Processing" | "Completed"
//         scope               : "all" | "by_department" | "by_employee"
//         selected_department : String
//         selected_employees  : [String]
//         employees           : Integer
//         working_days        : Integer
//         batches             : Integer
//         done                : Integer
//         error               : Integer
//         pending             : Integer
//         holidays            : [ { date: "YYYY-MM-DD", name: String } ]
//         gross               : Decimal | null  (null when not Completed)
//         net                 : Decimal | null
//         tax                 : Decimal | null
//         si                  : Decimal | null
//       }
//     ]
//   }
// Reads    : Monthly_Payroll_Setup (all records, sorted newest-period first)
// Writes   : nothing
// ============================================================

info "INIT. portalListRuns";

result = Map();
runs   = List();

// ── Fetch all MPS records ─────────────────────────────────────────────────────
// Zoho People getRecords returns up to 200 records by default.
// All active periods fit within this limit for most organisations.
all_mps = zoho.people.getRecords("Monthly_Payroll_Setup", {});

info "Total MPS records found: " + all_mps.size();

// ── Parse holidays helper ─────────────────────────────────────────────────────
// mps_public_holidays stores a JSON array string: [{"date":"...","name":"..."},...]
// Falls back to an empty list if not valid JSON or empty.

for each mps in all_mps
{
	raw_status = ifnull(mps.get("mps_status"), "Draft");
	// Map legacy "Ready" to "Draft" for frontend alignment
	run_status = (raw_status == "Ready") ? "Draft" : raw_status;

	prog_total = ifnull(mps.get("mps_progress_total"), "0").toInteger();
	prog_done  = ifnull(mps.get("mps_progress_done"),  "0").toInteger();
	prog_error = ifnull(mps.get("mps_progress_error"), "0").toInteger();
	prog_pend  = (prog_total - prog_done - prog_error).max(0);

	// Parse holidays from stored JSON string
	holidays_list = List();
	hol_raw = ifnull(mps.get("mps_public_holidays"), "");
	if(hol_raw != "" && hol_raw.startsWith("["))
	{
		// hol_raw is a JSON array string — parse into list of maps
		parsed_hols = hol_raw.toJSONList();
		if(parsed_hols != null)
		{
			holidays_list = parsed_hols;
		}
	}

	// Parse selected_employees from stored JSON string
	selected_emps = List();
	emps_raw = ifnull(mps.get("mps_selected_employees"), "");
	if(emps_raw != "" && emps_raw.startsWith("["))
	{
		parsed_emps = emps_raw.toJSONList();
		if(parsed_emps != null)
		{
			selected_emps = parsed_emps;
		}
	}

	// Financial totals — null when run is not Completed
	is_completed = (run_status == "Completed");
	gross_val = is_completed ? ifnull(mps.get("mps_gross"), null) : null;
	net_val   = is_completed ? ifnull(mps.get("mps_net"),   null) : null;
	tax_val   = is_completed ? ifnull(mps.get("mps_tax"),   null) : null;
	si_val    = is_completed ? ifnull(mps.get("mps_si"),    null) : null;

	run_entry = Map();
	run_entry.put("run_id",              mps.get("ID"));
	run_entry.put("period",              ifnull(mps.get("mps_payroll_period"),      ""));
	run_entry.put("status",              run_status);
	run_entry.put("scope",               ifnull(mps.get("mps_scope"),              "all"));
	run_entry.put("selected_department", ifnull(mps.get("mps_selected_department"), ""));
	run_entry.put("selected_employees",  selected_emps);
	run_entry.put("employees",           prog_total);
	run_entry.put("working_days",        ifnull(mps.get("mps_working_days"), "0").toInteger());
	run_entry.put("batches",             ifnull(mps.get("mps_batches"),      "0").toInteger());
	run_entry.put("done",                prog_done);
	run_entry.put("error",               prog_error);
	run_entry.put("pending",             prog_pend);
	run_entry.put("holidays",            holidays_list);
	run_entry.put("gross",               gross_val);
	run_entry.put("net",                 net_val);
	run_entry.put("tax",                 tax_val);
	run_entry.put("si",                  si_val);

	runs.add(run_entry);
}

// ── Sort by period descending (newest first) ──────────────────────────────────
sorted_runs = runs.sort(false, "period");

result.put("status", "success");
result.put("runs",   sorted_runs);

info "END. portalListRuns | count=" + sorted_runs.size();
return result;
