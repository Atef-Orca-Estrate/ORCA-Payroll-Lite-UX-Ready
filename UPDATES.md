# Branch Update Log — fix/toast-and-settings-users

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
