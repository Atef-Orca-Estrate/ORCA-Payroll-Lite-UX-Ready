# Branch Update Log — ui/mock-frontend-sandbox

All times UTC. Each entry documents what changed, why, and the exact modification made.

---

## [2026-04-28 | 01] feat: mock data architecture — dedicated mockData.js + useGateway refactor

**Why:** Separate all mock responses from gateway routing logic. Enables UI development and finalization with zero real Zoho API calls. Each mock handler is param-aware so responses vary by input (period-specific records, duplicate-guard errors, lock conflict simulation). Real API call code in useGateway.js is preserved — bypassed only, never removed.

**File:** `webtab/src/hooks/mockData.js` — new file
Full mock coverage for all 11 gateway functions:
- `portalGetSettings` — org config, SI rates, tax table, portal users map
- `portalListRuns` — all MPS records with financial totals on completed runs
- `portalGetQueueStatus` — period-aware; 2026-04 = Processing, others = Completed
- `portalGetPayrollRecords` — period-aware, full pr_* field set across 5 periods
- `portalGetPeriodReport` — per-period org summary; 2026-04 returns error (still processing)
- `portalCreateMPS` — ERROR SIMULATION: duplicate period guard
- `portalUpdateMPS` — always success
- `portalTriggerOrchestrator` — ERROR SIMULATION: first attempt = lock conflict; second = success
- `portalAddPortalUser` — ERROR SIMULATION: duplicate user guard
- `portalRemovePortalUser` — always success
- `portalSaveSettings` — always success (inline handler)

Session-scoped mutable state: `_createdPeriods`, `_triggerAttempts`, `_portalUsers`

**File:** `webtab/src/hooks/useGateway.js` — full rewrite
- Old inline MOCKS object removed
- Imports all handlers from mockData.js
- MOCK_HANDLERS map routes fnName → handler(params)
- DEV_MODE hardcoded true
- Production path (window.ZOHO.PEOPLE.invoke) preserved intact

---

## [2026-04-28 | 02] fix: run-ready corrections — permissions, mock roles, SDK script

**Why:** Three issues prevented local run: resolvePermissions received the wrong object from Shell, portal_roles was missing from the mock, and the Zoho SDK CDN script blocked the dev console.

**File:** `webtab/src/hooks/mockData.js`
- Added `portal_roles` to `portalGetSettings` mock response under `portal_config`

**File:** `webtab/src/components/Shell.jsx`
- `resolvePermissions(settingsResult, employeeId)` → `resolvePermissions(settingsResult.portal_config, employeeId)`

**File:** `webtab/index.html`
- Zoho SDK `<script>` tag commented out — not needed in DEV_MODE, was causing CDN errors in local dev

**File:** `README-LOCAL-DEV.md` — new file
- Step-by-step local run instructions: clone, branch, npm install, npm run dev
- Documents mock user, active error simulations, and pre-deployment checklist
