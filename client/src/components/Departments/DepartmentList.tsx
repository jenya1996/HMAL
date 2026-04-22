import { useState } from 'react';
import { Department, Employee } from '../../types';
import DepartmentForm from './DepartmentForm';

interface DepartmentListProps {
  departments: Department[];
  employees: Employee[];
  onUpdate: (departments: Department[]) => void;
}

export default function DepartmentList({ departments, employees, onUpdate }: DepartmentListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editDept, setEditDept] = useState<Department | undefined>(undefined);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  function empCount(deptName: string) {
    return employees.filter(e => e.department === deptName).length;
  }

  function handleSave(dept: Department) {
    if (editDept) {
      onUpdate(departments.map(d => d.id === dept.id ? dept : d));
    } else {
      onUpdate([...departments, dept]);
    }
    setShowForm(false);
    setEditDept(undefined);
  }

  function handleDelete(id: string) {
    const dept = departments.find(d => d.id === id);
    if (dept && empCount(dept.name) > 0) {
      setErrorMsg(`Cannot delete "${dept.name}" because it has ${empCount(dept.name)} employee(s) assigned.`);
      setDeleteId(null);
      return;
    }
    onUpdate(departments.filter(d => d.id !== id));
    setDeleteId(null);
  }

  return (
    <div>
      {errorMsg && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px',
          padding: '12px 16px', marginBottom: '16px', color: '#dc2626', fontSize: '14px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          {errorMsg}
          <button onClick={() => setErrorMsg('')} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '16px' }}>×</button>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
        <button onClick={() => { setEditDept(undefined); setShowForm(true); }} style={{
          padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none',
          borderRadius: '6px', fontSize: '14px', fontWeight: '500',
        }}>+ Add Department</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
        {departments.length === 0 ? (
          <div style={{ gridColumn: '1/-1', padding: '48px', textAlign: 'center', color: '#94a3b8', background: 'white', borderRadius: '12px' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🏢</div>
            <div style={{ fontWeight: '500' }}>No departments yet</div>
          </div>
        ) : departments.map(dept => (
          <div key={dept.id} style={{
            background: 'white', borderRadius: '12px', padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '4px solid #2563eb',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '17px', fontWeight: '600', color: '#1e293b' }}>{dept.name}</div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  {empCount(dept.name)} employee{empCount(dept.name) !== 1 ? 's' : ''}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => { setEditDept(dept); setShowForm(true); }} style={{
                  padding: '4px 10px', background: '#eff6ff', color: '#2563eb',
                  border: 'none', borderRadius: '5px', fontSize: '13px',
                }}>Edit</button>
                <button onClick={() => setDeleteId(dept.id)} style={{
                  padding: '4px 10px', background: '#fef2f2', color: '#dc2626',
                  border: 'none', borderRadius: '5px', fontSize: '13px',
                }}>Delete</button>
              </div>
            </div>
            <div style={{ marginTop: '12px' }}>
              {employees.filter(e => e.department === dept.name).slice(0, 3).map(e => (
                <div key={e.id} style={{ fontSize: '12px', color: '#64748b', padding: '2px 0' }}>• {e.name}</div>
              ))}
              {empCount(dept.name) > 3 && (
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>+{empCount(dept.name) - 3} more</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <DepartmentForm
          department={editDept}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditDept(undefined); }}
        />
      )}

      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Are you sure you want to delete this department?</p>
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
