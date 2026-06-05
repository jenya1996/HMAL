# Per-User Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split settings into per-user preferences (dashboard layout, idle timeout, table search/filters) stored in Firestore under each user's UID, and global shared data (soldiers, columns, task templates) that stays unchanged.

**Architecture:** A new `/api/prefs/:key` server route scopes reads/writes to `req.uid` using a `hmal-user-prefs/{uid}` Firestore collection. A new `useUserPref` client hook mirrors the existing `useFirestore` interface but hits the prefs endpoint. On first access, the server seeds the user's dashboard-config from the existing global document so day-one experience is unchanged.

**Tech Stack:** Express + Firebase Admin SDK (server), React + TypeScript (client), Firestore (storage). Server dev: `cd server && npm run dev` (`tsx watch`). Client dev: `cd client && npm run dev` (Vite). Build check: `cd server && npm run build` and `cd client && npm run build`.

---

### Task 1: Add preference types to `types.ts`

**Files:**
- Modify: `client/src/types.ts` (append at end)

- [ ] **Step 1: Add the two new interfaces**

Append to the bottom of `client/src/types.ts`:

```typescript
export interface SoldierTableState {
  search: string;
  filters: Record<string, string>;
}

export interface ScheduleTableState {
  search: string;
  filters: Record<string, string>;
}
```

- [ ] **Step 2: Verify TypeScript is happy**

```bash
cd client && npm run build
```

Expected: build succeeds (or only fails on pre-existing issues unrelated to this change).

- [ ] **Step 3: Commit**

```bash
git add client/src/types.ts
git commit -m "feat(types): add SoldierTableState and ScheduleTableState"
```

---

### Task 2: Create the server prefs route

**Files:**
- Create: `server/src/routes/prefs.ts`
- Modify: `server/src/index.ts` (mount the route)

- [ ] **Step 1: Create `server/src/routes/prefs.ts`**

```typescript
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { adminDb } from '../lib/firebase-admin';
import { requireAuth } from '../middleware/auth';
import { logger } from '../lib/logger';

const router = Router();
const USER_PREFS_COLLECTION = 'hmal-user-prefs';
const GLOBAL_COLLECTION     = 'hmal-data';

const prefsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  keyGenerator: (req) => (req.cookies as Record<string, string>)?.__session ?? req.ip ?? 'unknown',
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' },
});

const ALLOWED_PREF_KEYS = new Set([
  'dashboard-config',
  'idle-timeout',
  'soldier-table-state',
  'schedule-table-state',
]);

const PREF_VALIDATORS: Record<string, (v: unknown) => boolean> = {
  'dashboard-config':    v => typeof v === 'object' && v !== null && !Array.isArray(v),
  'idle-timeout':        v => typeof v === 'number' && v >= 300_000 && v <= 7_200_000,
  'soldier-table-state':  v => typeof v === 'object' && v !== null && !Array.isArray(v)
                               && 'search' in (v as object) && 'filters' in (v as object),
  'schedule-table-state': v => typeof v === 'object' && v !== null && !Array.isArray(v)
                               && 'search' in (v as object) && 'filters' in (v as object),
};

// For dashboard-config only: seed from global doc on first access
const MIGRATION_SEEDS: Record<string, string> = {
  'dashboard-config': 'hmal-dashboard-config',
};

router.get('/:key', requireAuth, prefsLimiter, async (req, res) => {
  const key = req.params.key;
  if (!ALLOWED_PREF_KEYS.has(key)) { res.status(400).json({ error: 'Invalid key' }); return; }
  const uid = (req as any).uid as string;
  logger.log(`[Prefs] GET uid=${uid} key="${key}"`);
  try {
    const snap    = await adminDb.collection(USER_PREFS_COLLECTION).doc(uid).get();
    const existing = snap.exists ? (snap.data()?.value as Record<string, unknown> | undefined) : undefined;

    if (existing && key in existing) {
      res.json({ value: existing[key] });
      return;
    }

    // First access — try migration seed
    const seedDoc = MIGRATION_SEEDS[key];
    if (seedDoc) {
      const globalSnap = await adminDb.collection(GLOBAL_COLLECTION).doc(seedDoc).get();
      const seedValue  = globalSnap.exists ? (globalSnap.data()?.value ?? null) : null;
      if (seedValue !== null) {
        await adminDb.collection(USER_PREFS_COLLECTION).doc(uid).set(
          { value: { ...(existing ?? {}), [key]: seedValue } },
          { merge: true }
        );
        logger.log(`[Prefs] seeded uid=${uid} key="${key}" from global`);
        res.json({ value: seedValue });
        return;
      }
    }

    res.json({ value: null });
  } catch (err) {
    logger.error(`[Prefs] GET error uid=${uid} key="${key}":`, err);
    res.status(500).json({ error: 'Failed to read preference' });
  }
});

router.put('/:key', requireAuth, prefsLimiter, async (req, res) => {
  const key = req.params.key;
  if (!ALLOWED_PREF_KEYS.has(key)) { res.status(400).json({ error: 'Invalid key' }); return; }
  const value = req.body?.value;
  if (value === undefined) { res.status(400).json({ error: 'Missing value in request body' }); return; }
  const validator = PREF_VALIDATORS[key];
  if (!validator || !validator(value)) { res.status(400).json({ error: 'Invalid value shape for key' }); return; }
  if (JSON.stringify(value).length > 100_000) { res.status(413).json({ error: 'Value too large' }); return; }
  const uid = (req as any).uid as string;
  logger.log(`[Prefs] PUT uid=${uid} key="${key}"`);
  try {
    await adminDb.collection(USER_PREFS_COLLECTION).doc(uid).set(
      { value: { [key]: value } },
      { merge: true }
    );
    res.json({ ok: true });
  } catch (err) {
    logger.error(`[Prefs] PUT error uid=${uid} key="${key}":`, err);
    res.status(500).json({ error: 'Failed to write preference' });
  }
});

export default router;
```

- [ ] **Step 2: Mount the route in `server/src/index.ts`**

Add the import after the existing route imports (around line 8):

```typescript
import prefsRouter from './routes/prefs';
```

Add the mount after `app.use('/api/data', dataRouter);` (around line 53):

```typescript
app.use('/api/prefs', prefsRouter);
```

- [ ] **Step 3: Build the server to verify no TypeScript errors**

```bash
cd server && npm run build
```

Expected: exits with code 0, `dist/` files updated.

- [ ] **Step 4: Smoke-test the endpoint**

Start the server (`npm run dev` in `server/`), then with a valid session cookie:

```
GET /api/prefs/dashboard-config   → { value: <existing global config or null> }
GET /api/prefs/bad-key            → 400 { error: "Invalid key" }
PUT /api/prefs/idle-timeout       body: { value: 900000 } → { ok: true }
PUT /api/prefs/idle-timeout       body: { value: 99 }     → 400 invalid shape
```

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/prefs.ts server/src/index.ts
git commit -m "feat(server): add /api/prefs route for per-user preferences"
```

---

### Task 3: Create `useUserPref` client hook

**Files:**
- Create: `client/src/hooks/useUserPref.ts`

- [ ] **Step 1: Create the hook**

```typescript
import { useState, useEffect, useRef } from 'react';
import { apiFetch } from '../lib/api';

function safeLocalSet(cacheKey: string, value: string) {
  try {
    localStorage.setItem(cacheKey, value);
  } catch (err) {
    console.error('[useUserPref] localStorage write failed:', err);
    window.dispatchEvent(new CustomEvent('hmal-storage-full'));
  }
}

export function useUserPref<T>(key: string, initialValue: T) {
  const cacheKey = `hmal-pref-${key}`;

  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(cacheKey);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const lastSeen = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    function sync() {
      apiFetch<{ value: T | null }>(`/api/prefs/${key}`)
        .then(({ value }) => {
          if (cancelled || value === null) return;
          const serialized = JSON.stringify(value);
          if (serialized !== lastSeen.current) {
            lastSeen.current = serialized;
            setStoredValue(value);
            safeLocalSet(cacheKey, serialized);
          }
        })
        .catch((err) => console.error(`[useUserPref:${key}] sync failed:`, err));
    }

    sync();
    const interval = setInterval(sync, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [key, cacheKey]);

  const setValue = (value: T) => {
    const serialized = JSON.stringify(value);
    lastSeen.current = serialized;
    setStoredValue(value);
    safeLocalSet(cacheKey, serialized);
    apiFetch(`/api/prefs/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value }),
    }).catch((err) => {
      console.error(`[useUserPref:${key}] PUT failed:`, err);
      window.dispatchEvent(new CustomEvent('hmal-sync-error', {
        detail: 'Failed to save preferences. Check your connection and try again.',
      }));
    });
  };

  return [storedValue, setValue] as const;
}
```

- [ ] **Step 2: Build to verify**

```bash
cd client && npm run build
```

Expected: no new TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useUserPref.ts
git commit -m "feat(hooks): add useUserPref hook for per-user synced preferences"
```

---

### Task 4: Switch `dashboardConfig` to `useUserPref` in `App.tsx`

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: Add the import**

In `client/src/App.tsx`, add to the imports at the top:

```typescript
import { useUserPref } from './hooks/useUserPref';
```

- [ ] **Step 2: Replace the `dashboardConfig` hook call**

Find (around line 95):
```typescript
const [dashboardConfig,  setDashboardConfig]  = useFirestore<DashboardConfig>('hmal-dashboard-config', DEFAULT_DASHBOARD_CONFIG);
```

Replace with:
```typescript
const [dashboardConfig,  setDashboardConfig]  = useUserPref<DashboardConfig>('dashboard-config', DEFAULT_DASHBOARD_CONFIG);
```

- [ ] **Step 3: Build and manually verify**

```bash
cd client && npm run build
```

Then start both server and client in dev mode. Log in, toggle a dashboard panel off, then log in as a different user (or open an incognito window) — the panel should still be visible there since each user now has their own config.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx
git commit -m "feat(app): per-user dashboard config via useUserPref"
```

---

### Task 5: Switch idle timeout to `useUserPref`

**Files:**
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/Settings/Settings.tsx`

- [ ] **Step 1: Update `AppContent` in `App.tsx` to read idle timeout from pref**

In `AppContent`, add `useUserPref` for idle timeout (after the existing `useUserPref` for dashboardConfig):

```typescript
const [idleTimeout] = useUserPref<number>('idle-timeout', IDLE_TIMEOUT_DEFAULT);
const idleTimeoutRef = useRef(idleTimeout);
useEffect(() => { idleTimeoutRef.current = idleTimeout; }, [idleTimeout]);
```

Then in the idle-timer `useEffect` (around lines 61–81), replace the localStorage read logic inside `setInterval`:

Find:
```typescript
const stored = localStorage.getItem(IDLE_TIMEOUT_KEY);
const parsed = stored ? parseInt(stored, 10) : IDLE_TIMEOUT_DEFAULT;
const MIN_TIMEOUT = 5 * 60 * 1000;
const MAX_TIMEOUT = 2 * 60 * 60 * 1000;
const timeout = (Number.isFinite(parsed) && parsed >= MIN_TIMEOUT && parsed <= MAX_TIMEOUT)
  ? parsed : IDLE_TIMEOUT_DEFAULT;
if (Date.now() - lastActivity >= timeout) {
```

Replace with:
```typescript
const timeout = idleTimeoutRef.current;
if (Date.now() - lastActivity >= timeout) {
```

Also add `idleTimeout` to the `useEffect` dependency array so React doesn't warn:
```typescript
}, [onSignOut, idleTimeout]);
```

- [ ] **Step 2: Update `Settings.tsx` to use `useUserPref` for idle timeout**

Add import at top of `Settings.tsx`:
```typescript
import { useUserPref } from '../../hooks/useUserPref';
```

Remove the local constants at lines 7–8:
```typescript
const IDLE_TIMEOUT_KEY     = 'hmal-idle-timeout-ms';   // delete this line
const IDLE_TIMEOUT_DEFAULT = 15 * 60 * 1000;           // keep this line
```

Replace the `idleTimeout` state (around line 60–63):
```typescript
// Remove this:
const [idleTimeout, setIdleTimeoutState] = useState<number>(() => {
  const stored = localStorage.getItem(IDLE_TIMEOUT_KEY);
  return stored ? parseInt(stored, 10) : IDLE_TIMEOUT_DEFAULT;
});

// Replace with:
const [idleTimeout, setIdleTimeoutPref] = useUserPref<number>('idle-timeout', IDLE_TIMEOUT_DEFAULT);
```

Replace `handleTimeoutChange` (around lines 66–71):
```typescript
// Remove this:
function handleTimeoutChange(ms: number) {
  localStorage.setItem(IDLE_TIMEOUT_KEY, String(ms));
  setIdleTimeoutState(ms);
  setTimeoutSaved(true);
  setTimeout(() => setTimeoutSaved(false), 2000);
}

// Replace with:
function handleTimeoutChange(ms: number) {
  setIdleTimeoutPref(ms);
  setTimeoutSaved(true);
  setTimeout(() => setTimeoutSaved(false), 2000);
}
```

- [ ] **Step 3: Build and verify**

```bash
cd client && npm run build
```

Start dev servers. In Settings → General, change the Auto Sign-Out timeout. Verify the selection persists after page refresh. Verify a second user's timeout is independent.

- [ ] **Step 4: Commit**

```bash
git add client/src/App.tsx client/src/components/Settings/Settings.tsx
git commit -m "feat(settings): per-user idle timeout via useUserPref"
```

---

### Task 6: Move soldier table state into `EmployeeList`

Removes `search`/`onSearchChange`/`filters`/`onFiltersChange` props from `EmployeeList`. The component now owns this state via `useUserPref`. Callers (`App.tsx` and `MobileApp.tsx`) stop passing those four props.

**Files:**
- Modify: `client/src/components/Employees/EmployeeList.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/mobile/MobileApp.tsx`

- [ ] **Step 1: Update `EmployeeList.tsx` — remove props, add internal pref state**

Add imports at top:
```typescript
import { useUserPref } from '../../hooks/useUserPref';
import { SoldierTableState } from '../../types';
```

Remove the four props from the interface:
```typescript
// Remove these four lines from EmployeeListProps:
search: string;
onSearchChange: (v: string) => void;
filters: Record<string, string>;
onFiltersChange: (f: Record<string, string>) => void;
```

Remove them from the destructured function signature:
```typescript
// Before:
export default function EmployeeList({ employees, departments, columnDefs, onUpdate, onDeleteSoldiers, search, onSearchChange, filters, onFiltersChange }: EmployeeListProps)

// After:
export default function EmployeeList({ employees, departments, columnDefs, onUpdate, onDeleteSoldiers }: EmployeeListProps)
```

Add internal pref state at the top of the function body (after existing `useState` declarations):
```typescript
const [tableState, setTableState] = useUserPref<SoldierTableState>(
  'soldier-table-state',
  { search: '', filters: {} }
);
const search  = tableState.search;
const filters = tableState.filters;
function onSearchChange(v: string)              { setTableState({ ...tableState, search: v }); }
function onFiltersChange(f: Record<string, string>) { setTableState({ ...tableState, filters: f }); }
```

- [ ] **Step 2: Update `App.tsx` — stop passing the four props to `EmployeeList`**

Find the `<EmployeeList` JSX block (around line 239) and remove these four props:
```typescript
// Remove:
search={soldierSearch}
onSearchChange={setSoldierSearch}
filters={soldierFilters}
onFiltersChange={setSoldierFilters}
```

- [ ] **Step 3: Update `MobileApp.tsx` — stop passing the four props to `EmployeeList`**

Find the `<EmployeeList` JSX block (around line 134) and remove:
```typescript
// Remove:
search={soldierSearch}
onSearchChange={setSoldierSearch}
filters={soldierFilters}
onFiltersChange={setSoldierFilters}
```

- [ ] **Step 4: Build**

```bash
cd client && npm run build
```

Fix any remaining TypeScript errors (there should be none if the above changes are complete).

- [ ] **Step 5: Verify manually**

Start dev server. On the Soldiers page, set a search term and filter. Refresh the page — they should persist. Log in as another user — they should have independent filters.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Employees/EmployeeList.tsx client/src/App.tsx client/src/components/mobile/MobileApp.tsx
git commit -m "feat(soldiers): per-user persisted search and filters"
```

---

### Task 7: Move schedule table state into `ScheduleCalendar`; clean up shared state in `App.tsx` and `MobileApp.tsx`

Removes `search`/`onSearchChange`/`filters`/`onFiltersChange` props from `ScheduleCalendar`. The component now owns this state and does its own filtering (currently App.tsx pre-filters and passes `filteredEmployees`; after this change it receives full `employees` and filters internally). `App.tsx` and `MobileApp.tsx` remove their `soldierSearch`/`soldierFilters` state entirely.

**Files:**
- Modify: `client/src/components/Schedule/ScheduleCalendar.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/components/mobile/MobileApp.tsx`

- [ ] **Step 1: Update `ScheduleCalendar.tsx` — remove props, add internal pref state, add internal filtering**

Add imports at top:
```typescript
import { useUserPref } from '../../hooks/useUserPref';
import { ScheduleTableState } from '../../types';
import { matchesFilters } from '../../lib/employeeFilters';
```

Remove the four props from `ScheduleCalendarProps`:
```typescript
// Remove these four lines:
search: string;
onSearchChange: (v: string) => void;
filters: Record<string, string>;
onFiltersChange: (f: Record<string, string>) => void;
```

Update the function signature:
```typescript
// Before:
export default function ScheduleCalendar({ employees, schedule, onUpdate, columnDefs, search, onSearchChange, filters, onFiltersChange }: ScheduleCalendarProps)

// After:
export default function ScheduleCalendar({ employees, schedule, onUpdate, columnDefs }: ScheduleCalendarProps)
```

Add internal pref state and filtering at the top of the function body:
```typescript
const [tableState, setTableState] = useUserPref<ScheduleTableState>(
  'schedule-table-state',
  { search: '', filters: {} }
);
const search  = tableState.search;
const filters = tableState.filters;
function onSearchChange(v: string)                   { setTableState({ ...tableState, search: v }); }
function onFiltersChange(f: Record<string, string>)  { setTableState({ ...tableState, filters: f }); }

// Filter employees locally (previously done by App.tsx via filteredEmployees)
const filteredEmployees = employees.filter(e => {
  const q = search.toLowerCase();
  const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
  return matchSearch && matchesFilters(e, filters, columnDefs);
});
```

Then anywhere in the component body that uses `employees` to render the calendar rows, replace with `filteredEmployees`. Search for direct uses of the `employees` prop in the render/computation sections (not the prop declaration) and switch them to `filteredEmployees`.

> **Note:** The existing component already has an `employees` param used throughout — after adding the internal `filteredEmployees`, the calendar rendering sections should reference `filteredEmployees` for the soldier list, while `employees` (full list) can remain for the summary counters if they should count all soldiers regardless of filter.

- [ ] **Step 2: Update `App.tsx` — pass full `employees` to ScheduleCalendar; remove shared search/filter state**

In `App.tsx`, locate the `<ScheduleCalendar` JSX (around line 251) and:

1. Change `employees={filteredEmployees}` → `employees={employees}`
2. Remove the four props:
   ```typescript
   // Remove:
   search={soldierSearch}
   onSearchChange={setSoldierSearch}
   filters={soldierFilters}
   onFiltersChange={setSoldierFilters}
   ```

Remove the shared soldier search/filter state (lines 83–84):
```typescript
// Remove:
const [soldierSearch,  setSoldierSearch]  = useState('');
const [soldierFilters, setSoldierFilters] = useState<Record<string, string>>({});
```

Remove the `filteredEmployees` memo (lines 129–135):
```typescript
// Remove:
const filteredEmployees = useMemo(() => employees.filter(e => {
  const q = soldierSearch.toLowerCase();
  const matchSearch = !q ||
    e.name.toLowerCase().includes(q) ||
    (e.email ?? '').toLowerCase().includes(q);
  return matchSearch && matchesFilters(e, soldierFilters, columnDefs);
}), [employees, soldierSearch, soldierFilters, columnDefs]);
```

Remove `useMemo` from the React import if it's no longer used anywhere else. Check other usages before removing.

Remove the `matchesFilters` import if no longer used in `App.tsx`:
```typescript
// Check and remove if unused:
import { matchesFilters } from './lib/employeeFilters';
```

- [ ] **Step 3: Update `MobileApp.tsx` — pass full `employees` to ScheduleCalendar; remove local search/filter state**

Find the `<ScheduleCalendar` block (around line 147) and:
1. Change `employees={filteredEmployees}` → `employees={employees}`
2. Remove:
   ```typescript
   search={soldierSearch}
   onSearchChange={setSoldierSearch}
   filters={soldierFilters}
   onFiltersChange={setSoldierFilters}
   ```

Remove the `soldierSearch`/`soldierFilters` state (around lines 73–74):
```typescript
// Remove:
const [soldierSearch,  setSoldierSearch]  = useState('');
const [soldierFilters, setSoldierFilters] = useState<Record<string, string>>({});
```

Remove the `filteredEmployees` computation (around lines 76–80):
```typescript
// Remove:
const filteredEmployees = employees.filter(e => {
  const q = soldierSearch.toLowerCase();
  const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
  return matchSearch && matchesFilters(e, soldierFilters, columnDefs);
});
```

Remove unused imports (`matchesFilters`) if applicable.

- [ ] **Step 4: Build**

```bash
cd client && npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 5: Verify manually**

Start dev servers. On the Schedule page:
- Set a search term — it should filter the calendar rows.
- Refresh — the search/filter persists.
- Log in as a different user — they have independent schedule filters.

Also confirm the Soldiers page still works correctly (its own independent persisted filters).

- [ ] **Step 6: Commit**

```bash
git add client/src/components/Schedule/ScheduleCalendar.tsx client/src/App.tsx client/src/components/mobile/MobileApp.tsx
git commit -m "feat(schedule): per-user persisted search and filters; remove shared filter state"
```

---

### Task 8: Full build, QA checklist, and deploy

**Files:** No code changes — build, test, deploy.

- [ ] **Step 1: Production build (both)**

```bash
cd server && npm run build
cd client && npm run build
```

Both must exit with code 0.

- [ ] **Step 2: QA checklist**

Log in as **User A**:
- [ ] Dashboard: toggle a stat card off — confirm it disappears
- [ ] Refresh — stat card still off
- [ ] Change idle timeout to 5 minutes — confirm selection is highlighted
- [ ] Soldiers page: set a search term and a filter — confirm results filter
- [ ] Refresh — search/filter persist
- [ ] Schedule page: set a search term — confirm calendar filters
- [ ] Refresh — search/filter persist

Log in as **User B** (different account / incognito):
- [ ] Dashboard: stat card toggled off by User A is **still visible** here — independent config confirmed
- [ ] Soldiers page: no search/filter carried over from User A
- [ ] Schedule page: no search/filter carried over from User A

Log in as User A again:
- [ ] All User A preferences are exactly as left — cross-device sync confirmed

- [ ] **Step 3: Deploy**

```bash
# From the project root
firebase deploy
```

Expected: Firebase hosting + server deploy succeeds. Confirm the live URL loads, auth works, and a fresh login inherits the correct preferences.

- [ ] **Step 4: Final commit (if any post-build fixes were needed)**

```bash
git add -A
git commit -m "chore: post-QA fixes for per-user settings"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✓ `/api/prefs` route with GET/PUT — Task 2
- ✓ `useUserPref` hook — Task 3
- ✓ `dashboard-config` per-user — Task 4
- ✓ `idle-timeout` per-user — Task 5
- ✓ Soldier table search/filters per-user — Task 6
- ✓ Schedule table search/filters per-user — Task 7
- ✓ Migration seed (first GET reads global and saves to user doc) — Task 2, Step 1
- ✓ Per-user Firestore isolation (req.uid scoping) — Task 2
- ✓ Key allowlist + shape validators — Task 2
- ✓ 100 KB size limit — Task 2
- ✓ localStorage cache with `hmal-pref-` prefix — Task 3
- ✓ `hmal-user-prefs` collection — Task 2
- ✓ Mobile: EmployeeList and ScheduleCalendar used in MobileApp — Tasks 6, 7
- ✓ Deploy after QA — Task 8
