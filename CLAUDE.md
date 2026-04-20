# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server
npm run build     # tsc && vite build (TypeScript compile + production bundle)
npm run preview   # Preview production build locally
```

No test or lint scripts are configured.

## Architecture

**Stack:** React 18 + TypeScript 5 + Vite 4. Single-page app with all data stored in browser localStorage.

**Routing:** No router library. `currentPage` state in `App.tsx` is a string enum (`'dashboard' | 'employees' | 'schedule' | 'tasks' | 'settings'`). Sidebar updates it; App.tsx conditionally renders the matching component.

**State management:** Custom `useLocalStorage` hook (`src/hooks/useLocalStorage.ts`) wraps `useState` with automatic JSON persistence. All top-level state lives in `App.tsx` and flows down via props; callbacks flow back up. Storage keys are versioned (e.g., `hmal-soldiers-v2`) to handle schema migrations.

**Styling:** Mostly inline styles. `index.css` handles global resets only. No CSS-in-JS library.

## Key Data Models (`src/types.ts`)

| Type | Structure | Notes |
|------|-----------|-------|
| `Employee` | `{ id, name, department, position, status, role?, customFields? }` | `status` can be `'Active' \| 'Inactive' \| 'Annexation'` |
| `ScheduleData` | `Record<employeeId, Record<dateKey, CellStatus>>` | `dateKey` is `'YYYY-MM-DD'`; `CellStatus` includes `'on-base' \| 'home-leave' \| 'departed' \| 'returning' \| 'absent'` |
| `TaskTemplate` | `{ id, name, startTime, endTime, requiredSoldiers, certifications[], groupId? }` | Times in `"HH:MM"` 24-hour format |
| `TaskAssignments` | `Record<templateId, Record<dateKey, empId[]>>` | Which soldiers are assigned per task per day |
| `TaskRoles` | `Record<templateId, Record<dateKey, Record<empId, certName>>>` | Which certification slot each soldier fills |
| `TaskGroup` | `{ id, name, intervalHours }` | Enforces minimum rest between tasks in the same group |
| `ColumnDef` | `{ key, label, visible, builtin, fieldType?, options? }` | Drives dynamic columns in the soldier table |

## Notable Behaviors

- **Schedule auto-markers:** When a `'home-leave'` block is saved, the app automatically inserts `'departed'` and `'returning'` status cells on the boundary days.
- **CSV import:** `EmployeeList` parses uploaded CSV files to bulk-import soldier records.
- **Dynamic columns:** Users can add custom columns (text, number, dropdown, multiselect) to the soldier table via Settings. These are stored in `ColumnDef[]` and rendered generically.
- **Cert-based task assignment:** Tasks declare required certifications; when a soldier is assigned, `TaskRoles` records which cert slot they fill.
- **Unused components:** `src/components/Leaves/` and `src/components/Departments/` exist but are not wired into the app.
