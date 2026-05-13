// ============================================================
// Function : calculateEmployeePayroll
// Version  : Orca Payroll Lit 2.0
// Called by: processPayrollBatch ONLY
// Purpose  : Merged SI + Tax + Attendance in one function body.
//            Eliminates 3 invokeUrl calls per employee (was one
//            per standalone function) down to 1 invokeUrl total.
//            All config maps passed as parameters — Orchestrator
//            reads them once and passes down. No internal fetches.
//
// INPUTS
//   employee_id          : String
//   gross_salary         : Decimal  — pre-computed (basic + allowances)
//   subscription_wage    : Decimal  — SI base wage (may differ from gross)
//   hire_month           : Integer  — from emp hire_date
//   hire_year            : Integer  — from emp hire_date
//   payroll_year         : Integer  — current run year
//   working_days         : Integer  — mps_working_days (full month)
//   absent_days          : Integer  — from pq_absent_days snapshot
//   unpaid_leave_days    : Decimal  — from pq_unpaid_leave_days snapshot
//   late_minutes         : Integer  — from pq_late_minutes snapshot
//   overtime_hours       : Decimal  — from pq_overtime_hours snapshot
//   ph_days_worked       : Integer  — from pq_ph_days_worked snapshot
//   apply_insurance      : Boolean  — from PAYROLL_SETTINGS_JSON
//   apply_tax            : Boolean  — from PAYROLL_SETTINGS_JSON
//   entity_type          : String   — "Legal Entity" | "Sole Proprietorship"
//   si_config            : Map      — SI_CONFIG_JSON.variable.value
//   tax_config           : Map      — TAX_CONFIG_JSON.variable.value
//   tax_std              : Map      — TAX_BRACKETS_STD_JSON.variable.value
//   tax_hi               : Map      — TAX_BRACKETS_HI_JSON.variable.value
//   att_rules            : Map      — ATTENDANCE_RULES_JSON.variable.value
//
// OUTPUT — combined result Map:
//   SI fields    : subscription_wage, monthly_ceiling, capped_wage,
//                  employee_si, employer_si, martyrs_fund,
//                  total_employee_deduction, total_employer_cost
//   Tax fields   : monthly_personal_exemption, monthly_net_taxable,
//                  months_remaining, annual_net_taxable, annual_tax,
//                  monthly_tax
//   Att fields   : daily_rate, hourly_rate, minute_rate,
//                  absence_deduction, unpaid_leave_deduction, late_deduction,
//                  overtime_addition, public_holiday_addition, total_adjustment
// ============================================================

// ── Parse config parameters ───────────────────────────────────────────────
// Config Maps are passed as JSON strings via invokeUrl POST from processPayrollBatch.
// .toMap() converts them back to native Deluge Maps before use.
// Empty string guards handle apply_insurance=false / apply_tax=false cases
// where si_config, tax_config, tax_std, tax_hi are passed as empty Map strings.
si_config  = ifnull(si_config,  "{}").toString().toMap();
tax_config = ifnull(tax_config, "{}").toString().toMap();
tax_std    = ifnull(tax_std,    "{}").toString().toMap();
tax_hi     = ifnull(tax_hi,     "{}").toString().toMap();
att_rules  = ifnull(att_rules,  "{}").toString().toMap();

result = Map();
result.put("employee_id", employee_id);

// ══════════════════════════════════════════════════════════════
// BLOCK 1 — Social Insurance
// Source logic: calculateSocialInsurance (standalone)
// Config: si_config passed in — no invokeUrl
// Sequential dependency: employee_si + martyrs_fund feed Block 2
// ══════════════════════════════════════════════════════════════
employee_si     = 0;
employer_si     = 0;
martyrs_fund    = 0;
capped_wage     = subscription_wage.toDecimal();
monthly_ceiling = 0;

if(apply_insurance)
{
    monthly_ceiling = si_config.get("monthly_ceiling").toDecimal();

    // Cap subscription wage at the GOSI monthly ceiling
    if(capped_wage > monthly_ceiling)
    {
        capped_wage = monthly_ceiling;
    }

    // Employee contribution — deducted from net salary
    employee_si = capped_wage * si_config.get("employee_rate").toDecimal();

    // Employer contribution — company cost, not deducted from employee net
    employer_si = capped_wage * si_config.get("employer_rate").toDecimal();

    // Martyrs Fund — Legal Entity only, zero for Sole Proprietorship
    if(entity_type == "Legal Entity")
    {
        martyrs_fund = gross_salary.toDecimal() * si_config.get("martyrs_fund_rate").toDecimal();
    }
}

result.put("subscription_wage",       subscription_wage.toDecimal().round(2));
result.put("monthly_ceiling",         monthly_ceiling);
result.put("capped_wage",             capped_wage.round(2));
result.put("employee_si",             employee_si.round(2));
result.put("employer_si",             employer_si.round(2));
result.put("martyrs_fund",            martyrs_fund.round(2));
result.put("total_employee_deduction",(employee_si + martyrs_fund).round(2));
result.put("total_employer_cost",     employer_si.round(2));

// ══════════════════════════════════════════════════════════════
// BLOCK 2 — Income Tax (Forward Annualisation)
// Source logic: calculatePayroll (standalone)
// Config: tax_config, tax_std, tax_hi passed in — no invokeUrl
// Depends on Block 1: employee_si and martyrs_fund reduce monthly_net
// Note: net_salary NOT computed here — processPayrollBatch
//       derives final_net from the full deductions map
// ══════════════════════════════════════════════════════════════
personal_exemption_annual  = tax_config.get("personal_exemption_annual").toDecimal();
monthly_personal_exemption = personal_exemption_annual / 12;

// Monthly taxable base — SI deductions reduce taxable income
monthly_net = gross_salary.toDecimal()
            - employee_si
            - martyrs_fund
            - monthly_personal_exemption;
if(monthly_net < 0) { monthly_net = 0; }

result.put("monthly_personal_exemption", monthly_personal_exemption.round(2));
result.put("monthly_net_taxable",        monthly_net.round(2));

monthly_tax     = 0;
annual_tax      = 0;
annual_net      = 0;
months_remaining = 12;  // initialised before guard — always present in result

if(apply_tax)
{
    // Forward annualisation:
    // Hire year → remaining months only (13 - hire_month)
    // All other years → full 12 months
    if(payroll_year.toNumber() == hire_year.toNumber())
    {
        months_remaining = 13 - hire_month.toNumber();
    }
    else
    {
        months_remaining = 12;
    }

    annual_net = monthly_net * months_remaining;

    // Bracket selection:
    // annual_net <= 600,000 → standard brackets
    // annual_net >  600,000 → high-income tiers
    // Match rule: annual_net > bracket.min AND <= bracket.max
    // Last tier: max = null → no upper bound
    if(annual_net <= 600000)
    {
        brackets = tax_std.get("standard_brackets");
        for each bracket in brackets
        {
            b_min   = bracket.get("min").toDecimal();
            b_max   = bracket.get("max");
            b_rate  = bracket.get("rate").toDecimal();
            b_const = bracket.get("constant").toDecimal();
            if(annual_net > b_min && (b_max == null || annual_net <= b_max.toDecimal()))
            {
                annual_tax = annual_net * b_rate - b_const;
                break;
            }
        }
    }
    else
    {
        tiers = tax_hi.get("high_income_tiers");
        for each tier in tiers
        {
            t_min   = tier.get("min").toDecimal();
            t_max   = tier.get("max");
            t_rate  = tier.get("rate").toDecimal();
            t_const = tier.get("constant").toDecimal();
            if(annual_net > t_min && (t_max == null || annual_net <= t_max.toDecimal()))
            {
                annual_tax = annual_net * t_rate - t_const;
                break;
            }
        }
    }

    // Tax floor — annual_tax can never be negative
    if(annual_tax < 0) { annual_tax = 0; }

    monthly_tax = annual_tax / months_remaining;

    result.put("months_remaining",   months_remaining);
    result.put("annual_net_taxable", annual_net.round(2));
    result.put("annual_tax",         annual_tax.round(2));
}

result.put("monthly_tax", monthly_tax.round(2));

// ══════════════════════════════════════════════════════════════
// BLOCK 3 — Attendance Adjustments
// Source logic: calculateAttendanceAdjustments (standalone)
// Config: att_rules passed in — no invokeUrl
// No dependency on Blocks 1 or 2 — operates on gross_salary only
// working_days = mps_working_days on regular runs (full month)
//             = days_worked on termination runs (partial month)
// ══════════════════════════════════════════════════════════════
daily_rate  = gross_salary.toDecimal() / working_days.toNumber();
hourly_rate = daily_rate / 8;
minute_rate = hourly_rate / 60;

result.put("daily_rate",  daily_rate.round(4));
result.put("hourly_rate", hourly_rate.round(4));
result.put("minute_rate", minute_rate.round(4));

// — Absence deduction ─────────────────────────────────────────
absence_deduction = 0;
if(att_rules.get("absence").get("enabled"))
{
    abs_multiplier    = ifnull(att_rules.get("absence").get("multiplier"), 1).toDecimal();
    absence_deduction = daily_rate * absent_days.toNumber() * abs_multiplier;
}
result.put("absence_deduction", absence_deduction.round(2));

// — Unpaid leave deduction ────────────────────────────────────
unpaid_leave_deduction = 0;
if(att_rules.get("unpaid_leave").get("enabled"))
{
    ul_multiplier          = ifnull(att_rules.get("unpaid_leave").get("multiplier"), 1).toDecimal();
    unpaid_leave_deduction = daily_rate * unpaid_leave_days.toDecimal() * ul_multiplier;
}
result.put("unpaid_leave_deduction", unpaid_leave_deduction.round(2));

// — Late deduction ────────────────────────────────────────────
// late_minutes aggregated in Orchestrator from DeviationTime
// Negative DeviationTime (early arrivals) excluded at Orchestrator — never reaches here
late_deduction = 0;
if(att_rules.get("late_deduction").get("enabled"))
{
    grace_min      = ifnull(att_rules.get("late_deduction").get("grace_minutes"), 0).toInteger();
    billed_late    = late_minutes.toNumber() - grace_min;
    if(billed_late < 0) { billed_late = 0; }
    ld_multiplier  = ifnull(att_rules.get("late_deduction").get("multiplier"), 1).toDecimal();
    late_deduction = minute_rate * billed_late * ld_multiplier;
}
result.put("late_deduction", late_deduction.round(2));

// — Overtime addition ─────────────────────────────────────────
// multiplier: 1.5 or 2.0 from att_rules
overtime_addition = 0;
if(att_rules.get("overtime").get("enabled"))
{
    multiplier        = att_rules.get("overtime").get("multiplier").toDecimal();
    overtime_addition = hourly_rate * multiplier * overtime_hours.toDecimal();
}
result.put("overtime_addition", overtime_addition.round(2));

// — Public holiday addition ───────────────────────────────────
// Three modes: overtime_rate | double_rate | paid_day
// paid_day → no extra pay (employee already compensated by base salary)
public_holiday_addition = 0;
if(att_rules.get("public_holiday").get("enabled") && ph_days_worked.toNumber() > 0)
{
    mode = att_rules.get("public_holiday").get("if_worked");
    if(mode == "overtime_rate")
    {
        multiplier              = att_rules.get("overtime").get("multiplier").toDecimal();
        public_holiday_addition = daily_rate * multiplier * ph_days_worked.toNumber();
    }
    else if(mode == "double_rate")
    {
        public_holiday_addition = daily_rate * 2 * ph_days_worked.toNumber();
    }
    else if(mode == "paid_day")
    {
        public_holiday_addition = 0;
    }
}
result.put("public_holiday_addition", public_holiday_addition.round(2));

// — Total adjustment ──────────────────────────────────────────
// Can be negative — net salary floor applied in processPayrollBatch, not here
total_adjustment = overtime_addition
                 + public_holiday_addition
                 - absence_deduction
                 - unpaid_leave_deduction
                 - late_deduction;
result.put("total_adjustment", total_adjustment.round(2));

info result;
return result;
