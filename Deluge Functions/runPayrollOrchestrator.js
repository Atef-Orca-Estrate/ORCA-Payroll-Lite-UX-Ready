// ============================================================
// Function : runPayrollOrchestrator
// Version  : Orca Payroll Lit 2.0
// Called by: portalTriggerOrchestrator (webtab gateway)
// Input    : payroll_period — String "YYYY-MM"
//
// Responsibilities (Lit 2.0 — optimized):
//   STEP 0  — Global lock: prevent concurrent runs
//   STEP 1  — Validate MPS record (must exist + status=Ready)
//   STEP 2  — Set MPS status → Processing
//   STEP 3  — Derive period boundaries
//   STEP 4  — Parse public holidays from MPS
//   STEP 5  — Read run scope from PAYROLL_SETTINGS_JSON
//   STEP 6  — Build employee list (paginated, 200/call)
//             Capture emp profile in same pass → emp_map
//   STEP 7  — Bulk YTD: one query all Final records this year
//             Aggregate per employee → ytd_map (no per-emp query in batch)
//   STEP 8  — Bulk attendance: paginated API call (100 emp/page)
//             Aggregate 4 fields per employee → att_map
//             Nested loop runs HERE once — not in processPayrollBatch
//   STEP 9  — Leave per employee: store in leave_map
//             processPayrollBatch reads from queue snapshot — zero leave calls in batch
//   STEP 10 — Write Payroll_Queue records with 7 snapshot fields
//             Batch trigger record (first of 10): pq_queue_at set → fires Workflow A
//   STEP 11 — Update MPS progress total
//   STEP 12 — Release global lock
// ============================================================

info "INIT. runPayrollOrchestrator | period: " + payroll_period;

// ── STEP 0: Global lock — prevent concurrent runs ─────────────────────────
info "INIT. STEP 0: Global lock check";

settings_url = "https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables";
settings_response = invokeurl
[
	url :settings_url
	type :GET
	connection:"zoho_people_payroll_conn"
];
payroll_settings  = settings_response.get("variable").get("value");
active_settings   = payroll_settings.get("active_settings");
payroll_run_cfg   = active_settings.get("payroll_run");

if(payroll_run_cfg.get("lock") == true)
{
	info "ABORT. Global lock active — concurrent run blocked.";
	return {"status":"error","message":"A payroll run is already in progress. Try again after it completes."};
}

// Acquire lock — write back immediately before doing anything else
payroll_run_cfg.put("lock", true);
active_settings.put("payroll_run", payroll_run_cfg);
payroll_settings.put("active_settings", active_settings);

settings_update_url = "https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/update?group=Orca_Payroll_Variables";
invokeurl
[
	url :settings_update_url
	type :POST
	parameters:{"value":payroll_settings.toString()}
	connection:"zoho_people_payroll_conn"
];
info "END. STEP 0: Lock acquired.";

// ── Helper: release lock — called before every early return ──────────────
// Defined as inline block to keep code DRY without nested function call overhead

// ── STEP 1: Validate MPS record ───────────────────────────────────────────
info "INIT. STEP 1: Validate MPS";

mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(mps_list.size() == 0)
{
	payroll_run_cfg.put("lock", false);
	active_settings.put("payroll_run", payroll_run_cfg);
	payroll_settings.put("active_settings", active_settings);
	invokeurl [url:settings_update_url type:POST parameters:{"value":payroll_settings.toString()} connection:"zoho_people_payroll_conn"];
	info "ABORT. No MPS found for period: " + payroll_period;
	return {"status":"error","message":"No Monthly_Payroll_Setup found for period " + payroll_period};
}

monthly_setup = mps_list.get(0);
mps_id        = monthly_setup.get("ID");
mps_status    = monthly_setup.get("mps_status");

if(mps_status != "Ready")
{
	payroll_run_cfg.put("lock", false);
	active_settings.put("payroll_run", payroll_run_cfg);
	payroll_settings.put("active_settings", active_settings);
	invokeurl [url:settings_update_url type:POST parameters:{"value":payroll_settings.toString()} connection:"zoho_people_payroll_conn"];
	info "ABORT. MPS status=" + mps_status + " — must be Ready.";
	return {"status":"error","message":"Monthly_Payroll_Setup status is " + mps_status + ". Must be Ready to run."};
}

working_days = monthly_setup.get("mps_working_days").toInteger();

// Fix E: working_days guard
if(working_days == null || working_days <= 0)
{
	payroll_run_cfg.put("lock", false);
	active_settings.put("payroll_run", payroll_run_cfg);
	payroll_settings.put("active_settings", active_settings);
	invokeurl [url:settings_update_url type:POST parameters:{"value":payroll_settings.toString()} connection:"zoho_people_payroll_conn"];
	info "ABORT. mps_working_days=" + working_days + " — invalid.";
	return {"status":"error","message":"mps_working_days is " + working_days + ". Must be > 0."};
}
info "END. STEP 1: MPS valid | working_days=" + working_days;

// ── STEP 2: Set MPS status → Processing ──────────────────────────────────
info "INIT. STEP 2: Set MPS Processing";
zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {"mps_status":"Processing"});
info "END. STEP 2: MPS status=Processing";

// ── STEP 3: Derive period boundaries ─────────────────────────────────────
info "INIT. STEP 3: Derive period boundaries";
period_parts  = payroll_period.split("-");
payroll_year  = period_parts.get(0).toInteger();
payroll_month = period_parts.get(1).toInteger();
period_start  = payroll_period + "-01";
// Last day of month: add 1 month then subtract 1 day — handles all month lengths
period_end    = (period_start.toDate()).addMonth(1).subDay(1).toString("yyyy-MM-dd");
info "END. STEP 3: period_start=" + period_start + " | period_end=" + period_end;

// ── STEP 4: Parse public holidays from MPS ────────────────────────────────
// Fix 8: Store as Date objects — format-safe comparison in attendance day loop
info "INIT. STEP 4: Parse public holidays";
public_holiday_dates = List();
ph_raw = monthly_setup.get("mps_public_holidays");
if(ph_raw != null && ph_raw != "")
{
	for each line in ph_raw.split("\n")
	{
		line = line.trim();
		if(line != "")
		{
			date_token = line.split(" ").get(0);
			public_holiday_dates.add(date_token.toDate());
		}
	}
}
info "END. STEP 4: public_holiday count=" + public_holiday_dates.size();

// ── STEP 5: Read run scope from settings ─────────────────────────────────
info "INIT. STEP 5: Read run scope";
scope           = payroll_run_cfg.get("scope");          // "all" | "by_department" | "by_employee"
selected_dept   = payroll_run_cfg.get("selected_department");
selected_emps   = payroll_run_cfg.get("selected_employees");  // List of EmployeeIDs
apply_insurance = active_settings.get("social_insurance").get("apply_insurance");
entity_type     = active_settings.get("social_insurance").get("entity_type");
apply_tax       = active_settings.get("income_tax").get("apply_tax");
info "END. STEP 5: scope=" + scope;

// ── STEP 6: Build employee list + profile snapshot map ────────────────────
// Paginate P_Employee (200/call). Capture emp fields in same pass.
// Result: all_employees (ordered List) + emp_map (keyed by EmployeeID)
info "INIT. STEP 6: Build employee list";
all_employees = List();
emp_map       = Map();  // EmployeeID → profile snapshot Map

sindex   = 1;
has_more = true;

while(has_more)
{
	emp_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/forms/P_Employee/records"
		type :GET
		parameters:{"sIndex":sindex,"limit":200,"searchField":"Employeestatus","searchOperator":"Is","searchText":"Active"}
		connection:"zoho_people_payroll_conn"
	];

	emp_result = emp_response.get("response").get("result");
	if(emp_result == null || emp_result.size() == 0) { has_more = false; break; }

	for each emp in emp_result
	{
		emp_id = emp.get("EmployeeID");

		// Scope filter — skip employees outside run scope
		if(scope == "by_department" && emp.get("Department") != selected_dept) { continue; }
		if(scope == "by_employee"   && !selected_emps.contains(emp_id))        { continue; }

		// Fix A: null/empty allowances default to 0
		basic_salary      = ifnull(emp.get("emp_basic_salary"),         "0").toDecimal();
		housing           = ifnull(emp.get("emp_housing_allowance"),     "0").toDecimal();
		transport         = ifnull(emp.get("emp_transport_allowance"),   "0").toDecimal();
		medical           = ifnull(emp.get("emp_medical_allowance"),     "0").toDecimal();
		other_allow       = ifnull(emp.get("emp_other_allowances"),      "0").toDecimal();
		total_allowances  = housing + transport + medical + other_allow;
		gross_salary      = basic_salary + total_allowances;

		// SI subscription wage — fallback to gross if not set
		sub_wage = ifnull(emp.get("emp_si_subscription_wage"), "0").toDecimal();
		if(sub_wage <= 0) { sub_wage = gross_salary; }

		// Hire date — Fix 8: .toDate() for safe parsing
		hire_date  = emp.get("DateofJoining").toDate();
		hire_month = hire_date.month();
		hire_year  = hire_date.year();

		// Per-employee SI/tax override flags
		// null = use org-level setting from PAYROLL_SETTINGS_JSON
		// true/false = override for this employee only
		// processPayrollBatch resolves: effective = ifnull(override, org_setting)
		emp_si_override  = emp.get("emp_si_override");   // null | true | false
		emp_tax_override = emp.get("emp_tax_override");  // null | true | false

		// Build profile snapshot — processPayrollBatch reads from here, not P_Employee
		snap = Map();
		snap.put("basic_salary",      basic_salary);
		snap.put("total_allowances",  total_allowances);
		snap.put("gross_salary",      gross_salary);
		snap.put("subscription_wage", sub_wage);
		snap.put("hire_month",        hire_month);
		snap.put("hire_year",         hire_year);
		snap.put("emp_si_override",   emp_si_override);
		snap.put("emp_tax_override",  emp_tax_override);

		emp_map.put(emp_id, snap);
		all_employees.add(emp_id);
	}

	if(emp_result.size() < 200) { has_more = false; }
	else { sindex = sindex + 200; }
}
info "END. STEP 6: employee count=" + all_employees.size();

// Guard: no employees found
if(all_employees.size() == 0)
{
	zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {"mps_status":"Ready"});
	payroll_run_cfg.put("lock", false);
	active_settings.put("payroll_run", payroll_run_cfg);
	payroll_settings.put("active_settings", active_settings);
	invokeurl [url:settings_update_url type:POST parameters:{"value":payroll_settings.toString()} connection:"zoho_people_payroll_conn"];
	info "ABORT. No active employees found for scope=" + scope;
	return {"status":"error","message":"No active employees found for scope: " + scope};
}

// ── STEP 7: Bulk YTD — one query, aggregate per employee ─────────────────
// Reads ALL Final records for this calendar year in one call.
// Aggregates ytd_gross + ytd_tax_withheld per employee into ytd_map.
// processPayrollBatch reads ytd from queue snapshot — zero YTD queries in batch.
info "INIT. STEP 7: Bulk YTD";
ytd_map = Map();  // EmployeeID → {ytd_gross, ytd_tax_withheld}

ytd_records = zoho.people.getRecords("Monthly_Payroll_Record",
	{"searchField":"pr_status","searchOperator":"Is","searchText":"Final"});

for each pr in ytd_records
{
	// Filter to current calendar year only — string prefix match
	if(!pr.get("pr_payroll_period").startsWith(payroll_year.toString())) { continue; }

	// Exclude termination records from regular YTD accumulation
	if(pr.get("pr_is_final_settlement") == true) { continue; }

	pr_emp = pr.get("pr_employee");

	if(!ytd_map.containsKey(pr_emp))
	{
		ytd_entry = Map();
		ytd_entry.put("ytd_gross",        0.0);
		ytd_entry.put("ytd_tax_withheld", 0.0);
		ytd_map.put(pr_emp, ytd_entry);
	}

	ytd_map.get(pr_emp).put("ytd_gross",
		(ytd_map.get(pr_emp).get("ytd_gross").toDecimal()
		+ ifnull(pr.get("pr_gross_salary"), "0").toDecimal()).round(2));

	ytd_map.get(pr_emp).put("ytd_tax_withheld",
		(ytd_map.get(pr_emp).get("ytd_tax_withheld").toDecimal()
		+ ifnull(pr.get("pr_monthly_tax"), "0").toDecimal()).round(2));
}
info "END. STEP 7: ytd_map size=" + ytd_map.size();

// ── STEP 8: Bulk attendance — paginated, 100 employees per API call ───────
// Aggregate per employee: absent_days, late_minutes, overtime_hours, ph_days_worked
// Nested loop (employee → days) runs HERE ONCE — never repeats in processPayrollBatch.
// processPayrollBatch reads 4 flat integers from queue record snapshot.
info "INIT. STEP 8: Bulk attendance fetch";

// Initialise all employees with zeroes — some may have no attendance data
att_map = Map();
for each emp_id in all_employees
{
	a = Map();
	a.put("absent_days",    0);
	a.put("late_minutes",   0);
	a.put("overtime_hours", 0.0);
	a.put("ph_days_worked", 0);
	att_map.put(emp_id, a);
}

att_sindex  = 0;
att_has_more = true;

while(att_has_more)
{
	att_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/attendance/getUserReport"
		type :GET
		parameters:{
			"sdate":      period_start,
			"edate":      period_end,
			"dateFormat": "yyyy-MM-dd",
			"startIndex": att_sindex
		}
		connection:"zoho_people_payroll_conn"
	];

	if(att_response.get("status") != 0) { att_has_more = false; break; }

	att_results = att_response.get("result");
	if(att_results == null || att_results.size() == 0) { att_has_more = false; break; }

	for each emp_att in att_results
	{
		att_emp_id = emp_att.get("employeeDetails").get("id");

		// Only process employees in this run scope
		if(!att_map.containsKey(att_emp_id)) { continue; }

		daily_data = emp_att.get("attendanceDetails");
		emp_absent = 0;
		emp_late   = 0;
		emp_ot     = 0.0;
		emp_ph     = 0;

		for each day_key in daily_data.keySet()
		{
			day_detail = daily_data.get(day_key);
			day_status = day_detail.get("Status");

			// Absence
			if(day_status == "Absent") { emp_absent += 1; }

			// Late deduction — positive DeviationTime only
			// Negative = early arrival → excluded here, never reaches processPayrollBatch
			deviation = day_detail.get("DeviationTime");
			if(deviation != null && deviation != "00:00" && !deviation.startsWith("-"))
			{
				dev_parts = deviation.split(":");
				emp_late  = emp_late + (dev_parts.get(0).toLong() * 60) + dev_parts.get(1).toLong();
			}

			// Overtime
			ot = day_detail.get("OverTime");
			if(ot != null && ot != "00:00")
			{
				ot_parts = ot.split(":");
				emp_ot   = emp_ot + ot_parts.get(0).toLong() + (ot_parts.get(1).toLong() / 60.0);
			}

			// Fix 8: .toDate() both sides — format-safe public holiday check
			if(public_holiday_dates.contains(day_key.toDate())) { emp_ph += 1; }
		}

		att_map.get(att_emp_id).put("absent_days",    emp_absent);
		att_map.get(att_emp_id).put("late_minutes",   emp_late);
		att_map.get(att_emp_id).put("overtime_hours", emp_ot.round(2));
		att_map.get(att_emp_id).put("ph_days_worked", emp_ph);
	}

	// Attendance API returns 100 employees per page
	if(att_results.size() < 100) { att_has_more = false; }
	else { att_sindex = att_sindex + 100; }
}
info "END. STEP 8: Attendance aggregated for " + att_map.size() + " employees.";

// ── STEP 9: Unpaid leave per employee ────────────────────────────────────
// Fetched here and stored in queue snapshot.
// processPayrollBatch reads pq_unpaid_leave_days — zero leave API calls in batch.
info "INIT. STEP 9: Unpaid leave fetch";
leave_map = Map();  // EmployeeID → Decimal days

for each emp_id in all_employees
{
	leave_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/leave/v2/getLeaveDetails"
		type :GET
		parameters:{
			"userId": emp_id,
			"from":   period_start,
			"to":     period_end,
			"type":   "UNPAID"
		}
		connection:"zoho_people_payroll_conn"
	];

	leave_days = 0.0;
	if(leave_response.get("status") == 0)
	{
		leave_list = leave_response.get("result");
		if(leave_list != null)
		{
			for each leave_rec in leave_list
			{
				leave_days = leave_days + ifnull(leave_rec.get("noOfDays"), "0").toDecimal();
			}
		}
	}
	leave_map.put(emp_id, leave_days.round(2));
}
info "END. STEP 9: Leave fetched for " + leave_map.size() + " employees.";

// ── STEP 10: Write Payroll_Queue records (batches of 10) ─────────────────
// Snapshot fields written per record — processPayrollBatch reads locally (zero extra API calls).
// First record of each batch: pq_queue_at set → fires Workflow A time-based trigger.
// Subsequent records in batch: pq_queue_at null — Workflow A ignores them.
// Batches staggered by 3 minutes to prevent overlap.
info "INIT. STEP 10: Write queue records";

batch_number   = 1;
batch_pos      = 0;   // position within current batch (0–9)
total_queued   = 0;

// Stagger batch trigger times: batch 1 fires in 1 min, batch 2 in 4 min, etc.
base_trigger_time = zoho.currenttime.addMinutes(1);

for each emp_id in all_employees
{
	emp_snap = emp_map.get(emp_id);
	att_snap = att_map.get(emp_id);

	// YTD — default to zero for new employees (no prior Final records this year)
	ytd_gross        = 0.0;
	ytd_tax_withheld = 0.0;
	if(ytd_map.containsKey(emp_id))
	{
		ytd_gross        = ytd_map.get(emp_id).get("ytd_gross").toDecimal();
		ytd_tax_withheld = ytd_map.get(emp_id).get("ytd_tax_withheld").toDecimal();
	}

	// Build YTD snapshot map → serialise as string for Multi-line Text field
	ytd_snap_map = Map();
	ytd_snap_map.put("ytd_gross",        ytd_gross.round(2));
	ytd_snap_map.put("ytd_tax_withheld", ytd_tax_withheld.round(2));

	queue_rec = Map();
	queue_rec.put("pq_employee_id",         emp_id);
	queue_rec.put("pq_payroll_period",       payroll_period);
	queue_rec.put("pq_batch_number",         batch_number);
	queue_rec.put("pq_is_final_settlement",  false);
	queue_rec.put("pq_status",               "Pending");
	queue_rec.put("pq_queued_at",            zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));

	// Snapshot fields — stored as JSON strings, parsed by processPayrollBatch
	queue_rec.put("pq_employee_snapshot",    emp_snap.toString());
	queue_rec.put("pq_ytd_snapshot",         ytd_snap_map.toString());

	// Flat attendance integers — no parsing needed in processPayrollBatch
	queue_rec.put("pq_absent_days",          att_snap.get("absent_days").toInteger());
	queue_rec.put("pq_late_minutes",         att_snap.get("late_minutes").toInteger());
	queue_rec.put("pq_overtime_hours",       att_snap.get("overtime_hours").toDecimal());
	queue_rec.put("pq_ph_days_worked",       att_snap.get("ph_days_worked").toInteger());
	queue_rec.put("pq_unpaid_leave_days",    leave_map.get(emp_id).toDecimal());

	// First record of each batch: set pq_queue_at → Workflow A condition matches → fires processPayrollBatch
	if(batch_pos == 0)
	{
		trigger_time = base_trigger_time.addMinutes((batch_number - 1) * 3);
		queue_rec.put("pq_queue_at", trigger_time.toString("yyyy-MM-dd HH:mm:ss"));
	}

	zoho.people.addRecord("Payroll_Queue", queue_rec);

	total_queued += 1;
	batch_pos    += 1;

	// Roll to next batch after 10 records
	if(batch_pos == 10)
	{
		batch_number += 1;
		batch_pos     = 0;
	}
}
info "END. STEP 10: Queue written | total=" + total_queued + " | batches=" + batch_number;

// ── STEP 11: Update MPS progress counters ────────────────────────────────
info "INIT. STEP 11: Update MPS progress";
zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {
	"mps_progress_total": total_queued,
	"mps_progress_done":  0,
	"mps_progress_error": 0
});
info "END. STEP 11: mps_progress_total=" + total_queued;

// ── STEP 12: Release global lock ─────────────────────────────────────────
info "INIT. STEP 12: Release lock";
payroll_run_cfg.put("lock", false);
active_settings.put("payroll_run", payroll_run_cfg);
payroll_settings.put("active_settings", active_settings);
invokeurl
[
	url :settings_update_url
	type :POST
	parameters:{"value":payroll_settings.toString()}
	connection:"zoho_people_payroll_conn"
];
info "END. STEP 12: Lock released.";

info "END. runPayrollOrchestrator | period=" + payroll_period
   + " | queued=" + total_queued + " | batches=" + batch_number;

return {
	"status":   "success",
	"period":   payroll_period,
	"queued":   total_queued,
	"batches":  batch_number
};
