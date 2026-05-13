// ============================================================
// Function : processTerminationRun
// Version  : Orca Payroll Lit 2.0
// Trigger  : Workflow B — Payroll_Queue record create
//            Condition : pq_is_final_settlement = true
//            Action    : Immediate custom function
// Inputs   : employee_id  ← pq_employee_id
//            exit_date    ← pq_exit_date
//            queue_id     ← pq_ID (queue record being created)
//
// Responsibilities:
//   STEP 1  — Load config from PAYROLL_SETTINGS_JSON
//   STEP 2  — Derive payroll period from exit_date
//   STEP 3  — Validate Monthly_Payroll_Setup exists for exit period
//   STEP 4  — Build public_holiday_dates list from MPS
//   STEP 5  — Read employee profile from P_Employee
//   STEP 6  — Compute YTD from prior Final records (current calendar year)
//   STEP 7  — Fix 2: check for existing regular record — convert to Draft if found
//   STEP 8  — Fetch attendance (month_start → exit_date, partial month)
//   STEP 9  — Fetch unpaid leave (month_start → exit_date)
//   STEP 10 — Count actual working days via .workDaysBetween() native Deluge
//             Egyptian weekend: Friday + Saturday
//             Replaces count_working_days invokeUrl call (retired in Lit 2.0)
//   STEP 11 — Pro-rate gross salary by days_worked / working_days
//   STEP 12 — Core calculations: SI, Tax, Attendance (3 standalone functions)
//   STEP 13 — Compute final net
//   STEP 14 — Write Monthly_Payroll_Record
//   STEP 15 — Mark queue record Done (function owns queue closure)
//
// Key differences from batch path:
//   - Calls 3 standalone functions individually (not calculateEmployeePayroll)
//   - Pro-rates gross — working_days passed to attendance = days_worked (partial)
//   - No snapshot fields — reads employee profile and YTD directly
//   - Owns queue closure at Step 15 (Workflow B does not close queue)
// ============================================================

info "INIT. processTerminationRun | employee: " + employee_id
   + " | exit_date: " + exit_date.toString("yyyy-MM-dd")
   + " | queue_id: " + queue_id;

// ── STEP 1: Load config ───────────────────────────────────────────────────────
info "INIT. STEP 1: Load config";
settings_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
payroll_settings = settings_response.get("variable").get("value");
active_settings  = payroll_settings.get("active_settings");

si_block        = active_settings.get("social_insurance");
apply_insurance = si_block.get("apply_insurance");
entity_type     = si_block.get("entity_type");

tax_block       = active_settings.get("income_tax");
apply_tax       = tax_block.get("apply_tax");

info "END. STEP 1: apply_insurance=" + apply_insurance
   + " | apply_tax=" + apply_tax + " | entity_type=" + entity_type;

// ── STEP 2: Derive period ─────────────────────────────────────────────────────
info "INIT. STEP 2: Derive period";
period_year    = exit_date.year();
period_month   = exit_date.month();
current_period = period_year.toString() + "-" + period_month.toString("00");
current_year   = period_year;
// Fix 8: month_start as Date object — format-safe throughout
month_start    = (current_period + "-01").toDate();
info "END. STEP 2: current_period=" + current_period
   + " | month_start=" + month_start.toString("yyyy-MM-dd");

// ── STEP 3: Validate Monthly_Payroll_Setup ────────────────────────────────────
// Status check omitted — termination may fire before or after the regular run
info "INIT. STEP 3: Validate MPS";
setup_recs = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":current_period});

if(setup_recs.size() == 0)
{
	zoho.people.update("Payroll_Queue",
		{"recordid":  queue_id,
		 "pq_status": "Error",
		 "pq_error":  "No Monthly_Payroll_Setup found for period " + current_period
		            + ". HR must create a setup record before this termination can be processed."},
		"zoho_people_payroll_conn");
	info "ERROR. No MPS for period=" + current_period + ". Queue marked Error.";
	return;
}

monthly_setup = setup_recs.get(0);
working_days  = monthly_setup.get("mps_working_days").toInteger();

// Fix E: working_days guard
if(working_days == null || working_days <= 0)
{
	zoho.people.update("Payroll_Queue",
		{"recordid":  queue_id,
		 "pq_status": "Error",
		 "pq_error":  "mps_working_days is " + working_days + " for period "
		            + current_period + " — cannot pro-rate salary."},
		"zoho_people_payroll_conn");
	info "ERROR. mps_working_days invalid. Queue marked Error.";
	return;
}
info "END. STEP 3: MPS valid | working_days=" + working_days;

// ── STEP 4: Build public_holiday_dates list ───────────────────────────────────
// Fix 8: stored as Date objects — format-safe for attendance loop and workDaysBetween
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
info "END. STEP 4: public_holiday_dates count=" + public_holiday_dates.size();

// ── STEP 5: Read employee profile ─────────────────────────────────────────────
info "INIT. STEP 5: Read employee profile";
emp_rec = zoho.people.getRecordById("P_Employee", employee_id);
if(emp_rec == null || emp_rec.isEmpty())
{
	zoho.people.update("Payroll_Queue",
		{"recordid":  queue_id,
		 "pq_status": "Error",
		 "pq_error":  "Employee record not found for ID: " + employee_id},
		"zoho_people_payroll_conn");
	info "ERROR. Employee not found: " + employee_id;
	return;
}

// Fix A: null/empty allowances treated as 0
emp_basic_salary = ifnull(emp_rec.get("emp_basic_salary"),        "0").toDecimal();
emp_housing      = ifnull(emp_rec.get("emp_housing_allowance"),   "0").toDecimal();
emp_transport    = ifnull(emp_rec.get("emp_transport_allowance"), "0").toDecimal();
emp_medical      = ifnull(emp_rec.get("emp_medical_allowance"),   "0").toDecimal();
emp_other        = ifnull(emp_rec.get("emp_other_allowances"),    "0").toDecimal();
total_allowances = emp_housing + emp_transport + emp_medical + emp_other;
gross_salary     = emp_basic_salary + total_allowances;

// SI subscription wage — fallback to gross if not set
subscription_wage = ifnull(emp_rec.get("emp_si_subscription_wage"), "0").toDecimal();
if(subscription_wage <= 0) { subscription_wage = gross_salary; }

// Fix 8: .toDate() for safe parsing
hire_date  = emp_rec.get("DateofJoining").toDate();
hire_month = hire_date.month();
hire_year  = hire_date.year();

info "END. STEP 5: gross_salary=" + gross_salary
   + " | subscription_wage=" + subscription_wage
   + " | hire_date=" + hire_date.toString("yyyy-MM-dd");

// Per-employee override resolution
// null = use org setting from PAYROLL_SETTINGS_JSON | true/false = per-employee override
emp_si_override  = emp_rec.get("emp_si_override");
emp_tax_override = emp_rec.get("emp_tax_override");
effective_apply_insurance = (emp_si_override  != null) ? emp_si_override  : apply_insurance;
effective_apply_tax       = (emp_tax_override != null) ? emp_tax_override : apply_tax;
info "effective_apply_insurance=" + effective_apply_insurance
   + " | effective_apply_tax=" + effective_apply_tax;

// ── STEP 6: YTD from prior Final records this calendar year ───────────────────
// ytd_si / ytd_martyrs omitted — Annual Reconciliation dropped in Lit
info "INIT. STEP 6: Compute YTD";
prior_finals = zoho.people.getRecords("Monthly_Payroll_Record",
	{"searchField": "pr_employee","searchOperator":"Is","searchText":employee_id,
	 "searchField2":"pr_status",  "searchOperator2":"Is","searchText2":"Final"});

ytd_gross        = 0.0;
ytd_tax_withheld = 0.0;
for each pr in prior_finals
{
	if(pr.get("pr_payroll_period").startsWith(current_year.toString()))
	{
		ytd_gross        = ytd_gross + ifnull(pr.get("pr_gross_salary"), "0").toDecimal();
		ytd_tax_withheld = ytd_tax_withheld + ifnull(pr.get("pr_monthly_tax"), "0").toDecimal();
	}
}
info "END. STEP 6: ytd_gross=" + ytd_gross + " | ytd_tax_withheld=" + ytd_tax_withheld;

// ── STEP 7: Fix 2 — Existing regular record conversion ───────────────────────
// If a regular run completed for this period before the termination fired,
// convert that record to Draft + increment run_sequence.
info "INIT. STEP 7: Fix 2 — existing regular record check";
target_record_id = null;
existing_regular = zoho.people.getRecords("Monthly_Payroll_Record",
	{"searchField": "pr_employee",            "searchOperator":"Is","searchText":employee_id,
	 "searchField2":"pr_payroll_period",      "searchOperator2":"Is","searchText2":current_period,
	 "searchField3":"pr_is_final_settlement", "searchOperator3":"Is","searchText3":"false"});

if(existing_regular.size() > 0)
{
	existing_pr     = existing_regular.get(0);
	existing_pr_id  = existing_pr.get("ID");
	existing_pr_seq = ifnull(existing_pr.get("pr_run_sequence"), "0").toInteger();
	zoho.people.update("Monthly_Payroll_Record",
		{"recordid":       existing_pr_id,
		 "pr_status":      "Draft",
		 "pr_is_rerun":    true,
		 "pr_run_sequence":existing_pr_seq + 1,
		 "pr_rerun_reason":"Converted to termination run on employee exit"},
		"zoho_people_payroll_conn");
	target_record_id = existing_pr_id;
	info "Fix 2: existing regular record " + existing_pr_id + " converted to Draft.";
}
info "END. STEP 7: target_record_id=" + ifnull(target_record_id, "null (new record)");

// ── STEP 8: Fetch attendance (month_start → exit_date, partial month) ─────────
info "INIT. STEP 8: Fetch attendance";
absent_days    = 0;
late_minutes   = 0;
overtime_hours = 0.0;
ph_days_worked = 0;

att_response = invokeurl
[
	url :"https://people.zoho.com/people/api/attendance/getUserReport"
	type :GET
	parameters:{
		"empId":      employee_id,
		"sdate":      month_start.toString("yyyy-MM-dd"),
		"edate":      exit_date.toString("yyyy-MM-dd"),
		"dateFormat": "yyyy-MM-dd"
	}
	connection:"zoho_people_payroll_conn"
];

if(att_response.get("status") == 0)
{
	att_results = att_response.get("result");
	for each emp_att in att_results
	{
		if(emp_att.get("employeeDetails").get("id") == employee_id)
		{
			daily_data = emp_att.get("attendanceDetails");
			for each day_key in daily_data.keySet()
			{
				day_detail = daily_data.get(day_key);
				day_status = day_detail.get("Status");

				if(day_status == "Absent") { absent_days += 1; }

				// Late — positive DeviationTime only (negative = early arrival, excluded)
				deviation = day_detail.get("DeviationTime");
				if(deviation != null && deviation != "00:00" && !deviation.startsWith("-"))
				{
					dev_parts    = deviation.split(":");
					late_minutes = late_minutes
					             + (dev_parts.get(0).toLong() * 60)
					             + dev_parts.get(1).toLong();
				}

				// Overtime
				ot = day_detail.get("OverTime");
				if(ot != null && ot != "00:00")
				{
					ot_parts       = ot.split(":");
					overtime_hours = overtime_hours
					               + ot_parts.get(0).toLong()
					               + (ot_parts.get(1).toLong() / 60.0);
				}

				// Fix 8: .toDate() both sides — format-safe public holiday check
				if(public_holiday_dates.contains(day_key.toDate())) { ph_days_worked += 1; }
			}
			break;
		}
	}
}
info "END. STEP 8: absent=" + absent_days + " | late_min=" + late_minutes
   + " | ot_hrs=" + overtime_hours.round(2) + " | ph=" + ph_days_worked;

// ── STEP 9: Fetch unpaid leave (month_start → exit_date) ──────────────────────
info "INIT. STEP 9: Fetch unpaid leave";
unpaid_leave_days = 0;

leave_response = invokeurl
[
	url :"https://people.zoho.com/people/api/leave/v2/getLeaveDetails"
	type :GET
	parameters:{
		"userId": employee_id,
		"from":   month_start.toString("yyyy-MM-dd"),
		"to":     exit_date.toString("yyyy-MM-dd"),
		"type":   "UNPAID"
	}
	connection:"zoho_people_payroll_conn"
];

if(leave_response.get("status") == 0)
{
	leave_list = leave_response.get("result");
	if(leave_list != null)
	{
		for each leave_rec in leave_list
		{
			unpaid_leave_days = unpaid_leave_days
			                  + ifnull(leave_rec.get("noOfDays"), "0").toDecimal();
		}
	}
}
info "END. STEP 9: unpaid_leave_days=" + unpaid_leave_days;

// ── STEP 10: Count actual working days (month_start → exit_date) ──────────────
// Native Deluge .workDaysBetween() replaces count_working_days custom function (retired)
// Egyptian weekend: Friday + Saturday (passed explicitly — Deluge default is Sat/Sun)
// workDaysBetween is EXCLUSIVE of start_date:
//   pass month_start.subDay(1) to include the 1st of the month in the count
info "INIT. STEP 10: count_working_days";
days_worked = month_start.subDay(1).workDaysBetween(
                exit_date,
                {"Friday","Saturday"},
                public_holiday_dates
              );

// Safety floor — guard against exit on a weekend
if(days_worked == null || days_worked <= 0) { days_worked = 1; }
info "END. STEP 10: days_worked=" + days_worked;

// ── STEP 11: Pro-rate gross salary ────────────────────────────────────────────
// Pro-ration: days_worked / working_days (full-month days from MPS)
info "INIT. STEP 11: Pro-rate gross";
final_gross    = ((gross_salary / working_days) * days_worked).round(2);
final_sub_wage = ((subscription_wage / working_days) * days_worked).round(2);
info "END. STEP 11: final_gross=" + final_gross + " | final_sub_wage=" + final_sub_wage;

// ── STEP 12: Core calculations ────────────────────────────────────────────────
// 3 standalone functions — not calculateEmployeePayroll (batch path only)
// Attendance working_days = days_worked (partial month) — correct daily rate
info "INIT. STEP 12: Core calculations";

// — Social Insurance —
si_param = Map();
si_param.put("employee_id",       employee_id);
si_param.put("subscription_wage", final_sub_wage);
si_param.put("entity_type",       entity_type);
si_param.put("gross_salary",      final_gross);
si_param.put("apply_insurance",   effective_apply_insurance);

si_result = invokeurl
[
	url :"https://people.zoho.com/api/v3/function/calculateSocialInsurance/execute"
	type :POST
	parameters:si_param
	connection:"zoho_people_payroll_conn"
];
info "si_result: " + si_result;

// — Income Tax — forward annualisation on pro-rated gross
tax_param = Map();
tax_param.put("employee_id",  employee_id);
tax_param.put("gross_salary", final_gross);
tax_param.put("si_deduction", si_result.get("employee_si"));
tax_param.put("martyrs_fund", si_result.get("martyrs_fund"));
tax_param.put("hire_month",   hire_month);
tax_param.put("hire_year",    hire_year);
tax_param.put("payroll_year", current_year);
tax_param.put("apply_tax",    effective_apply_tax);

tax_result = invokeurl
[
	url :"https://people.zoho.com/api/v3/function/calculatePayroll/execute"
	type :POST
	parameters:tax_param
	connection:"zoho_people_payroll_conn"
];
info "tax_result: " + tax_result;

// — Attendance Adjustments —
// working_days = days_worked (partial month) — daily rate stays correct
att_param = Map();
att_param.put("employee_id",              employee_id);
att_param.put("gross_salary",             final_gross);
att_param.put("working_days",             days_worked);
att_param.put("absent_days",              absent_days);
att_param.put("unpaid_leave_days",        unpaid_leave_days);
att_param.put("late_minutes",             late_minutes);
att_param.put("overtime_hours",           overtime_hours.round(2));
att_param.put("public_holiday_days_worked", ph_days_worked);

att_result = invokeurl
[
	url :"https://people.zoho.com/api/v3/function/calculateAttendanceAdjustments/execute"
	type :POST
	parameters:att_param
	connection:"zoho_people_payroll_conn"
];
info "att_result: " + att_result;
info "END. STEP 12: Calculations done.";

// ── STEP 13: Compute final net ────────────────────────────────────────────────
info "INIT. STEP 13: Compute final net";
total_deductions = ifnull(si_result.get("total_employee_deduction"), "0").toDecimal()
                 + ifnull(tax_result.get("monthly_tax"),             "0").toDecimal()
                 + ifnull(att_result.get("absence_deduction"),       "0").toDecimal()
                 + ifnull(att_result.get("unpaid_leave_deduction"),  "0").toDecimal()
                 + ifnull(att_result.get("late_deduction"),          "0").toDecimal();

total_additions  = ifnull(att_result.get("overtime_addition"),       "0").toDecimal()
                 + ifnull(att_result.get("public_holiday_addition"), "0").toDecimal();

final_net = (final_gross - total_deductions + total_additions).round(2);
if(final_net < 0) { final_net = 0; }

info "END. STEP 13: total_deductions=" + total_deductions
   + " | total_additions=" + total_additions + " | final_net=" + final_net;

// ── STEP 14: Write Monthly_Payroll_Record ─────────────────────────────────────
// Fix 2: if target_record_id set → update in place, otherwise → create new
info "INIT. STEP 14: Write payroll record";
pr_fields = Map();
pr_fields.put("pr_employee",                     employee_id);
pr_fields.put("pr_payroll_period",               current_period);
pr_fields.put("pr_payslip_issue_date",           monthly_setup.get("mps_payslip_issue_date"));
pr_fields.put("pr_basic_salary",                 emp_basic_salary);
pr_fields.put("pr_total_allowances",             total_allowances);
pr_fields.put("pr_gross_salary",                 final_gross);
pr_fields.put("pr_si_subscription_wage",         ifnull(si_result.get("subscription_wage"),  "0").toDecimal());
pr_fields.put("pr_si_capped_wage",               ifnull(si_result.get("capped_wage"),        "0").toDecimal());
pr_fields.put("pr_si_monthly_ceiling",           ifnull(si_result.get("monthly_ceiling"),    "0").toDecimal());
pr_fields.put("pr_employee_si_deduction",        ifnull(si_result.get("employee_si"),        "0").toDecimal());
pr_fields.put("pr_martyrs_fund",                 ifnull(si_result.get("martyrs_fund"),       "0").toDecimal());
pr_fields.put("pr_employer_si",                  ifnull(si_result.get("employer_si"),        "0").toDecimal());
pr_fields.put("pr_monthly_personal_exemption",   ifnull(tax_result.get("monthly_personal_exemption"), "0").toDecimal());
pr_fields.put("pr_monthly_net_taxable",          ifnull(tax_result.get("monthly_net_taxable"),        "0").toDecimal());
pr_fields.put("pr_annual_net_taxable",           ifnull(tax_result.get("annual_net_taxable"),         "0").toDecimal());
pr_fields.put("pr_annual_tax",                   ifnull(tax_result.get("annual_tax"),                 "0").toDecimal());
pr_fields.put("pr_monthly_tax",                  ifnull(tax_result.get("monthly_tax"),                "0").toDecimal());
pr_fields.put("pr_working_days",                 working_days);
pr_fields.put("pr_absent_days",                  absent_days);
pr_fields.put("pr_unpaid_leave_days",            unpaid_leave_days);
pr_fields.put("pr_late_minutes",                 late_minutes);
pr_fields.put("pr_overtime_hours",               overtime_hours.round(2));
pr_fields.put("pr_ph_days_worked",               ph_days_worked);
pr_fields.put("pr_absence_deduction",            ifnull(att_result.get("absence_deduction"),       "0").toDecimal());
pr_fields.put("pr_unpaid_leave_deduction",       ifnull(att_result.get("unpaid_leave_deduction"),  "0").toDecimal());
pr_fields.put("pr_late_deduction",               ifnull(att_result.get("late_deduction"),          "0").toDecimal());
pr_fields.put("pr_overtime_addition",            ifnull(att_result.get("overtime_addition"),       "0").toDecimal());
pr_fields.put("pr_public_holiday_addition",      ifnull(att_result.get("public_holiday_addition"), "0").toDecimal());
pr_fields.put("pr_total_attendance_adjustment",  ifnull(att_result.get("total_adjustment"),        "0").toDecimal());
pr_fields.put("pr_total_deductions",             total_deductions);
pr_fields.put("pr_total_additions",              total_additions);
pr_fields.put("pr_net_salary",                   final_net);
pr_fields.put("pr_ytd_gross",                    (ytd_gross + final_gross).round(2));
pr_fields.put("pr_ytd_tax_withheld",             (ytd_tax_withheld + ifnull(tax_result.get("monthly_tax"), "0").toDecimal()).round(2));
pr_fields.put("pr_status",                       "Final");
pr_fields.put("pr_is_final_settlement",          true);
pr_fields.put("pr_final_settlement_days_worked", days_worked);
pr_fields.put("pr_is_rerun",                     (target_record_id != null));
pr_fields.put("pr_generated_at",                 zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));

if(ifnull(target_record_id, "") != "")
{
	pr_fields.put("recordid", target_record_id);
	zoho.people.update("Monthly_Payroll_Record", pr_fields, "zoho_people_payroll_conn");
	info "Termination record updated in place: " + target_record_id;
}
else
{
	zoho.people.create("Monthly_Payroll_Record", pr_fields, "zoho_people_payroll_conn");
	info "New termination payroll record created.";
}
info "END. STEP 14: Payroll record written.";

// ── STEP 15: Mark queue record Done ──────────────────────────────────────────
// Function owns queue closure — Workflow B passes queue_id from pq_ID
// Scheduler is NOT involved in the termination path
info "INIT. STEP 15: Mark queue Done";
if(ifnull(queue_id, "") != "")
{
	zoho.people.update("Payroll_Queue",
		{"recordid":        queue_id,
		 "pq_status":       "Done",
		 "pq_processed_at": zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss")},
		"zoho_people_payroll_conn");
	info "Queue record " + queue_id + " marked Done.";
}
info "END. STEP 15: Queue closed.";

info "END. processTerminationRun | employee=" + employee_id
   + " | period=" + current_period
   + " | days_worked=" + days_worked
   + " | final_net=" + final_net;
