// ============================================================
// Function : portalGetSettings
// Trigger  : App boot — Shell.jsx before any screen renders
// Inputs   : none
// Returns  : {
//     status           : "success" | "error"
//     payroll_settings : {
//         payroll_run      : { scope, selected_department, selected_employees }
//         attendance       : { working_days_default, absence, unpaid_leave,
//                              late_deduction, overtime, public_holiday }
//         social_insurance : { monthly_ceiling, employee_rate, employer_rate,
//                              martyrs_fund_rate, ceiling_updated }
//     }
//     portal_config    : {
//         portal_users                : { [employee_id]: role }
//         portal_roles                : { [role]: [feature_key, ...] }
//         default_holiday_source      : "zoho" | "manual"
//         allow_working_days_override : Boolean
//         allow_multiple_runs         : Boolean
//     }
//   }
// Reads    : PAYROLL_SETTINGS_JSON, PAYROLL_PORTAL_CONFIG
// Writes   : nothing
// ============================================================

info "INIT. portalGetSettings";

result = Map();

// ── Read PAYROLL_SETTINGS_JSON ────────────────────────────────────────────────
settings_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];

if(settings_response.get("variable") == null)
{
	result.put("status",  "error");
	result.put("message", "PAYROLL_SETTINGS_JSON not found. Run initial configuration first.");
	return result;
}

payroll_var     = settings_response.get("variable").get("value");
active_settings = payroll_var.get("active_settings");

// ── social_insurance block — read with defaults for any missing fields ────────
si_raw = ifnull(active_settings.get("social_insurance"), Map());

si_block = Map();
si_block.put("monthly_ceiling",   ifnull(si_raw.get("monthly_ceiling"),   9400));
si_block.put("employee_rate",     ifnull(si_raw.get("employee_rate"),     0.11));
si_block.put("employer_rate",     ifnull(si_raw.get("employer_rate"),     0.1875));
si_block.put("martyrs_fund_rate", ifnull(si_raw.get("martyrs_fund_rate"), 0.0005));
si_block.put("ceiling_updated",   ifnull(si_raw.get("ceiling_updated"),   ""));

// ── attendance block — read with full defaults ────────────────────────────────
att_raw = ifnull(active_settings.get("attendance"), Map());

absence_raw = ifnull(att_raw.get("absence"),        Map());
ul_raw      = ifnull(att_raw.get("unpaid_leave"),   Map());
late_raw    = ifnull(att_raw.get("late_deduction"), Map());
ot_raw      = ifnull(att_raw.get("overtime"),       Map());
ph_raw      = ifnull(att_raw.get("public_holiday"), Map());

absence_block = Map();
absence_block.put("enabled",    ifnull(absence_raw.get("enabled"),    true));
absence_block.put("multiplier", ifnull(absence_raw.get("multiplier"), 1.0));

ul_block = Map();
ul_block.put("enabled",    ifnull(ul_raw.get("enabled"),    true));
ul_block.put("multiplier", ifnull(ul_raw.get("multiplier"), 1.0));

late_block = Map();
late_block.put("enabled",       ifnull(late_raw.get("enabled"),       true));
late_block.put("grace_minutes", ifnull(late_raw.get("grace_minutes"), 0));
late_block.put("multiplier",    ifnull(late_raw.get("multiplier"),    1.0));

ot_block = Map();
ot_block.put("enabled",    ifnull(ot_raw.get("enabled"),    true));
ot_block.put("multiplier", ifnull(ot_raw.get("multiplier"), 1.5));

ph_block = Map();
ph_block.put("enabled",    ifnull(ph_raw.get("enabled"),    true));
ph_block.put("if_worked",  ifnull(ph_raw.get("if_worked"),  "overtime_rate"));

att_block = Map();
att_block.put("working_days_default", ifnull(att_raw.get("working_days_default"), 22));
att_block.put("absence",              absence_block);
att_block.put("unpaid_leave",         ul_block);
att_block.put("late_deduction",       late_block);
att_block.put("overtime",             ot_block);
att_block.put("public_holiday",       ph_block);

// ── payroll_run block ─────────────────────────────────────────────────────────
run_raw = ifnull(active_settings.get("payroll_run"), Map());

run_block = Map();
run_block.put("scope",               ifnull(run_raw.get("scope"),               "all"));
run_block.put("selected_department", ifnull(run_raw.get("selected_department"), ""));
run_block.put("selected_employees",  ifnull(run_raw.get("selected_employees"),  List()));

// ── Assemble payroll_settings ─────────────────────────────────────────────────
payroll_settings_out = Map();
payroll_settings_out.put("social_insurance", si_block);
payroll_settings_out.put("attendance",       att_block);
payroll_settings_out.put("payroll_run",      run_block);

// ── Read PAYROLL_PORTAL_CONFIG ────────────────────────────────────────────────
portal_cfg_response = invokeurl
[
	url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
	type :GET
	connection:"zoho_people_payroll_conn"
];

if(portal_cfg_response.get("variable") == null)
{
	result.put("status",  "error");
	result.put("message", "PAYROLL_PORTAL_CONFIG not found. Run initial configuration first.");
	return result;
}

portal_var   = portal_cfg_response.get("variable").get("value");
config_block = ifnull(portal_var.get("config"), Map());

// ── Assemble portal_config — users and roles nested inside ────────────────────
portal_config_out = Map();
portal_config_out.put("portal_users",                ifnull(portal_var.get("users"),  Map()));
portal_config_out.put("portal_roles",                ifnull(portal_var.get("roles"),  Map()));
portal_config_out.put("default_holiday_source",      ifnull(config_block.get("default_holiday_source"),      "zoho"));
portal_config_out.put("allow_working_days_override", ifnull(config_block.get("allow_working_days_override"), true));
portal_config_out.put("allow_multiple_runs",         ifnull(config_block.get("allow_multiple_runs"),         false));

// ── Build response ────────────────────────────────────────────────────────────
result.put("status",           "success");
result.put("payroll_settings", payroll_settings_out);
result.put("portal_config",    portal_config_out);

info "END. portalGetSettings | status=success";
return result;
