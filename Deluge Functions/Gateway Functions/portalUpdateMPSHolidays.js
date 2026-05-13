// ============================================================
// Function : portalUpdateMPSHolidays
// Trigger  : RunPayroll wizard Step 2 — holiday Add / Edit / Delete actions
//            Only reachable when default_holiday_source = "manual"
// Inputs   : payroll_period — String "YYYY-MM"
//            holidays       — List of { date: "YYYY-MM-DD", name: String }
//                             Full replacement — not a diff.
// Returns  : { status: "success" | "error", message: String }
// Reads    : Monthly_Payroll_Setup
// Writes   : Monthly_Payroll_Setup (mps_public_holidays only)
// ============================================================

info "INIT. portalUpdateMPSHolidays | period=" + payroll_period;

result = Map();

// ── STEP 1: Validate inputs ───────────────────────────────────────────────────
if(ifnull(payroll_period, "") == "")
{
	result.put("status",  "error");
	result.put("message", "payroll_period is required.");
	return result;
}

holidays_in = ifnull(holidays, List());

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

// ── STEP 3: Status guard — only allow edits on Draft records ──────────────────
if(mps_status != "Draft" && mps_status != "Ready")
{
	result.put("status",  "error");
	result.put("message", "Cannot edit holidays — MPS status is "
	                    + mps_status + ". Holiday edits only permitted on Draft runs.");
	return result;
}

// ── STEP 4: Validate and normalise each holiday entry ─────────────────────────
validated = List();
for each h in holidays_in
{
	h_date = ifnull(h.get("date"), "");
	h_name = ifnull(h.get("name"), "");
	if(h_date == "" || h_name == "") { continue; }
	entry = Map();
	entry.put("date", h_date);
	entry.put("name", h_name);
	validated.add(entry);
}

// ── STEP 5: Save as JSON string ───────────────────────────────────────────────
holidays_json = validated.toString();

zoho.people.updateRecord("Monthly_Payroll_Setup", mps_id, {
	"mps_public_holidays": holidays_json
});

info "END. portalUpdateMPSHolidays | mps_id=" + mps_id
   + " | holidays=" + validated.size();

result.put("status",  "success");
result.put("message", "Holidays updated for period " + payroll_period + ".");
return result;
