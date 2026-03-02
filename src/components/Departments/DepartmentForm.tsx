import { useState } from 'react';
import { Department } from '../../types';

interface DepartmentFormProps {
  department?: Department;
  onSave: (dept: Department) => void;
  onClose: () => void;
}

export default function DepartmentForm({ department, onSave, onClose }: DepartmentFormProps) {
  const [name, setName] = useState(department?.name ?? '');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Department name is required'); return; }
    onSave({ id: department?.id ?? `d${Date.now()}`, name: name.trim() });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '28px', width: '100%', maxWidth: '400px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600' }}>{department ? 'Edit Department' : 'Add Department'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px', display: 'block' }}>
            Department Name *
          </label>
          <input
            value={name}
            onChange={e => { setName(e.target.value); setError(''); }}
            placeholder="Engineering"
            style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px' }}
          />
          {error && <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '14px' }}>Cancel</button>
            <button type="submit" style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '500' }}>Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
