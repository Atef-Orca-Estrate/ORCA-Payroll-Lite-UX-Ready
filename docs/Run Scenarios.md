# ORCA Payroll Lite 2.0 — Run Payroll Scenarios

**Audience:** QA, frontend developer, backend developer.
**Purpose:** Exhaustive catalogue of every payroll run scenario a user can initiate through the web tab UI. Covers all scope types, configuration states, error paths, and navigation flows.

---

## How to Read This Document

Each scenario lists:
- **Pre-conditions** — settings and data state required before starting
- **Steps** — exact user actions in the UI
- **Expected outcome** — what the UI must show at each step
- **Gateway calls** — which functions fire and in what order

Scenarios are grouped by category. Every scenario assumes the user is logged in with a role that includes `feature_run_payroll`.

---

## Configuration Variables That Control Scenario Availability

| Setting | Location | Effect on wizard |
|---|---|---|
| `allow_multiple_runs` | Portal Config | Enables or blocks creating a second run for the same period |
| `default_holiday_source` | Portal Config | `"zoho"` = holiday list read-only; `"manual"` = Add / Edit / Delete shown |
| `allow_working_days_override` | Portal Config | Shows or hides the Override button on Step 2 |

---

## Category A — Scope Selection

### S-A01 · Full org run — All employees

**Pre-conditions:** No existing run for the target period. Any holiday source.

**Steps:**
1. Click **New payroll run** in the Runs List
2. Select target period using MonthPicker
3. Select scope: **All employees**
4. Click **Create setup**

**Expected outcome:**
- Wizard transitions to Step 2 (Review)
- Config row shows: `Period = YYYY-MM`, `Scope = All active employees`
- Holiday list populated (Zoho source) or empty (manual source)
- Working days shown — editable if `allow_working_days_override = true`
- New run appears in Runs List with status chip `Draft` and no scope sublabel

**Gateway calls:** `portalCreateMPS({ payroll_period, scope:"all", selected_department:"", selected_employees:[], force:false })`

---

### S-A02 · Department-scoped run

**Pre-conditions:** No existing run for the target period (or `allow_multiple_runs = true`). `portalGetDepartments` returns at least one department.

**Steps:**
1. Click **New payroll run**
2. Select period
3. Select scope: **By department**
4. Click **Next →** — selection sub-screen appears
5. Search departments (optional)
6. Select one department via radio button
7. Click **Create setup**

**Expected outcome:**
- Wizard transitions to Step 2
- Config row shows: `Scope = Dept: Engineering` (selected dept name)
- Run appears in Runs List with sublabel `Dept · Engineering`
- Department picker was lazy-loaded (only fetched when sub-screen opened)

**Gateway calls:**
1. `portalGetDepartments()` — on sub-screen open
2. `portalCreateMPS({ payroll_period, scope:"by_department", selected_department:"Engineering", selected_employees:[], force:false })`

---

### S-A03 · Employee-scoped run — single employee

**Pre-conditions:** No existing run for the period. `portalGetEmployees` or `portalListEmployees` returns data.

**Steps:**
1. Click **New payroll run**
2. Select period
3. Select scope: **Select employees**
4. Click **Next →**
5. Search by name or ID (optional)
6. Check exactly one employee
7. Click **Create setup**

**Expected outcome:**
- Wizard at Step 2
- Config row: `Scope = 1 selected employee`
- Runs List sublabel: `1 emp`

**Gateway calls:**
1. `portalGetEmployees()` — unless `portalListEmployees` was called earlier in the session (Employees screen visited), in which case the list is derived client-side with no extra call
2. `portalCreateMPS({ scope:"by_employee", selected_employees:["EMP001"], ... })`

---

### S-A04 · Employee-scoped run — multiple employees

**Pre-conditions:** Same as S-A03.

**Steps:**
1–4. Same as S-A03
5. Check multiple employees (checkboxes)
6. Selection counter shows `N employees selected`
7. Click **Create setup**

**Expected outcome:**
- Config row: `Scope = N selected employees`
- Runs List sublabel: `N emps`

---

### S-A05 · Employee scope with search filter

**Pre-conditions:** Employee list has enough records to test search.

**Steps:**
1. Enter scope: **Select employees**, click **Next →**
2. Type part of a name in the search field
3. List filters client-side — no new API call fired
4. Select employees from filtered results
5. Clear search — all employees visible again with selections preserved
6. Click **Create setup**

**Expected outcome:**
- Search filters by `name` or `id` client-side
- Selected employees remain checked when search is cleared
- Selected count shown throughout

---

### S-A06 · Department scope with search filter

**Pre-conditions:** Multiple departments available.

**Steps:**
1. Scope: **By department**, click **Next →**
2. Type in search field — list filters client-side
3. Select department from filtered results
4. Click **Create setup**

**Expected outcome:** Same pattern as S-A05 but single-select (radio); search filters by `name` only.

---

## Category B — Step 2 Review Configurations

### S-B01 · Zoho holiday source — read-only list

**Pre-conditions:** `default_holiday_source = "zoho"`. Period has public holidays in Zoho calendar.

**Steps:**
1. Complete Step 1 (any scope)
2. On Step 2, view the **Public holidays** section

**Expected outcome:**
- Holiday list is populated from MPS creation (fetched from Zoho holiday API)
- No Add / Edit / Delete buttons shown
- Section label reads `Public holidays · Zoho`
- Working days reflects holidays already excluded

---

### S-B02 · Zoho holiday source — period has no holidays

**Pre-conditions:** `default_holiday_source = "zoho"`. Target period has no public holidays.

**Steps:**
1. Complete Step 1
2. View holiday section on Step 2

**Expected outcome:**
- Holiday list shows `No public holidays this period`
- No action buttons
- Working days = full working days in the month

---

### S-B03 · Manual holiday source — add holidays

**Pre-conditions:** `default_holiday_source = "manual"`.

**Steps:**
1. Complete Step 1 — holiday list starts empty
2. On Step 2, click **Add** button
3. Pick a date within the period using the date input
4. Enter a holiday name
5. Click **Add** (or press Enter)

**Expected outcome:**
- New holiday appears in list, sorted by date
- List persisted immediately via `portalUpdateMPSHolidays`
- Working days field does not auto-update — it reflects the default; user must override manually if needed

**Gateway call:** `portalUpdateMPSHolidays({ payroll_period, holidays:[{date, name}] })` — full list replacement

---

### S-B04 · Manual holiday source — edit an existing holiday

**Pre-conditions:** At least one holiday exists in the list.

**Steps:**
1. On Step 2, click **Edit** on a holiday row
2. Inline edit form appears with current date and name pre-filled
3. Change the name or date
4. Click **Save** (or press Enter)

**Expected outcome:**
- Row updates in place
- List re-sorted by date if date changed
- `portalUpdateMPSHolidays` called with full updated list

---

### S-B05 · Manual holiday source — delete a holiday

**Steps:**
1. Click **Delete** on a holiday row
2. No confirmation dialog — deletion is immediate

**Expected outcome:**
- Row removed from list
- `portalUpdateMPSHolidays` called with remaining holidays

---

### S-B06 · Working days override — change value

**Pre-conditions:** `allow_working_days_override = true`.

**Steps:**
1. On Step 2, click **Override** link next to working days
2. Number input appears — change the value (e.g., 21 → 20)
3. Click **Save**

**Expected outcome:**
- Value updates in config row
- Override button hidden while saving
- `portalUpdateMPS` called with `new_working_days`
- On success: toast confirms, input collapses back to display mode

**Gateway call:** `portalUpdateMPS({ payroll_period, new_working_days:20 })`

---

### S-B07 · Working days override — cancel without saving

**Steps:**
1. Click **Override**, change the value
2. Click **Cancel**

**Expected outcome:**
- Original working days value restored
- No API call made

---

### S-B08 · Working days override — hidden when disabled

**Pre-conditions:** `allow_working_days_override = false`.

**Expected outcome:**
- Working days row shows value as plain text
- No **Override** button or link visible

---

## Category C — Triggering the Run (Step 2 → Step 3)

### S-C01 · Successful first-attempt trigger

**Pre-conditions:** MPS in Draft status. No active global lock.

**Steps:**
1. On Step 2, click **Run payroll** (green button)

**Expected outcome:**
- Button shows `Starting…` with spinner
- On success: toast `Run started — N employees queued`
- Wizard transitions to Step 3 (Running)
- Step 3 shows: employee count, batch count, progress bar at 0%, countdown timer at 30s
- Run in Runs List updates to `Processing` status chip

**Gateway call:** `portalTriggerOrchestrator({ payroll_period })`
**Orchestrator fires:** queues employees into `Payroll_Queue`, sets batches, flips MPS to Processing

---

### S-C02 · Trigger fails on first attempt — lock conflict, auto-retry

**Pre-conditions:** Another run is in progress (global lock set).

**Steps:**
1. Click **Run payroll**

**Expected outcome:**
- Gateway returns: `{ status:"error", message:"Orchestrator is locked by another process. Wait 30 seconds and try again." }`
- Frontend automatically retries once after 30 seconds (no user action needed)
- Toast: error on first attempt; success or new error on retry
- If retry succeeds: transition to Step 3
- If retry also fails: toast shows error, button re-enables, user can retry manually

---

### S-C03 · Override active blocks trigger

**Pre-conditions:** User has the working days override input open (editing).

**Steps:**
1. Open the Override input
2. Attempt to click **Run payroll**

**Expected outcome:**
- **Run payroll** button is disabled (`overriding` state is `true`)
- User must Save or Cancel the override before triggering

---

## Category D — Processing (Step 3 — Live Polling)

### S-D01 · Normal processing — polling updates progress

**Pre-conditions:** Run is in `Processing` status. User is on Step 3.

**Expected behaviour:**
- Progress bar, Done / Remaining / Errors tiles update every 30 seconds
- Countdown timer counts down from 30 and resets on each poll
- Batch and employee counts shown in info banner
- Status chip in Runs List stays `Processing` with pulse animation

**Gateway call (every 30s):** `portalGetQueueStatus({ payroll_period, run_id })`

---

### S-D02 · Processing auto-completes — transition to Step 4

**Pre-conditions:** Poll returns `mps_status = "Completed"`.

**Expected behaviour:**
- Wizard automatically transitions to Step 4 (Complete)
- `portalGetPayrollRecords` fires to load the records panel
- No user action required

**Gateway calls on completion:**
1. `portalGetQueueStatus` returns `mps_status: "Completed"` (poll result)
2. `portalGetPayrollRecords({ payroll_period, run_id })` — auto-triggered

---

### S-D03 · Browser tab hidden — polling pauses

**Steps:**
1. Run is Processing on Step 3
2. Switch to another browser tab or minimise window

**Expected behaviour:**
- `visibilitychange` event pauses the poll timer
- Countdown freezes or stops
- When tab is re-focused: immediate poll fires, timers resume

---

### S-D04 · Errors in the run — shown in Step 3 tiles

**Pre-conditions:** Some queue records return `Error` status.

**Expected behaviour:**
- **Errors** tile (red) shows count > 0
- Progress bar reflects Done/(Total − Done) split
- Step 4 also shows an error warning: `N employees errored — check records`
- Records panel **Errors** filter tab shows count badge

---

## Category E — Completed Run (Step 4)

### S-E01 · Step 4 — financial summary displayed

**Pre-conditions:** Run reached Completed status.

**Expected outcome:**
- Green success banner: `N employees processed — YYYY-MM`
- Scope label shown (All employees / Dept · Name / N selected employees)
- 4 financial tiles: Gross salary, Net paid (accent), Tax withheld, Employee SI
- Tiles show values from `run.gross`, `run.net`, `run.tax`, `run.si`

---

### S-E02 · Navigate to period report from Step 4

**Steps:**
1. On Step 4, click **View period report →** (pinned to card footer)

**Expected outcome:**
- App navigates to Reports feature
- Report auto-loads for the same period without user clicking Generate
- `portalGetPeriodReport` fires with the run's period

**Gateway call:** Navigation via `onNavigate('feature_reports', { period })`

---

## Category F — Records Panel

### S-F01 · View all records for a completed run

**Pre-conditions:** A Completed run is selected.

**Expected outcome:**
- All employees listed in the records panel
- Header shows employee count
- **All** filter tab selected by default
- Each row (collapsed): employee name, id·department (monospace), status chip
- Rows with `status = "Done"` have an expand chevron (financials available)
- Rows with `status = "Error"` show error message inline, no chevron

---

### S-F02 · Filter records by status

**Steps:**
1. Click **Done**, **Processing**, **Pending**, or **Errors** filter tab

**Expected outcome:**
- List narrows to matching records only
- Each tab shows count badge
- Switching tabs resets any expanded row

---

### S-F03 · Expand a Done record — financial breakdown

**Steps:**
1. Click any row with status `Done`

**Expected outcome:**
- Row expands inline (only one row expanded at a time)
- Earnings section: Basic salary, Allowances, Gross salary
- Deductions section: Employee SI, Martyrs' fund, Absence, Unpaid leave, Late, Total deductions
- Result section: Net salary (accent), Monthly tax, YTD tax
- All values formatted as `EGP X,XXX.XX`

---

### S-F04 · Records cached for the session

**Pre-conditions:** Records have been loaded for a run.

**Steps:**
1. Navigate away from RunPayroll (e.g., to QueueMonitor)
2. Return to RunPayroll and select the same run

**Expected outcome:**
- Records load instantly from client-side cache — no `portalGetPayrollRecords` call fired
- Cache key is `run_id`; switching to a different run fetches fresh data

---

### S-F05 · Navigate to Queue Monitor from records panel

**Steps:**
1. With a run selected, click **View Queue** button (top-right of records panel)

**Expected outcome:**
- App navigates to Queue Monitor
- Queue Monitor pre-selects the same period and run via `navParams`

---

## Category G — Runs List Navigation

### S-G01 · Select an existing Draft run (resume)

**Pre-conditions:** At least one Draft run exists in the list.

**Steps:**
1. Click a Draft run row in the Runs List

**Expected outcome:**
- Wizard shows Step 2 (Review)
- Working days, holiday list, and scope populated from the existing MPS
- **Run payroll** button active

---

### S-G02 · Select an existing Processing run

**Steps:**
1. Click a Processing run row

**Expected outcome:**
- Wizard shows Step 3 (Running) with current progress
- Polling starts immediately on selection
- Records panel empty (records not available until Completed)

---

### S-G03 · Select an existing Completed run

**Steps:**
1. Click a Completed run row

**Expected outcome:**
- Wizard shows Step 4 (Complete) with financials
- Records panel loads for that run (or serves from cache)

---

### S-G04 · Multiple runs for same period — Runs List display

**Pre-conditions:** `allow_multiple_runs = true`. Two or more runs exist for the same period.

**Expected outcome in Runs List:**
- Each run shown as a separate row, keyed by `run_id`
- Each row has a distinct scope sublabel (e.g., `Dept · Engineering`, `3 emps`)
- Period label is the same on all rows; sublabel differentiates them

---

### S-G05 · Multiple runs — sibling navigation in records panel

**Pre-conditions:** 2+ runs for the same period; one is selected.

**Expected outcome:**
- Records panel header shows: `Run X of N for YYYY-MM`
- Prev / Next arrow buttons navigate between sibling runs
- Navigating to a sibling fetches that run's records (or serves from cache)
- Filter tabs and expanded row reset on navigation

---

## Category H — Multi-Run per Period

### S-H01 · Attempt second run — blocked (allow_multiple_runs = false)

**Pre-conditions:** `allow_multiple_runs = false`. A Completed run already exists for the period.

**Steps:**
1. Click **New payroll run**
2. Select the same period as the existing run
3. Click **Create setup** (or **Next →**)

**Expected outcome:**
- Client-side guard fires before any API call
- Toast: `A run for YYYY-MM already exists`
- Wizard stays on Step 1
- No `portalCreateMPS` call made

---

### S-H02 · Attempt second run while first is Processing — blocked regardless

**Pre-conditions:** A run for the period is currently `Processing`. `allow_multiple_runs` = any value.

**Steps:**
1. Select the same period
2. Click **Create setup**

**Expected outcome:**
- Toast: `A run for YYYY-MM is currently processing — wait for it to complete`
- Blocked client-side — no API call

---

### S-H03 · Second run allowed — different scope

**Pre-conditions:** `allow_multiple_runs = true`. Existing run is Completed (not Processing).

**Steps:**
1. Click **New payroll run**
2. Select the same period
3. Select a different scope (e.g., `By department` when first run was `All employees`)
4. Click **Next →**, select department, click **Create setup**

**Expected outcome:**
- `portalCreateMPS` called with `force: true`
- New Draft run created and selected in wizard
- Runs List shows both runs for the period with different scope sublabels
- QueueMonitor shows run tabs for the period

**Gateway call:** `portalCreateMPS({ payroll_period, scope:"by_department", selected_department:"Finance", force:true })`

---

## Category I — Error States and Recovery

### S-I01 · portalCreateMPS returns error — duplicate period

**Pre-conditions:** The period already exists and `force` was not sent (or duplicate guard fires server-side).

**Expected outcome:**
- Toast: `A payroll run for YYYY-MM already exists.` (server message)
- Wizard stays on Step 1
- User can select a different period or check `allow_multiple_runs`

---

### S-I02 · portalCreateMPS returns error — working days = 0

**Pre-conditions:** Zoho holiday API returns holidays filling all working days (edge case).

**Expected outcome:**
- Toast shows server error message
- Wizard stays on Step 1
- User should switch to manual source and enter working days manually

---

### S-I03 · portalListRuns fails on mount

**Pre-conditions:** Gateway returns error on initial load.

**Expected outcome:**
- Toast: `Failed to load runs`
- Runs List shows spinner then `No previous runs` empty state
- Wizard still usable — user can create a new run

---

### S-I04 · portalGetPayrollRecords fails

**Steps:**
1. Select a Completed run

**Expected outcome:**
- Records panel shows loading spinner, then empty state
- Toast: `Failed to load records`
- Wizard Step 4 still renders (financials from run object, not from records)

---

### S-I05 · Run has errors — records show Error filter

**Pre-conditions:** Completed run has `run.error > 0`.

**Expected outcome:**
- Step 4 shows amber/red error banner: `N employees errored — check records`
- Records panel **Errors** filter tab shows count
- Error rows: no expand chevron, error message displayed inline below name
- Financial tiles show gross/net of successful records only (server-side aggregation)

---

## Category J — Navigation Between Features

### S-J01 · Navigate from Queue Monitor to Run Payroll with period pre-selected

**Pre-conditions:** User is in Queue Monitor viewing a period.

**Steps:**
1. Click **View in Run Payroll →** link in QueueMonitor header

**Expected outcome:**
- RunPayroll feature opens
- The matching run for that period (and `run_id`) is auto-selected
- Wizard jumps to the correct step for that run's status
- `navParams = { period, run_id }` drives the auto-selection

---

### S-J02 · Navigate from Run Payroll Step 4 to Reports

**Steps:**
1. On Step 4, click **View period report →**

**Expected outcome:**
- Reports feature opens with period pre-filled
- Report auto-loads (`autoLoadedRef` tracks this to prevent double-fetch)
- If no Final payroll records exist yet: toast `No completed report available for period YYYY-MM`

---

### S-J03 · Navigate to Run Payroll via navParams with run_id

**Pre-conditions:** QueueMonitor or another feature calls `onNavigate('feature_run_payroll', { period, run_id })`.

**Expected outcome:**
- RunPayroll searches `runs` for the matching `run_id` first, falls back to `period`
- Correct run is selected and wizard step rendered

---

## Category K — Mobile Layout

### S-K01 · Records drawer — mobile

**Pre-conditions:** Viewport is mobile (< 768px). A run is selected.

**Steps:**
1. Tap the floating **Records** FAB button (bottom-right)

**Expected outcome:**
- Bottom drawer slides up from bottom with spring animation
- Drawer shows Records panel with filter tabs
- Tap backdrop or × to close
- Body scroll locked while drawer is open

---

### S-K02 · Mobile — no records FAB when no run selected

**Pre-conditions:** Wizard is on Step 1 (isNew = true) or no run selected.

**Expected outcome:**
- FAB button not rendered (hidden)
- Records drawer not accessible

---

## Scenario Coverage Matrix

| Scenario | Scope | Holiday Source | Override | Multi-Run | Error Path |
|---|:---:|:---:|:---:|:---:|:---:|
| S-A01 | All | Any | — | No | — |
| S-A02 | Dept | Any | — | No | — |
| S-A03 | Employee (1) | Any | — | No | — |
| S-A04 | Employee (N) | Any | — | No | — |
| S-B01 | Any | Zoho | — | No | — |
| S-B03 | Any | Manual | — | No | — |
| S-B06 | Any | Any | Yes | No | — |
| S-C01 | Any | Any | Any | No | — |
| S-C02 | Any | Any | Any | No | Lock conflict |
| S-H01 | Any | Any | Any | Blocked | Duplicate |
| S-H02 | Any | Any | Any | Blocked | Processing |
| S-H03 | Dept/Emp | Any | Any | Allowed | — |
| S-I01–I05 | Any | Any | Any | Any | Various |

---

*Based on UI study of branch `ui/mock-frontend-sandbox` — 2026-05-13*
