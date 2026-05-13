// ============================================================
// Function : portalGetPeriodReport
// Trigger  : Reports feature — period selection (or auto-load from navParams)
// Inputs   : payroll_period — String "YYYY-MM"
// Returns  : {
//     status       : "success" | "error"
//     period       : String
//     generated_at : String "HH:MM"  (time only)
//     summary      : {
//       headcount           : Integer
//       termination_count   : Integer
//       total_gross         : Decimal
//       total_basic_salary  : Decimal
//       total_allowances    : Decimal
//       total_employee_si   : Decimal
//       total_employer_si   : Decimal
//       total_martyrs_fund  : Decimal
//       total_tax_withheld  : Decimal
//       total_net_salary    : Decimal
//       total_employer_cost : Decimal
//     }
//   }
// Error (no completed run):
//     { status: "error",
//       message: "No completed report available for period YYYY-MM" }
// Reads    : Monthly_Payroll_Record (status=Final, period=payroll_period)
// Writes   : nothing
// ============================================================

info "INIT. portalGetPeriodReport | period=" + payroll_period;

result = Map();

// ── STEP 1: Validate period ───────────────────────────────────────────────────
if(ifnull(payroll_period, "") == "")
{
	result.put("status",  "error");
	result.put("message", "payroll_period is required.");
	return result;
}

// ── STEP 2: Fetch Final payroll records for the period ────────────────────────
payroll_records = zoho.people.getRecords("Monthly_Payroll_Record",
	{"searchField": "pr_payroll_period","searchOperator":"Is","searchText":payroll_period,
	 "searchField2":"pr_status",        "searchOperator2":"Is","searchText2":"Final"});

info "Final records found: " + payroll_records.size();

// No records → error (not empty success — frontend shows "No completed report" state)
if(payroll_records.size() == 0)
{
	result.put("status",  "error");
	result.put("message", "No completed report available for period " + payroll_period + ".");
	return result;
}

// ── STEP 3: Aggregate summary totals ─────────────────────────────────────────
headcount         = 0;
termination_count = 0;

total_gross       = 0.0;
total_basic       = 0.0;
total_allowances  = 0.0;
total_employee_si = 0.0;
total_employer_si = 0.0;
total_martyrs     = 0.0;
total_tax         = 0.0;
total_net         = 0.0;

for each pr in payroll_records
{
	is_term = (ifnull(pr.get("pr_is_final_settlement"), false) == true
	           || ifnull(pr.get("pr_is_final_settlement"), "") == "true");

	if(is_term) { termination_count += 1; }
	else        { headcount         += 1; }

	total_gross       = total_gross       + ifnull(pr.get("pr_gross_salary"),          "0").toDecimal();
	total_basic       = total_basic       + ifnull(pr.get("pr_basic_salary"),          "0").toDecimal();
	total_allowances  = total_allowances  + ifnull(pr.get("pr_total_allowances"),      "0").toDecimal();
	total_employee_si = total_employee_si + ifnull(pr.get("pr_employee_si_deduction"), "0").toDecimal();
	total_employer_si = total_employer_si + ifnull(pr.get("pr_employer_si"),           "0").toDecimal();
	total_martyrs     = total_martyrs     + ifnull(pr.get("pr_martyrs_fund"),          "0").toDecimal();
	// pr_monthly_tax is the field name on the record; returned as pr_monthly_tax_withheld to frontend
	total_tax         = total_tax         + ifnull(pr.get("pr_monthly_tax"),           "0").toDecimal();
	total_net         = total_net         + ifnull(pr.get("pr_net_salary"),            "0").toDecimal();
}

// total_employer_cost = gross + employer_si + martyrs_fund
total_employer_cost = (total_gross + total_employer_si + total_martyrs).round(2);

// ── STEP 4: Build summary ─────────────────────────────────────────────────────
summary = Map();
summary.put("headcount",           headcount);
summary.put("termination_count",   termination_count);
summary.put("total_gross",         total_gross.round(2));
summary.put("total_basic_salary",  total_basic.round(2));
summary.put("total_allowances",    total_allowances.round(2));
summary.put("total_employee_si",   total_employee_si.round(2));
summary.put("total_employer_si",   total_employer_si.round(2));
summary.put("total_martyrs_fund",  total_martyrs.round(2));
summary.put("total_tax_withheld",  total_tax.round(2));
summary.put("total_net_salary",    total_net.round(2));
summary.put("total_employer_cost", total_employer_cost);

// ── STEP 5: Assemble response ─────────────────────────────────────────────────
// generated_at is time-only ("HH:MM") — matches frontend display format
result.put("status",       "success");
result.put("period",       payroll_period);
result.put("generated_at", zoho.currenttime.toString("HH:mm"));
result.put("summary",      summary);

info "END. portalGetPeriodReport | period=" + payroll_period
   + " | headcount=" + headcount
   + " | terminations=" + termination_count
   + " | total_net=" + total_net.round(2);

return result;
