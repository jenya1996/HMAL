import { useState } from 'react';
import { Employee, ColumnDef, TaskTemplate, TaskAssignments, TaskRoles, TaskGroup } from '../../types';
import { ScheduleData } from '../Schedule/ScheduleCalendar';
import { matchesFilters } from '../../lib/employeeFilters';
import MobileDashboard from './MobileDashboard';
import MobileAdmin from './MobileAdmin';
import EmployeeList from '../Employees/EmployeeList';
import ScheduleCalendar from '../Schedule/ScheduleCalendar';
import Tasks from '../Tasks/Tasks';
import Settings from '../Settings/Settings';

type MobilePage = 'dashboard' | 'soldiers' | 'schedule' | 'tasks' | 'settings' | 'admin';

export interface MobileAppProps {
  employees: Employee[];
  schedule: ScheduleData;
  columnDefs: ColumnDef[];
  taskTemplates: TaskTemplate[];
  taskAssignments: TaskAssignments;
  taskRoles: TaskRoles;
  taskGroups: TaskGroup[];
  isAdmin: boolean;
  onUpdateSchedule: (s: ScheduleData) => void;
  onUpdateAssignments: (a: TaskAssignments) => void;
  onUpdateRoles: (r: TaskRoles) => void;
  onUpdateEmployees: (e: Employee[]) => void;
  onDeleteSoldiers: (ids: string[]) => void;
  onUpdateColumns: (c: ColumnDef[]) => void;
  onUpdateTaskTemplates: (t: TaskTemplate[]) => void;
  onUpdateTaskGroups: (g: TaskGroup[]) => void;
  onSignOut: () => void;
}

interface NavItem { id: MobilePage; label: string; icon: string }

const BASE_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home',     icon: '🏠' },
  { id: 'soldiers',  label: 'Soldiers', icon: '🪖' },
  { id: 'schedule',  label: 'Schedule', icon: '📅' },
  { id: 'tasks',     label: 'Tasks',    icon: '✅' },
  { id: 'settings',  label: 'Settings', icon: '⚙️' },
];
const ADMIN_NAV: NavItem = { id: 'admin', label: 'Admin', icon: '🛡️' };

const PAGE_TITLES: Record<MobilePage, string> = {
  dashboard: 'Dashboard',
  soldiers:  'Soldiers',
  schedule:  'Schedule',
  tasks:     'Tasks',
  settings:  'Settings',
  admin:     'Admin',
};

export default function MobileApp({
  employees, schedule, columnDefs, taskTemplates, taskAssignments, taskRoles, taskGroups,
  isAdmin,
  onUpdateSchedule, onUpdateAssignments, onUpdateRoles, onUpdateEmployees, onDeleteSoldiers,
  onUpdateColumns, onUpdateTaskTemplates, onUpdateTaskGroups,
  onSignOut,
}: MobileAppProps) {
  const [page, setPage] = useState<MobilePage>('dashboard');
  const [soldierSearch,  setSoldierSearch]  = useState('');
  const [soldierFilters, setSoldierFilters] = useState<Record<string, string>>({});

  const filteredEmployees = employees.filter(e => {
    const q = soldierSearch.toLowerCase();
    const matchSearch = !q || e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
    return matchSearch && matchesFilters(e, soldierFilters, columnDefs);
  });

  const navItems: NavItem[] = isAdmin ? [...BASE_NAV, ADMIN_NAV] : BASE_NAV;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#f8fafc', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div style={{
        background: '#1e293b', color: 'white',
        paddingLeft: '16px', paddingRight: '16px',
        height: '56px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
        boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        paddingTop: 'env(safe-area-inset-top)',
      }}>
        <div style={{ fontWeight: '700', fontSize: '17px', letterSpacing: '-0.3px' }}>
          {PAGE_TITLES[page]}
        </div>
        <button onClick={onSignOut} style={{
          background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '8px', color: 'white', padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
        }}>
          Sign out
        </button>
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: page !== 'dashboard' && page !== 'admin' ? '12px' : '0' }}>
        {page === 'dashboard' && <MobileDashboard employees={employees} schedule={schedule} />}
        {page === 'soldiers' && (
          <EmployeeList
            employees={employees}
            departments={[]}
            columnDefs={columnDefs}
            onUpdate={onUpdateEmployees}
            onDeleteSoldiers={onDeleteSoldiers}
            search={soldierSearch}
            onSearchChange={setSoldierSearch}
            filters={soldierFilters}
            onFiltersChange={setSoldierFilters}
          />
        )}
        {page === 'schedule' && (
          <ScheduleCalendar
            employees={filteredEmployees}
            schedule={schedule}
            onUpdate={onUpdateSchedule}
            columnDefs={columnDefs}
            search={soldierSearch}
            onSearchChange={setSoldierSearch}
            filters={soldierFilters}
            onFiltersChange={setSoldierFilters}
          />
        )}
        {page === 'tasks' && (
          <Tasks
            employees={employees}
            schedule={schedule}
            taskTemplates={taskTemplates}
            taskAssignments={taskAssignments}
            taskRoles={taskRoles}
            taskGroups={taskGroups}
            onUpdateAssignments={onUpdateAssignments}
            onUpdateRoles={onUpdateRoles}
          />
        )}
        {page === 'settings' && (
          <Settings
            columnDefs={columnDefs}
            onUpdateColumns={onUpdateColumns}
            taskTemplates={taskTemplates}
            onUpdateTaskTemplates={onUpdateTaskTemplates}
            taskGroups={taskGroups}
            onUpdateTaskGroups={onUpdateTaskGroups}
            employees={employees}
            onUpdateEmployees={onUpdateEmployees}
          />
        )}
        {page === 'admin' && isAdmin && (
          <MobileAdmin employees={employees} />
        )}
      </div>

      {/* Bottom navigation — scrolls sideways when items overflow */}
      <div style={{
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        flexShrink: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        paddingBottom: 'env(safe-area-inset-bottom)',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.06)',
      } as React.CSSProperties}>
        {navItems.map(item => (
          <button key={item.id} onClick={() => setPage(item.id)} style={{
            minWidth: '72px',
            flexShrink: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '10px 8px 8px',
            border: 'none', background: 'none', cursor: 'pointer', gap: '3px',
            color: page === item.id ? '#2563eb' : '#94a3b8',
            borderTop: `2px solid ${page === item.id ? '#2563eb' : 'transparent'}`,
          }}>
            <span style={{ fontSize: '20px', lineHeight: 1 }}>{item.icon}</span>
            <span style={{ fontSize: '10px', fontWeight: page === item.id ? '700' : '400', letterSpacing: '0.2px', whiteSpace: 'nowrap' }}>
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
