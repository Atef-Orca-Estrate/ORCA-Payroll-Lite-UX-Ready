// ============================================================
// Function : portalUpdateMPS
// Trigger  : RunPayroll wizard Step 2 — working days override field
//            Only reachable when allow_working_days_override = true
// Inputs   : payroll_period   — String "YYYY-MM"
//            new_working_days — Integer (1–31)
// Returns  : {
//     status       : "success" | "error"
//     period       : String
//     working_days : Integer (confirmed saved value)
//     message      : String
//   }
// Reads    : Monthly_Payroll_Setup
// Writes   : Monthly_Payroll_Setup (mps_working_days only)
// ============================================================

info "INIT. portalUpdateMPS | period=" + payroll_period + " | new_working_days=" + new_working_days;

result = Map();

// ── STEP 1: Validate new_working_days ────────────────────────────────────────
wd_int = ifnull(new_working_days, "0").toInteger();
if(wd_int <= 0 || wd_int > 31)
{
	result.put("status",  "error");
	result.put("message", "new_working_days must be between 1 and 31. Received: " + wd_int + ".");
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

// ── STEP 3: Status guard — only allow override on Draft records ───────────────
// Accepts "Draft" (current name) and "Ready" (legacy) for backward compatibility.
if(mps_status != "Draft" && mps_status != "Ready")
{
	result.put("status",  "error");
	result.put("message", "Cannot override working_days — MPS status is "
	                    + mps_status + ". Override only permitted on Draft runs.");
	return result;
}

// ── STEP 4: Patch mps_working_days ───────────────────────────────────────────
zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {
	"mps_working_days": wd_int
});

info "END. portalUpdateMPS | mps_id=" + mps_id + " | working_days=" + wd_int;

result.put("status",       "success");
result.put("period",       payroll_period);
result.put("working_days", wd_int);
result.put("message",      "Working days updated to " + wd_int + " for period " + payroll_period + ".");
return result;
