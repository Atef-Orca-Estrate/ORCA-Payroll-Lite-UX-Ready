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

---

## [2026-05-07 | 03] refactor: feature registry — single source of truth for all feature definitions

**Why:** Feature registration was scattered across 4 files (FEATURE_ORDER array, ICONS object, FEATURE_LABELS map, FEATURE_COMPONENTS map). Adding a new feature required touching all 4. Registry pattern reduces it to one entry in one file.

**Decision logged:** `minRoles` field is informational only — server-returned `features[]` array is the sole runtime access gate. Client-side role enforcement rejected: would require a frontend deploy for every new role added in Zoho.

**File:** `webtab/src/config/featureRegistry.jsx` — new file
- `FEATURE_REGISTRY` object: one entry per feature with `label`, `Icon`, `component`, `order`, `minRoles`
- `FEATURE_ORDER` derived export: sorted array of feature keys for nav components
- Icons (4 inline SVG components) moved here from Nav.jsx — co-located with feature definitions

**File:** `webtab/src/components/Shell.jsx`
- Removed: 4 individual feature imports (RunPayroll, QueueMonitor, Reports, Settings)
- Removed: `FEATURE_COMPONENTS` map
- Added: `import { FEATURE_REGISTRY } from '../config/featureRegistry'`
- Changed: `FEATURE_COMPONENTS[activeFeature]` → `FEATURE_REGISTRY[activeFeature]?.component`

**File:** `webtab/src/components/Nav.jsx`
- Removed: `FEATURE_ORDER` array, `ICONS` object, `FEATURE_LABELS` import
- Added: `import { FEATURE_REGISTRY, FEATURE_ORDER } from '../config/featureRegistry'`
- Both `Sidebar` and `BottomNav` now destructure `{ label, Icon }` from `FEATURE_REGISTRY[featureKey]`

**File:** `webtab/src/utils/permissions.js`
- Removed: `FEATURE_LABELS` export (labels now live in featureRegistry.jsx)
- `resolvePermissions` function: unchanged

**Behaviour change:** None — pure refactor, zero visible difference to user.
**Build verified:** ✓ clean build, 45 modules, no errors or warnings.

---

## [2026-05-07 | 04] feat: Layer 2 — visual foundation, brand identity, Geist font

**Why:** Establish Orca Estrate brand identity across the portal. Replace system font and generic blue with a deliberate design system. Every subsequent UI layer builds on these foundations.

### Typography
**File:** `webtab/public/fonts/geist-variable.woff2` — new, self-hosted
- Geist variable font (latin subset, 28KB WOFF2) — chosen for SF Pro DNA: geometric, optically precise, clean at small data sizes
- Self-hosted (not CDN) — no DNS lookup, no third-party dependency, served from same origin

**File:** `webtab/index.html`
- Title updated: "Payroll Portal" → "ORCA Payroll"
- `<link rel="preload">` added for geist-variable.woff2 — fires before HTML parsing completes

**File:** `webtab/src/index.css` — full rewrite
- `@font-face` for Geist variable (100–900 weight range, `font-display: swap`)
- `font-family: 'Geist', -apple-system, ...` on body — system SF Pro fallback on first paint
- Full CSS design token system (`:root` + `.dark` overrides) — 28 tokens covering accent, surface, border, text, sidebar, status
- Minimal scrollbar styling

**File:** `webtab/tailwind.config.js`
- `fontFamily.sans` extended with Geist + system fallback chain
- `colors.accent.*` tokens backed by CSS vars (accent, dark, bg, border, text, muted)
- `colors.surface.*` tokens backed by CSS vars
- `colors.brand.sidebar` = `#0F172A`

### Brand Identity
**File:** `webtab/public/orca-logo.svg` — new
- Real Orca Estrate SVG logo asset. On dark sidebar (#0F172A), the logo's own dark circular border (#0F1B31) blends with background, leaving clean floating white orca silhouette. No CSS filter required.

### Color System — Decisions
- **Palette:** Night Graphite (#0F172A) sidebar + Precision Indigo (#6366F1) accent — chosen over Teal for precision/authority signal appropriate to payroll compliance tool
- **Sidebar:** Fixed dark (#0F172A) regardless of dark/light mode preference — consistent brand presence, cleaner than toggling sidebar color
- **Active nav:** Indigo left border (2.5px #6366F1) + indigo background fill (rgba(99,102,241,0.10)) — both, as approved
- **Dark mode toggle:** Promoted from Settings screen to sidebar footer — always visible
- **Buttons:** #111827 graphite (not indigo) — prevents accent color competition between nav active state and CTAs

### Component Changes
**File:** `webtab/src/components/Nav.jsx` — full rewrite
- Dark graphite sidebar (#0F172A) — fixed, does not change with dark mode toggle
- Real Orca Estrate SVG logo mark via `<img>` tag (not inline SVG — preserves file maintainability)
- "ORCA Payroll" + "by Orca Estrate" identity block beside logo
- Nav items: indigo left border + translucent indigo fill on active, hover states with inline transition
- User avatar: initials from employeeId (alpha chars only, avoids "EM" from EMP* IDs)
- Role label: lowercase below employee ID
- Theme toggle (moon/sun SVG) in footer — always visible, replaces Settings-buried toggle
- Mobile BottomNav: dark graphite bar matching sidebar, indigo top border on active item
- OrcaLogo and ThemeToggle extracted as named sub-components

**File:** `webtab/src/components/LoadingScreen.jsx` — full rewrite
- All three screens (LoadingScreen, AccessDenied, ErrorScreen) use dark brand background (#0F172A)
- LoadingScreen: logo mark in frosted indigo tile, product name, "by Orca Estrate" sub-label, animated indigo progress bar
- AccessDenied: red error tile, employee ID in monospace pill, clear admin contact message
- ErrorScreen: amber warning tile, retry button in indigo

**File:** `webtab/src/components/Shell.jsx`
- Mobile header updated: dark brand bar, real SVG logo mark, "ORCA Payroll" + "by Orca Estrate", indigo avatar initials

**Behaviour change:** Visible — full visual redesign. Zero logic changes. All gateway calls, permission resolution, and feature routing unchanged.
**Build verified:** ✓ clean build, 45 modules, no errors.

---

## [2026-05-08 | 05] feat: RunPayroll screen — full redesign + mobile drawer + navigation

**Why:** RunPayroll had a broken mobile layout, out-of-sync colors, a buried CTA, and a dead "View period report" callback. This session addressed all 7 identified issues.

### Architecture changes
**File:** `webtab/src/components/Shell.jsx`
- Added `navParams` state and `handleNavigate(featureKey, params = {})` callback
- `handleNavigate` replaces `setActiveFeature` throughout — backward-compatible (params defaults to `{}`)
- Passed `onNavigate={handleNavigate}` and `navParams={navParams}` to `<ActiveComponent />`
- Enables cross-feature navigation with pre-filled state (RunPayroll → Reports with period)

### RunPayroll — all 7 issues resolved
**File:** `webtab/src/features/RunPayroll/index.jsx` — full rewrite

**1. Mobile layout (broken → drawer pattern)**
- `grid-cols-[260px_1fr]` hardcoded removed — replaced with responsive CSS media query
- Desktop: `grid-template-columns: 260px 1fr` applied at `≥768px` via inline `<style>` block
- Mobile: single-column flex layout (wizard + runs list stacked, full width)
- Records panel hidden on mobile (`display:none` until `≥768px`)
- Floating "View Records" FAB: fixed position, `bottom: 76px` (above bottom nav), visible mobile only
- Bottom drawer: slides up from bottom with `cubic-bezier(0.32, 0.72, 0, 1)` transition, max-height 85dvh, drag handle, close button, backdrop overlay with opacity transition
- Body scroll locked via `useEffect` when drawer open

**2. Color system alignment**
- All `bg-blue-600` primary buttons → graphite `#111827` (hover: `#1F2937`)
- Run payroll button: **stays green `#16A34A`** (Don's decision — deliberate "go" signal)
- Progress bar: `bg-blue-600` → `#6366F1` (indigo accent)
- Stepper active circle: blue → `#6366F1`
- Selected row highlight: `bg-blue-50` → `#EEF2FF` (indigo wash)
- Status badge Processing: blue → indigo
- StepComplete net paid card: blue → indigo accent tokens
- All hover/active states use indigo or token vars

**3. Stepper redesign**
- Circles: `w-5 h-5` (20px) → 28px
- Labels: `text-[10px]` → 11.5px
- Done state: green circle with SVG checkmark
- Active state: solid indigo circle
- Connector line: `h-px` → `h-2` (2px), color transitions with step progress

**4. CTA anchoring**
- All step CTAs (Create setup, Run payroll, View period report) use `position: sticky; bottom: 0` with surface background
- Scrollable content area can grow freely — CTA always visible at bottom of wizard card
- Override form (working days) no longer pushes "Run payroll" off-screen

**5. Filter tab active state**
- `border-gray-900 dark:border-gray-100` (harsh) → `border-[#6366F1] color: #6366F1` (indigo)
- Active tab count badge: gray → indigo wash with indigo text

**6. Error row treatment**
- `{rec.status.toLowerCase()} · ${rec.error}` (truncated inline) → dedicated red sub-line
- Error text rendered at `fontSize: 11, color: '#DC2626'` below employee ID
- Normal (non-error) rows show status + processed_at time as sub-line

**7. onViewReport wired up**
- `StepComplete` receives `onViewReport` → calls `onNavigate('feature_reports', { period: run.period })`
- Shell passes `handleNavigate` to feature components — navigation triggers feature switch + navParams

### Reports — pre-fill from navigation
**File:** `webtab/src/features/Reports/index.jsx` — full rewrite
- Accepts `navParams` prop from Shell
- `useEffect` on `navParams?.period`: sets period input + clears stale report
- Empty state message updates when period is pre-filled: "Period 2026-04 loaded — click Generate"
- All colors updated to indigo + token vars (removed blue-600 throughout)
- Generate button: graphite `#111827` matching system

**Behaviour change:** Visible — mobile layout fixed, all colors aligned, drawer navigation added, Reports pre-fills from RunPayroll.
**Build verified:** ✓ clean build, no errors.

---

## [2026-05-08 | 06] feat: QueueMonitor — full redesign, 4 states, batch groups, live monitor

**Why:** QueueMonitor had no state handling beyond Processing, used card layout (unusable at scale), had no error filtering, polled constantly regardless of visibility, and showed a toast error for the valid "no run" state.

### Architecture decisions locked before build
- `exit_date` on termination records: dropped from UI — not in backend contract
- Financial totals in QueueMonitor: not shown — users go to Reports
- `total_batches`: derived client-side from `Math.max(...records.map(r => r.batch_number))`
- `code: 'no_run'` on error response: NEW requirement added to `portalGetQueueStatus` contract

### Four states implemented
- **None** (`code: 'no_run'` error): EmptyState — icon, message, "Go to Run Payroll" button
- **Draft**: EmptyState — "Setup exists, not triggered", "Start run →" navigates to RunPayroll
- **Processing**: Full live view with pulsing indicator, progress, 4-stat tiles, batch groups, polling
- **Completed**: Green final summary header (counts only, no financials), batch-grouped records

### New components
- `PeriodHeader` — always visible, all states. Period picker, live dot, "Updated HH:MM · ↻ in Xs", refresh button, "View in Run Payroll →" cross-nav link
- `ProcessingOverview` — progress bar (8px, indigo), 4-stat tiles (Done/Processing/Pending/Errors separately), batch count derived from records, working days
- `CompletedOverview` — green header, final counts, error note with "will not auto-retry" message
- `StatTile` — reusable count tile with colored background
- `BatchGroup` — collapsible batch header (color-coded by batch status: done/processing/errors/pending), expand/collapse chevron, per-batch summary counts, `defaultOpen` when batch has errors or active records
- `QueueRow` — compact row replacing `rounded-xl p-4` cards: employee ID (monospace), status badge (pill, no border), processed_at or status text, dedicated error sub-line + "Requires manual review" for Error records, "Final settlement" tag for termination records
- `RecordsSection` — Regular/Termination tabs (indigo active), Errors-only toggle (cross-batch filter, shows flat error list with count header), empty states per tab
- `EmptyState` — handles none/draft with appropriate icon, message, CTA button
- `Spinner` — shared indigo spinner component

### Key behaviors
- **Auto-load current month on open** — fires on mount, period change clears and reloads
- **Polling: Processing only** — `setInterval` created only when `mps_status === 'Processing'`, cleared on Completed/Draft/none
- **Visibility-based pause** — `document.visibilitychange` listener: pauses poll timers when tab hidden, resumes + immediate refresh on focus
- **Last updated timestamp** — `new Date()` captured on each successful load, displayed as HH:MM
- **Error handling**: `code: 'no_run'` → EmptyState (no toast); other errors → toast
- **Cross-navigation**: "View in Run Payroll →" and EmptyState CTAs call `onNavigate('feature_run_payroll', { period })`
- **Batch defaultOpen**: batches with Error or Processing records auto-expand on load

### Mock updates
**File:** `webtab/src/hooks/mockData.js` — `mock_portalGetQueueStatus`
- `'2026-04'` → Processing (unchanged logic, now explicit)
- `'2026-03'` → Completed (expanded to 12 employees across 3 batches, 1 error, 1 termination record)
- `'2026-05'` → Draft (new state)
- Any other period → `{ status: 'error', code: 'no_run', message: '...' }` (new state)

### WEBTAB_SPEC.md updates
- Section 5 `portalGetQueueStatus`: contract fully rewritten — 4 response shapes, `code: 'no_run'` requirement, field notes updated (no exit_date, no financials, no total_batches)
- Section 9 Backend Implications: BI-01 entry logged (3 confirmed non-requirements + new `code` requirement)

**Build verified:** ✓ clean, 45 modules, no errors.

---

## [2026-05-08 | 07] feat: dark mode toggle — promoted to persistent shell for all users

**Why:** Dark mode is a personal preference, not a system setting. Removing it from Settings ensures it is not mixed with org-level configuration. Every user who opens the webtab should be able to toggle it immediately, on any device, without navigating anywhere.

**Decision:** Toggle lives exclusively in the persistent shell UI — sidebar footer on desktop (already present since Layer 2), mobile header on mobile (added now). Settings screen Appearance section removed entirely.

**File:** `webtab/src/components/Nav.jsx`
- `ThemeToggle` function changed from private to exported (`export function ThemeToggle`)
- No visual or behavioural change on desktop — sidebar footer unchanged

**File:** `webtab/src/components/Shell.jsx`
- Added `ThemeToggle` to import from `./Nav`
- Mobile header: `ThemeToggle` added between brand block and user avatar
- Dark/light icon (moon/sun SVG) now always visible on mobile at top of screen

**File:** `webtab/src/features/Settings/index.jsx`
- Removed `import { useTheme }` 
- Removed `const { theme, toggleTheme } = useTheme()` destructuring
- Removed entire Appearance section JSX block (~20 lines)
- Settings screen now opens directly to Payroll Settings section

**Behaviour change:** Dark mode toggle no longer in Settings. Now accessible from sidebar footer (desktop) and mobile header (mobile) — always visible to all users on all devices.
**Build verified:** ✓ clean, no errors.
