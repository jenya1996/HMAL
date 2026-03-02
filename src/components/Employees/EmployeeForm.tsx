import { useState } from 'react';
import { Employee, Department } from '../../types';

interface EmployeeFormProps {
  employee?: Employee;
  departments: Department[];
  onSave: (employee: Employee) => void;
  onClose: () => void;
}

export default function EmployeeForm({ employee, departments, onSave, onClose }: EmployeeFormProps) {
  const [form, setForm] = useState<Omit<Employee, 'id'>>({
    name: employee?.name ?? '',
    email: employee?.email ?? '',
    department: employee?.department ?? (departments[0]?.name ?? ''),
    position: employee?.position ?? '',
    startDate: employee?.startDate ?? new Date().toISOString().split('T')[0],
    status: employee?.status ?? 'Active',
    phone: employee?.phone ?? '',
  });
  const [errors, setErrors] = useState<Partial<Record<keyof Employee, string>>>({});

  function validate() {
    const errs: Partial<Record<keyof Employee, string>> = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.position.trim()) errs.position = 'Position is required';
    if (!form.department) errs.department = 'Department is required';
    if (!form.startDate) errs.startDate = 'Start date is required';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    onSave({
      id: employee?.id ?? `e${Date.now()}`,
      ...form,
    });
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontSize: '14px',
    color: '#1e293b',
    outline: 'none',
  };
  const labelStyle = { fontSize: '13px', fontWeight: '500' as const, color: '#374151', marginBottom: '4px', display: 'block' };
  const errorStyle = { fontSize: '12px', color: '#dc2626', marginTop: '2px' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'white', borderRadius: '12px', padding: '28px',
        width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{employee ? 'Edit Employee' : 'Add Employee'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Full Name *</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Alice Johnson" />
              {errors.name && <div style={errorStyle}>{errors.name}</div>}
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="alice@company.com" />
              {errors.email && <div style={errorStyle}>{errors.email}</div>}
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="555-0101" />
            </div>
            <div>
              <label style={labelStyle}>Department *</label>
              <select style={inputStyle} value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              {errors.department && <div style={errorStyle}>{errors.department}</div>}
            </div>
            <div>
              <label style={labelStyle}>Position *</label>
              <input style={inputStyle} value={form.position} onChange={e => setForm({...form, position: e.target.value})} placeholder="Software Engineer" />
              {errors.position && <div style={errorStyle}>{errors.position}</div>}
            </div>
            <div>
              <label style={labelStyle}>Start Date *</label>
              <input style={inputStyle} type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
              {errors.startDate && <div style={errorStyle}>{errors.startDate}</div>}
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm({...form, status: e.target.value as 'Active' | 'Inactive'})}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px',
              background: 'white', color: '#374151', fontSize: '14px',
            }}>Cancel</button>
            <button type="submit" style={{
              padding: '8px 20px', border: 'none', borderRadius: '6px',
              background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '500',
            }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
