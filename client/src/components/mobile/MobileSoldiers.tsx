import { useState } from 'react';
import type { ReactNode } from 'react';
import { Employee, ColumnDef } from '../../types';

interface Props {
  employees: Employee[];
  columnDefs: ColumnDef[];
  onUpdate: (employees: Employee[]) => void;
  onDelete: (ids: string[]) => void;
}

interface FormState {
  name: string;
  department: string;
  position: string;
  role: string;
  status: 'Active' | 'Inactive' | 'Annexation';
}

const EMPTY_FORM: FormState = { name: '', department: '', position: '', role: '', status: 'Active' };

function genId() { return `e${Date.now()}`; }

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Active:     { bg: '#dcfce7', color: '#16a34a' },
  Inactive:   { bg: '#f1f5f9', color: '#64748b' },
  Annexation: { bg: '#fef3c7', color: '#d97706' },
};

export default function MobileSoldiers({ employees, columnDefs, onUpdate, onDelete }: Props) {
  const [search, setSearch] = useState('');
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = employees.filter(e =>
    !search || e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.department ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const deptOptions = columnDefs.find(c => c.key === 'department')?.options ?? [];

  function openEdit(emp: Employee) {
    setForm({ name: emp.name, department: emp.department ?? '', position: emp.position ?? '', role: emp.role ?? '', status: emp.status });
    setEditEmp(emp);
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setShowAdd(true);
  }

  function closeForm() {
    setEditEmp(null);
    setShowAdd(false);
  }

  function saveForm() {
    if (!form.name.trim()) return;
    if (editEmp) {
      onUpdate(employees.map(e => e.id === editEmp.id ? { ...e, ...form } : e));
    } else {
      const newEmp: Employee = {
        id: genId(), email: '', startDate: '',
        name: form.name, department: form.department,
        position: form.position, role: form.role, status: form.status,
      };
      onUpdate([...employees, newEmp]);
    }
    closeForm();
  }

  function doDelete(id: string) {
    onDelete([id]);
    setConfirmDeleteId(null);
    closeForm();
  }

  const showForm = editEmp !== null || showAdd;

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Search bar */}
      <div style={{ padding: '12px 16px', background: 'white', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <input
          placeholder="Search soldiers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', border: '1px solid #e2e8f0', borderRadius: '10px', fontSize: '15px', boxSizing: 'border-box', outline: 'none', background: '#f8fafc' }}
        />
      </div>

      {/* Soldier count */}
      <div style={{ padding: '8px 16px 4px', fontSize: '12px', color: '#94a3b8', flexShrink: 0 }}>
        {filtered.length} soldier{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 80px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 0', fontSize: '14px' }}>
            No soldiers found
          </div>
        )}
        {filtered.map(emp => {
          const badge    = STATUS_COLORS[emp.status] ?? STATUS_COLORS.Inactive;
          const initials = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
          const sub      = [emp.department, emp.position].filter(Boolean).join(' · ');
          return (
            <div key={emp.id} onClick={() => openEdit(emp)} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: 'white', borderRadius: '12px', padding: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.06)', cursor: 'pointer',
            }}>
              <div style={{
                width: '42px', height: '42px', borderRadius: '50%', background: '#dbeafe',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '800', color: '#2563eb', fontSize: '13px', flexShrink: 0,
              }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '600', fontSize: '15px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {emp.name}
                </div>
                {sub && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{sub}</div>}
              </div>
              <span style={{ background: badge.bg, color: badge.color, padding: '4px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', flexShrink: 0 }}>
                {emp.status}
              </span>
              <span style={{ color: '#cbd5e1', fontSize: '16px' }}>›</span>
            </div>
          );
        })}
      </div>

      {/* FAB: Add soldier */}
      <button onClick={openAdd} style={{
        position: 'absolute', bottom: '20px', right: '20px',
        width: '54px', height: '54px', borderRadius: '50%',
        background: '#2563eb', color: 'white', border: 'none',
        fontSize: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 14px rgba(37,99,235,0.45)', lineHeight: 1,
      }}>+</button>

      {/* Add / Edit bottom sheet */}
      {showForm && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) closeForm(); }}
        >
          <div style={{ background: 'white', borderRadius: '20px 20px 0 0', padding: '0 0 env(safe-area-inset-bottom)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Sheet header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 0' }}>
              <div style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b' }}>
                {editEmp ? 'Edit Soldier' : 'New Soldier'}
              </div>
              <button onClick={closeForm} style={{
                width: '32px', height: '32px', borderRadius: '50%', border: 'none',
                background: '#f1f5f9', color: '#64748b', fontSize: '18px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            {/* Fields */}
            <div style={{ overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FormField label="Name *">
                <input
                  autoFocus
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Full name"
                  style={inputStyle}
                />
              </FormField>

              <FormField label="Department">
                {deptOptions.length > 0 ? (
                  <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} style={inputStyle}>
                    <option value="">None</option>
                    {deptOptions.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} placeholder="Department" style={inputStyle} />
                )}
              </FormField>

              <FormField label="Position">
                <input value={form.position} onChange={e => setForm(f => ({ ...f, position: e.target.value }))} placeholder="Position" style={inputStyle} />
              </FormField>

              <FormField label="Role">
                <input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="Role" style={inputStyle} />
              </FormField>

              <FormField label="Status">
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Active', 'Inactive', 'Annexation'] as const).map(s => {
                    const c = STATUS_COLORS[s];
                    const selected = form.status === s;
                    return (
                      <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{
                        flex: 1, padding: '11px 4px', fontSize: '12px', fontWeight: selected ? '700' : '400',
                        border: `2px solid ${selected ? c.color : '#e2e8f0'}`,
                        borderRadius: '10px',
                        background: selected ? c.bg : 'white',
                        color: selected ? c.color : '#94a3b8',
                        cursor: 'pointer',
                      }}>{s}</button>
                    );
                  })}
                </div>
              </FormField>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '10px', paddingTop: '4px' }}>
                {editEmp && (
                  <button onClick={() => setConfirmDeleteId(editEmp.id)} style={{
                    padding: '14px 18px', border: 'none', borderRadius: '12px',
                    background: '#fee2e2', color: '#dc2626', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
                  }}>
                    Delete
                  </button>
                )}
                <button onClick={saveForm} disabled={!form.name.trim()} style={{
                  flex: 1, padding: '14px', border: 'none', borderRadius: '12px',
                  background: form.name.trim() ? '#2563eb' : '#e2e8f0',
                  color: form.name.trim() ? 'white' : '#94a3b8',
                  fontWeight: '700', fontSize: '15px', cursor: form.name.trim() ? 'pointer' : 'default',
                }}>
                  {editEmp ? 'Save Changes' : 'Add Soldier'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDeleteId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div style={{ background: 'white', borderRadius: '18px', padding: '24px', width: '100%', maxWidth: '320px' }}>
            <div style={{ fontWeight: '700', fontSize: '17px', color: '#1e293b', marginBottom: '8px' }}>Remove soldier?</div>
            <div style={{ fontSize: '14px', color: '#64748b', marginBottom: '22px', lineHeight: '1.5' }}>
              This will remove the soldier and all their schedule data.
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmDeleteId(null)} style={{
                flex: 1, padding: '13px', border: '1px solid #e2e8f0', borderRadius: '10px',
                background: 'white', color: '#475569', fontSize: '14px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={() => doDelete(confirmDeleteId)} style={{
                flex: 1, padding: '13px', border: 'none', borderRadius: '10px',
                background: '#ef4444', color: 'white', fontWeight: '700', fontSize: '14px', cursor: 'pointer',
              }}>Remove</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '12px', fontWeight: '600', color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: '1px solid #e2e8f0', borderRadius: '10px',
  fontSize: '15px', boxSizing: 'border-box', outline: 'none', background: '#f8fafc', color: '#1e293b',
};
