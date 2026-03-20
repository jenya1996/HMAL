import { useState } from 'react';
import { Employee, Department, ColumnDef } from '../../types';

interface EmployeeFormProps {
  employee?: Employee;
  departments: Department[];
  customColumns: ColumnDef[];
  onSave: (employee: Employee) => void;
  onClose: () => void;
}

export default function EmployeeForm({ employee, customColumns, onSave, onClose }: EmployeeFormProps) {
  const [form, setForm] = useState<Omit<Employee, 'id'>>({
    soldierId:    employee?.soldierId ?? '',
    name:         employee?.name ?? '',
    email:        employee?.email ?? '',
    department:   employee?.department ?? '',
    position:     employee?.position ?? '',
    startDate:    employee?.startDate ?? new Date().toISOString().split('T')[0],
    status:       employee?.status ?? 'Active',
    phone:        employee?.phone ?? '',
    privateId:    employee?.privateId ?? '',
    role:         employee?.role ?? '',
    customFields: employee?.customFields ?? {},
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({ id: employee?.id ?? `e${Date.now()}`, ...form });
  }

  function setCustomField(key: string, value: string) {
    setForm(f => ({ ...f, customFields: { ...f.customFields, [key]: value } }));
  }

  const inputStyle = {
    width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0',
    borderRadius: '6px', fontSize: '14px', color: '#1e293b', outline: 'none',
    boxSizing: 'border-box' as const,
  };
  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{employee ? 'Edit Soldier' : 'Add Soldier'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={labelStyle}>ID</label>
              <input style={inputStyle} value={form.soldierId ?? ''} onChange={e => setForm({ ...form, soldierId: e.target.value })} placeholder="e.g. 1234" />
            </div>
            <div>
              <label style={labelStyle}>Private ID</label>
              <input style={inputStyle} value={form.privateId ?? ''} onChange={e => setForm({ ...form, privateId: e.target.value })} placeholder="ID number" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Full Name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value.replace(/\b\w/g, c => c.toUpperCase()) })} placeholder="John Smith" />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" />
            </div>
            <div>
              <label style={labelStyle}>Phone Number</label>
              <input style={inputStyle} value={form.phone ?? ''} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="555-0101" />
            </div>
            <div>
              <label style={labelStyle}>Role</label>
              <input style={inputStyle} value={form.role ?? ''} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="e.g. Commander" />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={inputStyle} value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'Active' | 'Inactive' | 'Annexation' })}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Annexation">Annexation</option>
              </select>
            </div>

            {/* Custom columns */}
            {customColumns.map(col => {
              const val = form.customFields?.[col.key] ?? '';
              const type = col.fieldType ?? 'text';
              return (
                <div key={col.key} style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>{col.label}</label>
                  {type === 'text' && (
                    <input style={inputStyle} value={val} onChange={e => setCustomField(col.key, e.target.value)} placeholder={col.label} />
                  )}
                  {type === 'number' && (
                    <input style={inputStyle} type="number" value={val} onChange={e => setCustomField(col.key, e.target.value)} placeholder="0" />
                  )}
                  {type === 'dropdown' && (
                    <select style={inputStyle} value={val} onChange={e => setCustomField(col.key, e.target.value)}>
                      <option value="">— Select —</option>
                      {(col.options ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  )}
                  {type === 'multiselect' && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1px solid #e2e8f0', borderRadius: '6px' }}>
                      {(col.options ?? []).length === 0
                        ? <span style={{ fontSize: '13px', color: '#94a3b8' }}>No options defined in Settings.</span>
                        : (col.options ?? []).map(opt => {
                            const selected = val.split('|').filter(Boolean).includes(opt);
                            return (
                              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                <input type="checkbox" checked={selected} style={{ accentColor: '#2563eb' }}
                                  onChange={() => {
                                    const parts = val.split('|').filter(Boolean);
                                    const next = selected ? parts.filter(p => p !== opt) : [...parts, opt];
                                    setCustomField(col.key, next.join('|'));
                                  }}
                                />
                                {opt}
                              </label>
                            );
                          })
                      }
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#374151', fontSize: '14px', cursor: 'pointer' }}>
              Cancel
            </button>
            <button type="submit" style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
