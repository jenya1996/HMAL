import { useState } from 'react';
import { LeaveRequest, LeaveType, Employee } from '../../types';

interface LeaveFormProps {
  leave?: LeaveRequest;
  employees: Employee[];
  onSave: (leave: LeaveRequest) => void;
  onClose: () => void;
}

const LEAVE_TYPES: LeaveType[] = ['Vacation', 'Sick Leave', 'Personal', 'Other'];

export default function LeaveForm({ leave, employees, onSave, onClose }: LeaveFormProps) {
  const [form, setForm] = useState({
    employeeId: leave?.employeeId ?? (employees[0]?.id ?? ''),
    type: leave?.type ?? 'Vacation' as LeaveType,
    startDate: leave?.startDate ?? '',
    endDate: leave?.endDate ?? '',
    reason: leave?.reason ?? '',
    status: leave?.status ?? 'Pending' as const,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!form.employeeId) errs.employeeId = 'Employee is required';
    if (!form.startDate) errs.startDate = 'Start date is required';
    if (!form.endDate) errs.endDate = 'End date is required';
    if (form.startDate && form.endDate && form.endDate < form.startDate) errs.endDate = 'End date must be after start date';
    if (!form.reason.trim()) errs.reason = 'Reason is required';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    const emp = employees.find(e => e.id === form.employeeId);
    onSave({
      id: leave?.id ?? `l${Date.now()}`,
      employeeId: form.employeeId,
      employeeName: emp?.name ?? '',
      type: form.type,
      startDate: form.startDate,
      endDate: form.endDate,
      reason: form.reason,
      status: form.status,
    });
  }

  const inputStyle = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' };
  const labelStyle = { fontSize: '13px', fontWeight: '500' as const, color: '#374151', marginBottom: '4px', display: 'block' };
  const errStyle = { fontSize: '12px', color: '#dc2626', marginTop: '2px' };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '480px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{leave ? 'Edit Leave Request' : 'New Leave Request'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Employee *</label>
              <select style={inputStyle} value={form.employeeId} onChange={e => setForm({...form, employeeId: e.target.value})}>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              {errors.employeeId && <div style={errStyle}>{errors.employeeId}</div>}
            </div>
            <div>
              <label style={labelStyle}>Leave Type *</label>
              <select style={inputStyle} value={form.type} onChange={e => setForm({...form, type: e.target.value as LeaveType})}>
                {LEAVE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Start Date *</label>
                <input style={inputStyle} type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} />
                {errors.startDate && <div style={errStyle}>{errors.startDate}</div>}
              </div>
              <div>
                <label style={labelStyle}>End Date *</label>
                <input style={inputStyle} type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} />
                {errors.endDate && <div style={errStyle}>{errors.endDate}</div>}
              </div>
            </div>
            <div>
              <label style={labelStyle}>Reason *</label>
              <textarea
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
                value={form.reason}
                onChange={e => setForm({...form, reason: e.target.value})}
                placeholder="Describe the reason for leave..."
              />
              {errors.reason && <div style={errStyle}>{errors.reason}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '14px' }}>Cancel</button>
            <button type="submit" style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '500' }}>Submit</button>
          </div>
        </form>
      </div>
    </div>
  );
}
