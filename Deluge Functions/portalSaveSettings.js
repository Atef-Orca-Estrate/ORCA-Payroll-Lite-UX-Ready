// ============================================================
// Function : portalSaveSettings
// Phase    : B2
// Trigger  : Webtab — feature_settings save actions
// Inputs   : section  — String: "payroll_settings" | "portal_config" | "portal_users"
//
//   section = "payroll_settings":
//     apply_insurance     — Boolean
//     entity_type         — String: "Legal Entity" | "Sole Proprietorship"
//     apply_tax           — Boolean
//     scope               — String: "all" | "by_department" | "by_employee"
//     selected_department — String (empty string if scope != by_department)
//
//   section = "portal_config":
//     default_holiday_source    — String: "zoho" | "manual"
//     allow_working_days_override — Boolean
//
//   section = "portal_users":
//     user_id — String  (Zoho People EmployeeID)
//     role    — String: "admin" | "manager" | "" (empty = remove user from map)
//
// Returns  : { status: "success" | "error", message: String }
// Reads    : PAYROLL_SETTINGS_JSON or PAYROLL_PORTAL_CONFIG (section-dependent)
// Writes   : PAYROLL_SETTINGS_JSON or PAYROLL_PORTAL_CONFIG (section-dependent)
// ============================================================

info "INIT. portalSaveSettings | section=" + section;

result = Map();

// ── Guard: reject write while payroll run is in progress ──────────────────────
// payroll_settings and portal_config changes during an active run could corrupt
// batch processing mid-flight. portal_users is safe to change any time.
if(section != "portal_users")
{
	settings_chk_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	chk_settings = settings_chk_response.get("variable").get("value");
	if(chk_settings.get("active_settings").get("payroll_run").get("lock") == true)
	{
		result.put("status",  "error");
		result.put("message", "Cannot update settings while a payroll run is in progress. Wait for the current run to complete.");
		return result;
	}
}

// ════════════════════════════════════════════════════════════════
// SECTION: payroll_settings
// Patches PAYROLL_SETTINGS_JSON.active_settings
// ════════════════════════════════════════════════════════════════
if(section == "payroll_settings")
{
	// Read current value
	settings_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	payroll_settings = settings_response.get("variable").get("value");
	active_settings  = payroll_settings.get("active_settings");

	// Patch social_insurance block
	si_block = active_settings.get("social_insurance");
	si_block.put("apply_insurance", apply_insurance);
	si_block.put("entity_type",     entity_type);
	active_settings.put("social_insurance", si_block);

	// Patch income_tax block
	tax_block = active_settings.get("income_tax");
	tax_block.put("apply_tax", apply_tax);
	active_settings.put("income_tax", tax_block);

	// Patch payroll_run scope block — never touch lock or selected_employees here
	run_block = active_settings.get("payroll_run");
	run_block.put("scope",               scope);
	run_block.put("selected_department", ifnull(selected_department, ""));
	active_settings.put("payroll_run", run_block);

	payroll_settings.put("active_settings", active_settings);

	// Write back
	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":payroll_settings.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=payroll_settings | saved.";
	result.put("status",  "success");
	result.put("message", "Payroll settings saved.");
	return result;
}

// ════════════════════════════════════════════════════════════════
// SECTION: portal_config
// Patches PAYROLL_PORTAL_CONFIG.config block
// ════════════════════════════════════════════════════════════════
if(section == "portal_config")
{
	portal_cfg_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	portal_config = portal_cfg_response.get("variable").get("value");

	// Patch config block — roles and users untouched
	config_block = portal_config.get("config");
	config_block.put("default_holiday_source",     default_holiday_source);
	config_block.put("allow_working_days_override", allow_working_days_override);
	portal_config.put("config", config_block);

	// Write back
	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":portal_config.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=portal_config | saved.";
	result.put("status",  "success");
	result.put("message", "Portal configuration saved.");
	return result;
}

// ════════════════════════════════════════════════════════════════
// SECTION: portal_users
// Upserts or removes a single user from PAYROLL_PORTAL_CONFIG.users
// role = "" → remove user | role = "admin"|"manager" → upsert
// ════════════════════════════════════════════════════════════════
if(section == "portal_users")
{
	// Validate user_id
	if(ifnull(user_id, "") == "")
	{
		result.put("status",  "error");
		result.put("message", "user_id is required.");
		return result;
	}

	// Validate role value
	valid_roles = {"admin", "manager", ""};
	if(!valid_roles.contains(role))
	{
		result.put("status",  "error");
		result.put("message", "Invalid role: " + role + ". Must be admin, manager, or empty to remove.");
		return result;
	}

	portal_cfg_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	portal_config = portal_cfg_response.get("variable").get("value");
	users_map     = portal_config.get("users");

	if(ifnull(role, "") == "")
	{
		// Remove user
		users_map.remove(user_id);
		action_taken = "removed";
	}
	else
	{
		// Upsert user → role
		users_map.put(user_id, role);
		action_taken = "saved";
	}

	portal_config.put("users", users_map);

	// Write back
	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":portal_config.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=portal_users | user=" + user_id + " | " + action_taken;
	result.put("status",  "success");
	result.put("message", "User " + user_id + " " + action_taken + ".");
	return result;
}

// ── Unknown section guard ─────────────────────────────────────────────────────
result.put("status",  "error");
result.put("message", "Unknown section: " + section + ". Must be payroll_settings, portal_config, or portal_users.");
info "END. portalSaveSettings | unknown section: " + section;
return result;
