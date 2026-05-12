// ============================================================
// Function : portalGetEmployees
// Phase    : B0 (pre-run setup support)
// Trigger  : Webtab — feature_run_payroll, StepSetup scope = by_employee
// Inputs   : none
// Returns  : {
//     status    : "success" | "error"
//     employees : [ { id: String, name: String, department: String } ]
//   }
// Reads    : Zoho People P_Employee form (active employees only)
// Writes   : nothing
// Note     : Returns up to 200 active employees. Paging not required
//            for the scope picker use case — all employees are loaded
//            once for client-side search filtering.
// ============================================================

info "INIT. portalGetEmployees";

result    = Map();
employees = List();

// ── STEP 1: Fetch active employees via Zoho People forms API ─────────────────
emp_response = invokeurl
[
	url :"https://people.zoho.com/people/api/forms/json/P_Employee/getRecords"
	type :GET
	parameters:{"sIndex":"1","limit":"200","searchField":"EmployeeStatus","searchOperator":"Is","searchValue":"Active"}
	connection:"zoho_people_payroll_conn"
];

info "Employee API response status: " + emp_response.get("response").get("status");

// ── STEP 2: Validate response ─────────────────────────────────────────────────
response_body = emp_response.get("response");

if(response_body == null || response_body.get("status") != 0)
{
	result.put("status",  "error");
	result.put("message", "Failed to fetch employees from Zoho People.");
	return result;
}

// ── STEP 3: Build employee list ───────────────────────────────────────────────
// Each record in result is { "P_Employee": { EmployeeID, FirstName, LastName, Department, ... } }
emp_records = response_body.get("result");

if(emp_records != null)
{
	for each record in emp_records
	{
		emp     = record.get("P_Employee");
		emp_id  = ifnull(emp.get("EmployeeID"), "");
		f_name  = ifnull(emp.get("FirstName"),  "");
		l_name  = ifnull(emp.get("LastName"),   "");
		dept    = ifnull(emp.get("Department"), "");

		if(emp_id == "") { continue; }

		// Build display name — handle partial data gracefully
		if(f_name != "" && l_name != "")
		{
			display_name = f_name + " " + l_name;
		}
		else if(f_name != "")
		{
			display_name = f_name;
		}
		else
		{
			display_name = emp_id;
		}

		e = Map();
		e.put("id",         emp_id);
		e.put("name",       display_name);
		e.put("department", dept);
		employees.add(e);
	}
}

info "END. portalGetEmployees | count=" + employees.size();

result.put("status",    "success");
result.put("employees", employees);
return result;
