import { useState, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { Employee, Department, ColumnDef, SoldierTableState } from '../../types';
import EmployeeForm from './EmployeeForm';
import { getVal, getFilterOptions, matchesFilters } from '../../lib/employeeFilters';
import { useUserPref } from '../../hooks/useUserPref';

interface EmployeeListProps {
  employees: Employee[];
  departments: Department[];
  columnDefs: ColumnDef[];
  onUpdate: (employees: Employee[]) => void;
  onDeleteSoldiers: (ids: string[]) => void;
}

type SortDir = 'asc' | 'desc';

const XLSX_MAX_SIZE = 5_000_000; // 5 MB

function sanitizeImportedField(s: string): string {
  return s.replace(/^[=+\-@\t\r]+/, '').trim().slice(0, 200);
}

export default function EmployeeList({ employees, departments, columnDefs, onUpdate, onDeleteSoldiers }: EmployeeListProps) {
  const [tableState, setTableState] = useUserPref<SoldierTableState>(
    'soldier-table-state',
    { search: '', filters: {} }
  );
  const search  = tableState.search;
  const filters = tableState.filters;
  function onSearchChange(v: string) { setTableState({ ...tableState, search: v }); }
  function onFiltersChange(f: Record<string, string>) { setTableState({ ...tableState, filters: f }); }

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
  const [bulkMultiInitial, setBulkMultiInitial] = useState<Record<string, string>>({});
  const [addingFilter, setAddingFilter] = useState(false);
  const [pendingCol, setPendingCol] = useState('');
  const [pendingVal, setPendingVal] = useState('');

  const visibleCols = columnDefs.filter(c => c.visible);
  const customCols  = columnDefs.filter(c => !c.builtin);
  const deptCol     = columnDefs.find(c => c.key === 'department');

  const handleXLSX = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > XLSX_MAX_SIZE) {
      setCsvError(`File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 5 MB.`);
      if (csvInput.current) csvInput.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        if (rows.length < 2) { setCsvError('File must have a header row and at least one data row.'); return; }
        if (rows.length > 5001) { setCsvError('File contains too many rows (max 5,000).'); return; }

        const headerRow = (rows[0] as unknown[]).map(h => String(h ?? '').trim().toLowerCase());

        // Build label→key map from columnDefs, plus common aliases for built-in fields
        const labelToKey: Record<string, string> = {};
        for (const col of columnDefs) {
          labelToKey[col.label.toLowerCase()] = col.key;
        }
        const aliases: Record<string, string> = {
          'id': 'id', 'soldierid': 'id', 'name': 'name', 'fullname': 'name',
          'email': 'email', 'phone': 'phone', 'phonenumber': 'phone',
          'privateid': 'privateId', 'role': 'role', 'department': 'department', 'status': 'status',
        };
        const keyToIndex: Record<string, number> = {};
        for (let i = 0; i < headerRow.length; i++) {
          const h = headerRow[i];
          const normalized = h.replace(/\s+/g, '');
          const key = labelToKey[h] ?? aliases[normalized] ?? null;
          if (key !== null && !(key in keyToIndex)) keyToIndex[key] = i;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const newSoldiers: Employee[] = (rows.slice(1) as unknown[][]).map(row => {
          const get = (key: string): string => {
            const idx = keyToIndex[key];
            return idx !== undefined ? sanitizeImportedField(String(row[idx] ?? '')) : '';
          };
          const name = get('name');
          if (!name) return null;

          const customFields: Record<string, string> = {};
          for (const col of columnDefs.filter(c => !c.builtin)) {
            const val = get(col.key);
            if (val) customFields[col.key] = val;
          }

          const rawStatus = get('status');
          const status = (['Active', 'Inactive', 'Annexation'].includes(rawStatus) ? rawStatus : 'Active') as Employee['status'];
          const email = get('email');

          return {
            id: crypto.randomUUID(),
            soldierId: get('id'),
            name: name.replace(/\b\w/g, c => c.toUpperCase()),
            email: emailRegex.test(email) ? email.slice(0, 200) : '',
            phone: get('phone'),
            privateId: get('privateId'),
            role: get('role'),
            department: get('department'),
            status,
            position: '',
            startDate: new Date().toISOString().split('T')[0],
            ...(Object.keys(customFields).length > 0 && { customFields }),
          };
        }).filter(Boolean) as Employee[];

        if (newSoldiers.length === 0) { setCsvError('No valid soldiers found in file.'); return; }
        onUpdate([...employees, ...newSoldiers]);
        setCsvError(null);
      } catch {
        setCsvError('Failed to parse file. Please check the file format.');
      } finally {
        if (csvInput.current) csvInput.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  }, [employees, onUpdate, columnDefs]);

  const filtered = employees.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q);
    return matchSearch && matchesFilters(e, filters, columnDefs);
  });

  const sorted = sortCol
    ? [...filtered].sort((a, b) => {
        const av = getVal(a, sortCol).toLowerCase();
        const bv = getVal(b, sortCol).toLowerCase();
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : filtered;

  const selectedArr = Array.from(selected);
  const allChecked  = sorted.length > 0 && sorted.every(e => selected.has(e.id));

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
    onUpdate(next);
    setShowForm(false); setEditEmployee(undefined); setSelected(new Set());
  }
  function openBulkEdit() {
    const selectedEmps = employees.filter(e => selected.has(e.id));
    const multiInitial: Record<string, string> = {};
    const customInit: Record<string, string> = {};
    for (const col of customCols.filter(c => c.fieldType === 'multiselect')) {
      const common = (col.options ?? []).filter(opt =>
        selectedEmps.every(e => (e.customFields?.[col.key] ?? '').split('|').filter(Boolean).includes(opt))
      );
      const val = common.join('|');
      multiInitial[col.key] = val;
      customInit[col.key] = val;
    }
    setBulkMultiInitial(multiInitial);
    setBulkFields({ status: '', role: '', department: '', custom: customInit });
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
      const newCustom = { ...e.customFields };
      for (const col of customCols) {
        const val = bulkFields.custom[col.key] ?? '';
        if (col.fieldType === 'multiselect') {
          const current = new Set(val.split('|').filter(Boolean));
          const initial = new Set((bulkMultiInitial[col.key] ?? '').split('|').filter(Boolean));
          const toAdd    = [...current].filter(o => !initial.has(o));
          const toRemove = [...initial].filter(o => !current.has(o));
          if (toAdd.length > 0 || toRemove.length > 0) {
            const existing = new Set((e.customFields?.[col.key] ?? '').split('|').filter(Boolean));
            toAdd.forEach(o => existing.add(o));
            toRemove.forEach(o => existing.delete(o));
            newCustom[col.key] = [...existing].join('|');
          }
        } else if (val.trim()) {
          newCustom[col.key] = val.trim();
        }
      }
      updated.customFields = newCustom;
      return updated;
    });
    onUpdate(next);
    setShowBulkEdit(false);
    setSelected(new Set());
  }
  function handleDelete(ids: string[]) {
    onDeleteSoldiers(ids);
    setSelected(new Set()); setDeleteIds(null);
  }
  function onRowDragStart(id: string) { dragRow.current = id; }
  function onRowDrop(id: string) {
    if (!dragRow.current || dragRow.current === id) { setRowDragOver(null); return; }
    const from = employees.findIndex(e => e.id === dragRow.current);
    const to   = employees.findIndex(e => e.id === id);
    const next = [...employees];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
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
            <div aria-hidden="true" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: '#2563eb', fontSize: '12px' }}>
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
        const rawBg = deptCol?.optionColors?.[dept] ?? '#e2e8f0';
        const bg = /^#[0-9A-Fa-f]{3,8}$/.test(rawBg) ? rawBg : '#e2e8f0';
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
                {parts.map(p => {
                  const rawBg = col.optionColors?.[p] ?? '#e0e7ff';
                  const bg = /^#[0-9A-Fa-f]{3,8}$/.test(rawBg) ? rawBg : '#e0e7ff';
                  return (
                    <span key={p} style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '500', background: bg, color: '#1e293b' }}>{p}</span>
                  );
                })}
              </div>
            </td>
          );
        }
        return td(val);
      }
    }
  }

  const sortIcon = (key: string) => {
    if (sortCol !== key) return <span style={{ color: '#d1d5db', fontSize: '10px' }} aria-hidden="true">⇅</span>;
    return <span style={{ color: '#2563eb', fontSize: '10px' }} aria-hidden="true">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  function handleExportXLSX() {
    const allCols = columnDefs; // all columns: visible, hidden, builtin, custom
    const headers = allCols.map(c => c.label);
    const rows = employees.map(e =>
      allCols.map(c => {
        switch (c.key) {
          case 'id':         return e.soldierId ?? '';
          case 'name':       return e.name;
          case 'email':      return e.email;
          case 'phone':      return e.phone ?? '';
          case 'privateId':  return e.privateId ?? '';
          case 'role':       return e.role ?? '';
          case 'department': return e.department;
          case 'status':     return e.status;
          default:           return e.customFields?.[c.key] ?? '';
        }
      })
    );
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Soldiers');
    XLSX.writeFile(wb, 'soldiers.xlsx');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <input
          placeholder="Search soldiers..."
          aria-label="Search soldiers"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '180px', flex: 1 }}
        />

        {/* Active filter chips */}
        {Object.entries(filters).map(([key, val]) => {
          const col = columnDefs.find(c => c.key === key);
          return (
            <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '9999px', fontSize: '13px', color: '#1d4ed8', whiteSpace: 'nowrap' }}>
              {col?.label ?? key}: <strong>{val}</strong>
              <button onClick={() => { const n = { ...filters }; delete n[key]; onFiltersChange(n); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: '15px', lineHeight: 1, padding: '0 0 0 2px' }} aria-label={`Remove ${col?.label} filter`}>×</button>
            </span>
          );
        })}

        {/* Add filter row */}
        {addingFilter ? (
          <>
            <select value={pendingCol} onChange={e => { setPendingCol(e.target.value); setPendingVal(''); }}
              style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
              <option value="">Column…</option>
              {visibleCols.filter(c => !filters[c.key]).map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            {pendingCol && (() => {
              const col = columnDefs.find(c => c.key === pendingCol);
              const opts = col ? getFilterOptions(col) : [];
              return opts.length > 0
                ? (
                  <select value={pendingVal} onChange={e => setPendingVal(e.target.value)}
                    style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', background: 'white' }}>
                    <option value="">Value…</option>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input value={pendingVal} onChange={e => setPendingVal(e.target.value)}
                    placeholder="Value…" autoFocus
                    style={{ padding: '7px 10px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '13px', width: '130px' }} />
                );
            })()}
            <button
              disabled={!pendingCol || !pendingVal}
              onClick={() => { onFiltersChange({ ...filters, [pendingCol]: pendingVal }); setPendingCol(''); setPendingVal(''); setAddingFilter(false); }}
              style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: (!pendingCol || !pendingVal) ? '#e2e8f0' : '#2563eb', color: (!pendingCol || !pendingVal) ? '#94a3b8' : 'white', fontSize: '13px', fontWeight: '600', cursor: (!pendingCol || !pendingVal) ? 'default' : 'pointer' }}>
              Add
            </button>
            <button onClick={() => { setAddingFilter(false); setPendingCol(''); setPendingVal(''); }}
              style={{ padding: '7px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b' }}>
              Cancel
            </button>
          </>
        ) : (
          <button onClick={() => setAddingFilter(true)}
            style={{ padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b', whiteSpace: 'nowrap' }}>
            + Filter
          </button>
        )}

        {(Object.keys(filters).length > 0 || sortCol) && (
          <button onClick={() => { onFiltersChange({}); setSortCol(null); }}
            style={{ padding: '7px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#64748b' }}>
            Clear All
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
        <input ref={csvInput} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleXLSX} aria-label="Import Excel file" />
        <button onClick={handleExportXLSX} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          ⬇ Export Excel
        </button>
        <button onClick={() => csvInput.current?.click()} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          ⬆ Import Excel
        </button>
        <button onClick={() => { setEditEmployee(undefined); setShowForm(true); }} style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', cursor: 'pointer' }}>
          + Add Soldier
        </button>
      </div>

      {csvError && (
        <div role="alert" style={{ padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '13px', color: '#dc2626', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
          {csvError}
          <button onClick={() => setCsvError(null)} aria-label="Dismiss error" style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: '700', color: '#dc2626' }}>×</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', flex: 1, overflow: 'auto', minHeight: 0 }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }} aria-hidden="true">🪖</div>
            <div style={{ fontWeight: '500' }}>No soldiers found</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }} role="grid">
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                <th style={{ padding: '12px 8px', textAlign: 'center', width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    aria-label="Select all soldiers"
                    style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
                  />
                </th>
                {visibleCols.map(col => (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    aria-sort={sortCol === col.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
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
                  aria-selected={selected.has(emp.id)}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: selected.has(emp.id) ? '#eff6ff' : rowDragOver === emp.id ? '#f0fdf4' : emp.status === 'Inactive' ? '#fca5a5' : emp.status === 'Annexation' ? '#4ade80' : (() => { const rc = deptCol?.optionColors?.[emp.department]; return (rc && /^#[0-9A-Fa-f]{3,8}$/.test(rc)) ? rc : (i % 2 === 0 ? 'white' : '#fafafa'); })(),
                    borderTop: rowDragOver === emp.id ? '2px solid #2563eb' : undefined,
                    transition: 'background 0.1s',
                    cursor: 'pointer',
                  }}
                >
                  <td style={{ padding: '0 8px', textAlign: 'center', width: '36px' }} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(emp.id)}
                      onChange={() => toggleSelect(emp.id)}
                      onClick={e => e.stopPropagation()}
                      aria-label={`Select ${emp.name || 'soldier'}`}
                      style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: '#2563eb' }}
                    />
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
        <div role="dialog" aria-modal="true" aria-label="Bulk edit soldiers" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
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
        <div role="dialog" aria-modal="true" aria-label="Confirm delete" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
              {deleteIds.length === 1
                ? 'Are you sure you want to delete this soldier? Their schedule and task assignments will also be removed.'
                : `Are you sure you want to delete ${deleteIds.length} soldiers? Their schedule and task assignments will also be removed.`
              } This action cannot be undone.
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
