import { useState, useEffect, useRef } from 'react';
import { apiFetch } from './lib/api';
import LoginPage from './components/Auth/LoginPage';
import { Employee, ColumnDef, DEFAULT_COLUMNS, TaskTemplate, TaskAssignments, TaskRoles, TaskGroup } from './types';
import { matchesFilters } from './lib/employeeFilters';
import { useFirestore } from './hooks/useFirestore';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeList from './components/Employees/EmployeeList';
import ScheduleCalendar, { ScheduleData } from './components/Schedule/ScheduleCalendar';
import Tasks from './components/Tasks/Tasks';
import Settings from './components/Settings/Settings';
import AdminPage from './components/Admin/AdminPage';
import MobileApp from './components/mobile/MobileApp';
import { ErrorBoundary } from './components/ErrorBoundary';

const HMAL_STORAGE_KEYS = [
  'hmal-soldiers-v2', 'hmal-schedule', 'hmal-columns-v1',
  'hmal-task-templates', 'hmal-task-assignments', 'hmal-task-roles',
  'hmal-task-groups', 'hmal-cert-source-col',
];

export const IDLE_TIMEOUT_KEY     = 'hmal-idle-timeout-ms';
export const IDLE_TIMEOUT_DEFAULT = 15 * 60 * 1000; // 15 minutes


type Page = 'dashboard' | 'employees' | 'schedule' | 'tasks' | 'admin' | 'settings';

const VALID_PAGES: Page[] = ['dashboard', 'employees', 'schedule', 'tasks', 'admin', 'settings'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return isMobile;
}

function AppContent({ onSignOut, isAdmin }: { onSignOut: () => void; isAdmin: boolean }) {
  const isMobile = useIsMobile();

  const [currentPage, setCurrentPageState] = useState<Page>(() => {
    const saved = sessionStorage.getItem('hmal-current-page') as Page | null;
    if (saved && VALID_PAGES.includes(saved)) {
      // Non-admins can't land on admin page after reload
      if (saved === 'admin' && !isAdmin) return 'dashboard';
      return saved;
    }
    return 'dashboard';
  });

  function setCurrentPage(page: Page) {
    sessionStorage.setItem('hmal-current-page', page);
    setCurrentPageState(page);
  }

  // Auto-logout after configurable idle period (reads localStorage each tick so changes apply immediately)
  useEffect(() => {
    let lastActivity = Date.now();
    const resetTimer = () => { lastActivity = Date.now(); };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));

    const interval = setInterval(() => {
      const stored = localStorage.getItem(IDLE_TIMEOUT_KEY);
      const parsed = stored ? parseInt(stored, 10) : IDLE_TIMEOUT_DEFAULT;
      const MIN_TIMEOUT = 5 * 60 * 1000;
      const MAX_TIMEOUT = 2 * 60 * 60 * 1000;
      const timeout = (Number.isFinite(parsed) && parsed >= MIN_TIMEOUT && parsed <= MAX_TIMEOUT)
        ? parsed
        : IDLE_TIMEOUT_DEFAULT;
      if (Date.now() - lastActivity >= timeout) {
        apiFetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
        onSignOut();
      }
    }, 30_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      clearInterval(interval);
    };
  }, [onSignOut]);
  const [soldierSearch,  setSoldierSearch]  = useState('');
  const [soldierFilters, setSoldierFilters] = useState<Record<string, string>>({});
  const [syncError,         setSyncError]         = useState<string | null>(null);
  const [storageWarning,    setStorageWarning]    = useState(false);

  const [employees,       setEmployees]       = useFirestore<Employee[]>('hmal-soldiers-v2', []);
  const [schedule,        setSchedule]        = useFirestore<ScheduleData>('hmal-schedule', {});
  const [columnDefs,      setColumnDefs]      = useFirestore<ColumnDef[]>('hmal-columns-v1', DEFAULT_COLUMNS);
  const migratedDept = useRef(false);
  useEffect(() => {
    if (migratedDept.current || columnDefs.length === 0) return;
    if (!columnDefs.find(c => c.key === 'department')) {
      migratedDept.current = true;
      const deptCol: ColumnDef = {
        key: 'department', label: 'Department', visible: true, builtin: true,
        fieldType: 'dropdown',
        options: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
        optionColors: { Alpha: '#dbeafe', Bravo: '#dcfce7', Charlie: '#fef9c3', Delta: '#fce7f3' },
      };
      const statusIdx = columnDefs.findIndex(c => c.key === 'status');
      const next = [...columnDefs];
      next.splice(statusIdx >= 0 ? statusIdx : next.length, 0, deptCol);
      setColumnDefs(next);
    }
  }, [columnDefs]);

  const [taskTemplates,   setTaskTemplates]   = useFirestore<TaskTemplate[]>('hmal-task-templates', []);
  const [taskAssignments, setTaskAssignments] = useFirestore<TaskAssignments>('hmal-task-assignments', {});
  const [taskRoles,       setTaskRoles]       = useFirestore<TaskRoles>('hmal-task-roles', {});
  const [taskGroups,      setTaskGroups]      = useFirestore<TaskGroup[]>('hmal-task-groups', []);

  // Listen for Firestore write failures and localStorage quota errors
  useEffect(() => {
    const onSyncError = (e: Event) => {
      setSyncError((e as CustomEvent<string>).detail);
      setTimeout(() => setSyncError(null), 6000);
    };
    const onStorageFull = () => setStorageWarning(true);
    window.addEventListener('hmal-sync-error', onSyncError);
    window.addEventListener('hmal-storage-full', onStorageFull);
    return () => {
      window.removeEventListener('hmal-sync-error', onSyncError);
      window.removeEventListener('hmal-storage-full', onStorageFull);
    };
  }, []);

  const filteredEmployees = employees.filter(e => {
    const q = soldierSearch.toLowerCase();
    const matchSearch = !q ||
      e.name.toLowerCase().includes(q) ||
      (e.email ?? '').toLowerCase().includes(q);
    return matchSearch && matchesFilters(e, soldierFilters, columnDefs);
  });

  function handleDeleteSoldiers(ids: string[]) {
    const idsSet = new Set(ids);
    setEmployees(employees.filter(e => !idsSet.has(e.id)));

    const newSchedule = Object.fromEntries(
      Object.entries(schedule).filter(([empId]) => !idsSet.has(empId))
    ) as ScheduleData;
    setSchedule(newSchedule);

    const newAssignments = Object.fromEntries(
      Object.entries(taskAssignments).map(([tplId, dates]) => [
        tplId,
        Object.fromEntries(
          Object.entries(dates).map(([date, empIds]) => [
            date,
            empIds.filter(id => !idsSet.has(id)),
          ])
        ),
      ])
    ) as TaskAssignments;
    setTaskAssignments(newAssignments);

    const newRoles = Object.fromEntries(
      Object.entries(taskRoles).map(([tplId, dates]) => [
        tplId,
        Object.fromEntries(
          Object.entries(dates).map(([date, roleMap]) => [
            date,
            Object.fromEntries(
              Object.entries(roleMap).filter(([empId]) => !idsSet.has(empId))
            ),
          ])
        ),
      ])
    ) as TaskRoles;
    setTaskRoles(newRoles);
  }

  const pageTitles: Record<Page, string> = {
    dashboard: 'Dashboard',
    employees: 'Soldiers',
    schedule:  'Schedule',
    tasks:     'Tasks',
    admin:     'Admin',
    settings:  'Settings',
  };

  if (isMobile) {
    return (
      <MobileApp
        employees={employees}
        schedule={schedule}
        columnDefs={columnDefs}
        taskTemplates={taskTemplates}
        taskAssignments={taskAssignments}
        taskRoles={taskRoles}
        taskGroups={taskGroups}
        isAdmin={isAdmin}
        onUpdateSchedule={setSchedule}
        onUpdateAssignments={setTaskAssignments}
        onUpdateRoles={setTaskRoles}
        onUpdateEmployees={setEmployees}
        onDeleteSoldiers={handleDeleteSoldiers}
        onUpdateColumns={setColumnDefs}
        onUpdateTaskTemplates={setTaskTemplates}
        onUpdateTaskGroups={setTaskGroups}
        onSignOut={onSignOut}
      />
    );
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} isAdmin={isAdmin} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title={pageTitles[currentPage]} onSignOut={onSignOut} />

        {/* Sync error banner */}
        {syncError && (
          <div style={{ padding: '10px 20px', background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#dc2626', fontSize: '13px', fontWeight: '500', display: 'flex', justifyContent: 'space-between' }}>
            <span>⚠ {syncError}</span>
            <button onClick={() => setSyncError(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: '700' }}>×</button>
          </div>
        )}
        {storageWarning && (
          <div style={{ padding: '10px 20px', background: '#fffbeb', borderBottom: '1px solid #fde68a', color: '#92400e', fontSize: '13px', fontWeight: '500', display: 'flex', justifyContent: 'space-between' }}>
            <span>⚠ Browser storage is full. Export your data and clear old records to free space.</span>
            <button onClick={() => setStorageWarning(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#92400e', fontWeight: '700' }}>×</button>
          </div>
        )}

        <main style={{ flex: 1, overflow: 'hidden', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          {currentPage === 'dashboard' && (
            <Dashboard employees={employees} />
          )}
          {currentPage === 'employees' && (
            <EmployeeList
              employees={employees}
              departments={[]}
              columnDefs={columnDefs}
              onUpdate={setEmployees}
              onDeleteSoldiers={handleDeleteSoldiers}
              search={soldierSearch}
              onSearchChange={setSoldierSearch}
              filters={soldierFilters}
              onFiltersChange={setSoldierFilters}
            />
          )}
          {currentPage === 'schedule' && (
            <ScheduleCalendar
              employees={filteredEmployees}
              schedule={schedule}
              onUpdate={setSchedule}
              columnDefs={columnDefs}
              search={soldierSearch}
              onSearchChange={setSoldierSearch}
              filters={soldierFilters}
              onFiltersChange={setSoldierFilters}
            />
          )}
          {currentPage === 'tasks' && (
            <Tasks
              employees={employees}
              schedule={schedule}
              taskTemplates={taskTemplates}
              taskAssignments={taskAssignments}
              taskRoles={taskRoles}
              taskGroups={taskGroups}
              onUpdateAssignments={setTaskAssignments}
              onUpdateRoles={setTaskRoles}
            />
          )}
          {currentPage === 'admin' && isAdmin && (
            <AdminPage employees={employees} isAdmin={isAdmin} />
          )}
          {currentPage === 'settings' && (
            <Settings
              columnDefs={columnDefs}
              onUpdateColumns={setColumnDefs}
              taskTemplates={taskTemplates}
              onUpdateTaskTemplates={setTaskTemplates}
              taskGroups={taskGroups}
              onUpdateTaskGroups={setTaskGroups}
              employees={employees}
              onUpdateEmployees={setEmployees}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [authed,  setAuthed]  = useState<boolean | 'loading'>('loading');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiFetch<{ uid: string; admin?: boolean }>('/api/auth/me')
      .then(({ admin }) => { setAuthed(true); setIsAdmin(!!admin); })
      .catch(() => setAuthed(false));
  }, []);

  function handleSignOut() {
    HMAL_STORAGE_KEYS.forEach(k => {
      try { localStorage.removeItem(k); } catch { /* ignore */ }
    });
    setAuthed(false);
    setIsAdmin(false);
  }

  if (authed === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }}>
        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  function handleLogin() {
    apiFetch<{ uid: string; admin?: boolean }>('/api/auth/me')
      .then(({ admin }) => { setAuthed(true); setIsAdmin(!!admin); })
      .catch(() => { setAuthed(false); setIsAdmin(false); });
  }

  if (!authed) return <LoginPage onLogin={handleLogin} />;
  return (
    <ErrorBoundary>
      <AppContent onSignOut={handleSignOut} isAdmin={isAdmin} />
    </ErrorBoundary>
  );
}
