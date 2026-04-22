import { useState, useEffect } from 'react';
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

function AppContent() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [employees,        setEmployees]        = useFirestore<Employee[]>('hmal-soldiers-v2', SAMPLE_EMPLOYEES);
  const [schedule,         setSchedule]         = useFirestore<ScheduleData>('hmal-schedule', {});
  const [columnDefs,       setColumnDefs]       = useFirestore<ColumnDef[]>('hmal-columns-v1', DEFAULT_COLUMNS);
  const [taskTemplates,    setTaskTemplates]    = useFirestore<TaskTemplate[]>('hmal-task-templates', []);
  const [taskAssignments,  setTaskAssignments]  = useFirestore<TaskAssignments>('hmal-task-assignments', {});
  const [taskRoles,        setTaskRoles]        = useFirestore<TaskRoles>('hmal-task-roles', {});
  const [taskGroups,       setTaskGroups]       = useFirestore<TaskGroup[]>('hmal-task-groups', []);

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
        <Header title={pageTitles[currentPage]} />
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
            />
          )}
          {currentPage === 'schedule' && (
            <ScheduleCalendar
              employees={employees}
              schedule={schedule}
              onUpdate={setSchedule}
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
  return <AppContent />;
}
