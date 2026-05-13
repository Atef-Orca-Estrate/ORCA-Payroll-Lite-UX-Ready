// ============================================================
// Function : portalGetPayrollRecords
// Trigger  : RunPayroll — selecting a completed run; after Processing→Completed transition
//            Frontend caches response by run_id for the session.
// Inputs   : payroll_period — String "YYYY-MM"
//            run_id         — String (MPS record ID)
// Returns  : {
//     status  : "success" | "error"
//     period  : String
//     run_id  : String
//     records : [
//       {
//         employee_id               : String
//         employee_name             : String  (enriched from Zoho People)
//         department                : String  (enriched from Zoho People)
//         status                    : "Done" | "Error" | "Processing" | "Pending"
//         pr_basic_salary           : Decimal | null
//         pr_total_allowances       : Decimal | null
//         pr_gross_salary           : Decimal | null
//         pr_employee_si_deduction  : Decimal | null
//         pr_martyrs_fund           : Decimal | null
//         pr_absence_deduction      : Decimal | null
//         pr_unpaid_leave_deduction : Decimal | null
//         pr_late_deduction         : Decimal | null
//         pr_total_deductions       : Decimal | null
//         pr_net_salary             : Decimal | null
//         pr_monthly_tax_withheld   : Decimal | null
//         pr_ytd_tax_withheld       : Decimal | null
//         error                     : String
//       }
//     ]
//   }
// Reads    : Monthly_Payroll_Record, Zoho People (enrichment)
// Writes   : nothing
// ============================================================

info "INIT. portalGetPayrollRecords | period=" + payroll_period + " | run_id=" + run_id;

result  = Map();
records = List();

// ── STEP 1: Validate inputs ───────────────────────────────────────────────────
if(ifnull(payroll_period, "") == "")
{
	result.put("status",  "error");
	result.put("message", "payroll_period is required.");
	return result;
}

// ── STEP 2: Fetch payroll records for the period ──────────────────────────────
pr_list = zoho.people.getRecords("Monthly_Payroll_Record",
	{"searchField":"pr_payroll_period","searchOperator":"Is","searchText":payroll_period});

info "Payroll records found for period: " + pr_list.size();

// ── STEP 2b: Filter by run_id when provided ───────────────────────────────────
// pr_mps_id on Monthly_Payroll_Record links each record to its MPS (run).
// Records without pr_mps_id (pre-schema or legacy) are always included.
run_id_val = ifnull(run_id, "");
if(run_id_val != "" && pr_list.size() > 0)
{
	filtered_list = List();
	for each pr in pr_list
	{
		pr_run_id = ifnull(pr.get("pr_mps_id"), "");
		if(pr_run_id == "" || pr_run_id == run_id_val)
		{
			filtered_list.add(pr);
		}
	}
	pr_list = filtered_list;
	info "After run_id filter (" + run_id_val + "): " + pr_list.size() + " records";
}

// ── STEP 3: Collect unique employee IDs for enrichment ────────────────────────
emp_id_set = List();
for each pr in pr_list
{
	e_id = ifnull(pr.get("pr_employee"), "");
	if(e_id != "" && !emp_id_set.contains(e_id))
	{
		emp_id_set.add(e_id);
	}
}

// ── STEP 4: Bulk-fetch employee identity data ─────────────────────────────────
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
			emp     = record.get("P_Employee");
			e_id    = ifnull(emp.get("EmployeeID"), "");
			f_name  = ifnull(emp.get("FirstName"),  "");
			l_name  = ifnull(emp.get("LastName"),   "");
			dept    = ifnull(emp.get("Department"),  "");
			disp    = (f_name != "" && l_name != "") ? (f_name + " " + l_name)
			                                         : ifnull(f_name, e_id);
			if(e_id != "")
			{
				info_entry = Map();
				info_entry.put("employee_name", disp);
				info_entry.put("department",    dept);
				emp_info_map.put(e_id, info_entry);
			}
		}
	}
}

// ── STEP 5: Build response records ───────────────────────────────────────────
for each pr in pr_list
{
	e_id     = ifnull(pr.get("pr_employee"), "");
	pr_status = ifnull(pr.get("pr_status"), "Pending");

	// Enrich with identity
	emp_info  = ifnull(emp_info_map.get(e_id), Map());
	emp_name  = ifnull(emp_info.get("employee_name"), e_id);
	emp_dept  = ifnull(emp_info.get("department"),    "");

	// Numeric fields are null when status is not Done
	is_done = (pr_status == "Done" || pr_status == "Final");

	basic    = is_done ? ifnull(pr.get("pr_basic_salary"),          "0").toDecimal() : null;
	allow    = is_done ? ifnull(pr.get("pr_total_allowances"),      "0").toDecimal() : null;
	gross    = is_done ? ifnull(pr.get("pr_gross_salary"),          "0").toDecimal() : null;
	emp_si   = is_done ? ifnull(pr.get("pr_employee_si_deduction"), "0").toDecimal() : null;
	martyrs  = is_done ? ifnull(pr.get("pr_martyrs_fund"),          "0").toDecimal() : null;
	abs_ded  = is_done ? ifnull(pr.get("pr_absence_deduction"),     "0").toDecimal() : null;
	ul_ded   = is_done ? ifnull(pr.get("pr_unpaid_leave_deduction"),"0").toDecimal() : null;
	late_ded = is_done ? ifnull(pr.get("pr_late_deduction"),        "0").toDecimal() : null;
	net      = is_done ? ifnull(pr.get("pr_net_salary"),            "0").toDecimal() : null;
	tax      = is_done ? ifnull(pr.get("pr_monthly_tax"),           "0").toDecimal() : null;
	ytd_tax  = is_done ? ifnull(pr.get("pr_ytd_tax_withheld"),      "0").toDecimal() : null;

	// pr_total_deductions — sum the components if not stored as a field
	total_ded = null;
	if(is_done)
	{
		total_ded = (emp_si + martyrs + abs_ded + ul_ded + late_ded).round(2);
	}

	rec = Map();
	rec.put("employee_id",               e_id);
	rec.put("employee_name",             emp_name);
	rec.put("department",                emp_dept);
	rec.put("status",                    pr_status == "Final" ? "Done" : pr_status);
	rec.put("pr_basic_salary",           basic);
	rec.put("pr_total_allowances",       allow);
	rec.put("pr_gross_salary",           gross);
	rec.put("pr_employee_si_deduction",  emp_si);
	rec.put("pr_martyrs_fund",           martyrs);
	rec.put("pr_absence_deduction",      abs_ded);
	rec.put("pr_unpaid_leave_deduction", ul_ded);
	rec.put("pr_late_deduction",         late_ded);
	rec.put("pr_total_deductions",       total_ded);
	rec.put("pr_net_salary",             net);
	rec.put("pr_monthly_tax_withheld",   tax);
	rec.put("pr_ytd_tax_withheld",       ytd_tax);
	rec.put("error",                     ifnull(pr.get("pr_error"), ""));

	records.add(rec);
}

result.put("status",  "success");
result.put("period",  payroll_period);
result.put("run_id",  ifnull(run_id, ""));
result.put("records", records);

info "END. portalGetPayrollRecords | period=" + payroll_period
   + " | records=" + records.size();

return result;
