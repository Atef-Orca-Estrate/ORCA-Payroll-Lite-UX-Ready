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
