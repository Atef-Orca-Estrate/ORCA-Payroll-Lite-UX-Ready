// ============================================================
// Function : portalTriggerOrchestrator
// Trigger  : RunPayroll wizard Step 2 — "Run Payroll" button
//            Frontend retries once on lock error (30s delay between attempts)
// Inputs   : payroll_period — String "YYYY-MM"
// Returns  : {
//     status  : "success" | "error"
//     run_id  : String — MPS record ID
//     period  : String
//     queued  : Integer
//     batches : Integer
//     message : String
//   }
// Lock error (retryable):
//     { status: "error",
//       message: "Orchestrator is locked by another process. Wait 30 seconds and try again." }
// Other errors:
//     { status: "error", message: String }
// Pre-flight: MPS must exist with status "Draft"
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

// ── STEP 2: Pre-flight — MPS must exist and be in Draft status ────────────────
mps_list = zoho.people.getRecords("Monthly_Payroll_Setup",
	{"searchField":"mps_payroll_period","searchOperator":"Is","searchText":payroll_period});

if(mps_list.size() == 0)
{
	result.put("status",  "error");
	result.put("message", "No Monthly_Payroll_Setup found for period " + payroll_period
	                    + ". Create the setup first using the period selector.");
	return result;
}

monthly_setup   = mps_list.get(0);
mps_status      = monthly_setup.get("mps_status");
resolved_run_id = monthly_setup.get("ID");

// Accept "Draft" (new name) and "Ready" (legacy) for backward compatibility
if(mps_status != "Draft" && mps_status != "Ready")
{
	result.put("status",  "error");
	result.put("message", "Cannot trigger run — MPS status is "
	                    + mps_status + ". Expected: Draft.");
	result.put("current_status", mps_status);
	return result;
}

// ── STEP 3: Pre-flight — global lock check ────────────────────────────────────
settings_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];
lock_val = ifnull(settings_response.get("variable").get("value")
                                   .get("active_settings").get("payroll_run").get("lock"), false);

if(lock_val == true || lock_val == "true")
{
	// Return the exact message the frontend expects for its retry logic
	result.put("status",  "error");
	result.put("message", "Orchestrator is locked by another process. Wait 30 seconds and try again.");
	return result;
}

// ── STEP 4: Trigger Orchestrator ─────────────────────────────────────────────
info "Pre-flight passed. Calling runPayrollOrchestrator | period=" + payroll_period
   + " | run_id=" + resolved_run_id;

orch_result = invokeurl
[
	url :"https://people.zoho.com/api/v3/function/runPayrollOrchestrator/execute"
	type :POST
	parameters:{"payroll_period":payroll_period,"run_id":resolved_run_id}
	connection:"zoho_people_payroll_conn"
];
info "orch_result: " + orch_result;

// ── STEP 5: Return result ─────────────────────────────────────────────────────
orch_status = ifnull(orch_result.get("status"), "error");

if(orch_status == "success")
{
	result.put("status",  "success");
	result.put("run_id",  resolved_run_id);
	result.put("period",  payroll_period);
	result.put("queued",  orch_result.get("queued"));
	result.put("batches", orch_result.get("batches"));
	result.put("message", "Payroll run started for period " + payroll_period
	                    + ". " + orch_result.get("queued") + " employees queued across "
	                    + orch_result.get("batches") + " batch(es).");
}
else
{
	orch_msg = ifnull(orch_result.get("message"), "Unknown orchestrator error.");
	// Propagate lock conflicts with the exact retryable message the frontend expects
	if(orch_msg.contains("lock") || orch_msg.contains("locked"))
	{
		result.put("message", "Orchestrator is locked by another process. Wait 30 seconds and try again.");
	}
	else
	{
		result.put("message", "Orchestrator error: " + orch_msg);
	}
	result.put("status", "error");
}

info "END. portalTriggerOrchestrator | " + result.get("status");
return result;
