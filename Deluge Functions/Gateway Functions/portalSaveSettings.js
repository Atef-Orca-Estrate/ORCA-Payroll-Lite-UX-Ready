// ============================================================
// Function : portalSaveSettings
// Trigger  : Settings feature — "Save" button per section card
// Inputs   : section — String routing key (see cases below)
//
//   section = "social_insurance":
//     monthly_ceiling   — Number (EGP)
//
//   section = "attendance":
//     working_days_default — Integer
//     absence        — { enabled: Boolean, multiplier: Number }
//     unpaid_leave   — { enabled: Boolean, multiplier: Number }
//     late_deduction — { enabled: Boolean, grace_minutes: Integer, multiplier: Number }
//     overtime       — { enabled: Boolean, multiplier: Number }
//     public_holiday — { enabled: Boolean, if_worked: String }
//
//   section = "portal_config":
//     default_holiday_source      — String "zoho" | "manual"
//     allow_working_days_override — Boolean
//     allow_multiple_runs         — Boolean
//
//   section = "portal_roles":
//     portal_roles — Map { [role_name]: [feature_key, ...] }
//
//   section = "portal_users":
//     user_id — String (employee ID)
//     role    — String | "" (empty = remove user)
//
// Returns  : { status: "success" | "error", message: String }
// Reads    : PAYROLL_SETTINGS_JSON or PAYROLL_PORTAL_CONFIG
// Writes   : PAYROLL_SETTINGS_JSON or PAYROLL_PORTAL_CONFIG
// ============================================================

info "INIT. portalSaveSettings | section=" + section;

result = Map();

// ── Guard: reject writes to settings while a payroll run is Processing ────────
// portal_users and portal_roles are safe to change at any time.
if(section != "portal_users" && section != "portal_roles")
{
	settings_chk = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	lock_val = ifnull(settings_chk.get("variable").get("value")
	                              .get("active_settings").get("payroll_run").get("lock"), false);
	if(lock_val == true || lock_val == "true")
	{
		result.put("status",  "error");
		result.put("message", "Cannot update settings while a payroll run is in progress. Wait for the current run to complete.");
		return result;
	}
}

// ════════════════════════════════════════════════════════════════
// SECTION: social_insurance
// Saves monthly_ceiling and stamps ceiling_updated to today.
// ════════════════════════════════════════════════════════════════
if(section == "social_insurance")
{
	if(ifnull(monthly_ceiling, "") == "")
	{
		result.put("status",  "error");
		result.put("message", "monthly_ceiling is required.");
		return result;
	}

	settings_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	payroll_var     = settings_response.get("variable").get("value");
	active_settings = payroll_var.get("active_settings");

	si_block = ifnull(active_settings.get("social_insurance"), Map());
	si_block.put("monthly_ceiling",   monthly_ceiling.toDecimal());
	si_block.put("ceiling_updated",   zoho.currenttime.toString("yyyy-MM-dd"));
	active_settings.put("social_insurance", si_block);
	payroll_var.put("active_settings", active_settings);

	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":payroll_var.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=social_insurance | ceiling=" + monthly_ceiling;
	result.put("status",  "success");
	result.put("message", "Social insurance settings saved.");
	return result;
}

// ════════════════════════════════════════════════════════════════
// SECTION: attendance
// Saves full attendance block.
// ════════════════════════════════════════════════════════════════
if(section == "attendance")
{
	settings_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	payroll_var     = settings_response.get("variable").get("value");
	active_settings = payroll_var.get("active_settings");

	// Build attendance block from incoming params
	absence_in = ifnull(absence, Map());
	ul_in      = ifnull(unpaid_leave, Map());
	late_in    = ifnull(late_deduction, Map());
	ot_in      = ifnull(overtime, Map());
	ph_in      = ifnull(public_holiday, Map());

	absence_block = Map();
	absence_block.put("enabled",    ifnull(absence_in.get("enabled"),    true));
	absence_block.put("multiplier", ifnull(absence_in.get("multiplier"), 1.0));

	ul_block = Map();
	ul_block.put("enabled",    ifnull(ul_in.get("enabled"),    true));
	ul_block.put("multiplier", ifnull(ul_in.get("multiplier"), 1.0));

	late_block = Map();
	late_block.put("enabled",       ifnull(late_in.get("enabled"),       true));
	late_block.put("grace_minutes", ifnull(late_in.get("grace_minutes"), 0));
	late_block.put("multiplier",    ifnull(late_in.get("multiplier"),    1.0));

	ot_block = Map();
	ot_block.put("enabled",    ifnull(ot_in.get("enabled"),    true));
	ot_block.put("multiplier", ifnull(ot_in.get("multiplier"), 1.5));

	ph_block = Map();
	ph_block.put("enabled",   ifnull(ph_in.get("enabled"),   true));
	ph_block.put("if_worked", ifnull(ph_in.get("if_worked"), "overtime_rate"));

	att_block = Map();
	att_block.put("working_days_default", ifnull(working_days_default, 22).toInteger());
	att_block.put("absence",              absence_block);
	att_block.put("unpaid_leave",         ul_block);
	att_block.put("late_deduction",       late_block);
	att_block.put("overtime",             ot_block);
	att_block.put("public_holiday",       ph_block);

	active_settings.put("attendance", att_block);
	payroll_var.put("active_settings", active_settings);

	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_SETTINGS_JSON/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":payroll_var.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=attendance | saved.";
	result.put("status",  "success");
	result.put("message", "Attendance settings saved.");
	return result;
}

// ════════════════════════════════════════════════════════════════
// SECTION: portal_config
// Saves default_holiday_source, allow_working_days_override, allow_multiple_runs.
// ════════════════════════════════════════════════════════════════
if(section == "portal_config")
{
	portal_cfg_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	portal_var   = portal_cfg_response.get("variable").get("value");
	config_block = ifnull(portal_var.get("config"), Map());

	config_block.put("default_holiday_source",     ifnull(default_holiday_source,      config_block.get("default_holiday_source")));
	config_block.put("allow_working_days_override", ifnull(allow_working_days_override, config_block.get("allow_working_days_override")));
	config_block.put("allow_multiple_runs",         ifnull(allow_multiple_runs,         ifnull(config_block.get("allow_multiple_runs"), false)));
	portal_var.put("config", config_block);

	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":portal_var.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=portal_config | saved.";
	result.put("status",  "success");
	result.put("message", "Portal configuration saved.");
	return result;
}

// ════════════════════════════════════════════════════════════════
// SECTION: portal_roles
// Full matrix replacement — all roles replaced at once.
// ════════════════════════════════════════════════════════════════
if(section == "portal_roles")
{
	if(ifnull(portal_roles, "") == "")
	{
		result.put("status",  "error");
		result.put("message", "portal_roles map is required.");
		return result;
	}

	portal_cfg_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	portal_var = portal_cfg_response.get("variable").get("value");
	portal_var.put("roles", portal_roles);

	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":portal_var.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=portal_roles | saved.";
	result.put("status",  "success");
	result.put("message", "Roles and permissions saved.");
	return result;
}

// ════════════════════════════════════════════════════════════════
// SECTION: portal_users
// Upserts (role != "") or removes (role == "") a single user.
// ════════════════════════════════════════════════════════════════
if(section == "portal_users")
{
	if(ifnull(user_id, "") == "")
	{
		result.put("status",  "error");
		result.put("message", "user_id is required.");
		return result;
	}

	portal_cfg_response = invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/view?group=Orca_Payroll_Variables"
		type :GET
		connection:"zoho_people_payroll_conn"
	];
	portal_var = portal_cfg_response.get("variable").get("value");
	users_map  = ifnull(portal_var.get("users"), Map());
	roles_map  = ifnull(portal_var.get("roles"), Map());

	role_val = ifnull(role, "");

	if(role_val == "")
	{
		// Remove user
		users_map.remove(user_id);
		action = "removed";
	}
	else
	{
		// Validate role exists in roles map
		if(!roles_map.containsKey(role_val))
		{
			result.put("status",  "error");
			result.put("message", "Role '" + role_val + "' does not exist. Create it in Roles & Permissions first.");
			return result;
		}
		// Check for duplicate (add only; update is allowed)
		if(users_map.containsKey(user_id) && users_map.get(user_id) != role_val)
		{
			// Updating role — allowed
		}
		else if(users_map.containsKey(user_id))
		{
			result.put("status",  "error");
			result.put("message", user_id + " already has a portal role.");
			return result;
		}
		users_map.put(user_id, role_val);
		action = "saved";
	}

	portal_var.put("users", users_map);

	invokeurl
	[
		url :"https://people.zoho.com/people/api/v3/variables/PAYROLL_PORTAL_CONFIG/update?group=Orca_Payroll_Variables"
		type :POST
		parameters:{"value":portal_var.toString()}
		connection:"zoho_people_payroll_conn"
	];

	info "END. portalSaveSettings | section=portal_users | user=" + user_id + " | " + action;
	result.put("status",  "success");
	result.put("message", "User " + user_id + " " + action + ".");
	return result;
}

// ── Unknown section guard ─────────────────────────────────────────────────────
result.put("status",  "error");
result.put("message", "Unknown section: '" + section + "'. Valid sections: social_insurance, attendance, portal_config, portal_roles, portal_users.");
info "END. portalSaveSettings | unknown section: " + section;
return result;
