// ============================================================
// Function : portalCreateMPS
// Trigger  : RunPayroll wizard Step 1 — "Create" button
// Inputs   : payroll_period      — String "YYYY-MM"
//            scope               — String "all" | "by_department" | "by_employee"
//            selected_department — String (empty when scope != by_department)
//            selected_employees  — List of employee ID strings (by_employee scope)
//            force               — Boolean — bypasses duplicate guard when true
//                                  (only sent when allow_multiple_runs = true)
// Returns  : {
//     status       : "success" | "error"
//     run_id       : String — MPS record ID (canonical run key)
//     period       : String "YYYY-MM"
//     working_days : Integer
//     holidays     : [ { date: "YYYY-MM-DD", name: String } ]
//     message      : String
//   }
// Error returns:
//     { status: "error", message: "A payroll run for YYYY-MM already exists." }
//     { status: "error", message: "Invalid payroll_period: ..." }
//     { status: "error", message: "working_days resolved to 0 ..." }
// Reads    : PAYROLL_PORTAL_CONFIG, Zoho holiday API (if source=zoho)
// Writes   : Monthly_Payroll_Setup
// ============================================================

info "INIT. portalCreateMPS | period=" + payroll_period + " | scope=" + scope + " | force=" + force;

result = Map();

// ── STEP 1: Validate period format ───────────────────────────────────────────
if(ifnull(payroll_period, "") == "" || payroll_period.length() != 7)
{
	result.put("status",  "error");
	result.put("message", "Invalid payroll_period: " + payroll_period + ". Expected format: YYYY-MM.");
	return result;
}

// ── STEP 2: Load portal config ────────────────────────────────────────────────
portal_cfg_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];

if(portal_cfg_response.get("variable") == null)
{
	result.put("status",  "error");
	result.put("message", "PAYROLL_PORTAL_CONFIG not found. Run initial configuration first.");
	return result;
}

portal_var     = portal_cfg_response.get("variable").get("value");
config_block   = ifnull(portal_var.get("config"), Map());
holiday_source = ifnull(config_block.get("default_holiday_source"), "zoho");
allow_multi    = ifnull(config_block.get("allow_multiple_runs"),    false);

info "holiday_source=" + holiday_source + " | allow_multiple_runs=" + allow_multi;

// ── STEP 3: Duplicate period guard ───────────────────────────────────────────
force_flag = (ifnull(force, false) == true || ifnull(force, "") == "true");

existing_mps = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(existing_mps.size() > 0 && !force_flag)
{
	result.put("status",  "error");
	result.put("message", "A payroll run for " + payroll_period + " already exists.");
	return result;
}

// ── STEP 4: Derive period boundaries ─────────────────────────────────────────
period_start = (payroll_period + "-01").toDate();
period_year  = period_start.year();
period_month = period_start.month();
period_end   = period_start.addMonth(1).subDay(1);

info "period_start=" + period_start.toString("yyyy-MM-dd")
   + " | period_end=" + period_end.toString("yyyy-MM-dd");

// ── STEP 5: Resolve holiday list and working days ─────────────────────────────
final_working_days = 0;
holidays_list      = List();

if(holiday_source == "zoho")
{
	holiday_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/leave/v2/holidays"
		type :GET
		parameters:{"year":period_year.toString()}
		connection:"zoho_people_payroll_conn"
	];

	zoho_holiday_dates = List();

	if(ifnull(holiday_response.get("status"), 1) == 0)
	{
		for each h in holiday_response.get("result")
		{
			h_date = h.get("date").toDate();
			if(h_date.month() == period_month)
			{
				zoho_holiday_dates.add(h_date);
				hol = Map();
				hol.put("date", h_date.toString("yyyy-MM-dd"));
				hol.put("name", h.get("name"));
				holidays_list.add(hol);
			}
		}
	}

	final_working_days = period_start.subDay(1).workDaysBetween(
	                       period_end,
	                       {"Friday","Saturday"},
	                       zoho_holiday_dates
	                     );

	info "Zoho source | holidays=" + holidays_list.size()
	   + " | working_days=" + final_working_days;
}
else
{
	// Manual source — holidays start empty; user adds via portalUpdateMPSHolidays
	// Working days default comes from attendance settings
	settings_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	att_raw            = ifnull(settings_response.get("variable").get("value").get("active_settings").get("attendance"), Map());
	final_working_days = ifnull(att_raw.get("working_days_default"), 22).toInteger();
	holidays_list      = List();
	info "Manual source | default working_days=" + final_working_days;
}

// ── STEP 6: Working days safety floor ────────────────────────────────────────
if(final_working_days == null || final_working_days <= 0)
{
	result.put("status",  "error");
	result.put("message", "working_days resolved to " + final_working_days
	                    + " — cannot create MPS with 0 or negative working days.");
	return result;
}

// ── STEP 7: Serialise scope and holidays for storage ─────────────────────────
scope_val        = ifnull(scope, "all");
dept_val         = ifnull(selected_department, "");
emps_val         = ifnull(selected_employees, List());
holidays_json    = holidays_list.toString();   // stored as JSON string

// ── STEP 8: Write Monthly_Payroll_Setup ──────────────────────────────────────
mps_fields = Map();
mps_fields.put("mps_payroll_period",     payroll_period);
mps_fields.put("mps_working_days",       final_working_days);
mps_fields.put("mps_public_holidays",    holidays_json);
mps_fields.put("mps_status",             "Draft");
mps_fields.put("mps_scope",              scope_val);
mps_fields.put("mps_selected_department",dept_val);
mps_fields.put("mps_selected_employees", emps_val.toString());
mps_fields.put("mps_progress_total",     0);
mps_fields.put("mps_progress_done",      0);
mps_fields.put("mps_progress_error",     0);
mps_fields.put("mps_batches",            0);
mps_fields.put("mps_gross",              null);
mps_fields.put("mps_net",               null);
mps_fields.put("mps_tax",               null);
mps_fields.put("mps_si",               null);
mps_fields.put("mps_created_by",         zoho.loginuserid);
mps_fields.put("mps_created_at",         zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));

create_response = zoho.people.addRecord("Monthly_Payroll_Setup", mps_fields);
new_mps_id      = create_response.get("ID");

info "END. portalCreateMPS | run_id=" + new_mps_id
   + " | working_days=" + final_working_days
   + " | holidays=" + holidays_list.size();

result.put("status",       "success");
result.put("run_id",       new_mps_id);
result.put("period",       payroll_period);
result.put("working_days", final_working_days);
result.put("holidays",     holidays_list);
result.put("message",      "MPS created for " + payroll_period);
return result;
