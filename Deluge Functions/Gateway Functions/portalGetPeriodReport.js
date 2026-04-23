// ============================================================
// Function : portalGetPeriodReport
// Phase    : B7
// Trigger  : Webtab — feature_reports, period selected
// Inputs   : payroll_period — String "YYYY-MM"
// Returns  : {
//     status           : "success" | "error"
//     period           : String
//     generated_at     : String timestamp
//     summary : {
//       headcount           : Integer — regular Final records
//       termination_count   : Integer — termination Final records
//       total_gross         : Decimal
//       total_basic_salary  : Decimal
//       total_allowances    : Decimal
//       total_employee_si   : Decimal
//       total_employer_si   : Decimal
//       total_martyrs_fund  : Decimal
//       total_tax_withheld  : Decimal
//       total_net_salary    : Decimal
//       total_employer_cost : Decimal  (gross + employer_si + martyrs_fund)
//     }
//     records : [                       — flat list for CSV/PDF export
//       {
//         employee_id, payroll_period, basic_salary, total_allowances,
//         gross_salary, employee_si, martyrs_fund, employer_si,
//         monthly_tax, net_salary, is_termination, settlement_days_worked,
//         absent_days, late_minutes, overtime_hours,
//         ytd_gross, ytd_tax_withheld
//       }
//     ]
//   }
// Reads    : Monthly_Payroll_Record (status=Final, period=payroll_period)
// Writes   : nothing
// Note     : CSV and PDF export are generated client-side in webtab
//            from the records array. This function returns raw data only.
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

// ── STEP 2: Fetch all Final payroll records for the period ────────────────────
// One query — both regular and termination records returned, partitioned in memory
payroll_records = zoho.people.getRecords("Monthly_Payroll_Record",
	{"searchField": "pr_payroll_period","searchOperator":"Is","searchText":payroll_period,
	 "searchField2":"pr_status",        "searchOperator2":"Is","searchText2":"Final"});

info "Records found: " + payroll_records.size();

if(payroll_records.size() == 0)
{
	result.put("status",      "success");
	result.put("period",      payroll_period);
	result.put("message",     "No Final payroll records found for period " + payroll_period + ".");
	result.put("summary",     Map());
	result.put("records",     List());
	result.put("generated_at",zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));
	return result;
}

// ── STEP 3: Aggregate and build flat record list ──────────────────────────────
headcount         = 0;
termination_count = 0;

total_gross        = 0.0;
total_basic        = 0.0;
total_allowances   = 0.0;
total_employee_si  = 0.0;
total_employer_si  = 0.0;
total_martyrs      = 0.0;
total_tax          = 0.0;
total_net          = 0.0;

flat_records = List();

for each pr in payroll_records
{
	is_term = ifnull(pr.get("pr_is_final_settlement"), false);

	if(is_term == true || is_term == "true")
	{
		termination_count += 1;
	}
	else
	{
		headcount += 1;
	}

	// Accumulate summary totals — both regular and termination contribute
	pr_gross       = ifnull(pr.get("pr_gross_salary"),          "0").toDecimal();
	pr_basic       = ifnull(pr.get("pr_basic_salary"),          "0").toDecimal();
	pr_allow       = ifnull(pr.get("pr_total_allowances"),      "0").toDecimal();
	pr_emp_si      = ifnull(pr.get("pr_employee_si_deduction"), "0").toDecimal();
	pr_emp_si_er   = ifnull(pr.get("pr_employer_si"),           "0").toDecimal();
	pr_martyrs     = ifnull(pr.get("pr_martyrs_fund"),          "0").toDecimal();
	pr_tax         = ifnull(pr.get("pr_monthly_tax"),           "0").toDecimal();
	pr_net         = ifnull(pr.get("pr_net_salary"),            "0").toDecimal();

	total_gross       = total_gross      + pr_gross;
	total_basic       = total_basic      + pr_basic;
	total_allowances  = total_allowances + pr_allow;
	total_employee_si = total_employee_si + pr_emp_si;
	total_employer_si = total_employer_si + pr_emp_si_er;
	total_martyrs     = total_martyrs    + pr_martyrs;
	total_tax         = total_tax        + pr_tax;
	total_net         = total_net        + pr_net;

	// Build flat record for export
	rec = Map();
	rec.put("employee_id",          pr.get("pr_employee"));
	rec.put("payroll_period",       payroll_period);
	rec.put("basic_salary",         pr_basic);
	rec.put("total_allowances",     pr_allow);
	rec.put("gross_salary",         pr_gross);
	rec.put("si_subscription_wage", ifnull(pr.get("pr_si_subscription_wage"),  "0").toDecimal());
	rec.put("employee_si",          pr_emp_si);
	rec.put("martyrs_fund",         pr_martyrs);
	rec.put("employer_si",          pr_emp_si_er);
	rec.put("monthly_tax",          pr_tax);
	rec.put("absence_deduction",    ifnull(pr.get("pr_absence_deduction"),     "0").toDecimal());
	rec.put("unpaid_leave_deduction",ifnull(pr.get("pr_unpaid_leave_deduction"),"0").toDecimal());
	rec.put("late_deduction",       ifnull(pr.get("pr_late_deduction"),        "0").toDecimal());
	rec.put("overtime_addition",    ifnull(pr.get("pr_overtime_addition"),     "0").toDecimal());
	rec.put("ph_addition",          ifnull(pr.get("pr_public_holiday_addition"),"0").toDecimal());
	rec.put("net_salary",           pr_net);
	rec.put("is_termination",       (is_term == true || is_term == "true"));
	rec.put("settlement_days_worked",ifnull(pr.get("pr_final_settlement_days_worked"),""));
	rec.put("absent_days",          ifnull(pr.get("pr_absent_days"),           "0").toInteger());
	rec.put("late_minutes",         ifnull(pr.get("pr_late_minutes"),          "0").toInteger());
	rec.put("overtime_hours",       ifnull(pr.get("pr_overtime_hours"),        "0").toDecimal());
	rec.put("ytd_gross",            ifnull(pr.get("pr_ytd_gross"),             "0").toDecimal());
	rec.put("ytd_tax_withheld",     ifnull(pr.get("pr_ytd_tax_withheld"),      "0").toDecimal());
	rec.put("payslip_issue_date",   ifnull(pr.get("pr_payslip_issue_date"),    ""));
	flat_records.add(rec);
}

// ── STEP 4: Build summary ─────────────────────────────────────────────────────
// total_employer_cost: gross + employer_si + martyrs_fund
total_employer_cost = (total_gross + total_employer_si + total_martyrs).round(2);

summary = Map();
summary.put("headcount",          headcount);
summary.put("termination_count",  termination_count);
summary.put("total_gross",        total_gross.round(2));
summary.put("total_basic_salary", total_basic.round(2));
summary.put("total_allowances",   total_allowances.round(2));
summary.put("total_employee_si",  total_employee_si.round(2));
summary.put("total_employer_si",  total_employer_si.round(2));
summary.put("total_martyrs_fund", total_martyrs.round(2));
summary.put("total_tax_withheld", total_tax.round(2));
summary.put("total_net_salary",   total_net.round(2));
summary.put("total_employer_cost",total_employer_cost);

// ── STEP 5: Assemble response ─────────────────────────────────────────────────
result.put("status",       "success");
result.put("period",       payroll_period);
result.put("generated_at", zoho.currenttime.toString("yyyy-MM-dd HH:mm:ss"));
result.put("summary",      summary);
result.put("records",      flat_records);

info "END. portalGetPeriodReport | period=" + payroll_period
   + " | headcount=" + headcount + " | terminations=" + termination_count
   + " | total_net=" + total_net.round(2);

return result;
