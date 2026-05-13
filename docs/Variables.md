# ORCA Payroll Lite 2.0 — Org Variable Reference

All variables belong to the group: `Orca_Payroll_Variables`
All are accessed via: `https://people.zoho.com/people/api/v3/variables/{NAME}/view?group=Orca_Payroll_Variables`

> **Document ownership:** Sections marked `[FRONTEND]` are maintained by the frontend team.
> Sections marked `[BACKEND]` are maintained by the backend/Deluge team.
> Each team adds notes to their own section only.

---

## Variable Index

| Variable | Purpose | Frontend? | Backend? |
|---|---|:---:|:---:|
| `PAYROLL_SETTINGS_JSON` | Attendance rules, SI rates, run lock | ✓ reads/writes | ✓ reads/writes |
| `PAYROLL_PORTAL_CONFIG` | Roles, users, portal behaviour flags | ✓ reads/writes | ✓ reads |
| `SI_CONFIG_JSON` | Social insurance rates and ceiling | — | ✓ reads/writes |
| `TAX_CONFIG_JSON` | Personal exemption annual value | — | ✓ reads/writes |
| `TAX_BRACKETS_STD_JSON` | Standard tax brackets | — | ✓ reads |
| `TAX_BRACKETS_HI_JSON` | High-income tax tiers | — | ✓ reads |
| `ATTENDANCE_RULES_JSON` | Per-factor attendance rules | — | ✓ reads/writes |

---

## 1. PAYROLL_SETTINGS_JSON

### [FRONTEND]

The frontend reads and writes the `social_insurance` and `attendance` blocks via `portalGetSettings` (read) and `portalSaveSettings` (write). The `payroll_run` block is read by the backend engine only — the frontend **does not read or write scope fields from this variable**. Scope is owned by each MPS record.

**Full variable structure (frontend-required shape):**

```json
{
  "active_settings": {
    "social_insurance": {
      "monthly_ceiling":   9400,
      "employee_rate":     0.11,
      "employer_rate":     0.1875,
      "martyrs_fund_rate": 0.0005,
      "ceiling_updated":   "YYYY-MM-DD"
    },
    "attendance": {
      "working_days_default": 22,
      "absence":        { "enabled": true,  "multiplier": 1.0 },
      "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
      "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
      "overtime":       { "enabled": true,  "multiplier": 1.5 },
      "public_holiday": { "enabled": true,  "if_worked": "overtime_rate" }
    },
    "payroll_run": {
      "lock": false
    }
  }
}
```

**Frontend field reference — `social_insurance` block:**

| Field | Type | Who writes | Notes |
|---|---|---|---|
| `monthly_ceiling` | Decimal | `portalSaveSettings` (section: social_insurance) | Max insurable wage (EGP). `ceiling_updated` auto-stamped to today on each save |
| `employee_rate` | Decimal | Manual setup only | Display only in UI — not editable by admin |
| `employer_rate` | Decimal | Manual setup only | Display only in UI |
| `martyrs_fund_rate` | Decimal | Manual setup only | Display only in UI |
| `ceiling_updated` | String `YYYY-MM-DD` | `portalSaveSettings` (auto) | Auto-stamped to today when ceiling is saved. Triggers warning badge in Settings if year < current year |

**Frontend field reference — `attendance` block:**

| Field | Type | Values | Notes |
|---|---|---|---|
| `working_days_default` | Integer | 1–31 | Fallback working days used by `portalCreateMPS` when source = manual |
| `absence.enabled` | Boolean | `true`/`false` | Deduction applied if true |
| `absence.multiplier` | Decimal | ≥ 1.0 | Applied to daily rate per absent day |
| `unpaid_leave.enabled` | Boolean | `true`/`false` | |
| `unpaid_leave.multiplier` | Decimal | ≥ 1.0 | Applied to daily rate per unpaid leave day |
| `late_deduction.enabled` | Boolean | `true`/`false` | |
| `late_deduction.grace_minutes` | Integer | ≥ 0 | Monthly accumulated late minutes before deduction starts |
| `late_deduction.multiplier` | Decimal | ≥ 1.0 | Applied to per-minute rate after grace period |
| `overtime.enabled` | Boolean | `true`/`false` | |
| `overtime.multiplier` | Decimal | `1.5` / `2.0` | Standard or double time |
| `public_holiday.enabled` | Boolean | `true`/`false` | |
| `public_holiday.if_worked` | String | `"overtime_rate"` / `"double_rate"` / `"paid_day"` | Rate applied when employee works on a public holiday |

**Frontend field reference — `payroll_run` block:**

| Field | Type | Who writes | Notes |
|---|---|---|---|
| `lock` | Boolean | `runPayrollOrchestrator` | Frontend reads this only via `portalTriggerOrchestrator` pre-flight check. Never written by any gateway function directly |

> **Scope fields removed:** `scope`, `selected_department`, `selected_employees` no longer live in this variable. They are stored per-run on the `Monthly_Payroll_Setup` record — see `Forms.md`.

---

### [BACKEND]

Controls runtime behaviour of the payroll engine. The backend engine reads:
- `active_settings.social_insurance.apply_insurance` and `entity_type` for SI calculation
- `active_settings.income_tax.apply_tax` for tax calculation
- `active_settings.payroll_run.scope`, `selected_department`, `selected_employees` for Orchestrator employee filter
- `active_settings.payroll_run.lock` for concurrent run protection

**Backend-only fields (not exposed to frontend):**

```json
{
  "active_settings": {
    "social_insurance": {
      "apply_insurance": true,
      "entity_type": "Legal Entity"
    },
    "income_tax": {
      "apply_tax": true
    },
    "payroll_run": {
      "scope": "all",
      "selected_department": "",
      "selected_employees": [],
      "lock": false
    }
  }
}
```

| Field | Type | Values | Notes |
|---|---|---|---|
| `apply_insurance` | Boolean | `true`/`false` | `false` → all SI outputs zero |
| `entity_type` | String | `"Legal Entity"` / `"Sole Proprietorship"` | Martyrs Fund only applies to Legal Entity |
| `apply_tax` | Boolean | `true`/`false` | `false` → all tax outputs zero |
| `scope` | String | `"all"` / `"by_department"` / `"by_employee"` | Controls Orchestrator employee filter |
| `selected_department` | String | department name | Only read when scope = by_department |
| `selected_employees` | List | list of EmployeeIDs | Only read when scope = by_employee. Cleared on clean completion |
| `lock` | Boolean | `true`/`false` | Set `true` by Orchestrator on start, `false` on finish |

> **Note to backend:** The frontend team no longer writes `scope`, `selected_department`, or `selected_employees` to this variable. The Orchestrator must read scope from the MPS record (`mps_scope`, `mps_selected_department`, `mps_selected_employees`) instead of from `PAYROLL_SETTINGS_JSON`.

---

## 2. PAYROLL_PORTAL_CONFIG

### [FRONTEND]

Read by `portalGetSettings` on every app boot. Written by `portalSaveSettings` for three sections: `portal_config`, `portal_roles`, and `portal_users`.

**Full variable structure:**

```json
{
  "config": {
    "default_holiday_source":      "zoho",
    "allow_working_days_override": true,
    "allow_multiple_runs":         false
  },
  "users": {
    "EMP001": "admin",
    "EMP002": "manager"
  },
  "roles": {
    "admin":   ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_settings", "feature_employees"],
    "manager": ["feature_dashboard", "feature_run_payroll", "feature_queue_monitor", "feature_reports", "feature_employees"]
  }
}
```

**`config` block field reference:**

| Field | Type | Values | Who writes | Notes |
|---|---|---|---|---|
| `default_holiday_source` | String | `"zoho"` / `"manual"` | `portalSaveSettings` (section: portal_config) | `zoho` → Deluge fetches holiday API server-side on MPS creation. `manual` → holidays start empty, user adds via web tab |
| `allow_working_days_override` | Boolean | `true`/`false` | `portalSaveSettings` | Shows Override button on Step 2 of the wizard |
| `allow_multiple_runs` | Boolean | `true`/`false` | `portalSaveSettings` | When `true`, wizard allows a second run for the same period and sends `force: true` to `portalCreateMPS` |

**`users` block:**

| Element | Type | Notes |
|---|---|---|
| Key | String | Zoho People EmployeeID |
| Value | String | Role name — must match a key in `roles` map |

Written by `portalSaveSettings` (section: `portal_users`). Add user: `role = "manager"`. Remove user: `role = ""` (empty string signals deletion).

**`roles` block:**

| Element | Type | Notes |
|---|---|---|
| Key | String | Role name (lowercase, underscore-separated) |
| Value | String[] | Array of feature keys from the Feature Registry |

Written by `portalSaveSettings` (section: `portal_roles`) — always a full matrix replacement. `admin` role is protected and cannot be removed via the UI.

**Permission resolution at runtime (Shell.jsx):**
```
role     = users[employeeId]       → null = Access Denied
features = roles[role]             → runtime permission list for the session
roleRevoked = role in users BUT role not in roles → amber lock screen
```

---

### [BACKEND]

> _Add backend notes here — e.g. whether any engine functions read PAYROLL_PORTAL_CONFIG, interaction with role-based processing, or any fields the backend team owns._

---

## 3. SI_CONFIG_JSON

### [BACKEND]

Social Insurance rates per Law 148/2019. Updated annually — ceiling adjusted each fiscal year.

```json
{
  "employee_rate": 0.11,
  "employer_rate": 0.1875,
  "martyrs_fund_rate": 0.0005,
  "monthly_ceiling": 12600.00
}
```

| Field | Type | Value | Notes |
|---|---|---|---|
| `employee_rate` | Decimal | `0.11` | 11% — deducted from employee net |
| `employer_rate` | Decimal | `0.1875` | 18.75% — company cost, not deducted from employee |
| `martyrs_fund_rate` | Decimal | `0.0005` | 0.05% of gross — Legal Entity only |
| `monthly_ceiling` | Decimal | `12600.00` | EGP — subscription wage capped at this value. **Update annually.** |

### [FRONTEND]

> The frontend reads SI rates and ceiling from `PAYROLL_SETTINGS_JSON.active_settings.social_insurance` — not from `SI_CONFIG_JSON`. The Settings screen displays `employee_rate`, `employer_rate`, and `martyrs_fund_rate` as read-only (hardcoded by law). Only `monthly_ceiling` is editable and saved to `PAYROLL_SETTINGS_JSON` via `portalSaveSettings`.

---

## 4. TAX_CONFIG_JSON

### [BACKEND]

Income tax configuration per Law 7/2024.

```json
{
  "personal_exemption_annual": 20000.00
}
```

| Field | Type | Value | Notes |
|---|---|---|---|
| `personal_exemption_annual` | Decimal | `20000.00` | EGP — divided by 12 for monthly exemption. Deducted before tax base calculation |

### [FRONTEND]

> Not read by any gateway function. Not exposed in the web tab UI.

---

## 5. TAX_BRACKETS_STD_JSON

### [BACKEND]

Standard income tax brackets — applied when annual net taxable income ≤ 600,000 EGP.
Source: Egyptian Income Tax Law 7/2024.

Formula: `annual_tax = annual_net * rate - constant`

```json
{
  "standard_brackets": [
    { "min": 0,       "max": 40000,  "rate": 0.00,  "constant": 0.00    },
    { "min": 40000,   "max": 55000,  "rate": 0.025, "constant": 1000.00 },
    { "min": 55000,   "max": 70000,  "rate": 0.10,  "constant": 5125.00 },
    { "min": 70000,   "max": 200000, "rate": 0.15,  "constant": 8625.00 },
    { "min": 200000,  "max": 400000, "rate": 0.20,  "constant": 18625.00},
    { "min": 400000,  "max": 600000, "rate": 0.225, "constant": 28625.00}
  ]
}
```

| Annual Net (EGP) | Rate | Formula | Annual Tax | Monthly Tax |
|---|---|---|---|---|
| 40,000 | 0% | 40,000 × 0% − 0 | 0 | 0 |
| 55,000 | 2.5% | 55,000 × 2.5% − 1,000 | 375 | 31.25 |
| 70,000 | 10% | 70,000 × 10% − 5,125 | 1,875 | 156.25 |
| 200,000 | 15% | 200,000 × 15% − 8,625 | 21,375 | 1,781.25 |
| 400,000 | 20% | 400,000 × 20% − 18,625 | 61,375 | 5,114.58 |
| 600,000 | 22.5% | 600,000 × 22.5% − 28,625 | 106,375 | 8,864.58 |

Match logic: `annual_net > bracket.min AND (bracket.max == null OR annual_net <= bracket.max)`

### [FRONTEND]

> Not read by any gateway function. Not exposed in the web tab UI.

---

## 6. TAX_BRACKETS_HI_JSON

### [BACKEND]

High-income tax tiers — applied when annual net taxable income > 600,000 EGP.
Source: Egyptian Income Tax Law 7/2024. Same formula as standard.

```json
{
  "high_income_tiers": [
    { "min": 600000,  "max": 700000, "rate": 0.25,  "constant": 43625.00 },
    { "min": 700000,  "max": 900000, "rate": 0.275, "constant": 61125.00 },
    { "min": 900000,  "max": null,   "rate": 0.30,  "constant": 83625.00 }
  ]
}
```

| Annual Net (EGP) | Rate | Formula | Annual Tax | Monthly Tax |
|---|---|---|---|---|
| 700,000 | 25% | 700,000 × 25% − 43,625 | 131,375 | 10,947.92 |
| 900,000 | 27.5% | 900,000 × 27.5% − 61,125 | 186,375 | 15,531.25 |
| 1,200,000 | 30% | 1,200,000 × 30% − 83,625 | 276,375 | 23,031.25 |

**Continuity at 600,000:** Standard: `600,000 × 22.5% − 28,625 = 106,375` | HI: `600,001 × 25% − 43,625 ≈ 106,375.25` ✓

### [FRONTEND]

> Not read by any gateway function. Not exposed in the web tab UI.

---

## 7. ATTENDANCE_RULES_JSON

### [BACKEND]

Controls which attendance factors are active and their calculation parameters.

```json
{
  "absence":        { "enabled": true },
  "unpaid_leave":   { "enabled": true },
  "late_deduction": { "enabled": true },
  "overtime":       { "enabled": true, "multiplier": 1.5 },
  "public_holiday": { "enabled": true, "if_worked": "overtime_rate" }
}
```

| Field | Type | Values | Notes |
|---|---|---|---|
| `absence.enabled` | Boolean | `true`/`false` | Deduction = daily_rate × absent_days |
| `unpaid_leave.enabled` | Boolean | `true`/`false` | Deduction = daily_rate × unpaid_leave_days |
| `late_deduction.enabled` | Boolean | `true`/`false` | Deduction = minute_rate × late_minutes |
| `overtime.enabled` | Boolean | `true`/`false` | Addition = hourly_rate × multiplier × overtime_hours |
| `overtime.multiplier` | Decimal | `1.5` / `2.0` | Also used by public_holiday if mode = overtime_rate |
| `public_holiday.enabled` | Boolean | `true`/`false` | Controls PH addition when employee works on a public holiday |
| `public_holiday.if_worked` | String | `"overtime_rate"` / `"double_rate"` / `"paid_day"` | `paid_day` = no extra pay |

Rate derivation:
```
daily_rate  = gross_salary / working_days
hourly_rate = daily_rate / 8
minute_rate = hourly_rate / 60
```

### [FRONTEND]

> The frontend reads and writes attendance rules from `PAYROLL_SETTINGS_JSON.active_settings.attendance` — not from `ATTENDANCE_RULES_JSON`. The Settings screen writes `working_days_default`, multipliers, grace period, and `if_worked` mode via `portalSaveSettings (section: attendance)`. `ATTENDANCE_RULES_JSON` is a backend-only variable.

---

## Initial Setup Checklist

### [BACKEND]

Before the first payroll run, create all variables in group `Orca_Payroll_Variables`:

- [ ] `PAYROLL_SETTINGS_JSON` — set `apply_insurance`, `apply_tax`, `entity_type`, `lock: false`; initialise `social_insurance` and `attendance` blocks with frontend-expected field names
- [ ] `SI_CONFIG_JSON` — set rates and current year ceiling
- [ ] `TAX_CONFIG_JSON` — set `personal_exemption_annual`
- [ ] `TAX_BRACKETS_STD_JSON` — load from Law 7/2024
- [ ] `TAX_BRACKETS_HI_JSON` — load from Law 7/2024
- [ ] `ATTENDANCE_RULES_JSON` — configure per client policy
- [ ] `PAYROLL_PORTAL_CONFIG` — set `roles`, add admin user IDs, set `default_holiday_source`, `allow_working_days_override`, `allow_multiple_runs`

**Annual maintenance:**
- Update `SI_CONFIG_JSON.monthly_ceiling` each fiscal year (Law 148/2019 schedule)
- Update `PAYROLL_SETTINGS_JSON.active_settings.social_insurance.monthly_ceiling` to match (frontend reads from here)
- Update tax bracket variables if Tax Law changes

### [FRONTEND]

After initial setup is complete, the following are configurable via the Settings screen by the admin:

- `PAYROLL_SETTINGS_JSON` — `social_insurance.monthly_ceiling`, full `attendance` block
- `PAYROLL_PORTAL_CONFIG` — all three sections (`config`, `roles`, `users`)
