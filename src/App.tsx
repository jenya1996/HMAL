import { useState } from 'react';
import { Employee, Department, LeaveRequest, LeaveType } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import Sidebar from './components/Layout/Sidebar';
import Header from './components/Layout/Header';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeList from './components/Employees/EmployeeList';
import DepartmentList from './components/Departments/DepartmentList';
import LeaveList from './components/Leaves/LeaveList';

const SAMPLE_DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Engineering' },
  { id: 'd2', name: 'Marketing' },
  { id: 'd3', name: 'Human Resources' },
  { id: 'd4', name: 'Finance' },
];

const SAMPLE_EMPLOYEES: Employee[] = [
  { id: 'e1', name: 'Alice Johnson', email: 'alice@company.com', department: 'Engineering', position: 'Senior Developer', startDate: '2021-03-15', status: 'Active', phone: '555-0101' },
  { id: 'e2', name: 'Bob Smith', email: 'bob@company.com', department: 'Engineering', position: 'Junior Developer', startDate: '2022-07-01', status: 'Active', phone: '555-0102' },
  { id: 'e3', name: 'Carol White', email: 'carol@company.com', department: 'Marketing', position: 'Marketing Manager', startDate: '2020-01-10', status: 'Active', phone: '555-0103' },
  { id: 'e4', name: 'David Brown', email: 'david@company.com', department: 'Human Resources', position: 'HR Specialist', startDate: '2021-09-20', status: 'Active', phone: '555-0104' },
  { id: 'e5', name: 'Eva Martinez', email: 'eva@company.com', department: 'Finance', position: 'Financial Analyst', startDate: '2022-02-14', status: 'Active', phone: '555-0105' },
  { id: 'e6', name: 'Frank Lee', email: 'frank@company.com', department: 'Marketing', position: 'Content Writer', startDate: '2023-05-01', status: 'Inactive', phone: '555-0106' },
];

const SAMPLE_LEAVES: LeaveRequest[] = [
  { id: 'l1', employeeId: 'e1', employeeName: 'Alice Johnson', type: 'Vacation' as LeaveType, startDate: '2024-02-01', endDate: '2024-02-07', status: 'Approved', reason: 'Annual vacation' },
  { id: 'l2', employeeId: 'e2', employeeName: 'Bob Smith', type: 'Sick Leave' as LeaveType, startDate: '2024-01-20', endDate: '2024-01-22', status: 'Approved', reason: 'Flu' },
  { id: 'l3', employeeId: 'e3', employeeName: 'Carol White', type: 'Personal' as LeaveType, startDate: '2024-03-10', endDate: '2024-03-11', status: 'Pending', reason: 'Personal appointment' },
  { id: 'l4', employeeId: 'e5', employeeName: 'Eva Martinez', type: 'Vacation' as LeaveType, startDate: '2024-04-15', endDate: '2024-04-20', status: 'Rejected', reason: 'Family trip' },
];

type Page = 'dashboard' | 'employees' | 'departments' | 'leaves';

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [employees, setEmployees] = useLocalStorage<Employee[]>('hmal-employees', SAMPLE_EMPLOYEES);
  const [departments, setDepartments] = useLocalStorage<Department[]>('hmal-departments', SAMPLE_DEPARTMENTS);
  const [leaves, setLeaves] = useLocalStorage<LeaveRequest[]>('hmal-leaves', SAMPLE_LEAVES);

  const pageTitles: Record<Page, string> = {
    dashboard: 'Dashboard',
    employees: 'Employee Management',
    departments: 'Department Management',
    leaves: 'Leave Requests',
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header title={pageTitles[currentPage]} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {currentPage === 'dashboard' && (
            <Dashboard employees={employees} departments={departments} leaves={leaves} />
          )}
          {currentPage === 'employees' && (
            <EmployeeList
              employees={employees}
              departments={departments}
              onUpdate={setEmployees}
            />
          )}
          {currentPage === 'departments' && (
            <DepartmentList
              departments={departments}
              employees={employees}
              onUpdate={setDepartments}
            />
          )}
          {currentPage === 'leaves' && (
            <LeaveList
              leaves={leaves}
              employees={employees}
              onUpdate={setLeaves}
            />
          )}
        </main>
      </div>
    </div>
  );
}
