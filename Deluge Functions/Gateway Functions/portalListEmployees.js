// ============================================================
// Function : portalListEmployees
// Trigger  : Employees feature mount
// Inputs   : none
// Returns  : {
//     status    : "success" | "error"
//     employees : [
//       {
//         employee_id          : String
//         employee_name        : String
//         department           : String
//         pr_basic_salary      : Decimal  (reference/profile value — not period-specific)
//         pr_gross_salary      : Decimal
//         pr_net_salary        : Decimal
//         exclude_si           : Boolean
//         exclude_martyrs_fund : Boolean
//         exclude_income_tax   : Boolean
//       }
//     ]
//   }
// Reads    : Zoho People P_Employee (active employees only),
//            Employee_Payroll_Config (exclusion flags),
//            P_Salary (salary reference values — most recent record per employee)
// Writes   : nothing
// ============================================================

info "INIT. portalListEmployees";

result    = Map();
employees = List();

// ── STEP 1: Fetch active employees from Zoho People ──────────────────────────
emp_response = invokeurl
[
	url :"https://people.zoho.com/people/api/forms/json/P_Employee/getRecords"
	type :GET
	parameters:{"sIndex":"1","limit":"200","searchField":"EmployeeStatus","searchOperator":"Is","searchValue":"Active"}
	connection:"zoho_people_payroll_conn"
];

resp_body = ifnull(emp_response.get("response"), Map());
if(ifnull(resp_body.get("status"), 1) != 0)
{
	result.put("status",  "error");
	result.put("message", "Failed to fetch employees from Zoho People.");
	return result;
}

emp_records = ifnull(resp_body.get("result"), List());
info "Active employees fetched: " + emp_records.size();

// ── STEP 2: Fetch payroll exclusion flags (Employee_Payroll_Config form) ──────
// Fields: epc_employee (employee ID), epc_exclude_si, epc_exclude_martyrs_fund,
//         epc_exclude_income_tax
exclusion_map = Map();
epc_response = zoho.people.getRecords("Employee_Payroll_Config", {});
for each epc in ifnull(epc_response, List())
{
	e_id = ifnull(epc.get("epc_employee"), "");
	if(e_id != "")
	{
		flags = Map();
		flags.put("exclude_si",           (ifnull(epc.get("epc_exclude_si"),           false) == true || ifnull(epc.get("epc_exclude_si"), "") == "true"));
		flags.put("exclude_martyrs_fund", (ifnull(epc.get("epc_exclude_martyrs_fund"), false) == true || ifnull(epc.get("epc_exclude_martyrs_fund"), "") == "true"));
		flags.put("exclude_income_tax",   (ifnull(epc.get("epc_exclude_income_tax"),   false) == true || ifnull(epc.get("epc_exclude_income_tax"), "") == "true"));
		exclusion_map.put(e_id, flags);
	}
}
info "Exclusion config records fetched: " + exclusion_map.size();

// ── STEP 3: Fetch salary reference values (P_Salary — most recent per employee) ──
salary_map = Map();
sal_response = invokeurl
[
	url :"https://people.zoho.com/people/api/forms/json/P_Salary/getRecords"
	type :GET
	parameters:{"sIndex":"1","limit":"200"}
	connection:"zoho_people_payroll_conn"
];
sal_body = ifnull(sal_response.get("response"), Map());
if(ifnull(sal_body.get("status"), 1) == 0)
{
	for each sr in ifnull(sal_body.get("result"), List())
	{
		sal  = sr.get("P_Salary");
		e_id = ifnull(sal.get("EmployeeID"), "");
		if(e_id == "") { continue; }
		// Store only if not already present (assumes first record is most recent)
		if(!salary_map.containsKey(e_id))
		{
			sal_entry = Map();
			sal_entry.put("basic", ifnull(sal.get("BasicSalary"),  "0").toDecimal());
			sal_entry.put("gross", ifnull(sal.get("GrossSalary"),  "0").toDecimal());
			sal_entry.put("net",   ifnull(sal.get("NetSalary"),    "0").toDecimal());
			salary_map.put(e_id, sal_entry);
		}
	}
}
info "Salary records fetched: " + salary_map.size();

// ── STEP 4: Build employee list ───────────────────────────────────────────────
for each record in emp_records
{
	emp    = record.get("P_Employee");
	e_id   = ifnull(emp.get("EmployeeID"), "");
	if(e_id == "") { continue; }

	f_name = ifnull(emp.get("FirstName"), "");
	l_name = ifnull(emp.get("LastName"),  "");
	dept   = ifnull(emp.get("Department"), "");
	disp   = (f_name != "" && l_name != "") ? (f_name + " " + l_name)
	                                        : ifnull(f_name, e_id);

	// Salary reference — defaults to 0 when no salary record exists
	sal  = ifnull(salary_map.get(e_id), Map());
	basic = ifnull(sal.get("basic"), 0).toDecimal();
	gross = ifnull(sal.get("gross"), 0).toDecimal();
	net   = ifnull(sal.get("net"),   0).toDecimal();

	// Exclusion flags — defaults to false when no config record exists
	excl           = ifnull(exclusion_map.get(e_id), Map());
	excl_si        = ifnull(excl.get("exclude_si"),           false);
	excl_martyrs   = ifnull(excl.get("exclude_martyrs_fund"), false);
	excl_tax       = ifnull(excl.get("exclude_income_tax"),   false);

	emp_entry = Map();
	emp_entry.put("employee_id",          e_id);
	emp_entry.put("employee_name",        disp);
	emp_entry.put("department",           dept);
	emp_entry.put("pr_basic_salary",      basic);
	emp_entry.put("pr_gross_salary",      gross);
	emp_entry.put("pr_net_salary",        net);
	emp_entry.put("exclude_si",           excl_si);
	emp_entry.put("exclude_martyrs_fund", excl_martyrs);
	emp_entry.put("exclude_income_tax",   excl_tax);

	employees.add(emp_entry);
}

result.put("status",    "success");
result.put("employees", employees);

info "END. portalListEmployees | count=" + employees.size();
return result;
