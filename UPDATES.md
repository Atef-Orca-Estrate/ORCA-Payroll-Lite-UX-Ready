# Branch Update Log — feature/dark-theme-and-run-payroll

All times UTC. Each entry documents what changed, why, and the exact modification made.

---

## [2026-04-27 | 01] feat: dark mode infrastructure

**Why:** Dark theme support requires a class-based Tailwind strategy and a persistent context before any component dark variants can be applied.

**Files changed:**

`webtab/tailwind.config.js`
```diff
+ darkMode: 'class',
```

`webtab/src/context/ThemeContext.jsx` — new file
- `ThemeProvider` reads preference from `localStorage` on init (no API call)
- Applies/removes `dark` class on `document.documentElement`
- Exposes `theme` and `toggleTheme` via `useTheme` hook
- Persists preference back to `localStorage` on change

`webtab/src/App.jsx`
```diff
+ import { ThemeProvider } from './context/ThemeContext';
  // ThemeProvider wraps AuthProvider so dark class is available to all children
```

`webtab/src/index.css`
```diff
- body { @apply bg-gray-50 text-gray-900; }
+ body { @apply bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100; }
```

`webtab/src/components/Shell.jsx` — dark variants added to all layout surfaces

`webtab/src/components/Nav.jsx` — dark variants added to Sidebar and BottomNav

`webtab/src/components/LoadingScreen.jsx` — dark variants added to LoadingScreen, AccessDenied, ErrorScreen

---

## [2026-04-27 | 02] feat: gateway mocks for portalListRuns and portalGetPayrollRecords

**Why:** RunPayroll rebuild (Phase 3) requires two new gateway functions. Mocks are added now so the component can be built and tested in DEV_MODE without any Zoho API dependency.

**File:** `webtab/src/hooks/useGateway.js`

- `portalListRuns` — returns all MPS records with period, status, employee count, working days, batch count, and progress counters (done/error/pending). Fetched once on RunPayroll mount, cached client-side.
- `portalGetPayrollRecords` — returns per-employee `pr_*` fields for a given period: basic salary, allowances, gross, SI, Martyrs Fund, absence/unpaid leave/late deductions, total deductions, net salary, monthly tax withheld, YTD tax withheld. Fetched on first run selection only — subsequent selections of the same period use the cached result.

---


All times UTC. Each entry documents what changed, why, and the exact modification made.

---

## [2026-04-26 | 01] Fix: Toast renders blank — out-of-scope variable

**Why:** `ToastProvider` was rendering `{message || t.message}` inside the toast map. `message` is a parameter name from the inner `show` callback and is not in scope at render time. Every toast was silently rendering nothing.

**File:** `webtab/src/context/AuthContext.jsx`

**Change:**
```diff
- {message || t.message}
+ {t.message}
```

---

## [2026-04-26 | 02] Fix: Settings portal users hardcoded instead of loaded from auth context

**Why:** `portalUsers` state was seeded with a hardcoded mock object `{ EMP001: 'admin', EMP002: 'manager' }` instead of the data already available in `auth.portalConfig.portal_users` (populated by `portalGetSettings` during Shell initialization). In production this would cause the users list to always show the hardcoded values regardless of actual configuration.

Additionally, a dead `users` state declaration was present — declared but never read or written anywhere in the component.

**File:** `webtab/src/features/Settings/index.jsx`

**Change:**
```diff
- const [users, setUsers] = useState(auth.payrollSettings ? {} : {}); // loaded from gateway mock
- const [portalUsers, setPortalUsers] = useState(
-   { EMP001: 'admin', EMP002: 'manager' } // seeded from mock
- );
+ const [portalUsers, setPortalUsers] = useState(auth.portalConfig?.portal_users || {});
```

---

## [2026-04-27 | 03] feat: Shell height chain + RunPayroll full rebuild

**Why:** RunPayroll requires a fixed-height 3-panel layout with no content overflow. Shell needed a proper viewport height anchor before RunPayroll could enforce its own overflow rules.

**File:** `webtab/src/components/Shell.jsx`
- Outer div: `min-h-screen` → `h-screen overflow-hidden` — anchors height chain to viewport
- `main`: added `flex flex-col overflow-hidden`
- Content wrapper: context-aware — RunPayroll gets `flex-1 min-h-0 overflow-hidden flex flex-col`, all other features get `flex-1 overflow-y-auto` (natural scroll preserved)

**File:** `webtab/src/components/Nav.jsx`
- Removed `min-h-screen` from Sidebar — parent is now `h-screen`

**File:** `webtab/src/features/RunPayroll/index.jsx` — full replacement
- 3-panel layout: left 260px (50/50 wizard + runs list), right flex-1 (records)
- Full height chain: every card uses `flex-1 min-h-0 overflow-hidden` — no boundary breaks
- `portalListRuns` fetched once on mount, cached for full session
- `portalGetPayrollRecords` cached per period — re-selecting same period = zero API calls
- Polling only when run status is Processing; single call per tick; stops on Completed
- 4-stage wizard driven by selected run status
- New payroll run pinned at top of runs list
- Records panel: filter tabs + expandable rows with Earnings / Deductions / Result
- Full dark mode coverage

## [2026-04-27 | 04] feat: dark mode toggle in Settings — Appearance section

**Why:** Users need a way to switch between light and dark themes from within the portal UI.

**File:** `webtab/src/features/Settings/index.jsx`
- Imported `useTheme` from `ThemeContext`
- Added standalone "Appearance" section above Payroll Settings
- Toggle wired directly to `theme` / `toggleTheme` from ThemeContext
- Applies instantly on click — no Save button, no gateway call, no API consumption
- Persisted to `localStorage` via ThemeContext automatically
