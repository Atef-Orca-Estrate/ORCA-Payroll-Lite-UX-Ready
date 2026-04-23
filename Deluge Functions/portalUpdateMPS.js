// ============================================================
// Function : portalUpdateMPS
// Phase    : B4
// Trigger  : Webtab — feature_run_payroll, working days override
//            Only reachable if allow_working_days_override = true in portal config
// Inputs   : payroll_period  — String "YYYY-MM"
//            new_working_days — Integer (HR-entered override value)
// Returns  : {
//     status       : "success" | "error"
//     message      : String
//     period       : String
//     working_days : Integer (confirmed saved value)
//   }
// Reads    : Monthly_Payroll_Setup
// Writes   : Monthly_Payroll_Setup (mps_working_days only)
// ============================================================

info "INIT. portalUpdateMPS | period=" + payroll_period + " | new_working_days=" + new_working_days;

result = Map();

// ── STEP 1: Validate new_working_days ────────────────────────────────────────
new_working_days = ifnull(new_working_days, "0").toInteger();
if(new_working_days <= 0 || new_working_days > 31)
{
	result.put("status",  "error");
	result.put("message", "new_working_days must be between 1 and 31. Received: " + new_working_days + ".");
	return result;
}

// ── STEP 2: Find MPS record ───────────────────────────────────────────────────
mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(mps_list.size() == 0)
{
	result.put("status",  "error");
	result.put("message", "No Monthly_Payroll_Setup found for period " + payroll_period + ".");
	return result;
}

monthly_setup = mps_list.get(0);
mps_id        = monthly_setup.get("ID");
mps_status    = monthly_setup.get("mps_status");

// ── STEP 3: Status guard — only allow override on Ready records ───────────────
// Processing / Completed records must not be modified mid-run
if(mps_status != "Ready")
{
	result.put("status",  "error");
	result.put("message", "Cannot override working_days — MPS status is "
	                    + mps_status + ". Override only permitted when status is Ready.");
	return result;
}

// ── STEP 4: Patch mps_working_days ───────────────────────────────────────────
zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {
	"mps_working_days": new_working_days
});

info "END. portalUpdateMPS | mps_id=" + mps_id + " | working_days updated to " + new_working_days;

result.put("status",       "success");
result.put("message",      "Working days updated to " + new_working_days + " for period " + payroll_period + ".");
result.put("period",       payroll_period);
result.put("working_days", new_working_days);
return result;
