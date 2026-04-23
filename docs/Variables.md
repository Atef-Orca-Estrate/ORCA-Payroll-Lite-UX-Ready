# Orca Payroll Lit 2.0 — Org Variable Reference

All variables belong to the group: `Orca_Payroll_Variables`
All are accessed via: `https://people.zoho.com/people/api/v3/variables/{NAME}/view?group=Orca_Payroll_Variables`

---

## Variable Index

| Variable | Purpose | Read By | Written By |
|---|---|---|---|
| `PAYROLL_SETTINGS_JSON` | Run config, SI toggle, tax toggle, scope, lock | All batch functions, gateway functions | portalSaveSettings, processPayrollBatch (scope clear), runPayrollOrchestrator (lock) |
| `SI_CONFIG_JSON` | Social insurance rates and ceiling | processPayrollBatch, processTerminationRun | Manual setup |
| `TAX_CONFIG_JSON` | Personal exemption annual value | processPayrollBatch, processTerminationRun | Manual setup |
| `TAX_BRACKETS_STD_JSON` | Standard tax brackets (annual ≤ 600,000 EGP) | processPayrollBatch, processTerminationRun | Manual setup |
| `TAX_BRACKETS_HI_JSON` | High-income tax tiers (annual > 600,000 EGP) | processPayrollBatch, processTerminationRun | Manual setup |
| `ATTENDANCE_RULES_JSON` | Per-factor attendance deduction/addition rules | processPayrollBatch, processTerminationRun | Manual setup |
| `PAYROLL_PORTAL_CONFIG` | Web tab roles, users, portal config | All gateway functions | portalSaveSettings |

---

## 1. PAYROLL_SETTINGS_JSON

Controls all runtime behaviour of the payroll engine.

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

### Field Reference

| Field | Type | Values | Notes |
|---|---|---|---|
| `apply_insurance` | Boolean | `true` / `false` | false → all SI outputs zero |
| `entity_type` | String | `"Legal Entity"` / `"Sole Proprietorship"` | Martyrs Fund only applies to Legal Entity |
| `apply_tax` | Boolean | `true` / `false` | false → all tax outputs zero |
| `scope` | String | `"all"` / `"by_department"` / `"by_employee"` | Controls Orchestrator employee filter |
| `selected_department` | String | Department name | Only read when scope = by_department |
| `selected_employees` | List | List of EmployeeIDs | Only read when scope = by_employee. Cleared on clean completion. |
| `lock` | Boolean | `true` / `false` | Set true by Orchestrator on start, false on finish. Blocks concurrent runs. |

---

## 2. SI_CONFIG_JSON

Social Insurance rates per Law 148/2019. Updated annually — ceiling is adjusted each fiscal year.

```json
{
  "employee_rate": 0.11,
  "employer_rate": 0.1875,
  "martyrs_fund_rate": 0.0005,
  "monthly_ceiling": 12600.00
}
```

### Field Reference

| Field | Type | Value | Notes |
|---|---|---|---|
| `employee_rate` | Decimal | `0.11` | 11% — deducted from employee net |
| `employer_rate` | Decimal | `0.1875` | 18.75% — company cost, not deducted from employee |
| `martyrs_fund_rate` | Decimal | `0.0005` | 0.05% of gross — Legal Entity only |
| `monthly_ceiling` | Decimal | `12600.00` | EGP — subscription wage capped at this value. **Update annually.** |

---

## 3. TAX_CONFIG_JSON

Income tax configuration per Law 7/2024.

```json
{
  "personal_exemption_annual": 20000.00
}
```

### Field Reference

| Field | Type | Value | Notes |
|---|---|---|---|
| `personal_exemption_annual` | Decimal | `20000.00` | EGP — divided by 12 for monthly exemption. Deducted before tax base calculation. |

---

## 4. TAX_BRACKETS_STD_JSON

Standard income tax brackets — applied when annual net taxable income ≤ 600,000 EGP.
Source: Egyptian Income Tax Law 7/2024.

Formula: `annual_tax = annual_net * rate - constant`
Constant ensures continuity at bracket transitions. Last bracket: `max = null` (no upper bound within this table).

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

### Bracket Validation Table

| Annual Net (EGP) | Rate | Formula | Annual Tax | Monthly Tax |
|---|---|---|---|---|
| 40,000 | 0% | 40,000 × 0% − 0 | 0 | 0 |
| 55,000 | 2.5% | 55,000 × 2.5% − 1,000 | 375 | 31.25 |
| 70,000 | 10% | 70,000 × 10% − 5,125 | 1,875 | 156.25 |
| 200,000 | 15% | 200,000 × 15% − 8,625 | 21,375 | 1,781.25 |
| 400,000 | 20% | 400,000 × 20% − 18,625 | 61,375 | 5,114.58 |
| 600,000 | 22.5% | 600,000 × 22.5% − 28,625 | 106,375 | 8,864.58 |

### Match Logic (from calculateEmployeePayroll / calculatePayroll)

```
annual_net > bracket.min AND (bracket.max == null OR annual_net <= bracket.max)
```

First matching bracket wins — brackets must be ordered ascending by min.

---

## 5. TAX_BRACKETS_HI_JSON

High-income tax tiers — applied when annual net taxable income > 600,000 EGP.
Source: Egyptian Income Tax Law 7/2024.

Same formula as standard: `annual_tax = annual_net * rate - constant`
Last tier: `max = null` (no upper bound).

```json
{
  "high_income_tiers": [
    { "min": 600000,  "max": 700000, "rate": 0.25,  "constant": 43625.00 },
    { "min": 700000,  "max": 900000, "rate": 0.275, "constant": 61125.00 },
    { "min": 900000,  "max": null,   "rate": 0.30,  "constant": 83625.00 }
  ]
}
```

### Tier Validation Table

| Annual Net (EGP) | Rate | Formula | Annual Tax | Monthly Tax |
|---|---|---|---|---|
| 600,001 | 25% | 600,001 × 25% − 43,625 | 106,375.25 | 8,864.60 |
| 700,000 | 25% | 700,000 × 25% − 43,625 | 131,375 | 10,947.92 |
| 900,000 | 27.5% | 900,000 × 27.5% − 61,125 | 186,375 | 15,531.25 |
| 1,200,000 | 30% | 1,200,000 × 30% − 83,625 | 276,375 | 23,031.25 |

### Continuity Check at 600,000

Standard bracket at 600,000: `600,000 × 22.5% − 28,625 = 106,375`
High-income tier at 600,001: `600,001 × 25% − 43,625 ≈ 106,375.25` ✓ Continuous.

---

## 6. ATTENDANCE_RULES_JSON

Controls which attendance factors are active and their calculation parameters.
All factors are independently toggled. Absence and unpaid leave use the daily rate.
Late uses the minute rate. Overtime uses the hourly rate × multiplier.

```json
{
  "absence": {
    "enabled": true
  },
  "unpaid_leave": {
    "enabled": true
  },
  "late_deduction": {
    "enabled": true
  },
  "overtime": {
    "enabled": true,
    "multiplier": 1.5
  },
  "public_holiday": {
    "enabled": true,
    "if_worked": "overtime_rate"
  }
}
```

### Field Reference

| Field | Type | Values | Notes |
|---|---|---|---|
| `absence.enabled` | Boolean | `true` / `false` | Deduction = daily_rate × absent_days |
| `unpaid_leave.enabled` | Boolean | `true` / `false` | Deduction = daily_rate × unpaid_leave_days |
| `late_deduction.enabled` | Boolean | `true` / `false` | Deduction = minute_rate × late_minutes |
| `overtime.enabled` | Boolean | `true` / `false` | Addition = hourly_rate × multiplier × overtime_hours |
| `overtime.multiplier` | Decimal | `1.5` / `2.0` | OT rate multiplier. Also used by public_holiday if mode = overtime_rate |
| `public_holiday.enabled` | Boolean | `true` / `false` | Controls PH addition when employee works on a public holiday |
| `public_holiday.if_worked` | String | `"overtime_rate"` / `"double_rate"` / `"paid_day"` | `paid_day` = no extra pay (already compensated by base salary) |

### Rate Derivation (from calculateEmployeePayroll / calculateAttendanceAdjustments)

```
daily_rate  = gross_salary / working_days
hourly_rate = daily_rate / 8
minute_rate = hourly_rate / 60
```

On termination runs: `working_days = days_worked` (partial month) — daily rate stays correct.

---

## 7. PAYROLL_PORTAL_CONFIG

Controls web tab access (roles, users) and runtime portal behaviour.
Single merged variable — all three sections read and written together.

```json
{
  "roles": {
    "admin": [
      "feature_settings",
      "feature_run_payroll",
      "feature_queue_monitor",
      "feature_reports"
    ],
    "manager": [
      "feature_run_payroll",
      "feature_queue_monitor",
      "feature_reports"
    ]
  },
  "users": {
    "USER_ID_001": "admin",
    "USER_ID_002": "manager"
  },
  "config": {
    "default_holiday_source": "zoho",
    "allow_working_days_override": false
  }
}
```

### Field Reference

| Field | Type | Values | Notes |
|---|---|---|---|
| `roles` | Map | role → feature list | Feature keys must match webtab feature module keys exactly |
| `users` | Map | user_id → role | user_id = Zoho People EmployeeID. Start with empty map `{}`. |
| `config.default_holiday_source` | String | `"zoho"` / `"manual"` | `zoho` → Deluge fetches holiday API + workDaysBetween() server-side |
| `config.allow_working_days_override` | Boolean | `true` / `false` | Shows Override button on MPS review screen in web tab |

### Permission Resolution at Runtime

```
user_id = URL param injected by Zoho People at tab load

role     = PAYROLL_PORTAL_CONFIG.users.get(user_id)
           → null = Access Denied (no tab access)

features = PAYROLL_PORTAL_CONFIG.roles.get(role)
           → render only permitted feature modules
```

---

## Initial Setup Checklist

Before the first payroll run, create all 7 org variables in group `Orca_Payroll_Variables`:

- [ ] `PAYROLL_SETTINGS_JSON` — set apply_insurance, apply_tax, entity_type, scope
- [ ] `SI_CONFIG_JSON` — set rates and current year ceiling
- [ ] `TAX_CONFIG_JSON` — set personal_exemption_annual
- [ ] `TAX_BRACKETS_STD_JSON` — load from Law 7/2024 (static until law changes)
- [ ] `TAX_BRACKETS_HI_JSON` — load from Law 7/2024 (static until law changes)
- [ ] `ATTENDANCE_RULES_JSON` — configure per client policy
- [ ] `PAYROLL_PORTAL_CONFIG` — set roles, add admin user IDs, set holiday source

**Annual maintenance:**
- Update `SI_CONFIG_JSON.monthly_ceiling` each fiscal year (Law 148/2019 schedule)
- Update `TAX_BRACKETS_STD_JSON` and `TAX_BRACKETS_HI_JSON` if Tax Law changes

