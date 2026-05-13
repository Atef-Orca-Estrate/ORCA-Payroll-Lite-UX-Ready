// ============================================================
// Function : portalUpdateEmployee
// Trigger  : Employees feature — per-employee "Update" button
// Inputs   : employee_id          — String
//            exclude_si           — Boolean
//            exclude_martyrs_fund — Boolean
//            exclude_income_tax   — Boolean
// Returns  : { status: "success" | "error", employee_id: String, message: String }
// Reads    : Employee_Payroll_Config
// Writes   : Employee_Payroll_Config (upsert — create if not exists, update if exists)
// ============================================================

info "INIT. portalUpdateEmployee | employee_id=" + employee_id;

result = Map();

// ── STEP 1: Validate employee_id ─────────────────────────────────────────────
if(ifnull(employee_id, "") == "")
{
	result.put("status",  "error");
	result.put("message", "employee_id is required.");
	return result;
}

// ── STEP 2: Normalise boolean inputs ─────────────────────────────────────────
excl_si      = (ifnull(exclude_si,           false) == true || ifnull(exclude_si,           "") == "true");
excl_martyrs = (ifnull(exclude_martyrs_fund, false) == true || ifnull(exclude_martyrs_fund, "") == "true");
excl_tax     = (ifnull(exclude_income_tax,   false) == true || ifnull(exclude_income_tax,   "") == "true");

// ── STEP 3: Find existing Employee_Payroll_Config record ──────────────────────
epc_list = zoho.people.getRecords("Employee_Payroll_Config",
	{"searchField":"epc_employee","searchOperator":"Is","searchText":employee_id});

update_fields = Map();
update_fields.put("epc_employee",           employee_id);
update_fields.put("epc_exclude_si",           excl_si);
update_fields.put("epc_exclude_martyrs_fund", excl_martyrs);
update_fields.put("epc_exclude_income_tax",   excl_tax);

if(epc_list.size() > 0)
{
	// Update existing record
	epc_id = epc_list.get(0).get("ID");
	zoho.people.updateRecord("Employee_Payroll_Config", epc_id, update_fields);
	info "Updated existing EPC record | epc_id=" + epc_id;
}
else
{
	// Create new record
	zoho.people.addRecord("Employee_Payroll_Config", update_fields);
	info "Created new EPC record for employee=" + employee_id;
}

result.put("status",      "success");
result.put("employee_id", employee_id);
result.put("message",     "Employee settings updated for " + employee_id + ".");

info "END. portalUpdateEmployee | employee_id=" + employee_id;
return result;
