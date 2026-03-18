import { useState, useRef, useCallback } from 'react';
import { Employee, Department } from '../../types';
import EmployeeForm from './EmployeeForm';

interface EmployeeListProps {
  employees: Employee[];
  departments: Department[];
  onUpdate: (employees: Employee[]) => void;
}

type ColKey = 'check' | 'drag' | 'id' | 'name' | 'email' | 'phone' | 'privateId' | 'role' | 'status';
type SortDir = 'asc' | 'desc';
type SortableCol = 'id' | 'name' | 'email' | 'phone' | 'privateId' | 'role' | 'status';

const ALL_COLUMNS: { key: ColKey; label: string }[] = [
  { key: 'check',     label: '' },
  { key: 'drag',      label: '' },
  { key: 'id',        label: 'ID' },
  { key: 'name',      label: 'Name' },
  { key: 'email',     label: 'Email' },
  { key: 'phone',     label: 'Phone Number' },
  { key: 'privateId', label: 'Private ID' },
  { key: 'role',      label: 'Role' },
  { key: 'status',    label: 'Status' },
];

const SORTABLE: ColKey[] = ['id', 'name', 'email', 'phone', 'privateId', 'role', 'status'];

function getVal(emp: Employee, col: SortableCol): string {
  switch (col) {
    case 'id':        return emp.id;
    case 'name':      return emp.name;
    case 'email':     return emp.email;
    case 'phone':     return emp.phone ?? '';
    case 'privateId': return emp.privateId ?? '';
    case 'role':      return emp.role ?? '';
    case 'status':    return emp.status;
  }
}

export default function EmployeeList({ employees, departments, onUpdate }: EmployeeListProps) {
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | undefined>(undefined);
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Column reorder
  const [columns, setColumns] = useState<ColKey[]>(ALL_COLUMNS.map(c => c.key));
  const [colDragOver, setColDragOver] = useState<ColKey | null>(null);
  const dragCol = useRef<ColKey | null>(null);

  // Column sort
  const [sortCol, setSortCol] = useState<SortableCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  // Row reorder
  const [rowDragOver, setRowDragOver] = useState<string | null>(null);
  const dragRow = useRef<string | null>(null);

  // CSV import
  const [csvError, setCsvError] = useState<string | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);

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
          soldierId:  headers.findIndex(h => h === 'id' || h === 'soldierid'),
          name:       headers.findIndex(h => h === 'name' || h === 'fullname'),
          email:      headers.findIndex(h => h === 'email'),
          phone:      headers.findIndex(h => h === 'phone' || h === 'phonenumber'),
          privateId:  headers.findIndex(h => h === 'privateid'),
          status:     headers.findIndex(h => h === 'status'),
        };

        const newSoldiers: Employee[] = lines.slice(1).map(line => {
          const cols = line.split(',').map(c => c.trim());
          const name = map.name >= 0 ? cols[map.name] ?? '' : '';
          const capitalized = name.replace(/\b\w/g, c => c.toUpperCase());
          const status = map.status >= 0 ? cols[map.status] : 'Active';
          return {
            id: `e${Date.now()}-${Math.random().toString(36).slice(2)}`,
            soldierId:  map.soldierId >= 0  ? cols[map.soldierId]  ?? '' : '',
            name:       capitalized,
            email:      map.email >= 0      ? cols[map.email]      ?? '' : '',
            phone:      map.phone >= 0      ? cols[map.phone]      ?? '' : '',
            privateId:  map.privateId >= 0  ? cols[map.privateId]  ?? '' : '',
            status:     (status === 'Inactive' ? 'Inactive' : 'Active') as 'Active' | 'Inactive',
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

  const filtered = employees.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = getVal(a, sortCol).toLowerCase();
        const bv = getVal(b, sortCol).toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : filtered;

  const selectedArr = Array.from(selected);
  const allChecked = sorted.length > 0 && sorted.every(e => selected.has(e.id));
  const someChecked = selectedArr.length > 0;
  const oneChecked = selectedArr.length === 1;

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allChecked) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map(e => e.id)));
    }
  }

  function handleSort(key: ColKey) {
    if (!SORTABLE.includes(key)) return;
    const col = key as SortableCol;
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  }

  function handleSave(emp: Employee) {
    if (editEmployee) {
      onUpdate(employees.map(e => e.id === emp.id ? emp : e));
    } else {
      onUpdate([...employees, emp]);
    }
    setShowForm(false);
    setEditEmployee(undefined);
    setSelected(new Set());
  }

  function handleDelete(ids: string[]) {
    onUpdate(employees.filter(e => !ids.includes(e.id)));
    setSelected(new Set());
    setDeleteIds(null);
  }

  // Column drag
  function onColDragStart(key: ColKey) { dragCol.current = key; }
  function onColDrop(key: ColKey) {
    if (!dragCol.current || dragCol.current === key || dragCol.current === 'check' || dragCol.current === 'drag') {
      setColDragOver(null); return;
    }
    const from = columns.indexOf(dragCol.current);
    const to = columns.indexOf(key);
    const next = [...columns];
    next.splice(from, 1);
    next.splice(to, 0, dragCol.current);
    setColumns(next);
    dragCol.current = null;
    setColDragOver(null);
  }

  // Row drag
  function onRowDragStart(id: string) { dragRow.current = id; }
  function onRowDrop(id: string) {
    if (!dragRow.current || dragRow.current === id) { setRowDragOver(null); return; }
    const from = employees.findIndex(e => e.id === dragRow.current);
    const to = employees.findIndex(e => e.id === id);
    const next = [...employees];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onUpdate(next);
    dragRow.current = null;
    setRowDragOver(null);
  }

  const statusBadge = (status: string) => (
    <span style={{
      padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500',
      background: status === 'Active' ? '#dcfce7' : '#fee2e2',
      color: status === 'Active' ? '#15803d' : '#dc2626',
    }}>{status}</span>
  );

  function renderCell(key: ColKey, emp: Employee) {
    switch (key) {
      case 'check':
        return (
          <td key={key} style={{ padding: '0 8px', textAlign: 'center', width: '36px' }} onClick={e => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={selected.has(emp.id)}
              onChange={() => toggleSelect(emp.id)}
              style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
            />
          </td>
        );
      case 'drag':
        return (
          <td key={key} style={{ padding: '0 8px', color: '#cbd5e1', cursor: 'grab', fontSize: '16px', textAlign: 'center', width: '28px' }}>
            ⠿
          </td>
        );
      case 'id':
        return <td key={key} style={{ padding: '12px 16px', fontSize: '13px', color: '#94a3b8', fontFamily: 'monospace' }}>{emp.soldierId || '—'}</td>;
      case 'name':
        return (
          <td key={key} style={{ padding: '12px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                background: '#dbeafe', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: '600', color: '#2563eb', fontSize: '12px',
              }}>
                {emp.name ? emp.name.split(' ').map(n => n[0]).join('') : '?'}
              </div>
              <span style={{ fontWeight: '500', fontSize: '14px' }}>{emp.name || '—'}</span>
            </div>
          </td>
        );
      case 'email':
        return <td key={key} style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{emp.email || '—'}</td>;
      case 'phone':
        return <td key={key} style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{emp.phone || '—'}</td>;
      case 'privateId':
        return <td key={key} style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{emp.privateId || '—'}</td>;
      case 'role':
        return <td key={key} style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{emp.role || '—'}</td>;
      case 'status':
        return <td key={key} style={{ padding: '12px 16px' }}>{statusBadge(emp.status)}</td>;
    }
  }

  const colLabel = (key: ColKey) => ALL_COLUMNS.find(c => c.key === key)!.label;
  const sortIcon = (key: ColKey) => {
    if (!SORTABLE.includes(key)) return null;
    if (sortCol !== key) return <span style={{ color: '#d1d5db', fontSize: '10px' }}>⇅</span>;
    return <span style={{ color: '#2563eb', fontSize: '10px' }}>{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <input
          placeholder="🔍 Search soldiers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '220px', flex: 1 }}
        />
        {sortCol && (
          <button onClick={() => setSortCol(null)} style={{
            padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px',
            background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b',
          }}>
            Clear Sort
          </button>
        )}
        {someChecked && oneChecked && (
          <button
            onClick={() => { setEditEmployee(employees.find(e => e.id === selectedArr[0])); setShowForm(true); }}
            style={{ padding: '8px 16px', background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            Edit
          </button>
        )}
        {someChecked && (
          <button
            onClick={() => setDeleteIds(selectedArr)}
            style={{ padding: '8px 16px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            Delete{selectedArr.length > 1 ? ` (${selectedArr.length})` : ''}
          </button>
        )}
        <input ref={csvInput} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleCSV} />
        <button onClick={() => {
          const headers = ['ID', 'Name', 'Email', 'Phone', 'Private ID', 'Role', 'Status'];
          const rows = employees.map(e => [
            e.soldierId ?? '', e.name, e.email, e.phone ?? '', e.privateId ?? '', e.role ?? '', e.status
          ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
          const csv = [headers.join(','), ...rows].join('\n');
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
          a.download = 'soldiers.csv';
          a.click();
        }} style={{
          padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0',
          borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer',
        }}>⬇ Export CSV</button>
        <button onClick={() => csvInput.current?.click()} style={{
          padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0',
          borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer',
        }}>⬆ Import CSV</button>
        <button onClick={() => { setEditEmployee(undefined); setShowForm(true); }} style={{
          padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none',
          borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer',
        }}>+ Add Soldier</button>
      </div>
      {csvError && (
        <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', display: 'flex', justifyContent: 'space-between' }}>
          {csvError}
          <span onClick={() => setCsvError(null)} style={{ cursor: 'pointer', fontWeight: '700' }}>×</span>
        </div>
      )}

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
                  {columns.map(key => (
                    <th
                      key={key}
                      draggable={key !== 'check' && key !== 'drag'}
                      onDragStart={() => onColDragStart(key)}
                      onDragEnter={() => setColDragOver(key)}
                      onDragOver={e => e.preventDefault()}
                      onDrop={() => onColDrop(key)}
                      onDragEnd={() => setColDragOver(null)}
                      onClick={() => handleSort(key)}
                      style={{
                        padding: (key === 'check' || key === 'drag') ? '12px 8px' : '12px 16px',
                        textAlign: key === 'check' ? 'center' : 'left',
                        fontSize: '13px', fontWeight: '600', color: '#374151',
                        cursor: SORTABLE.includes(key) ? 'pointer' : (key === 'check' || key === 'drag') ? 'default' : 'grab',
                        userSelect: 'none',
                        background: colDragOver === key ? '#e0e7ff' : sortCol === key ? '#f0f7ff' : '#f8fafc',
                        borderRight: colDragOver === key ? '2px solid #6366f1' : '2px solid transparent',
                        transition: 'background 0.15s',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {key === 'check' ? (
                        <input
                          type="checkbox"
                          checked={allChecked}
                          onChange={toggleAll}
                          style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
                        />
                      ) : key === 'drag' ? (
                        <span style={{ color: '#d1d5db', fontSize: '14px' }}>⠿</span>
                      ) : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ color: '#d1d5db', fontSize: '11px' }}>⠿</span>
                          {colLabel(key)}
                          {sortIcon(key)}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((emp, i) => (
                  <tr
                    key={emp.id}
                    draggable
                    onDragStart={() => onRowDragStart(emp.id)}
                    onDragEnter={() => setRowDragOver(emp.id)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => onRowDrop(emp.id)}
                    onDragEnd={() => setRowDragOver(null)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: selected.has(emp.id) ? '#eff6ff' : rowDragOver === emp.id ? '#f0fdf4' : i % 2 === 0 ? 'white' : '#fafafa',
                      borderTop: rowDragOver === emp.id ? '2px solid #2563eb' : undefined,
                      transition: 'background 0.1s',
                    }}
                  >
                    {columns.map(key => renderCell(key, emp))}
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
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditEmployee(undefined); }}
        />
      )}

      {deleteIds && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              {deleteIds.length === 1
                ? 'Are you sure you want to delete this soldier?'
                : `Are you sure you want to delete ${deleteIds.length} soldiers?`} This action cannot be undone.
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
