import { useState } from 'react';
import { Employee, Department } from '../../types';
import EmployeeForm from './EmployeeForm';

interface EmployeeListProps {
  employees: Employee[];
  departments: Department[];
  onUpdate: (employees: Employee[]) => void;
}

export default function EmployeeList({ employees, departments, onUpdate }: EmployeeListProps) {
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = employees.filter(e => {
    const matchSearch = e.name.toLowerCase().includes(search.toLowerCase()) || e.email.toLowerCase().includes(search.toLowerCase());
    const matchDept = !deptFilter || e.department === deptFilter;
    return matchSearch && matchDept;
  });

  function handleSave(emp: Employee) {
    if (editEmployee) {
      onUpdate(employees.map(e => e.id === emp.id ? emp : e));
    } else {
      onUpdate([...employees, emp]);
    }
    setShowForm(false);
    setEditEmployee(undefined);
  }

  function handleDelete(id: string) {
    onUpdate(employees.filter(e => e.id !== id));
    setDeleteId(null);
  }

  function openEdit(emp: Employee) {
    setEditEmployee(emp);
    setShowForm(true);
  }

  function openAdd() {
    setEditEmployee(undefined);
    setShowForm(true);
  }

  const statusBadge = (status: string) => (
    <span style={{
      padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500',
      background: status === 'Active' ? '#dcfce7' : '#fee2e2',
      color: status === 'Active' ? '#15803d' : '#dc2626',
    }}>{status}</span>
  );

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Search employees..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '220px', flex: 1 }}
        />
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '160px' }}
        >
          <option value="">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
        </select>
        <button onClick={openAdd} style={{
          padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none',
          borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap',
        }}>+ Add Employee</button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>👥</div>
            <div style={{ fontWeight: '500' }}>No employees found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {['Name', 'Email', 'Department', 'Position', 'Start Date', 'Status', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, i) => (
                  <tr key={emp.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: '#dbeafe', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontWeight: '600', color: '#2563eb', fontSize: '12px', flexShrink: 0,
                        }}>
                          {emp.name.split(' ').map(n => n[0]).join('')}
                        </div>
                        <span style={{ fontWeight: '500', fontSize: '14px' }}>{emp.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{emp.email}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{emp.department}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{emp.position}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{emp.startDate}</td>
                    <td style={{ padding: '12px 16px' }}>{statusBadge(emp.status)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => openEdit(emp)} style={{
                          padding: '4px 12px', background: '#eff6ff', color: '#2563eb',
                          border: 'none', borderRadius: '5px', fontSize: '13px',
                        }}>Edit</button>
                        <button onClick={() => setDeleteId(emp.id)} style={{
                          padding: '4px 12px', background: '#fef2f2', color: '#dc2626',
                          border: 'none', borderRadius: '5px', fontSize: '13px',
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <EmployeeForm
          employee={editEmployee}
          departments={departments}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditEmployee(undefined); }}
        />
      )}

      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Are you sure you want to delete this employee? This action cannot be undone.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#dc2626', color: 'white', fontSize: '14px' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
