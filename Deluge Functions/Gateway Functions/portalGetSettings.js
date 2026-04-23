// ============================================================
// Function : portalGetSettings
// Phase    : B1
// Trigger  : Webtab — feature_settings module load
// Inputs   : none
// Returns  : {
//     status           : "success" | "error"
//     payroll_settings : { apply_insurance, entity_type, apply_tax, scope, selected_department }
//     portal_config    : { default_holiday_source, allow_working_days_override }
//     portal_users     : Map — user_id → role
//     portal_roles     : Map — role → feature list
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

payroll_settings = settings_response.get("variable").get("value");
active_settings  = payroll_settings.get("active_settings");
si_cfg           = active_settings.get("social_insurance");
tax_cfg          = active_settings.get("income_tax");
run_cfg          = active_settings.get("payroll_run");

payroll_section = Map();
payroll_section.put("apply_insurance",      si_cfg.get("apply_insurance"));
payroll_section.put("entity_type",          si_cfg.get("entity_type"));
payroll_section.put("apply_tax",            tax_cfg.get("apply_tax"));
payroll_section.put("scope",                run_cfg.get("scope"));
payroll_section.put("selected_department",  ifnull(run_cfg.get("selected_department"), ""));
payroll_section.put("lock",                 ifnull(run_cfg.get("lock"), false));

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

portal_config  = portal_cfg_response.get("variable").get("value");
config_section = portal_config.get("config");

portal_section = Map();
portal_section.put("default_holiday_source",    config_section.get("default_holiday_source"));
portal_section.put("allow_working_days_override", config_section.get("allow_working_days_override"));

// ── Assemble response ─────────────────────────────────────────────────────────
result.put("status",           "success");
result.put("payroll_settings", payroll_section);
result.put("portal_config",    portal_section);
result.put("portal_users",     portal_config.get("users"));   // user_id → role map
result.put("portal_roles",     portal_config.get("roles"));   // role → feature list (display only)

info "END. portalGetSettings | status=success";
return result;
