# ORCA Payroll — Organisation Settings Variable Structure
**Audience:** Frontend developers and AI agents working on settings, gateway functions, or any feature that reads org configuration.
**Purpose:** Single source of truth for every organisation-level variable that controls the SaaS frontend behaviour. All code must read and write these exact field names — no aliases, no camelCase equivalents.

---

## Where These Variables Live

Organisation settings are loaded once at app boot via `portalGetSettings` and stored in the global `auth` context:

```
portalGetSettings response
  └── payroll_settings     → auth.payrollSettings
        ├── payroll_run
        ├── attendance
        └── social_insurance
  └── portal_config        → auth.portalConfig
        ├── portal_users
        ├── portal_roles
        ├── default_holiday_source
        ├── allow_working_days_override
        └── allow_multiple_runs
```

They are never re-fetched. Any mutation (via `portalSaveSettings`) updates the `auth` context optimistically.

---

## 1. Social Insurance Settings

**Auth path:** `auth.payrollSettings.social_insurance`
**Saved via:** `portalSaveSettings` with `section: "social_insurance"`

| Field | Type | Description |
|---|---|---|
| `monthly_ceiling` | `number` | Maximum insurable wage per month (EGP). Editable by admin. |
| `employee_rate` | `number` | Employee SI contribution rate. Fixed by Egyptian Law 148/2019. Display only — not editable in UI. |
| `employer_rate` | `number` | Employer SI contribution rate. Fixed by law. Display only. |
| `martyrs_fund_rate` | `number` | Martyrs' Fund contribution rate. Fixed by law. Display only. |
| `ceiling_updated` | `string` | Date the ceiling was last set (`YYYY-MM-DD`). Triggers a warning badge in Settings if the year is older than the current year. |

**Full object shape:**
```json
{
  "monthly_ceiling":   9400,
  "employee_rate":     0.11,
  "employer_rate":     0.1875,
  "martyrs_fund_rate": 0.0005,
  "ceiling_updated":   "YYYY-MM-DD"
}
```

---

## 2. Attendance Rules

**Auth path:** `auth.payrollSettings.attendance`
**Saved via:** `portalSaveSettings` with `section: "attendance"`

| Field | Type | Description |
|---|---|---|
| `working_days_default` | `number` | Fallback working days per month used when no override is set on a payroll run. |
| `absence.enabled` | `boolean` | Whether absence deductions are applied to the payroll calculation. |
| `absence.multiplier` | `number` | Daily-rate multiplier applied per absent day. |
| `unpaid_leave.enabled` | `boolean` | Whether unpaid leave deductions are applied. |
| `unpaid_leave.multiplier` | `number` | Daily-rate multiplier applied per unpaid leave day. |
| `late_deduction.enabled` | `boolean` | Whether late-arrival deductions are applied. |
| `late_deduction.grace_minutes` | `number` | Monthly accumulated late minutes before deduction starts. |
| `late_deduction.multiplier` | `number` | Per-minute-rate multiplier applied after grace period. |
| `overtime.enabled` | `boolean` | Whether overtime pay is added. |
| `overtime.multiplier` | `number` | Hourly-rate multiplier per overtime hour. |
| `public_holiday.enabled` | `boolean` | Whether extra pay applies when an employee works on a public holiday. |
| `public_holiday.if_worked` | `string` | Rate applied to worked public holiday hours. See valid values below. |

**`public_holiday.if_worked` valid values:**
```
"overtime_rate"  — pay at the configured overtime multiplier
"double_rate"    — pay at 2× the daily rate
"paid_day"       — no extra pay beyond the standard day
```

**Full object shape:**
```json
{
  "working_days_default": 22,
  "absence":        { "enabled": true,  "multiplier": 1.0 },
  "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
  "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
  "overtime":       { "enabled": true,  "multiplier": 1.5 },
  "public_holiday": { "enabled": true,  "if_worked": "overtime_rate" }
}
```

---

## 3. Portal Configuration Flags

**Auth path:** `auth.portalConfig`
**Saved via:** `portalSaveSettings` with `section: "portal_config"`

| Field | Type | Valid values | What it controls |
|---|---|---|---|
| `default_holiday_source` | `string` | `"zoho"` \| `"manual"` | In the Run Payroll wizard (Step 2), `"zoho"` makes the holiday list read-only (fetched on MPS creation). `"manual"` shows Add / Edit / Delete actions and persists via `portalUpdateMPSHolidays`. |
| `allow_working_days_override` | `boolean` | `true` \| `false` | Shows or hides the editable working-days field in wizard Step 2. When `false` the field is read-only. |
| `allow_multiple_runs` | `boolean` | `true` \| `false` | When `false`, the wizard blocks creating a second run for a period that already has one. When `true`, a second run is allowed and `force: true` is sent to `portalCreateMPS`. |

**Full object shape (within `portal_config`):**
```json
{
  "default_holiday_source":      "zoho",
  "allow_working_days_override": true,
  "allow_multiple_runs":         false
}
```

---

## 4. Portal Users Map

**Auth path:** `auth.portalConfig.portal_users`
**Mutated via:** `portalSaveSettings` with `section: "portal_users"`

A flat object mapping each employee ID to their assigned portal role. Only employees listed here can log in to the portal.

```json
{
  "EMP001": "admin",
  "EMP002": "manager"
}
```

| Field | Type | Description |
|---|---|---|
| Key (employee ID) | `string` | Zoho People employee ID (e.g. `"EMP001"`). |
| Value (role name) | `string` | Must match a key in `portal_roles`. |

**Add user params** (passed to `portalSaveSettings`):
```json
{ "section": "portal_users", "user_id": "EMP005", "role": "manager" }
```

**Remove user params** (role set to empty string signals deletion):
```json
{ "section": "portal_users", "user_id": "EMP005", "role": "" }
```

---

## 5. Portal Roles & Permissions Matrix

**Auth path:** `auth.portalConfig.portal_roles`
**Saved via:** `portalSaveSettings` with `section: "portal_roles"` — always a full matrix replacement.

A map of role names to the list of feature keys that role is permitted to access. This is the only source that populates `auth.features` at login, which is the sole runtime access gate for the entire UI.

```json
{
  "admin":   ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_settings", "feature_employees"],
  "manager": ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_employees"]
}
```

| Element | Type | Description |
|---|---|---|
| Key (role name) | `string` | Lowercase, underscore-separated (e.g. `"admin"`, `"manager"`). New roles are normalised to this format. |
| Value (feature array) | `string[]` | Feature keys from the Feature Registry (see below). |

**Valid feature keys:**
```
"feature_dashboard"
"feature_run_payroll"
"feature_queue_monitor"
"feature_reports"
"feature_employees"
"feature_settings"
```

**Rules:**
- `"admin"` is a protected role — it cannot be deleted.
- `"feature_settings"` is always locked to `"admin"` — it cannot be unchecked.
- A role deleted from `portal_roles` while still assigned to a user in `portal_users` triggers the `roleRevoked` lock screen for that user on next login.

---

## 6. How Settings Flow Through the Frontend

```
App boot
  → portalGetSettings()
      ├── response.payroll_settings  → auth.payrollSettings
      │     ├── .social_insurance    → SocialInsuranceSection reads auth.payrollSettings.social_insurance
      │     ├── .attendance          → AttendanceSection reads auth.payrollSettings.attendance
      │     └── .payroll_run         → (default scope, not currently exposed in Settings UI)
      └── response.portal_config     → auth.portalConfig
            ├── .default_holiday_source       → wizard Step 2 holiday edit/read-only mode
            ├── .allow_working_days_override  → wizard Step 2 working days field visibility
            ├── .allow_multiple_runs          → wizard Step 1 duplicate-period guard
            ├── .portal_users                 → PortalUsersSection
            └── .portal_roles                 → RolesSection + resolvePermissions() → auth.features
```

**Runtime permission check (the only access gate):**
```
resolvePermissions(auth.portalConfig, employeeId)
  → role = portal_users[employeeId]
  → features = portal_roles[role]
  → auth.features = features
  → nav items, feature components, and admin guards all check auth.features
```

---

*Last audited: 2026-05-13 against branch `ui/mock-frontend-sandbox`*
