import { useState, useRef, useCallback } from 'react';
import { Employee, Department, ColumnDef } from '../../types';
import EmployeeForm from './EmployeeForm';

interface EmployeeListProps {
  employees: Employee[];
  departments: Department[];
  columnDefs: ColumnDef[];
  onUpdate: (employees: Employee[]) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filterDept: string;
  onFilterDeptChange: (v: string) => void;
  deptOptions: string[];
}

type SortDir = 'asc' | 'desc';

function getVal(emp: Employee, key: string): string {
  switch (key) {
    case 'id':         return emp.soldierId ?? '';
    case 'name':       return emp.name;
    case 'email':      return emp.email;
    case 'phone':      return emp.phone ?? '';
    case 'privateId':  return emp.privateId ?? '';
    case 'role':       return emp.role ?? '';
    case 'department': return emp.department ?? '';
    case 'status':     return emp.status;
    default:           return emp.customFields?.[key] ?? '';
  }
}

export default function EmployeeList({ employees, departments, columnDefs, onUpdate, search, onSearchChange, filterDept, onFilterDeptChange, deptOptions }: EmployeeListProps) {
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | undefined>(undefined);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [rowDragOver, setRowDragOver] = useState<string | null>(null);
  const dragRow = useRef<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkFields, setBulkFields] = useState<{ status: string; role: string; department: string; custom: Record<string, string> }>({ status: '', role: '', department: '', custom: {} });

  const visibleCols = columnDefs.filter(c => c.visible);
  const customCols = columnDefs.filter(c => !c.builtin);
  const deptCol = columnDefs.find(c => c.key === 'department');

  const handleCSV = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setCsvError('CSV must have a header row and at least one data row.'); return; }
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, ''));
        const map = {
          soldierId: headers.findIndex(h => h === 'id' || h === 'soldierid'),
          name:      headers.findIndex(h => h === 'name' || h === 'fullname'),
          email:     headers.findIndex(h => h === 'email'),
          phone:     headers.findIndex(h => h === 'phone' || h === 'phonenumber'),
          privateId: headers.findIndex(h => h === 'privateid'),
          status:    headers.findIndex(h => h === 'status'),
        };
        const newSoldiers: Employee[] = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim());
          const name = map.name >= 0 ? cols[map.name] ?? '' : '';
          const status = map.status >= 0 ? cols[map.status] : 'Active';
          return {
            id: `e${Date.now()}-${Math.random().toString(36).slice(2)}`,
            soldierId: map.soldierId >= 0 ? cols[map.soldierId] ?? '' : '',
            name: name.replace(/\b\w/g, c => c.toUpperCase()),
            email: map.email >= 0 ? cols[map.email] ?? '' : '',
            phone: map.phone >= 0 ? cols[map.phone] ?? '' : '',
            privateId: map.privateId >= 0 ? cols[map.privateId] ?? '' : '',
            status: (status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
            department: '', position: '', startDate: '',
          };
        }).filter(e => e.name);
        if (newSoldiers.length === 0) { setCsvError('No valid soldiers found in CSV.'); return; }
        onUpdate([...employees, ...newSoldiers]);
        setCsvError(null);
      } catch {
        setCsvError('Failed to parse CSV. Please check the file format.');
      } finally {
        if (csvInput.current) csvInput.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [employees, onUpdate]);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q);
    const matchDept = !filterDept || e.department === filterDept;
    return matchSearch && matchDept;
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = getVal(a, sortCol).toLowerCase();
        const bv = getVal(b, sortCol).toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : filtered;

  const selectedArr = Array.from(selected);
  const allChecked = sorted.length > 0 && sorted.every(e => selected.has(e.id));

  function toggleSelect(id: string) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(sorted.map(e => e.id)));
  }
  function handleSort(key: string) {
    if (sortCol === key) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortCol(key); setSortDir('asc'); }
  }
  function handleSave(emp: Employee) {
    const isEdit = !!editEmployee;
    const next = isEdit ? employees.map(e => e.id === emp.id ? emp : e) : [...employees, emp];
    console.log(`[EmployeeList] handleSave — ${isEdit ? 'editing' : 'adding'} soldier:`, emp);
    console.log('[EmployeeList] new employees array length:', next.length);
    onUpdate(next);
    setShowForm(false); setEditEmployee(undefined); setSelected(new Set());
  }
  function openBulkEdit() {
    setBulkFields({ status: '', role: '', department: '', custom: {} });
    setShowBulkEdit(true);
  }
  function applyBulkEdit() {
    const ids = Array.from(selected);
    const next = employees.map(e => {
      if (!ids.includes(e.id)) return e;
      const updated = { ...e };
      if (bulkFields.status) updated.status = bulkFields.status as Employee['status'];
      if (bulkFields.role.trim()) updated.role = bulkFields.role.trim();
      if (bulkFields.department) updated.department = bulkFields.department;
      const customUpdates = Object.entries(bulkFields.custom).filter(([, v]) => v.trim());
      if (customUpdates.length) updated.customFields = { ...e.customFields, ...Object.fromEntries(customUpdates.map(([k, v]) => [k, v.trim()])) };
      return updated;
    });
    onUpdate(next);
    setShowBulkEdit(false);
    setSelected(new Set());
  }
  function handleDelete(ids: string[]) {
    console.log('[EmployeeList] handleDelete — deleting ids:', ids);
    onUpdate(employees.filter(e => !ids.includes(e.id)));
    setSelected(new Set()); setDeleteIds(null);
  }
  function onRowDragStart(id: string) { dragRow.current = id; }
  function onRowDrop(id: string) {
    if (!dragRow.current || dragRow.current === id) { setRowDragOver(null); return; }
    const from = employees.findIndex(e => e.id === dragRow.current);
    const to = employees.findIndex(e => e.id === id);
    const next = [...employees];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    console.log('[EmployeeList] onRowDrop — reordering soldiers');
    onUpdate(next); dragRow.current = null; setRowDragOver(null);
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string }> = {
      Active:     { bg: '#dcfce7', color: '#15803d' },
      Inactive:   { bg: '#fee2e2', color: '#dc2626' },
      Annexation: { bg: '#bbf7d0', color: '#166534' },
    };
    const s = styles[status] ?? styles.Active;
    return <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500', background: s.bg, color: s.color }}>{status}</span>;
  };

  function renderCell(col: ColumnDef, emp: Employee) {
    const td = (content: React.ReactNode) => (
      <td key={col.key} style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{content}</td>
    );
    switch (col.key) {
      case 'id':        return <td key={col.key} style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{emp.soldierId || '—'}</td>;
      case 'name':      return (
        <td key={col.key} style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: '#2563eb', fontSize: '12px' }}>
              {emp.name ? emp.name.split(' ').map(n => n[0]).join('') : '?'}
            </div>
            <span style={{ fontWeight: '500', fontSize: '14px' }}>{emp.name || '—'}</span>
          </div>
        </td>
      );
      case 'email':     return td(emp.email || '—');
      case 'phone':     return td(emp.phone || '—');
      case 'privateId': return td(emp.privateId || '—');
      case 'role':       return td(emp.role || '—');
      case 'department': {
        const dept = emp.department || '';
        if (!dept) return td('—');
        const bg = deptCol?.optionColors?.[dept] ?? '#e2e8f0';
        return (
          <td key={col.key} style={{ padding: '8px 16px' }}>
            <span style={{ padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500', background: bg, color: '#1e293b', display: 'inline-block' }}>{dept}</span>
          </td>
        );
      }
      case 'status':    return <td key={col.key} style={{ padding: '12px 16px' }}>{statusBadge(emp.status)}</td>;
      default: {
        const val = emp.customFields?.[col.key] ?? '';
        const type = col.fieldType ?? 'text';
        if (!val) return td('—');
        if (type === 'multiselect') {
          const parts = val.split('|').filter(Boolean);
          return (
            <td key={col.key} style={{ padding: '8px 16px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {parts.map(p => (
                  <span key={p} style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '500', background: '#e0e7ff', color: '#3730a3' }}>{p}</span>
                ))}
              </div>
            </td>
          );
        }
        return td(val);
      }
    }
  }

  const sortIcon = (key: string) => {
    if (sortCol !== key) return <span style={{ color: '#d1d5db', fontSize: '10px' }}>⇅</span>;
    return <span style={{ color: '#2563eb', fontSize: '10px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <input
          placeholder="🔍 Search soldiers..."
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '180px', flex: 1 }}
        />
        {deptOptions.length > 0 && (
          <select value={filterDept} onChange={e => onFilterDeptChange(e.target.value)}
            style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', background: 'white', cursor: 'pointer', color: filterDept ? '#1e293b' : '#94a3b8' }}>
            <option value="">All departments</option>
            {deptOptions.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        )}
        {sortCol && (
          <button onClick={() => setSortCol(null)} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b' }}>
            Clear Sort
          </button>
        )}
        {selectedArr.length === 1 && (
          <button onClick={() => { setEditEmployee(employees.find(e => e.id === selectedArr[0])); setShowForm(true); }}
            style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Edit
          </button>
        )}
        {selectedArr.length > 1 && (
          <button onClick={openBulkEdit}
            style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Edit ({selectedArr.length})
          </button>
        )}
        {selectedArr.length > 0 && (
          <button onClick={() => setDeleteIds(selectedArr)}
            style={{ padding: '8px 16px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Delete{selectedArr.length > 1 ? ` (${selectedArr.length})` : ''}
          </button>
        )}
        <input ref={csvInput} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
        <button onClick={() => {
          const headers = ['ID', 'Name', 'Email', 'Phone', 'Private ID', 'Role', 'Status', ...customCols.map(c => c.label)];
          const rows = employees.map(e => [
            e.soldierId ?? '', e.name, e.email, e.phone ?? '', e.privateId ?? '', e.role ?? '', e.status,
            ...customCols.map(c => e.customFields?.[c.key] ?? ''),
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
          const csv = [headers.join(','), ...rows].join('\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = 'soldiers.csv'; a.click();
        }} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          ⬇ Export CSV
        </button>
        <button onClick={() => csvInput.current?.click()} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          ⬆ Import CSV
        </button>
        <button onClick={() => { setEditEmployee(undefined); setShowForm(true); }} style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          + Add Soldier
        </button>
      </div>

      {csvError && (
        <div style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          {csvError}
          <span onClick={() => setCsvError(null)} style={{ cursor: 'pointer', fontWeight: '700' }}>×</span>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: 1, overflow: 'auto', minHeight: 0 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>🪖</div>
            <div style={{ fontWeight: '500' }}>No soldiers found</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                {/* Checkbox */}
                <th style={{ padding: '12px 8px', textAlign: 'center', width: '36px' }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll}
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }} />
                </th>
                {/* Dynamic columns */}
                {visibleCols.map(col => (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600',
                      color: '#374151', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
                      background: sortCol === col.key ? '#f0f7ff' : '#f8fafc',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {col.label} {sortIcon(col.key)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((emp, i) => (
                <tr key={emp.id}
                  draggable
                  onDragStart={() => onRowDragStart(emp.id)}
                  onDragEnter={() => setRowDragOver(emp.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => onRowDrop(emp.id)}
                  onDragEnd={() => setRowDragOver(null)}
                  onClick={() => toggleSelect(emp.id)}
                  onDoubleClick={() => { setEditEmployee(emp); setShowForm(true); }}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: selected.has(emp.id) ? '#eff6ff' : rowDragOver === emp.id ? '#f0fdf4' : emp.status === 'Inactive' ? '#fca5a5' : emp.status === 'Annexation' ? '#4ade80' : (deptCol?.optionColors?.[emp.department] ?? (i % 2 === 0 ? 'white' : '#fafafa')),
                    borderTop: rowDragOver === emp.id ? '2px solid #2563eb' : undefined,
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '0 8px', textAlign: 'center', width: '36px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(emp.id)} onChange={() => toggleSelect(emp.id)} onClick={e => e.stopPropagation()}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }} />
                  </td>
                  {visibleCols.map(col => renderCell(col, emp))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <EmployeeForm
          employee={editEmployee}
          departments={departments}
          columnDefs={columnDefs}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditEmployee(undefined); }}
        />
      )}

      {showBulkEdit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '420px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>Bulk Edit</h3>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px' }}>
              Editing {selectedArr.length} soldiers. Only filled fields will be applied.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Status</label>
                <select value={bulkFields.status} onChange={e => setBulkFields(f => ({ ...f, status: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: 'white' }}>
                  <option value="">— no change —</option>
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Annexation">Annexation</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Department</label>
                <select value={bulkFields.department} onChange={e => setBulkFields(f => ({ ...f, department: e.target.value }))}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: 'white' }}>
                  <option value="">— no change —</option>
                  {(deptCol?.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>Role</label>
                <input value={bulkFields.role} onChange={e => setBulkFields(f => ({ ...f, role: e.target.value }))}
                  placeholder="leave blank to keep current"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }} />
              </div>
              {customCols.map(col => (
                <div key={col.key}>
                  <label style={{ fontSize: '13px', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '4px' }}>{col.label}</label>
                  {col.fieldType === 'dropdown' && col.options?.length ? (
                    <select value={bulkFields.custom[col.key] ?? ''} onChange={e => setBulkFields(f => ({ ...f, custom: { ...f.custom, [col.key]: e.target.value } }))}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '14px', background: 'white' }}>
                      <option value="">— no change —</option>
                      {col.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : col.fieldType === 'multiselect' && col.options?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', border: '1.5px solid #e2e8f0', borderRadius: '6px' }}>
                      {col.options.map(opt => {
                        const val = bulkFields.custom[col.key] ?? '';
                        const checked = val.split('|').filter(Boolean).includes(opt);
                        return (
                          <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                            <input type="checkbox" checked={checked} style={{ accentColor: '#2563eb' }}
                              onChange={() => {
                                const parts = val.split('|').filter(Boolean);
                                const next = checked ? parts.filter(p => p !== opt) : [...parts, opt];
                                setBulkFields(f => ({ ...f, custom: { ...f.custom, [col.key]: next.join('|') } }));
                              }}
                            />
                            {opt}
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <input value={bulkFields.custom[col.key] ?? ''} onChange={e => setBulkFields(f => ({ ...f, custom: { ...f.custom, [col.key]: e.target.value } }))}
                      placeholder="leave blank to keep current"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1.5px solid #e2e8f0', fontSize: '14px', boxSizing: 'border-box' }} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button onClick={() => setShowBulkEdit(false)} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={applyBulkEdit} style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#2563eb', color: 'white', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>Apply to {selectedArr.length} soldiers</button>
            </div>
          </div>
        </div>
      )}

      {deleteIds && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              {deleteIds.length === 1 ? 'Are you sure you want to delete this soldier?' : `Are you sure you want to delete ${deleteIds.length} soldiers?`} This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteIds(null)} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '14px', cursor: 'pointer' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteIds)} style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#dc2626', color: 'white', fontSize: '14px', cursor: 'pointer' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
