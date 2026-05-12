// ============================================================
// Function : portalGetDepartments
// Phase    : B0 (pre-run setup support)
// Trigger  : Webtab — feature_run_payroll, StepSetup scope = by_department
// Inputs   : none
// Returns  : {
//     status      : "success" | "error"
//     departments : [ { name: String } ]
//   }
// Reads    : Zoho People native department API
// Writes   : nothing
// ============================================================

info "INIT. portalGetDepartments";

result = Map();

// ── STEP 1: Fetch departments from Zoho People ────────────────────────────────
dept_response = invokeurl
[
	url :"https://people.zoho.com/people/api/department"
	type :GET
	connection:"zoho_people_payroll_conn"
];

info "Dept API response: " + dept_response;

// ── STEP 2: Validate response ─────────────────────────────────────────────────
// Zoho People department API returns { response: { status: 0, result: [...] } }
response_body = dept_response.get("response");

if(response_body == null)
{
	result.put("status",  "error");
	result.put("message", "Unexpected response from Zoho People department API.");
	return result;
}

if(response_body.get("status") != 0)
{
	result.put("status",  "error");
	result.put("message", "Department API returned error status: " + response_body.get("status"));
	return result;
}

// ── STEP 3: Build department list ─────────────────────────────────────────────
departments = List();
dept_list   = response_body.get("result");

if(dept_list != null)
{
	for each dept in dept_list
	{
		dept_name = ifnull(dept.get("departmentName"), dept.get("name"));
		if(ifnull(dept_name, "") != "")
		{
			d = Map();
			d.put("name", dept_name);
			departments.add(d);
		}
	}
}

info "END. portalGetDepartments | count=" + departments.size();

result.put("status",      "success");
result.put("departments", departments);
return result;
