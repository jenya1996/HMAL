# Per-User Settings & Preferences

**Date:** 2026-06-05  
**Status:** Approved

## Problem

All settings and preferences are currently stored as shared global Firestore documents. If one user changes their dashboard layout or table filters, it changes them for everyone. Users need independent, persisted, device-synced preferences.

## Scope

### Per-user (this spec)
- Dashboard config: hidden stat cards, hidden panels, soldier column filters, panel order
- Auto sign-out (idle) timeout
- Soldier page: search string + column filters (persisted, per-user)
- Schedule page: search string + column filters (persisted, per-user)

### Global / unchanged
- Column definitions (`hmal-columns-v1`)
- Task templates, task groups, cert source column, soldier sort order in assignment panel
- Soldiers data, schedule data, task assignments, task roles

## Architecture

### Firestore Data Model

```
hmal-data/                          ← existing global collection, unchanged
  hmal-dashboard-config             ← kept as migration seed (read-only after rollout)
  hmal-soldiers-v2
  hmal-columns-v1
  ...

hmal-user-prefs/                    ← new collection
  {uid}                             ← one document per user
    value: {
      "dashboard-config":      DashboardConfig
      "idle-timeout":          number (ms)
      "soldier-table-state":   { search: string, filters: Record<string, string> }
      "schedule-table-state":  { search: string, filters: Record<string, string> }
    }
```

All four preference keys are stored as named fields inside a single `value` map per user document. Individual key writes use Firestore `set(..., { merge: true })` so they don't clobber other keys.

### Server Route — `server/src/routes/prefs.ts`

Mounted at `/api/prefs`.

**`GET /api/prefs/:key`**
1. Requires auth (`requireAuth` middleware — same as data route).
2. Validates key against `ALLOWED_PREF_KEYS`.
3. Reads `hmal-user-prefs/{uid}` document.
4. If the key field is present → return it.
5. If not present (first-ever access) → read the migration seed from the corresponding global `hmal-data` document, write it to the user's pref doc, return it. This is the lazy migration: every user inherits the shared state that existed at rollout.
6. If no global seed exists either → return the in-code default.

**`PUT /api/prefs/:key`**
1. Requires auth.
2. Validates key and value shape against `ALLOWED_PREF_KEYS` / `PREF_VALIDATORS`.
3. Writes `hmal-user-prefs/{uid}` using `set({ value: { [key]: newVal } }, { merge: true })`.
4. Returns `{ ok: true }`.

**Allowed keys and validators:**

| Key | Validator |
|-----|-----------|
| `dashboard-config` | object, not array |
| `idle-timeout` | number between 300 000 and 7 200 000 (5 min – 2 hr) |
| `soldier-table-state` | object with `search: string` and `filters: object` |
| `schedule-table-state` | object with `search: string` and `filters: object` |

**Migration seed mapping** (key → global fallback doc):

| Pref key | Global seed doc |
|----------|----------------|
| `dashboard-config` | `hmal-data/hmal-dashboard-config` |
| `idle-timeout` | none (use in-code default: 900 000 ms) |
| `soldier-table-state` | none (default: `{ search: '', filters: {} }`) |
| `schedule-table-state` | none (default: `{ search: '', filters: {} }`) |

No audit logging for pref changes (personal preferences are not operational data).

### Client Hook — `client/src/hooks/useUserPref.ts`

Same `[value, setValue]` interface as `useFirestore`. Implementation:
- Reads initial value from `localStorage` as cache (keyed `hmal-pref-{key}` to avoid collisions with global keys).
- On mount: fetches `GET /api/prefs/:key`, updates state and cache.
- Polls every 10 s (same cadence as `useFirestore`) for cross-device sync.
- `setValue`: writes to state + cache immediately, fires `PUT /api/prefs/:key`, dispatches `hmal-sync-error` event on failure (same error pattern as `useFirestore`).

### Component Changes

**`App.tsx`**
- `dashboardConfig` / `setDashboardConfig`: switch from `useFirestore('hmal-dashboard-config')` to `useUserPref('dashboard-config')`.
- `soldierSearch` / `setSoldierSearch` and `soldierFilters` / `setSoldierFilters`: removed from App.tsx state entirely. Each child component owns its own state.
- Idle timeout polling loop: currently reads `localStorage.getItem(IDLE_TIMEOUT_KEY)` directly inside `setInterval`. After change: reads from `idleTimeout` state value returned by `useUserPref('idle-timeout')`, passed as a dependency to the `useEffect` via a ref.

**`Settings.tsx`**
- `idleTimeout` state: switch from `localStorage.getItem/setItem` to `useUserPref('idle-timeout')`.
- All other settings tabs: no change.

**`EmployeeList.tsx`**
- Add internal `useUserPref('soldier-table-state')` for `{ search, filters }`.
- Remove `search`, `onSearchChange`, `filters`, `onFiltersChange` props (no longer driven by App.tsx).

**`ScheduleCalendar.tsx`**
- Add internal `useUserPref('schedule-table-state')` for `{ search, filters }`.
- Remove `search`, `onSearchChange`, `filters`, `onFiltersChange` props.

**`MobileApp.tsx` / `MobileSettings.tsx`**
- Same changes as desktop equivalents — `useUserPref` for the same four keys.

## Migration Strategy

Lazy, zero-downtime, no migration script:

1. Deploy server with new `/api/prefs` route and updated client.
2. On first load after deploy, each user's `useUserPref('dashboard-config')` fires `GET /api/prefs/dashboard-config`.
3. Server finds no user pref → reads `hmal-data/hmal-dashboard-config` → writes it to `hmal-user-prefs/{uid}` → returns it.
4. User sees their dashboard exactly as it was. No visible change.
5. From this point, their dashboard config is independent.

New users who sign up after rollout also go through the same flow and inherit whatever the global `hmal-dashboard-config` contains at that time (the frozen shared state from before rollout).

## Security

- The `/api/prefs` route is protected by `requireAuth` — unauthenticated requests get 401.
- The server reads `req.uid` from the verified session cookie; clients cannot request another user's prefs.
- Firestore security rules: `hmal-user-prefs/{uid}` is readable/writable only by the matching authenticated user (protects against direct Firestore client access bypassing the server).
- Key allowlist and shape validators reject unknown keys and malformed values with 400.
- Value size limit: 100 KB per pref key (prefs are small; this prevents abuse).

## Types

Add to `client/src/types.ts`:

```ts
export interface SoldierTableState {
  search: string;
  filters: Record<string, string>;
}

export interface ScheduleTableState {
  search: string;
  filters: Record<string, string>;
}
```

`DashboardConfig` already exists in `types.ts` and is unchanged.
