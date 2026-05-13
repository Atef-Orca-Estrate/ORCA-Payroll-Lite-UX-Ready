# ORCA Payroll — Frontend Architecture & Feature Aspects
**Audience:** AI agent or developer working on the frontend. Read this before modifying any screen.
**Stack:** React 18 + Vite + Tailwind CSS (utility classes only for responsive breakpoints; all component styles are inline).

---

## 1. Application Architecture

```
index.html
└── main.jsx  →  <App />
                  └── <Shell />              ← auth gate + feature router
                       ├── <Sidebar />       ← desktop nav (220px, dark #0F172A)
                       └── <Feature />       ← active screen (fills remaining space)
```

### Tech choices that affect all work
- **All component styles are inline** (`style={{ ... }}`). No CSS modules, no Tailwind component classes. Tailwind is used only for responsive utility classes (`hidden md:flex`, `md:grid-cols-2`).
- **No global state library.** State flows via React context (`AuthContext`, `ThemeContext`) and prop drilling. There is no Redux, Zustand, or Jotai.
- **All API calls go through `useGateway()`** — never call `window.ZOHO` directly from a feature component.
- **DEV_MODE flag** in `useGateway.js` toggles between mock data and real Zoho SDK. Set to `false` before packaging.

---

## 2. Boot & Auth Flow

```
App mount
  → useSDK().init()                    ← Zoho SDK PageLoad event (or mock user in DEV_MODE)
  → gateway.invoke('portalGetSettings', { employee_id })
  → resolvePermissions(portal_config, employee_id)
      → role = portal_users[employee_id]
      → features = portal_roles[role]
      → roleRevoked = role exists in users but NOT in roles
  → set auth context: { employeeId, email, name, role, features, settings, portalConfig }
```

**States before the main UI renders:**
1. `loading` — spinner (LoadingScreen)
2. `error` — fatal error screen
3. `roleRevoked` — amber lock screen ("Access Suspended — contact Admin")
4. Authenticated — Shell renders

**The `auth` context object** (available to every component via `useAuth()`):
```js
{
  employeeId:   "EMP001",
  email:        "admin@example.com",
  name:         "Ahmed Hassan",
  role:         "admin",
  features:     ["feature_dashboard", "feature_run_payroll", ...],
  settings:     { payroll_run, attendance, social_insurance },
  portalConfig: { portal_users, portal_roles, default_holiday_source, allow_working_days_override, allow_multiple_runs }
}
```

**Access gate:** `auth.features` is the sole runtime permission list. `featureRegistry.minRoles` is documentation only — never used at runtime.

---

## 3. Navigation Model

### Sidebar (desktop, md+)
- **220px fixed width**, dark background (`#0F172A`)
- All features except `feature_settings` are rendered in the main nav list
- `feature_settings` is pinned above the user card at the bottom
- **Nav groups:** `feature_run_payroll` and `feature_queue_monitor` are grouped under "Payroll Engine" — a collapsible accordion. The group opens automatically when the active feature is a child; stays open until manually closed by clicking the group header.
- **Group definition** lives in `Nav.jsx` (`NAV_GROUPS` const) — not in featureRegistry.
- Active state: `2.5px solid #6366F1` left border + `rgba(99,102,241,0.10)` background
- User card (bottom): shows employeeId + role, theme toggle button (sun/moon)
- Contact card: flips in-place (CSS rotateY 380ms) to reveal website + email

### Cross-screen navigation
Features communicate via `onNavigate(featureKey, navParams)`:
- `navParams` carries context between screens (e.g. `{ period, run_id }`)
- No URL routing — all navigation is in-memory state in Shell
- Example: Records panel "View Queue →" button calls `onNavigate('feature_queue_monitor', { period, run_id })`

---

## 4. Feature Registry (`featureRegistry.jsx`)

```js
FEATURE_REGISTRY = {
  feature_dashboard:     { label: 'Dashboard',      order: 0 },
  feature_run_payroll:   { label: 'Payroll Runs',   order: 1 },
  feature_queue_monitor: { label: 'Queue Monitor',  order: 2 },
  feature_reports:       { label: 'Reports',        order: 3 },
  feature_employees:     { label: 'Employees',      order: 4 },
  feature_settings:      { label: 'Settings',       order: 5 },
}
```

Adding a feature requires only: (1) add entry here, (2) add feature key to `portal_roles` in backend. Nav, Shell, and all permission checks auto-update.

---

## 5. Design System & Shared Patterns

### Colour tokens (inline, always these exact values)
```
Accent:       #6366F1  (indigo)
Accent BG:    #EEF2FF
Accent Text:  #3730A3
Accent Muted: #818CF8
Graphite:     #111827  (primary button)
Graphite H:   #1F2937  (primary button hover)
Green:        #16A34A  (success/completed)
Amber:        #B45309 / rgba(245,158,11,...)  (warning/pending)
Red:          #DC2626  (error)
```

CSS variables (set by ThemeContext, light/dark):
- `var(--surface)`, `var(--surface-raised)`, `var(--surface-inset)`
- `var(--border)`, `var(--border-strong)`
- `var(--text-primary)`, `var(--text-secondary)`, `var(--text-muted)`
- `var(--accent-border)`

### MonthPicker component (`src/components/MonthPicker.jsx`)
- Replaces `<input type="month">` everywhere
- Props: `value` (YYYY-MM string), `onChange`, `align` ('left' | 'right')
- Scroll-wheel on the trigger cycles months
- Popover: year nav arrows + 3×4 month grid
- Validation: future months (after current month) are disabled
- Used in: RunPayroll wizard, QueueMonitor header, Reports

### Expand/collapse rows
All list rows (payroll records, employees, queue batches) use the same pattern:
- Clicking the row header toggles `isExpanded`
- Only one row is expanded at a time (parent tracks `expandedId`)
- Expanded content appears inline below (no modal, no drawer)
- Collapsed header always shows: avatar/status indicator, name, id·department, key metric, chevron

### Dirty-state save buttons
Settings cards and the Employees expand panel use this pattern:
- `savedRef = useRef(originalValues)` — snapshot at load/last-save time
- `draft` state — local copy that reflects live edits
- `isDirty = JSON.stringify(draft) !== JSON.stringify(savedRef.current)`
- Save/Cancel buttons are `disabled` + `opacity: 0.4` when `!isDirty`

### Status chips (consistent across screens)
```
Completed:  green bg  rgba(22,163,74,0.10)   + text #16A34A
Processing: indigo bg rgba(99,102,241,0.10)  + text #6366F1  + pulse animation
Draft:      muted bg  var(--surface-inset)   + text var(--text-muted)
Error:      red bg    rgba(239,68,68,0.10)   + text #DC2626
Pending:    amber bg  rgba(245,158,11,0.10)  + text #B45309
Done:       same as Completed
```

---

## 6. Feature: Dashboard (`features/Dashboard/index.jsx`)

**Route key:** `feature_dashboard` — the landing page (default on login).

**Gateway calls:**
- `portalGetDashboard` → on mount, once, no params

**Layout:** 2-column grid on desktop (md+), single column on mobile.

**Left column:**
- KPI cards row: headcount, on leave, new this month
- Run history table: 6 most recent periods, period / run date / status / headcount / net pay

**Right column:**
- Last run summary card: status chip, gross/net/tax/SI tiles
- Upcoming run card: period, cutoff date, scheduled date
- Queue health mini-card: pending/processing/failed counts
- Alerts list: severity-coloured rows (error=red, warning=amber, info=blue)

**No cross-screen navigation from Dashboard.** It is read-only.

---

## 7. Feature: Payroll Runs (`features/RunPayroll/index.jsx`)

**Route key:** `feature_run_payroll`
**navParams accepted:** `{ period?, run_id? }` — auto-selects the matching run on load.

### Layout
2-column grid (md+): left = Wizard Card + Runs List; right = Records Panel.
Mobile: single column + floating "Records" FAB button + bottom drawer.

### Wizard Card (left top)
A 4-step stepper that progresses based on the selected run's `status`:
- Step 1 (Setup) — `isNew = true` (no run selected)
- Step 2 (Review) — `status = 'Draft'`
- Step 3 (Running) — `status = 'Processing'`
- Step 4 (Complete) — `status = 'Completed'`

**Stepper animation:** Active step = 26px circle + label; done = 18px green circle; pending = 22px grey. Connectors `flex: 1` so they fill freed space when steps contract. Fragment pattern — nodes and connectors are flat siblings, not nested.

**Step 1 — Setup:**
- MonthPicker for period selection
- Duplicate guard: blocks creating a run for a period that already has one, unless `allow_multiple_runs = true` in portal config
- Scope radio: All / By Department / By Employee (no sub-text descriptions)
- Employee list (compact, 6px card padding, 12.5px name, 10.5px monospace id·dept) — only shown for `by_employee` scope; fetched lazily via `portalGetEmployees`
- Department dropdown — only for `by_department` scope; fetched lazily via `portalGetDepartments`
- On submit: calls `portalCreateMPS` → calls `handleMpsCreated` → transitions to Step 2

**Step 2 — Review:**
- Working days field (editable if `allow_working_days_override = true`)
- Holiday section:
  - If `default_holiday_source = 'zoho'`: list is read-only, sourced from MPS creation
  - If `default_holiday_source = 'manual'`: Add / Edit / Delete actions shown; saves via `portalUpdateMPSHolidays`
- "Run Payroll" green button (sticky bottom) → calls `portalTriggerOrchestrator`

**Step 3 — Running:**
- Progress bar + 3 stat tiles (Done / Remaining / Errors)
- Auto-polls `portalGetQueueStatus` every 30s; countdown timer shown
- On Completed: auto-loads records via `portalGetPayrollRecords`

**Step 4 — Complete:**
- Success banner + scope label
- Financial summary: 4 tiles (Gross / Net / Tax / Employee SI)
- "View period report →" button pinned to card footer (not scrollable) → navigates to Reports

### Runs List (left bottom)
- "New payroll run" row — fixed above scroll, dashed circle icon
- Historical runs — scrollable list, sorted newest-first
- Run row shows: period, scope label (if not 'all'), employees count, working days, status chip
- Multiple runs for same period have distinct scope sublabels (e.g. "Dept · Engineering", "3 emps")
- **Key:** `run_id` (not `period`) — avoids React key conflicts when same period has multiple runs

### Records Panel (right)
- Period + employee count in header
- "View Queue →" button → navigates to QueueMonitor with `{ period, run_id }`
- **Sibling run navigation:** when period has >1 run, shows prev/next arrows + "Run X of N" label — navigating between sibling runs updates `currentRunId` and re-fetches records
- Filter tabs: All / Done / Processing / Pending / Errors (with counts)
- Each employee row: collapsed = name + id·dept monospace + status chip; expanded = financial breakdown grid (3 sections: Earnings, Deductions, Result)
- Records cached client-side by `run_id` — never re-fetched for the same run in the session

### State management
```js
runs          // null (loading) | Run[]
selectedRun   // null | Run object (includes run_id)
isNew         // bool — drives wizard to step 1
recordsCache  // { [run_id]: Record[] }
activeRecords // Record[] — current panel display
```

---

## 8. Feature: Queue Monitor (`features/QueueMonitor/index.jsx`)

**Route key:** `feature_queue_monitor`
**navParams accepted:** `{ period?, run_id? }` — pre-selects period and specific run tab.

### Layout
Full-height single column. Header row + optional run tabs + content area.

**Header row:** "Queue Monitor" title + MonthPicker (inline, left side) + Live indicator (pulsing dot, only when Processing) + last-updated time + refresh button + "← Payroll Runs" cross-nav link.

**Run Tabs:** Shown only when `portalListRuns` reveals >1 run for the selected period.
- Each tab: status dot (coloured) + scope label ("All employees" / department name / "N employees") + status chip
- Tabs appear above the stats card
- Selecting a tab updates `runId` state → triggers new `portalGetQueueStatus` call
- Changing the period via MonthPicker clears `runId` (no run pre-selected)
- `portalListRuns` is called on each period change to determine how many tabs to show

**Content states:**
1. Loading spinner (initial load)
2. Empty — no run: "No payroll run for YYYY-MM" + "Go to Run Payroll" button
3. Empty — Draft: "Ready to run" + "Start run →" button
4. Processing: `ProcessingOverview` card + `RecordsSection`
5. Completed: `CompletedOverview` card + `RecordsSection`

**ProcessingOverview:** progress bar + 4 stat tiles (Done / Processing / Pending / Errors) + working days.

**CompletedOverview:** green checkmark header + 3 stat tiles + working days.

**RecordsSection:**
- Tabs: Regular Run / Termination Run
- "Errors only" toggle (appears when errors exist)
- Batch groups (collapsible): batch header shows batch number + done/error/processing counts; click to expand employee rows
- Each employee row (`QueueRow`): name (primary) + id · department (secondary monospace) + status/time + error message

**Polling:** Auto-polls `portalGetQueueStatus` every 30s when `mps_status = Processing`. Pauses when browser tab is hidden, resumes on visibility change.

---

## 9. Feature: Reports (`features/Reports/index.jsx`)

**Route key:** `feature_reports`
**navParams accepted:** `{ period? }` — auto-loads the report for that period.

**Layout:** Full-height card with MonthPicker in header + report content.

**Auto-load:** If `navParams.period` is present (navigated from Wizard Step 4 "View period report"), the report loads immediately without user interaction.

**Report content (when loaded):**
- Generated-at timestamp
- Headcount + termination count
- 4 primary tiles: Total Gross / Total Net / Total Tax / Total Employer SI
- 3 secondary tiles: Employee SI / Martyrs' Fund / Employer Cost
- Total Allowances + Total Basic Salary inline row

**Empty state:** "Select a period to view report" with a chart icon.

**Error state:** "No completed report available for YYYY-MM" when period has no completed run.

---

## 10. Feature: Employees (`features/Employees/index.jsx`)

**Route key:** `feature_employees`

**Gateway calls:**
- `portalListEmployees` → on mount, once
- `portalUpdateEmployee` → per employee "Update" button

**Layout:** Page header + search bar + single scrollable card listing all active employees.

**Search:** Filters by `employee_name`, `employee_id`, or `department` (case-insensitive). Shows "X of Y employees" in card header when filtered.

**Employee row (collapsed):**
- Circular avatar (initials, coloured by department: Engineering=indigo, Finance=emerald, Operations=amber, Sales=blue, HR=rose, Marketing=orange)
- Name (primary) + id · department (secondary monospace)
- Exclusion badge (amber, shows count) — only when ≥1 exclusion is active
- Basic salary + "Basic" label
- Chevron (rotates 180° when expanded)
- **Only one row can be expanded at a time** — parent tracks `expandedId`

**Employee row (expanded, left-indented 62px):**
- "Salary Reference" section: 3 tiles (Basic / Gross / Net — Net uses accent colour)
- "Payroll Exclusions" section: custom-styled checkboxes in a bordered card
  - Exclude from Social Insurance (+ description line)
  - Exclude from Martyrs' Fund (+ description line)
  - Exclude from Income Tax (+ description line)
- Action buttons row (right-aligned): **Update** (dark filled) then **Cancel** (ghost border)
- Both buttons disabled + 40% opacity when no change has been made
- On successful update: `savedRef.current` is updated, toast shown, parent list updated via `onUpdated` callback

**Dirty detection:**
```js
isDirty = draft.exclude_si !== savedRef.current.exclude_si
  || draft.exclude_martyrs_fund !== savedRef.current.exclude_martyrs_fund
  || draft.exclude_income_tax   !== savedRef.current.exclude_income_tax
```

---

## 11. Feature: Settings (`features/Settings/index.jsx`)

**Route key:** `feature_settings` — admin only.

**Gateway calls:**
- Reads from `auth.settings` and `auth.portalConfig` (no extra fetch on mount)
- `portalSaveSettings` — per section save
- `portalAddPortalUser` — add user to portal
- `portalRemovePortalUser` — remove user from portal

**Layout:** 2-column grid (each column independent, dynamic height):
- **Column 1:** Social Insurance card → Portal Users card
- **Column 2:** Portal Configuration card → Attendance card
- **Full width below both columns:** Roles & Permissions matrix card

### Dirty-state pattern (all cards)
Each card has a `useRef` snapshot of its initial values. Save button is disabled when `JSON.stringify(current) === JSON.stringify(snapshot)`.

### Social Insurance card
Editable fields: Monthly Ceiling, Employee Rate (%), Employer Rate (%), Martyrs' Fund Rate (%).
Saves via `portalSaveSettings({ section: 'social_insurance', ... })`.

### Portal Users card
- Table: Employee ID | Role | Remove button
- "Add user" form: Employee ID input + Role dropdown → calls `portalAddPortalUser`
- Remove (×) button → calls `portalRemovePortalUser`
- Roles in dropdown come from `Object.keys(auth.portalConfig.portal_roles)`

### Portal Configuration card
Three toggles (pill-style ON/OFF):
1. **Holiday Source** — "Zoho System" / "Manual" — determines whether wizard holiday list is read-only or editable
2. **Working Days Override** — allows wizard Step 2 override field
3. **Multiple Runs Per Period** — when ON, wizard allows a second run for the same period (sends `force: true` to `portalCreateMPS`)

### Attendance card
Toggle + input rows for each attendance rule type (Absence, Unpaid Leave, Late Deduction, Overtime, Public Holiday).

### Roles & Permissions matrix card
- **Column layout:** Feature column (sticky left, `position: sticky; left: 0; zIndex: 2`) + role columns (scrollable right)
- Admin role is always the first column; other roles sorted by insertion order
- Add role: input field + "Add" button — appends new column
- Remove role: (×) button in column header — removes entire column
- Permission toggle: checkbox per cell (feature × role)
- Dirty: `JSON.stringify(roles) !== JSON.stringify(originalRoles)`
- Saves full matrix via `portalSaveSettings({ section: 'portal_roles', portal_roles: {...} })`

**FEATURE_LABELS** (local map in Settings to avoid circular import with featureRegistry):
```js
{
  feature_dashboard:     'Dashboard',
  feature_run_payroll:   'Payroll Runs',
  feature_queue_monitor: 'Queue Monitor',
  feature_reports:       'Reports',
  feature_employees:     'Employees',
  feature_settings:      'Settings',
}
```
**Keep this in sync with featureRegistry.jsx labels manually.**

---

## 12. Permissions & Role Revoked

`resolvePermissions(portalConfig, employeeId)` in `utils/permissions.js`:

```
portal_users[employeeId] → role name (or null if not in portal)
portal_roles[role]       → features[] (or roleRevoked if role was deleted)
```

**Scenarios:**
- Not in `portal_users` → `role: null, features: [], roleRevoked: false` → error screen "No access"
- Role deleted from `portal_roles` → `roleRevoked: true` → amber lock screen "Access Suspended"
- Normal → `{ role, features: [...] }`

---

## 13. File Map

```
src/
├── main.jsx                          Entry point
├── components/
│   ├── Shell.jsx                     Auth gate + feature router
│   ├── Nav.jsx                       Sidebar + BottomNav (mobile returns null)
│   ├── MonthPicker.jsx               Shared month/year picker
│   ├── LoadingScreen.jsx             Loading, error, RoleRevokedScreen
│   └── ...
├── context/
│   ├── AuthContext.jsx               useAuth() + useToast()
│   └── ThemeContext.jsx              useTheme() — light/dark toggle
├── config/
│   └── featureRegistry.jsx           Feature definitions + icons + order
├── hooks/
│   ├── useGateway.js                 Gateway invoke() + DEV_MODE flag
│   ├── useSDK.js                     Zoho SDK init → resolves user identity
│   └── mockData.js                   All mock responses (DEV_MODE only)
├── utils/
│   └── permissions.js                resolvePermissions()
└── features/
    ├── Dashboard/index.jsx
    ├── RunPayroll/index.jsx
    ├── QueueMonitor/index.jsx
    ├── Reports/index.jsx
    ├── Employees/index.jsx
    └── Settings/index.jsx
```

---

## 14. Critical Rules for Future AI Agents

1. **Never add CSS files or CSS modules.** All styles are inline objects.
2. **Never import from featureRegistry inside a feature component** — circular dependency. Use a local label map in that component.
3. **All gateway calls go through `gateway.invoke(fnName, params)`** — never call `window.ZOHO` directly.
4. **DEV_MODE mock handlers in `mockData.js` must mirror the real API contract exactly** — they are the integration test.
5. **Adding a feature:** (a) create component, (b) import in featureRegistry, (c) add registry entry, (d) add permission key to `_portalRoles` in mockData — nothing else.
6. **`run_id` is the canonical key for a run** — `period` alone is not unique (multiple runs per period are allowed).
7. **`portalGetSettings` response must not be called again** — it's cached for the whole session in `auth` context. Settings changes (via `portalSaveSettings`) update local state optimistically without re-fetching.
8. **`employee_name` and `department` are not stored on the frontend** — they come from the API enriched in `portalGetQueueStatus` and `portalGetPayrollRecords`. Do not add a client-side lookup table.
9. **The `FEATURE_LABELS` map in `Settings/index.jsx` must be kept in sync with `featureRegistry.jsx` labels manually** — it's a deliberate duplication to avoid a circular import.
10. **MonthPicker must be used everywhere a month/year input appears** — never `<input type="month">`.
