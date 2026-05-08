# PENDING_CONFIG.md — Frontend/Variable Gaps vs. Deluge Engine

**Branch:** `ui/mock-frontend-sandbox`
**Maintained by:** Frontend Consultant
**Last updated:** 2026-05-08

---

## Purpose

This file tracks every setting that has been:

1. ✅ Added to the **Settings UI** (visible and saveable by admins)
2. ✅ Added to the **`PAYROLL_SETTINGS_JSON` variable structure** (written to org variable on save)
3. ❌ **NOT yet implemented in the Deluge calculation engine**

These settings are written to the org variable correctly by the gateway functions.
But the Deluge engine functions that run during payroll processing do not yet read or
use the new keys. They produce no effect at runtime until the engine is updated.

**This file is the handoff to the Deluge/backend consultant.**
Read it alongside `WEBTAB_SPEC.md` before modifying any engine function.

---

## Rules

- This file is updated by the Frontend Consultant whenever a new setting is added to the
  UI that requires an engine change.
- The Deluge consultant updates status to `[x] Done` and adds their implementation notes
  when each item is resolved.
- **Never modify `calculateAttendanceAdjustments`, `calculateSocialInsurance`,
  `calculatePayroll`, `runPayrollOrchestrator`, or `PayrollScheduler` without
  reading and resolving the relevant items here first.**
- Items are never deleted — mark them `[x] Done` and add resolution date.

---

## Status Legend

```
[ ] Pending   — in variable + UI, not in engine
[~] In progress
[x] Done      — engine updated, fully active
[!] Blocked   — dependency or decision needed
```

---

## Items

---

### PC-01 — Absence Deduction Multiplier

**Status:** `[ ] Pending`
**Added:** 2026-05-08
**Priority:** Medium

**What was added to the UI and variable:**
A `multiplier` field under `active_settings.attendance.absence`.

```json
"absence": {
  "enabled":    true,
  "multiplier": 1.0
}
```

**Default value:** `1.0` — preserves exact current engine behaviour at default.

**What the engine currently does:**
```javascript
absence_deduction = daily_rate * absent_days;
```

**What the engine needs to do after this is implemented:**
```javascript
absence_multiplier = att_rules.get("absence").get("multiplier");
if(absence_multiplier == null) { absence_multiplier = 1.0; }
absence_deduction  = daily_rate * absent_days * absence_multiplier;
```

**Engine function to update:** `calculateAttendanceAdjustments`
**Location in function:** Inside the `if(att_rules.get("absence").get("enabled"))` block.

**Business meaning:**
- `1.0` = standard deduction (1 day's pay per absent day) — current behaviour
- `1.5` = 1.5× penalty (e.g. absent day costs 1.5 days' pay)
- `2.0` = double penalty
Useful for organizations that apply a disciplinary rate for unexcused absence.

**Impact if not implemented:**
Admins can set the multiplier in the UI and it will be saved to the org variable.
The engine ignores it and always applies 1.0×. No error, no crash — silent no-op.

---

### PC-02 — Unpaid Leave Deduction Multiplier

**Status:** `[ ] Pending`
**Added:** 2026-05-08
**Priority:** Medium

**What was added to the UI and variable:**
A `multiplier` field under `active_settings.attendance.unpaid_leave`.

```json
"unpaid_leave": {
  "enabled":    true,
  "multiplier": 1.0
}
```

**Default value:** `1.0` — preserves exact current engine behaviour at default.

**What the engine currently does:**
```javascript
unpaid_leave_deduction = daily_rate * unpaid_leave_days;
```

**What the engine needs to do after this is implemented:**
```javascript
unpaid_leave_multiplier = att_rules.get("unpaid_leave").get("multiplier");
if(unpaid_leave_multiplier == null) { unpaid_leave_multiplier = 1.0; }
unpaid_leave_deduction  = daily_rate * unpaid_leave_days * unpaid_leave_multiplier;
```

**Engine function to update:** `calculateAttendanceAdjustments`
**Location in function:** Inside the `if(att_rules.get("unpaid_leave").get("enabled"))` block.

**Business meaning:**
- `1.0` = standard deduction (1 day's pay per unpaid leave day) — current behaviour
- `> 1.0` = penalty rate above the standard daily deduction
Most organizations use 1.0 — the multiplier exists for policy flexibility.

**Impact if not implemented:**
Same as PC-01 — silent no-op. Engine always applies 1.0×.

---

### PC-03 — Late Deduction Grace Period

**Status:** `[ ] Pending`
**Added:** 2026-05-08
**Priority:** High

**What was added to the UI and variable:**
A `grace_minutes` field under `active_settings.attendance.late_deduction`.

```json
"late_deduction": {
  "enabled":       true,
  "grace_minutes": 0,
  "multiplier":    1.0
}
```

**Default value:** `0` — preserves exact current engine behaviour (no grace period).

**What the engine currently does:**
```javascript
late_deduction = minute_rate * late_minutes;
```

**What the engine needs to do after this is implemented:**
```javascript
grace_minutes          = att_rules.get("late_deduction").get("grace_minutes");
if(grace_minutes == null) { grace_minutes = 0; }
effective_late_minutes = late_minutes - grace_minutes;
if(effective_late_minutes < 0) { effective_late_minutes = 0; }
late_deduction         = minute_rate * effective_late_minutes;
```

**Engine function to update:** `calculateAttendanceAdjustments`
**Location in function:** Inside the `if(att_rules.get("late_deduction").get("enabled"))` block,
replacing the current `late_deduction = minute_rate * late_minutes` line.

**Business meaning:**
- `0` = every late minute counted — current behaviour
- `15` = employees with fewer than 15 total late minutes in the month pay nothing
- `30` = 30-minute monthly grace before deduction starts
This is the most commonly requested late deduction setting in Egyptian organizations.

**IMPORTANT — Grace period is MONTHLY total, not per-day:**
`late_minutes` from Zoho Attendance is the total accumulated late minutes for the entire
payroll period. The grace is applied once against the monthly total, not per day.
If per-day grace is needed in future, `pq_late_minutes` must be re-computed from
daily attendance records before being passed to this function.

**Impact if not implemented:**
Admins can set a grace period in the UI. It saves to the org variable correctly.
Engine ignores it and deducts from minute 1. No error — silent no-op.
This is the highest-priority item because clients will notice immediately.

---

### PC-04 — Late Deduction Multiplier

**Status:** `[ ] Pending`
**Added:** 2026-05-08
**Priority:** Medium

**What was added to the UI and variable:**
A `multiplier` field under `active_settings.attendance.late_deduction`.

```json
"late_deduction": {
  "enabled":       true,
  "grace_minutes": 0,
  "multiplier":    1.0
}
```

**Default value:** `1.0` — preserves exact current engine behaviour.

**What the engine currently does (after PC-03 is implemented):**
```javascript
effective_late_minutes = late_minutes - grace_minutes;
if(effective_late_minutes < 0) { effective_late_minutes = 0; }
late_deduction         = minute_rate * effective_late_minutes;
```

**What the engine needs to do after PC-04 is also implemented:**
```javascript
late_multiplier        = att_rules.get("late_deduction").get("multiplier");
if(late_multiplier == null) { late_multiplier = 1.0; }
effective_late_minutes = late_minutes - grace_minutes;
if(effective_late_minutes < 0) { effective_late_minutes = 0; }
late_deduction         = minute_rate * effective_late_minutes * late_multiplier;
```

**Engine function to update:** `calculateAttendanceAdjustments`
**Location in function:** Same block as PC-03 — implement together.
**Dependency:** PC-03 must be implemented first or simultaneously.

**Business meaning:**
- `1.0` = standard per-minute rate — current behaviour
- `1.5` = late minutes cost 1.5× the proportional minute rate
- `2.0` = double the rate per late minute (punitive policy)

**Impact if not implemented:**
Silent no-op. Engine always applies 1.0×.

---

### PC-05 — `portalGetSettings` Response — Nested Attendance Structure

**Status:** `[ ] Pending`
**Added:** 2026-05-08
**Priority:** High — blocks Settings UI from loading correct values

**What was added to the UI:**
The Settings screen reads attendance sub-keys from `auth.payrollSettings.attendance.*`
using the nested structure:
```
payrollSettings.attendance.absence.multiplier
payrollSettings.attendance.unpaid_leave.multiplier
payrollSettings.attendance.late_deduction.grace_minutes
payrollSettings.attendance.late_deduction.multiplier
payrollSettings.attendance.overtime.multiplier
payrollSettings.attendance.overtime.enabled
payrollSettings.attendance.public_holiday.if_worked
payrollSettings.attendance.working_days_default
```

**What the current `portalGetSettings` gateway returns:**
A flat `payroll_settings` object:
```json
{
  "payroll_settings": {
    "apply_insurance": true,
    "apply_tax": true,
    "entity_type": "Legal Entity",
    "scope": "all",
    "allow_working_days_override": true
  }
}
```

**What `portalGetSettings` must return (correct nested structure):**
```json
{
  "payroll_settings": {
    "payroll_run": {
      "scope": "all",
      "department": null,
      "selected_employees": []
    },
    "attendance": {
      "working_days_default": 22,
      "absence":        { "enabled": true,  "multiplier": 1.0 },
      "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
      "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
      "overtime":       { "enabled": true,  "multiplier": 1.5 },
      "public_holiday": { "enabled": true,  "if_worked": "overtime_rate" }
    },
    "social_insurance": {
      "monthly_ceiling":   9400,
      "employee_rate":     0.11,
      "employer_rate":     0.1875,
      "martyrs_fund_rate": 0.0005,
      "ceiling_updated":   "2024-01-01"
    }
  },
  "portal_config": {
    "portal_users":                 { "EMP001": "admin" },
    "portal_roles":                 { "admin": [...], "manager": [...] },
    "default_holiday_source":       "zoho",
    "allow_working_days_override":  true
  }
}
```

**Org variable transformation required:**
The gateway must read `PAYROLL_SETTINGS_JSON.active_settings` and return it nested under
`payroll_settings`. The flat shape currently in the mock is wrong and must be updated.
See `WEBTAB_SPEC.md` Section 6 for the full discrepancy analysis.

**Gateway function to update:** `portalGetSettings`
**Mock function to update:** `mock_portalGetSettings` in `mockData.js`

**Impact if not implemented:**
Settings screen initializes with undefined/null values for all attendance controls.
Toggles default to false. Multipliers default to 1.0 (hardcoded fallback in UI).
The screen appears to work but admin cannot see or change the real org variable values.

---

### PC-06 — `portalSaveSettings` — New Section Routes

**Status:** `[ ] Pending`
**Added:** 2026-05-08
**Priority:** High — blocks all Attendance, Payroll Run, and Social Insurance saves

**What was added to the UI:**
Three new save paths in the Settings screen:
- Attendance section → `portalSaveSettings({ section: "attendance", ...fields })`
- Payroll Run section → `portalSaveSettings({ section: "payroll_run", ...fields })`
- Social Insurance section → `portalSaveSettings({ section: "social_insurance", monthly_ceiling: N })`

**What the current `portalSaveSettings` gateway handles:**
Only two sections: `payroll_settings` (flat, wrong fields) and `portal_config`.

**What `portalSaveSettings` must handle after update:**

Section `"attendance"` → write to `PAYROLL_SETTINGS_JSON.active_settings.attendance`:
```json
{
  "section": "attendance",
  "working_days_default": 22,
  "absence":        { "enabled": true,  "multiplier": 1.0 },
  "unpaid_leave":   { "enabled": true,  "multiplier": 1.0 },
  "late_deduction": { "enabled": true,  "grace_minutes": 0, "multiplier": 1.0 },
  "overtime":       { "enabled": true,  "multiplier": 1.5 },
  "public_holiday": { "enabled": true,  "if_worked": "overtime_rate" }
}
```

Section `"payroll_run"` → write to `PAYROLL_SETTINGS_JSON.active_settings.payroll_run`:
```json
{
  "section":             "payroll_run",
  "scope":               "all",
  "department":          null,
  "selected_employees":  []
}
```

Section `"social_insurance"` → write ONLY `monthly_ceiling` and `ceiling_updated` to
`PAYROLL_SETTINGS_JSON.active_settings.social_insurance`.
**Backend must reject any attempt to change rate fields** (`employee_rate`, `employer_rate`,
`martyrs_fund_rate`). UI will not send them, but guard is required.

Section `"portal_config"` → existing behaviour, unchanged.

**Gateway function to update:** `portalSaveSettings`
**Mock function to update:** `mock_portalSaveSettings` in `mockData.js`

**Impact if not implemented:**
Saves appear to succeed (mock returns success) but the org variable is never updated.
Admins see their changes reflected in the UI session but they vanish on reload.

---

## Summary Table

| ID | Setting | Variable key | Engine function | Priority | Status |
|----|---------|-------------|-----------------|----------|--------|
| PC-01 | Absence multiplier | `attendance.absence.multiplier` | `calculateAttendanceAdjustments` | Medium | `[ ]` |
| PC-02 | Unpaid leave multiplier | `attendance.unpaid_leave.multiplier` | `calculateAttendanceAdjustments` | Medium | `[ ]` |
| PC-03 | Late grace period | `attendance.late_deduction.grace_minutes` | `calculateAttendanceAdjustments` | **High** | `[ ]` |
| PC-04 | Late multiplier | `attendance.late_deduction.multiplier` | `calculateAttendanceAdjustments` | Medium | `[ ]` |
| PC-05 | `portalGetSettings` nested response | N/A | Gateway: `portalGetSettings` | **High** | `[ ]` |
| PC-06 | `portalSaveSettings` new section routes | N/A | Gateway: `portalSaveSettings` | **High** | `[ ]` |

---

## Implementation Order (Recommended)

Implement in this order to avoid partial states:

1. **PC-05** first — `portalGetSettings` correct nested response. Nothing else works without it.
2. **PC-06** second — `portalSaveSettings` new routes. Saves must work before testing engine changes.
3. **PC-03 + PC-04** together — grace period and late multiplier are in the same code block.
4. **PC-01** — absence multiplier.
5. **PC-02** — unpaid leave multiplier.

---

## Testing Checklist (After Each Item)

After implementing each PC item:

- [ ] `portalGetSettings` returns the new key with its default value
- [ ] Settings UI displays the correct loaded value
- [ ] Save writes the new value to the org variable (verify in Zoho org variable viewer)
- [ ] Payroll run for an employee with non-default value produces the expected deduction
- [ ] Rerun produces the same result (idempotent)
- [ ] Default value (1.0 / 0) produces identical output to pre-change behaviour
