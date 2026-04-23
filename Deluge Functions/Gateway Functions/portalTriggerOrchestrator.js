// ============================================================
// Function : portalTriggerOrchestrator
// Phase    : B5
// Trigger  : Webtab — feature_run_payroll, Run button clicked
// Inputs   : payroll_period — String "YYYY-MM"
// Returns  : {
//     status  : "success" | "error"
//     message : String
//     period  : String
//     queued  : Integer — total employees queued (from Orchestrator)
//     batches : Integer — total batch count
//   }
// Pre-flight: MPS must exist AND status must be "Ready"
// Calls    : runPayrollOrchestrator(payroll_period)
// ============================================================

info "INIT. portalTriggerOrchestrator | period=" + payroll_period;

result = Map();

// ── STEP 1: Validate period ───────────────────────────────────────────────────
if(ifnull(payroll_period, "") == "")
{
	result.put("status",  "error");
	result.put("message", "payroll_period is required.");
	return result;
}

// ── STEP 2: Pre-flight — MPS must exist and be Ready ─────────────────────────
mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(mps_list.size() == 0)
{
	result.put("status",  "error");
	result.put("message", "No Monthly_Payroll_Setup found for period " + payroll_period
	                    + ". Create the setup first using the period selector.");
	return result;
}

monthly_setup = mps_list.get(0);
mps_status    = monthly_setup.get("mps_status");

if(mps_status != "Ready")
{
	result.put("status",  "error");
	result.put("message", "Cannot trigger run — MPS status is "
	                    + mps_status + ". Expected: Ready. "
	                    + "If a previous run completed, create a new MPS to run again.");
	result.put("current_status", mps_status);
	return result;
}

// ── STEP 3: Pre-flight — global lock check ────────────────────────────────────
// Orchestrator also checks this but catching it here gives a cleaner UI error message
settings_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
run_cfg = settings_response.get("variable").get("value")
                           .get("active_settings").get("payroll_run");

if(run_cfg.get("lock") == true)
{
	result.put("status",  "error");
	result.put("message", "A payroll run is already in progress. Monitor the Queue Status tab for progress.");
	return result;
}

// ── STEP 4: Trigger Orchestrator ─────────────────────────────────────────────
info "Pre-flight passed. Calling runPayrollOrchestrator for period=" + payroll_period;

orch_result = invokeurl
[
	url :"https://people.zoho.com/api/v3/function/runPayrollOrchestrator/execute"
	type :POST
	parameters:{"payroll_period":payroll_period}
	connection:"zoho_people_payroll_conn"
];
info "orch_result: " + orch_result;

// ── STEP 5: Return Orchestrator result to webtab ──────────────────────────────
orch_status = ifnull(orch_result.get("status"), "error");

if(orch_status == "success")
{
	result.put("status",  "success");
	result.put("message", "Payroll run started for period " + payroll_period
	                    + ". " + orch_result.get("queued") + " employees queued across "
	                    + orch_result.get("batches") + " batch(es).");
	result.put("period",  payroll_period);
	result.put("queued",  orch_result.get("queued"));
	result.put("batches", orch_result.get("batches"));
}
else
{
	result.put("status",  "error");
	result.put("message", "Orchestrator error: " + ifnull(orch_result.get("message"), "Unknown error."));
}

info "END. portalTriggerOrchestrator | " + result.get("status");
return result;
