import { useState } from 'react';
import { Employee, Department } from '../../types';

interface EmployeeFormProps {
  employee?: Employee;
  departments: Department[];
  onSave: (employee: Employee) => void;
  onClose: () => void;
}

export default function EmployeeForm({ employee, onSave, onClose }: EmployeeFormProps) {
  const [form, setForm] = useState<Omit<Employee, 'id'>>({
    soldierId: employee?.soldierId ?? '',
    name: employee?.name ?? '',
    email: employee?.email ?? '',
    department: employee?.department ?? '',
    position: employee?.position ?? '',
    startDate: employee?.startDate ?? new Date().toISOString().split('T')[0],
    status: employee?.status ?? 'Active',
    phone: employee?.phone ?? '',
    privateId: employee?.privateId ?? '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{employee ? 'Edit Soldier' : 'Add Soldier'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>ID</label>
              <input style={inputStyle} value={form.soldierId ?? ''} onChange={e => setForm({...form, soldierId: e.target.value})} placeholder="e.g. 1234" />
            </div>
            <div>
              <label style={labelStyle}>Private ID</label>
              <input style={inputStyle} value={form.privateId ?? ''} onChange={e => setForm({...form, privateId: e.target.value})} placeholder="ID number" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} value={form.name} onChange={e => {
                const val = e.target.value.replace(/\b\w/g, c => c.toUpperCase());
                setForm({...form, name: val});
              }} placeholder="John Smith" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} value={form.phone ?? ''} onChange={e => setForm({...form, phone: e.target.value})} placeholder="555-0101" />
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
              background: 'white', color: '#374151', fontSize: '14px', cursor: 'pointer',
            }}>Cancel</button>
            <button type="submit" style={{
              padding: '8px 20px', border: 'none', borderRadius: '6px',
              background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer',
            }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
