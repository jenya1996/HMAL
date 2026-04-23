import { useState, useEffect, useRef } from 'react';
import { apiFetch } from './lib/api';
import LoginPage from './components/Auth/LoginPage';
import { Employee, ColumnDef, DEFAULT_COLUMNS, TaskTemplate, TaskAssignments, TaskRoles, TaskGroup } from './types';
import { useFirestore } from './hooks/useFirestore';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeList from './components/Employees/EmployeeList';
import ScheduleCalendar, { ScheduleData } from './components/Schedule/ScheduleCalendar';
import Tasks from './components/Tasks/Tasks';
import Settings from './components/Settings/Settings';

const SAMPLE_EMPLOYEES: Employee[] = [
  { id: 'e1',  name: 'Mark Goloshapov',  email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e2',  name: 'Tim McCain',       email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e3',  name: 'Yevgeny Glushko',  email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e4',  name: 'Tomer Cassuto',    email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e5',  name: 'Gil Haddad',       email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e6',  name: 'Danny Kogan',      email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e7',  name: 'Yehuda Vashdi',    email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e8',  name: 'Alex Zvir',        email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e9',  name: 'Shahar Carnieli',  email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e10', name: 'Aaron Rose',       email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e11', name: 'Eliran Chevra',    email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e12', name: 'Douglas Balta',    email: '', department: '', position: '', startDate: '', status: 'Active' },
  { id: 'e13', name: 'Denis Yatzmaniov', email: '', department: '', position: '', startDate: '', status: 'Active' },
];

type Page = 'dashboard' | 'employees' | 'schedule' | 'tasks' | 'settings';

function AppContent({ onSignOut }: { onSignOut: () => void }) {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [soldierSearch,    setSoldierSearch]    = useState('');
  const [soldierFilterDept, setSoldierFilterDept] = useState('');
  const [employees,        setEmployees]        = useFirestore<Employee[]>('hmal-soldiers-v2', SAMPLE_EMPLOYEES);
  const [schedule,         setSchedule]         = useFirestore<ScheduleData>('hmal-schedule', {});
  const [columnDefs,       setColumnDefs]       = useFirestore<ColumnDef[]>('hmal-columns-v1', DEFAULT_COLUMNS);
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
  const [taskTemplates,    setTaskTemplates]    = useFirestore<TaskTemplate[]>('hmal-task-templates', []);
  const [taskAssignments,  setTaskAssignments]  = useFirestore<TaskAssignments>('hmal-task-assignments', {});
  const [taskRoles,        setTaskRoles]        = useFirestore<TaskRoles>('hmal-task-roles', {});
  const [taskGroups,       setTaskGroups]       = useFirestore<TaskGroup[]>('hmal-task-groups', []);

  const deptCol = columnDefs.find(c => c.key === 'department');
  const deptOptions = deptCol?.options ?? [];

  const filteredEmployees = employees.filter(e => {
    const q = soldierSearch.toLowerCase();
    const matchSearch = !q ||
      e.name.toLowerCase().includes(q) ||
      (e.email ?? '').toLowerCase().includes(q);
    const matchDept = !soldierFilterDept || e.department === soldierFilterDept;
    return matchSearch && matchDept;
  });

  const pageTitles: Record<Page, string> = {
    dashboard: 'Dashboard',
    employees: 'Soldiers',
    schedule:  'Schedule',
    tasks:     'Tasks',
    settings:  'Settings',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title={pageTitles[currentPage]} onSignOut={onSignOut} />
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
              search={soldierSearch}
              onSearchChange={setSoldierSearch}
              filterDept={soldierFilterDept}
              onFilterDeptChange={setSoldierFilterDept}
              deptOptions={deptOptions}
            />
          )}
          {currentPage === 'schedule' && (
            <ScheduleCalendar
              employees={filteredEmployees}
              schedule={schedule}
              onUpdate={setSchedule}
              search={soldierSearch}
              onSearchChange={setSoldierSearch}
              filterDept={soldierFilterDept}
              onFilterDeptChange={setSoldierFilterDept}
              deptOptions={deptOptions}
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
          {currentPage === 'settings' && (
            <Settings
              columnDefs={columnDefs}
              onUpdateColumns={setColumnDefs}
              taskTemplates={taskTemplates}
              onUpdateTaskTemplates={setTaskTemplates}
              taskGroups={taskGroups}
              onUpdateTaskGroups={setTaskGroups}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  const [authed, setAuthed] = useState<boolean | 'loading'>('loading');

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  if (authed === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0f172a' }}>
        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  if (!authed) return <LoginPage onLogin={() => setAuthed(true)} />;
  return <AppContent onSignOut={() => setAuthed(false)} />;
}
