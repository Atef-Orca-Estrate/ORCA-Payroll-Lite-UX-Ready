// ============================================================
// Function : portalCreateMPS
// Phase    : B3
// Trigger  : Webtab — feature_run_payroll, period selected
// Inputs   : payroll_period  — String "YYYY-MM" (always from webtab)
//            holiday_list    — String: newline-separated "YYYY-MM-DD Name" lines
//                             (used if default_holiday_source = "manual")
//                             (ignored if default_holiday_source = "zoho")
//            working_days    — Integer
//                             (from webtab JS calculation if manual)
//                             (ignored if default_holiday_source = "zoho" — recalculated here)
// Returns  : {
//     status       : "success" | "error"
//     message      : String
//     period       : String "YYYY-MM"
//     working_days : Integer
//     holidays     : String — mps_public_holidays text (for HR review before run)
//     mps_id       : String — ID of created MPS record
//   }
// Reads    : PAYROLL_PORTAL_CONFIG.config, Zoho People holiday API (if source=zoho)
// Writes   : Monthly_Payroll_Setup
// ============================================================

info "INIT. portalCreateMPS | period=" + payroll_period;

result = Map();

// ── STEP 1: Load portal config ────────────────────────────────────────────────
portal_cfg_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
portal_config   = portal_cfg_response.get("variable").get("value");
config_block    = portal_config.get("config");
holiday_source  = config_block.get("default_holiday_source");  // "zoho" | "manual"
info "holiday_source=" + holiday_source;

// ── STEP 2: Validate period format ───────────────────────────────────────────
if(ifnull(payroll_period, "") == "" || payroll_period.length() != 7)
{
	result.put("status",  "error");
	result.put("message", "Invalid payroll_period: " + payroll_period + ". Expected format: YYYY-MM.");
	return result;
}

// ── STEP 3: Duplicate period guard ───────────────────────────────────────────
existing_mps = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(existing_mps.size() > 0)
{
	existing = existing_mps.get(0);
	result.put("status",        "error");
	result.put("message",       "Monthly_Payroll_Setup already exists for period " + payroll_period
	                          + " (status: " + existing.get("mps_status") + ").");
	result.put("existing_mps_id", existing.get("ID"));
	return result;
}

// ── STEP 4: Derive period boundaries ─────────────────────────────────────────
period_start = (payroll_period + "-01").toDate();
period_year  = period_start.year();
period_month = period_start.month();
// Last day: add 1 month then subtract 1 day — handles all month lengths
period_end   = period_start.addMonth(1).subDay(1);

info "period_start=" + period_start.toString("yyyy-MM-dd")
   + " | period_end=" + period_end.toString("yyyy-MM-dd");

// ── STEP 5: Resolve holiday list and working days ─────────────────────────────
mps_holidays_text = "";
final_working_days = 0;

if(holiday_source == "zoho")
{
	// Fetch public holidays from Zoho People holiday calendar for the year
	holiday_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/leave/v2/holidays"
		type :GET
		parameters:{"year":period_year.toString()}
		connection:"zoho_people_payroll_conn"
	];
	info "Zoho holiday API response status: " + holiday_response.get("status");

	// Build Date list and text — filter to current month only
	zoho_holidays     = List();
	mps_holidays_text = "";

	if(holiday_response.get("status") == 0)
	{
		for each h in holiday_response.get("result")
		{
			h_date = h.get("date").toDate();
			if(h_date.month() == period_month)
			{
				zoho_holidays.add(h_date);
				mps_holidays_text = mps_holidays_text
				                  + h_date.toString("yyyy-MM-dd")
				                  + " " + h.get("name") + "\n";
			}
		}
	}
	mps_holidays_text = mps_holidays_text.trim();

	// Calculate working days server-side using native Deluge function
	// Egyptian weekend: Friday + Saturday
	// workDaysBetween is exclusive of start_date — subtract 1 day to include the 1st
	final_working_days = period_start.subDay(1).workDaysBetween(
	                       period_end,
	                       {"Friday","Saturday"},
	                       zoho_holidays
	                     );

	info "Zoho source | zoho_holidays=" + zoho_holidays.size()
	   + " | final_working_days=" + final_working_days;
}
else
{
	// "manual" — trust values passed in from webtab JS calculation
	final_working_days = ifnull(working_days, "0").toInteger();
	mps_holidays_text  = ifnull(holiday_list, "").trim();
	info "Manual source | working_days=" + final_working_days;
}

// ── STEP 6: Working days safety floor ────────────────────────────────────────
if(final_working_days == null || final_working_days <= 0)
{
	result.put("status",  "error");
	result.put("message", "working_days resolved to " + final_working_days
	                    + " — cannot create MPS with 0 or negative working days.");
	return result;
}

// ── STEP 7: Write Monthly_Payroll_Setup ──────────────────────────────────────
mps_fields = Map();
mps_fields.put("mps_payroll_period",  payroll_period);
mps_fields.put("mps_working_days",    final_working_days);
mps_fields.put("mps_public_holidays", mps_holidays_text);
mps_fields.put("mps_status",          "Ready");
mps_fields.put("mps_progress_total",  0);
mps_fields.put("mps_progress_done",   0);
mps_fields.put("mps_progress_error",  0);
mps_fields.put("mps_payslip_issue_date", zoho.currenttime.toString("yyyy-MM-dd"));
mps_fields.put("mps_created_by",        zoho.loginuserid);
mps_fields.put("mps_created_at",        zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));

create_response = zoho.people.addRecord("Monthly_Payroll_Setup", mps_fields);
new_mps_id      = create_response.get("ID");

info "END. portalCreateMPS | mps_id=" + new_mps_id
   + " | working_days=" + final_working_days;

result.put("status",       "success");
result.put("message",      "Monthly_Payroll_Setup created for period " + payroll_period + ".");
result.put("period",       payroll_period);
result.put("working_days", final_working_days);
result.put("holidays",     mps_holidays_text);
result.put("mps_id",       new_mps_id);
return result;
