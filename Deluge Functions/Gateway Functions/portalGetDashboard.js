// ============================================================
// Function : portalGetDashboard
// Trigger  : Dashboard feature mount (once per session)
// Inputs   : none
// Returns  : {
//     status           : "success" | "error"
//     employee_summary : { total_active, total_on_leave, new_this_month }
//     last_run         : { period, run_date, status, employee_count,
//                          total_gross, total_net, total_tax, total_si }
//     upcoming_run     : { period, cutoff_date, scheduled_date }
//     queue_summary    : { pending, processing, failed, completed_today }
//     run_history      : [ { period, run_date, status, employee_count, total_net } ]
//     alerts           : [ { id, severity, message } ]
//   }
// Reads    : Monthly_Payroll_Setup, Payroll_Queue, Zoho People leave API,
//            Zoho People employee API, PAYROLL_SETTINGS_JSON (SI ceiling date)
// Writes   : nothing
// ============================================================

info "INIT. portalGetDashboard";

result = Map();

// ── HELPER: zero-safe decimal ─────────────────────────────────────────────────
// Used to coerce null/empty field values from Zoho records.

// ── STEP 1: Employee summary ─────────────────────────────────────────────────
total_active    = 0;
total_on_leave  = 0;
new_this_month  = 0;

today          = zoho.currentdate;
current_year   = today.year();
current_month  = today.month();

emp_response = invokeurl
[
	url :"https://people.zoho.com/people/api/forms/json/P_Employee/getRecords"
	type :GET
	parameters:{"sIndex":"1","limit":"200","searchField":"EmployeeStatus","searchOperator":"Is","searchValue":"Active"}
	connection:"zoho_people_payroll_conn"
];

emp_body = ifnull(emp_response.get("response"), Map());
if(ifnull(emp_body.get("status"), 1) == 0)
{
	emp_list = ifnull(emp_body.get("result"), List());
	total_active = emp_list.size();

	for each rec in emp_list
	{
		emp       = rec.get("P_Employee");
		hire_date = ifnull(emp.get("DateOfJoining"), "");
		if(hire_date != "")
		{
			hd = hire_date.toDate();
			if(hd.year() == current_year && hd.month() == current_month)
			{
				new_this_month += 1;
			}
		}
	}
}

// Leave count — employees on approved leave today
leave_response = invokeurl
[
	url :"https://people.zoho.com/people/api/leave/v2/summary"
	type :GET
	parameters:{"dateRange":today.toString("yyyy-MM-dd") + "," + today.toString("yyyy-MM-dd")}
	connection:"zoho_people_payroll_conn"
];
if(ifnull(leave_response.get("status"), 1) == 0)
{
	total_on_leave = ifnull(leave_response.get("result"), List()).size();
}

employee_summary = Map();
employee_summary.put("total_active",   total_active);
employee_summary.put("total_on_leave", total_on_leave);
employee_summary.put("new_this_month", new_this_month);

// ── STEP 2: Run history — fetch all Completed MPS records, newest first ───────
all_mps = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_status","searchOperator":"Is","searchText":"Completed"});

// Sort by period descending
sorted_mps = all_mps.sort(false, "mps_payroll_period");

run_history  = List();
history_count = 0;
last_run_map  = null;

for each mps in sorted_mps
{
	mps_period  = ifnull(mps.get("mps_payroll_period"), "");
	run_date    = ifnull(mps.get("mps_created_at"), "").split(" ").get(0);
	emp_count   = ifnull(mps.get("mps_progress_total"),  "0").toInteger();
	run_gross   = ifnull(mps.get("mps_gross"), "0").toDecimal();
	run_net     = ifnull(mps.get("mps_net"),   "0").toDecimal();
	run_tax     = ifnull(mps.get("mps_tax"),   "0").toDecimal();
	run_si      = ifnull(mps.get("mps_si"),    "0").toDecimal();

	// Capture last_run from the first (most recent) Completed record
	if(last_run_map == null)
	{
		last_run_map = Map();
		last_run_map.put("period",         mps_period);
		last_run_map.put("run_date",       run_date);
		last_run_map.put("status",         "Completed");
		last_run_map.put("employee_count", emp_count);
		last_run_map.put("total_gross",    run_gross);
		last_run_map.put("total_net",      run_net);
		last_run_map.put("total_tax",      run_tax);
		last_run_map.put("total_si",       run_si);
	}

	// run_history — 6 most recent periods
	if(history_count < 6)
	{
		h_entry = Map();
		h_entry.put("period",         mps_period);
		h_entry.put("run_date",       run_date);
		h_entry.put("status",         "Completed");
		h_entry.put("employee_count", emp_count);
		h_entry.put("total_net",      run_net);
		run_history.add(h_entry);
		history_count += 1;
	}
}

// Also include Processing runs in last_run if no Completed exists
if(last_run_map == null)
{
	proc_mps = zoho.people.getRecords("Monthly_Payroll_Setup",
		{"searchField":"mps_status","searchOperator":"Is","searchText":"Processing"});
	if(proc_mps.size() > 0)
	{
		p = proc_mps.get(0);
		last_run_map = Map();
		last_run_map.put("period",         ifnull(p.get("mps_payroll_period"), ""));
		last_run_map.put("run_date",       ifnull(p.get("mps_created_at"), "").split(" ").get(0));
		last_run_map.put("status",         "Processing");
		last_run_map.put("employee_count", ifnull(p.get("mps_progress_total"), "0").toInteger());
		last_run_map.put("total_gross",    null);
		last_run_map.put("total_net",      null);
		last_run_map.put("total_tax",      null);
		last_run_map.put("total_si",       null);
	}
}

// ── STEP 3: Upcoming run — next calendar month ────────────────────────────────
next_month_date   = today.addMonth(1);
upcoming_period   = next_month_date.toString("yyyy-MM");
// Cutoff: 5th-last working day of next month (approximate: 25th)
cutoff_day        = next_month_date.getMonthDays() - 5;
cutoff_date_str   = upcoming_period + "-" + cutoff_day.toString().leftPad(2,"0");
// Scheduled: last day of next month
last_day          = next_month_date.getMonthDays();
scheduled_date_str = upcoming_period + "-" + last_day.toString().leftPad(2,"0");

upcoming_run = Map();
upcoming_run.put("period",         upcoming_period);
upcoming_run.put("cutoff_date",    cutoff_date_str);
upcoming_run.put("scheduled_date", scheduled_date_str);

// ── STEP 4: Queue summary — counts from Payroll_Queue (active + today) ────────
pending_count    = 0;
processing_count = 0;
failed_count     = 0;
done_today_count = 0;
today_str        = today.toString("yyyy-MM-dd");

active_queue = zoho.people.getRecords("Payroll_Queue", {});
for each q in ifnull(active_queue, List())
{
	q_status   = ifnull(q.get("pq_status"), "");
	processed  = ifnull(q.get("pq_processed_at"), "");

	if(q_status == "Pending")    { pending_count    += 1; }
	if(q_status == "Processing") { processing_count += 1; }
	if(q_status == "Error")      { failed_count     += 1; }
	if(q_status == "Done" && processed.startsWith(today_str)) { done_today_count += 1; }
}

queue_summary = Map();
queue_summary.put("pending",         pending_count);
queue_summary.put("processing",      processing_count);
queue_summary.put("failed",          failed_count);
queue_summary.put("completed_today", done_today_count);

// ── STEP 5: Alerts — computed from live state ─────────────────────────────────
alerts    = List();
alert_id  = 1;

// Alert: failed queue items
if(failed_count > 0)
{
	a = Map();
	a.put("id",       alert_id);
	a.put("severity", "error");
	a.put("message",  failed_count + " queue item(s) failed — review in Queue Monitor.");
	alerts.add(a);
	alert_id += 1;
}

// Alert: SI ceiling out of date (ceiling_updated year < current year)
settings_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
si_raw = ifnull(settings_response.get("variable").get("value")
                                 .get("active_settings").get("social_insurance"), Map());
ceiling_updated = ifnull(si_raw.get("ceiling_updated"), "");
if(ceiling_updated != "")
{
	ceiling_year = ceiling_updated.toDate().year();
	if(ceiling_year < current_year)
	{
		a = Map();
		a.put("id",       alert_id);
		a.put("severity", "warning");
		a.put("message",  "SI ceiling last updated in " + ceiling_year
		                + " — verify against latest GOSI announcement.");
		alerts.add(a);
		alert_id += 1;
	}
}

// ── STEP 6: Assemble response ─────────────────────────────────────────────────
result.put("status",           "success");
result.put("employee_summary", employee_summary);
result.put("last_run",         ifnull(last_run_map, Map()));
result.put("upcoming_run",     upcoming_run);
result.put("queue_summary",    queue_summary);
result.put("run_history",      run_history);
result.put("alerts",           alerts);

info "END. portalGetDashboard | active=" + total_active
   + " | history=" + run_history.size()
   + " | alerts=" + alerts.size();

return result;
