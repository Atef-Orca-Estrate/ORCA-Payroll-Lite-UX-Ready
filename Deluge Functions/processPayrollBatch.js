// ============================================================
// Function : processPayrollBatch
// Version  : Orca Payroll Lit 2.0
// Trigger  : Workflow A — time-based on pq_queue_at
//            Condition : pq_queue_at is not empty
//                        AND pq_is_final_settlement = false
// Inputs   : batch_number    — Integer (pq_batch_number)
//            payroll_period  — String  "YYYY-MM" (pq_payroll_period)
//
// Responsibilities (Lit 2.0 — optimized):
//   STEP 1  — Read all config ONCE per batch (not per employee)
//             Fetches: PAYROLL_SETTINGS_JSON, SI_CONFIG_JSON,
//             TAX_CONFIG_JSON, TAX_BRACKETS_STD_JSON,
//             TAX_BRACKETS_HI_JSON, ATTENDANCE_RULES_JSON
//   STEP 2  — Read MPS record for working_days + payslip_issue_date
//   STEP 3  — Fetch batch queue records (Pending, this batch_number)
//   STEP 4  — Per-employee loop:
//             a. Parse 7 snapshot fields from queue record — zero extra reads
//             a-2. Fetch unpaid leave live — 1 invokeUrl per employee
//                  (moved from Orchestrator STEP 9 to reduce Orchestrator runtime)
//             b. Call calculateEmployeePayroll — 1 invokeUrl (was 3)
//             c. Compute final_net
//             d. Rerun check — convert existing record in place if found
//             e. Write Monthly_Payroll_Record
//             f. Mark queue Done / Error
//   STEP 5  — Update MPS progress counters (read-then-write — concurrent safe)
//   STEP 6  — Completion check — query remaining Pending
//             If 0 remaining → MPS status = Completed
//             Fix 14: clear by_employee scope only on clean completion
// ============================================================

info "INIT. processPayrollBatch | batch: " + batch_number + " | period: " + payroll_period;

// ── STEP 1: Read all config ONCE ─────────────────────────────────────────────
// All fetches happen here — calculateEmployeePayroll receives them as params.
// Zero config reads inside the per-employee loop.
info "INIT. STEP 1: Load config";

// — PAYROLL_SETTINGS_JSON ─────────────────────────────────────────────────────
settings_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
payroll_settings = settings_response.get("variable").get("value");
active_settings  = payroll_settings.get("active_settings");
apply_insurance  = active_settings.get("social_insurance").get("apply_insurance");
entity_type      = active_settings.get("social_insurance").get("entity_type");
apply_tax        = active_settings.get("income_tax").get("apply_tax");
scope            = active_settings.get("payroll_run").get("scope");

// — SI_CONFIG_JSON ─────────────────────────────────────────────────────────────
si_config = Map();
if(apply_insurance)
{
	si_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/SI_CONFIG_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	si_config = si_response.get("variable").get("value");
}

// — TAX_CONFIG_JSON + BRACKETS ────────────────────────────────────────────────
// Fetch both bracket sets — employee's annual_net determines which is used at runtime
tax_config = Map();
tax_std    = Map();
tax_hi     = Map();
if(apply_tax)
{
	tax_cfg_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/TAX_CONFIG_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	tax_config = tax_cfg_response.get("variable").get("value");

	tax_std_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/TAX_BRACKETS_STD_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	tax_std = tax_std_response.get("variable").get("value");

	tax_hi_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/TAX_BRACKETS_HI_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	tax_hi = tax_hi_response.get("variable").get("value");
}

// — ATTENDANCE_RULES_JSON ─────────────────────────────────────────────────────
att_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/ATTENDANCE_RULES_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
att_rules = att_response.get("variable").get("value");

info "END. STEP 1: Config loaded | apply_insurance=" + apply_insurance
   + " | apply_tax=" + apply_tax + " | entity_type=" + entity_type;

// ── STEP 2: Read MPS record ───────────────────────────────────────────────────
info "INIT. STEP 2: Read MPS";
mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(mps_list.size() == 0)
{
	info "ERROR. No MPS found for period=" + payroll_period + ". Batch cannot continue.";
	return;
}
monthly_setup      = mps_list.get(0);
mps_id             = monthly_setup.get("ID");
working_days       = monthly_setup.get("mps_working_days").toInteger();
payslip_issue_date = monthly_setup.get("mps_payslip_issue_date");

// Fix E: working_days guard — should never be 0 here (Orchestrator validated) but guard anyway
if(working_days == null || working_days <= 0) { working_days = 1; }

// Derive payroll_year for forward annualisation in tax block
period_parts  = payroll_period.split("-");
payroll_year  = period_parts.get(0).toInteger();

info "END. STEP 2: MPS loaded | mps_id=" + mps_id + " | working_days=" + working_days;

// ── STEP 3: Fetch batch queue records ────────────────────────────────────────
// Only Pending records for this batch_number — Processing/Done/Error records skipped
info "INIT. STEP 3: Fetch batch queue records";
batch_records = zoho.people.getRecords("Payroll_Queue",
	{"searchField": "pq_batch_number","searchOperator":"Is","searchText":batch_number,
	 "searchField2":"pq_status",      "searchOperator2":"Is","searchText2":"Pending"});

if(batch_records.size() == 0)
{
	info "WARN. No Pending records found for batch=" + batch_number + ". Batch may have already been processed.";
	return;
}
info "END. STEP 3: " + batch_records.size() + " Pending records in batch.";

// ── STEP 4: Per-employee processing loop ─────────────────────────────────────
done_this_batch  = 0;
error_this_batch = 0;

for each queue_rec in batch_records
{
	queue_id    = queue_rec.get("ID");
	employee_id = queue_rec.get("pq_employee_id");

	info "INIT. Employee: " + employee_id + " | queue_id: " + queue_id;

	// Mark Processing — prevents duplicate processing if Workflow A fires twice
	zoho.people.updateRecord("Payroll_Queue", queue_id, {"pq_status":"Processing"});

	try
	{
		// ── 4a: Parse snapshot fields — no additional API calls ─────────────────
		// pq_employee_snapshot and pq_ytd_snapshot stored as JSON strings by Orchestrator
		emp_snap  = queue_rec.get("pq_employee_snapshot").toMap();
		ytd_snap  = queue_rec.get("pq_ytd_snapshot").toMap();

		gross_salary      = emp_snap.get("gross_salary").toDecimal();
		subscription_wage = emp_snap.get("subscription_wage").toDecimal();
		hire_month        = emp_snap.get("hire_month").toInteger();
		hire_year         = emp_snap.get("hire_year").toInteger();
		emp_basic_salary  = emp_snap.get("emp_basic_salary").toDecimal();
		total_allowances  = emp_snap.get("total_allowances").toDecimal();

		// Per-employee override resolution
		// null = use org setting | true/false = per-employee override
		emp_si_override  = emp_snap.get("emp_si_override");
		emp_tax_override = emp_snap.get("emp_tax_override");
		effective_apply_insurance = (emp_si_override  != null) ? emp_si_override  : apply_insurance;
		effective_apply_tax       = (emp_tax_override != null) ? emp_tax_override : apply_tax;

		ytd_gross        = ytd_snap.get("ytd_gross").toDecimal();
		ytd_tax_withheld = ytd_snap.get("ytd_tax_withheld").toDecimal();

		// Flat attendance integers — stored directly as field values by Orchestrator
		// No parsing, no loops — just read
		absent_days    = ifnull(queue_rec.get("pq_absent_days"),    "0").toInteger();
		late_minutes   = ifnull(queue_rec.get("pq_late_minutes"),   "0").toInteger();
		overtime_hours = ifnull(queue_rec.get("pq_overtime_hours"), "0").toDecimal();
		ph_days_worked = ifnull(queue_rec.get("pq_ph_days_worked"), "0").toInteger();

		// ── 4a-2: Fetch unpaid leave per employee ─────────────────────────────
		// Moved from Orchestrator STEP 9 to reduce Orchestrator runtime.
		// Called once per employee within the batch (10 calls max per batch).
		// period_start and period_end derived from payroll_period (already available).
		period_start_str = payroll_period + "-01";
		period_end_str   = (payroll_period + "-01").toDate().addMonth(1).subDay(1).toString("yyyy-MM-dd");

		unpaid_leave_days = 0.0;
		leave_response = invokeurl
		[
			url :"https://people.zoho.com/people/api/leave/v2/getLeaveDetails"
			type :GET
			parameters:{
				"userId": employee_id,
				"from":   period_start_str,
				"to":     period_end_str,
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
		unpaid_leave_days = unpaid_leave_days.round(2);

		info "Snapshot parsed | gross=" + gross_salary + " | ytd_gross=" + ytd_gross
		   + " | absent=" + absent_days + " | late_min=" + late_minutes
		   + " | ot_hrs=" + overtime_hours + " | ph=" + ph_days_worked
		   + " | unpaid=" + unpaid_leave_days + " (fetched live)";

		// ── 4b: calculateEmployeePayroll — 1 invokeUrl (merged SI + Tax + Attendance) ──
		// Config maps passed as stringified JSON — calculateEmployeePayroll calls .toMap() on receipt
		calc_param = Map();
		calc_param.put("employee_id",       employee_id);
		calc_param.put("gross_salary",      gross_salary);
		calc_param.put("subscription_wage", subscription_wage);
		calc_param.put("hire_month",        hire_month);
		calc_param.put("hire_year",         hire_year);
		calc_param.put("payroll_year",      payroll_year);
		calc_param.put("working_days",      working_days);
		calc_param.put("absent_days",       absent_days);
		calc_param.put("unpaid_leave_days", unpaid_leave_days);
		calc_param.put("late_minutes",      late_minutes);
		calc_param.put("overtime_hours",    overtime_hours);
		calc_param.put("ph_days_worked",    ph_days_worked);
		calc_param.put("apply_insurance",   effective_apply_insurance);
		calc_param.put("apply_tax",         effective_apply_tax);
		calc_param.put("entity_type",       entity_type);
		calc_param.put("si_config",         si_config.toString());
		calc_param.put("tax_config",        tax_config.toString());
		calc_param.put("tax_std",           tax_std.toString());
		calc_param.put("tax_hi",            tax_hi.toString());
		calc_param.put("att_rules",         att_rules.toString());

		calc_result = invokeurl
		[
			url :"https://people.zoho.com/api/v3/function/calculateEmployeePayroll/execute"
			type :POST
			parameters:calc_param
			connection:"zoho_people_payroll_conn"
		];
		info "calc_result: " + calc_result;

		// ── 4c: Compute final net ─────────────────────────────────────────────────
		total_deductions = ifnull(calc_result.get("total_employee_deduction"), "0").toDecimal()
		                 + ifnull(calc_result.get("monthly_tax"),              "0").toDecimal()
		                 + ifnull(calc_result.get("absence_deduction"),        "0").toDecimal()
		                 + ifnull(calc_result.get("unpaid_leave_deduction"),   "0").toDecimal()
		                 + ifnull(calc_result.get("late_deduction"),           "0").toDecimal();

		total_additions  = ifnull(calc_result.get("overtime_addition"),       "0").toDecimal()
		                 + ifnull(calc_result.get("public_holiday_addition"), "0").toDecimal();

		net_salary = (gross_salary - total_deductions + total_additions).round(2);
		if(net_salary < 0) { net_salary = 0; }

		info "total_deductions=" + total_deductions + " | total_additions=" + total_additions
		   + " | net_salary=" + net_salary;

		// ── 4d: Rerun check — convert existing record in place ────────────────────
		// If a record already exists for this employee + period (from a prior run),
		// set it to Draft and increment run_sequence. The update below overwrites it.
		target_record_id = null;
		existing_records = zoho.people.getRecords("Monthly_Payroll_Record",
			{"searchField": "pr_employee",       "searchOperator":"Is","searchText":employee_id,
			 "searchField2":"pr_payroll_period", "searchOperator2":"Is","searchText2":payroll_period,
			 "searchField3":"pr_is_final_settlement","searchOperator3":"Is","searchText3":"false"});

		if(existing_records.size() > 0)
		{
			existing_rec     = existing_records.get(0);
			existing_rec_id  = existing_rec.get("ID");
			existing_seq     = ifnull(existing_rec.get("pr_run_sequence"), "0").toInteger();
			zoho.people.updateRecord("Monthly_Payroll_Record", existing_rec_id, {
				"pr_status":       "Draft",
				"pr_is_rerun":     true,
				"pr_run_sequence": existing_seq + 1,
				"pr_rerun_reason": "Overwritten by rerun for period " + payroll_period
			});
			target_record_id = existing_rec_id;
			info "Rerun: existing record " + existing_rec_id + " converted to Draft.";
		}

		// ── 4e: Write Monthly_Payroll_Record ──────────────────────────────────────
		pr_fields = Map();
		pr_fields.put("pr_employee",                     employee_id);
		pr_fields.put("pr_payroll_period",               payroll_period);
		pr_fields.put("pr_payslip_issue_date",           payslip_issue_date);
		pr_fields.put("pr_basic_salary",                 emp_basic_salary);
		pr_fields.put("pr_total_allowances",             total_allowances);
		pr_fields.put("pr_gross_salary",                 gross_salary);
		pr_fields.put("pr_si_subscription_wage",         ifnull(calc_result.get("subscription_wage"),  "0").toDecimal());
		pr_fields.put("pr_si_capped_wage",               ifnull(calc_result.get("capped_wage"),        "0").toDecimal());
		pr_fields.put("pr_si_monthly_ceiling",           ifnull(calc_result.get("monthly_ceiling"),    "0").toDecimal());
		pr_fields.put("pr_employee_si_deduction",        ifnull(calc_result.get("employee_si"),        "0").toDecimal());
		pr_fields.put("pr_martyrs_fund",                 ifnull(calc_result.get("martyrs_fund"),       "0").toDecimal());
		pr_fields.put("pr_employer_si",                  ifnull(calc_result.get("employer_si"),        "0").toDecimal());
		pr_fields.put("pr_monthly_personal_exemption",   ifnull(calc_result.get("monthly_personal_exemption"), "0").toDecimal());
		pr_fields.put("pr_monthly_net_taxable",          ifnull(calc_result.get("monthly_net_taxable"),        "0").toDecimal());
		pr_fields.put("pr_annual_net_taxable",           ifnull(calc_result.get("annual_net_taxable"),         "0").toDecimal());
		pr_fields.put("pr_annual_tax",                   ifnull(calc_result.get("annual_tax"),                 "0").toDecimal());
		pr_fields.put("pr_monthly_tax",                  ifnull(calc_result.get("monthly_tax"),                "0").toDecimal());
		pr_fields.put("pr_working_days",                 working_days);
		pr_fields.put("pr_absent_days",                  absent_days);
		pr_fields.put("pr_unpaid_leave_days",            unpaid_leave_days);
		pr_fields.put("pr_late_minutes",                 late_minutes);
		pr_fields.put("pr_overtime_hours",               overtime_hours.round(2));
		pr_fields.put("pr_ph_days_worked",               ph_days_worked);
		pr_fields.put("pr_absence_deduction",            ifnull(calc_result.get("absence_deduction"),       "0").toDecimal());
		pr_fields.put("pr_unpaid_leave_deduction",       ifnull(calc_result.get("unpaid_leave_deduction"),  "0").toDecimal());
		pr_fields.put("pr_late_deduction",               ifnull(calc_result.get("late_deduction"),          "0").toDecimal());
		pr_fields.put("pr_overtime_addition",            ifnull(calc_result.get("overtime_addition"),       "0").toDecimal());
		pr_fields.put("pr_public_holiday_addition",      ifnull(calc_result.get("public_holiday_addition"), "0").toDecimal());
		pr_fields.put("pr_total_attendance_adjustment",  ifnull(calc_result.get("total_adjustment"),        "0").toDecimal());
		pr_fields.put("pr_total_deductions",             total_deductions);
		pr_fields.put("pr_total_additions",              total_additions);
		pr_fields.put("pr_net_salary",                   net_salary);
		pr_fields.put("pr_ytd_gross",                    (ytd_gross + gross_salary).round(2));
		pr_fields.put("pr_ytd_tax_withheld",             (ytd_tax_withheld + ifnull(calc_result.get("monthly_tax"), "0").toDecimal()).round(2));
		pr_fields.put("pr_status",                       "Final");
		pr_fields.put("pr_is_final_settlement",          false);
		pr_fields.put("pr_is_rerun",                     (target_record_id != null));
		pr_fields.put("pr_generated_at",                 zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));

		if(ifnull(target_record_id, "") != "")
		{
			// Rerun — update existing record in place
			pr_fields.put("recordid", target_record_id);
			zoho.people.update("Monthly_Payroll_Record", pr_fields, "zoho_people_payroll_conn");
			info "Payroll record updated in place: " + target_record_id;
		}
		else
		{
			// New record
			zoho.people.create("Monthly_Payroll_Record", pr_fields, "zoho_people_payroll_conn");
			info "New payroll record created.";
		}

		// ── 4f: Mark queue Done ───────────────────────────────────────────────────
		zoho.people.updateRecord("Payroll_Queue", queue_id, {
			"pq_status":       "Done",
			"pq_processed_at": zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss")
		});
		done_this_batch += 1;
		info "END. Employee: " + employee_id + " → Done.";
	}
	catch(e)
	{
		// Mark queue Error — does not block other employees in batch
		zoho.people.updateRecord("Payroll_Queue", queue_id, {
			"pq_status": "Error",
			"pq_error":  e.toString().subString(0, 500)
		});
		error_this_batch += 1;
		info "ERROR. Employee: " + employee_id + " | " + e.toString();
	}
}  // end for each queue_rec

info "END. STEP 4: done=" + done_this_batch + " | errors=" + error_this_batch;

// ── STEP 5: Update MPS progress counters ─────────────────────────────────────
// Read fresh MPS before writing — concurrent batches may have updated counters
// between when this batch started and now
info "INIT. STEP 5: Update MPS progress";
fresh_setup    = zoho.people.getRecordById("Monthly_Payroll_Setup", mps_id);
current_done   = ifnull(fresh_setup.get("mps_progress_done"),  "0").toInteger();
current_errors = ifnull(fresh_setup.get("mps_progress_error"), "0").toInteger();

zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {
	"mps_progress_done":  current_done  + done_this_batch,
	"mps_progress_error": current_errors + error_this_batch
});
info "END. STEP 5: mps_progress_done=" + (current_done + done_this_batch)
   + " | mps_progress_error=" + (current_errors + error_this_batch);

// ── STEP 6: Completion check ─────────────────────────────────────────────────
// Query remaining Pending records for this period.
// If 0 → all batches have finished → mark run Completed.
// Fix 14: clear by_employee scope only when no errors exist.
info "INIT. STEP 6: Completion check";
remaining_pending = zoho.people.getRecords("Payroll_Queue",
	{"searchField": "pq_payroll_period","searchOperator":"Is","searchText":payroll_period,
	 "searchField2":"pq_status",        "searchOperator2":"Is","searchText2":"Pending"});

if(remaining_pending.size() == 0)
{
	info "All batches complete — marking MPS Completed.";
	zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {"mps_status":"Completed"});

	// Fix 14: Only clear by_employee scope if run completed without errors
	// Errors preserved so HR can re-trigger for failed employees
	error_recs = zoho.people.getRecords("Payroll_Queue",
		{"searchField": "pq_payroll_period","searchOperator":"Is","searchText":payroll_period,
		 "searchField2":"pq_status",        "searchOperator2":"Is","searchText2":"Error"});

	if(scope == "by_employee" && error_recs.size() == 0)
	{
		fresh_settings = invokeurl
		[
			url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
			type :GET
			connection:"zoho_people_payroll_conn"
		];
		settings_map = fresh_settings.get("variable").get("value");
		settings_map.get("active_settings").get("payroll_run").put("selected_employees", List());
		settings_map.get("active_settings").get("payroll_run").put("scope", "all");

		invokeurl
		[
			url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/update?group=Orca_Payroll_Variables"
			type :POST
			parameters:{"value":settings_map.toString()}
			connection:"zoho_people_payroll_conn"
		];
		info "Fix 14: by_employee scope cleared — clean completion.";
	}
	else if(error_recs.size() > 0)
	{
		info "Fix 14: by_employee scope preserved — " + error_recs.size() + " error(s) found.";
	}
}
else
{
	info "Remaining Pending: " + remaining_pending.size() + " — other batches still processing.";
}
info "END. STEP 6: Completion check done.";

info "END. processPayrollBatch | batch=" + batch_number
   + " | period=" + payroll_period
   + " | done=" + done_this_batch
   + " | errors=" + error_this_batch;
