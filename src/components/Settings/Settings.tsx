import { useState, useRef } from 'react';
import { ColumnDef, FieldType } from '../../types';

interface SettingsProps {
  columnDefs: ColumnDef[];
  onUpdateColumns: (cols: ColumnDef[]) => void;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:        'Text',
  number:      'Number',
  dropdown:    'Dropdown',
  multiselect: 'Multi-select',
};

export default function Settings({ columnDefs, onUpdateColumns }: SettingsProps) {
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<FieldType>('text');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [newOption, setNewOption] = useState('');
  const dragIdx = useRef<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);

  function updateCol(key: string, patch: Partial<ColumnDef>) {
    onUpdateColumns(columnDefs.map(c => c.key === key ? { ...c, ...patch } : c));
  }

  function deleteColumn(key: string) {
    onUpdateColumns(columnDefs.filter(c => c.key !== key));
    if (expandedKey === key) setExpandedKey(null);
  }

  function addColumn() {
    const label = newColLabel.trim();
    if (!label) return;
    const key = `custom_${Date.now()}`;
    onUpdateColumns([...columnDefs, { key, label, visible: true, builtin: false, fieldType: newColType, options: [] }]);
    setNewColLabel('');
    setNewColType('text');
  }

  function addOption(key: string) {
    const opt = newOption.trim();
    if (!opt) return;
    const col = columnDefs.find(c => c.key === key);
    if (!col) return;
    updateCol(key, { options: [...(col.options ?? []), opt] });
    setNewOption('');
  }

  function removeOption(key: string, opt: string) {
    const col = columnDefs.find(c => c.key === key);
    if (!col) return;
    updateCol(key, { options: (col.options ?? []).filter(o => o !== opt) });
  }

  function onDragStart(i: number) { dragIdx.current = i; }
  function onDrop(i: number) {
    if (dragIdx.current === null || dragIdx.current === i) { setDragOver(null); return; }
    const next = [...columnDefs];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(i, 0, moved);
    onUpdateColumns(next);
    dragIdx.current = null;
    setDragOver(null);
  }

  const needsOptions = (t?: FieldType) => t === 'dropdown' || t === 'multiselect';

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: '6px',
    fontSize: '13px', outline: 'none', background: 'white',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto', flex: 1 }}>
      <div style={{ background: 'white', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: '600px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>Soldier Table Columns</h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
          Show/hide columns, drag to reorder, add custom columns with a data type.
        </p>

        {/* Column list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
          {columnDefs.map((col, i) => (
            <div key={col.key}>
              {/* Main row */}
              <div
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => setDragOver(i)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(i)}
                onDragEnd={() => setDragOver(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 12px', borderRadius: expandedKey === col.key ? '8px 8px 0 0' : '8px',
                  border: dragOver === i ? '2px solid #2563eb' : '2px solid #e2e8f0',
                  borderBottom: expandedKey === col.key ? '1px solid #e2e8f0' : undefined,
                  background: dragOver === i ? '#eff6ff' : col.visible ? 'white' : '#f8fafc',
                  transition: 'border-color 0.1s',
                  cursor: 'grab',
                }}
              >
                <span style={{ color: '#cbd5e1', fontSize: '16px', flexShrink: 0 }}>⠿</span>

                {/* Label */}
                <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: col.visible ? '#1e293b' : '#94a3b8', minWidth: 0 }}>
                  {col.label}
                  {col.builtin
                    ? <span style={{ marginLeft: '6px', fontSize: '11px', color: '#94a3b8', fontWeight: '400' }}>built-in</span>
                    : <span style={{ marginLeft: '6px', fontSize: '11px', color: '#64748b', fontWeight: '400' }}>
                        {FIELD_TYPE_LABELS[col.fieldType ?? 'text']}
                      </span>
                  }
                </span>

                {/* Field type selector (custom only) */}
                {!col.builtin && (
                  <select
                    value={col.fieldType ?? 'text'}
                    onChange={e => {
                      const t = e.target.value as FieldType;
                      updateCol(col.key, { fieldType: t, options: needsOptions(t) ? (col.options ?? []) : [] });
                      if (needsOptions(t)) setExpandedKey(col.key);
                      else setExpandedKey(null);
                    }}
                    onClick={e => e.stopPropagation()}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(t => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                )}

                {/* Options toggle (dropdown/multiselect) */}
                {!col.builtin && needsOptions(col.fieldType) && (
                  <button
                    onClick={e => { e.stopPropagation(); setExpandedKey(expandedKey === col.key ? null : col.key); }}
                    style={{
                      ...inputStyle, cursor: 'pointer', flexShrink: 0,
                      background: expandedKey === col.key ? '#eff6ff' : 'white',
                      color: expandedKey === col.key ? '#2563eb' : '#64748b',
                      border: `1px solid ${expandedKey === col.key ? '#bfdbfe' : '#e2e8f0'}`,
                    }}
                  >
                    Options {col.options?.length ? `(${col.options.length})` : ''}
                  </button>
                )}

                {/* Visible toggle */}
                <button
                  onClick={e => { e.stopPropagation(); updateCol(col.key, { visible: !col.visible }); }}
                  style={{
                    padding: '4px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', flexShrink: 0,
                    background: col.visible ? '#dcfce7' : '#f1f5f9',
                    color: col.visible ? '#15803d' : '#94a3b8',
                    fontSize: '12px', fontWeight: '600', cursor: 'pointer',
                  }}
                >
                  {col.visible ? 'Visible' : 'Hidden'}
                </button>

                {/* Delete */}
                {!col.builtin && (
                  <button
                    onClick={e => { e.stopPropagation(); deleteColumn(col.key); }}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Options editor */}
              {expandedKey === col.key && needsOptions(col.fieldType) && (
                <div style={{ border: '2px solid #e2e8f0', borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px', background: '#f8fafc' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {(col.options ?? []).length === 0 && (
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>No options yet. Add some below.</span>
                    )}
                    {(col.options ?? []).map(opt => (
                      <span key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 10px', borderRadius: '9999px', background: '#e0e7ff', color: '#3730a3', fontSize: '12px', fontWeight: '500' }}>
                        {opt}
                        <button onClick={() => removeOption(col.key, opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6366f1', fontWeight: '700', padding: '0 2px', fontSize: '12px' }}>×</button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      value={newOption}
                      onChange={e => setNewOption(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addOption(col.key)}
                      placeholder="Add option..."
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() => addOption(col.key)}
                      disabled={!newOption.trim()}
                      style={{
                        padding: '6px 14px', border: 'none', borderRadius: '6px',
                        background: newOption.trim() ? '#2563eb' : '#e2e8f0',
                        color: newOption.trim() ? 'white' : '#94a3b8',
                        fontSize: '13px', fontWeight: '500', cursor: newOption.trim() ? 'pointer' : 'default',
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add custom column */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            value={newColLabel}
            onChange={e => setNewColLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addColumn()}
            placeholder="New column name..."
            style={{ ...inputStyle, flex: 1, minWidth: '160px', padding: '8px 12px' }}
          />
          <select
            value={newColType}
            onChange={e => setNewColType(e.target.value as FieldType)}
            style={{ ...inputStyle, cursor: 'pointer', padding: '8px 12px' }}
          >
            {(Object.keys(FIELD_TYPE_LABELS) as FieldType[]).map(t => (
              <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
            ))}
          </select>
          <button
            onClick={addColumn}
            disabled={!newColLabel.trim()}
            style={{
              padding: '8px 18px', border: 'none', borderRadius: '6px',
              background: newColLabel.trim() ? '#2563eb' : '#e2e8f0',
              color: newColLabel.trim() ? 'white' : '#94a3b8',
              fontSize: '14px', fontWeight: '500', cursor: newColLabel.trim() ? 'pointer' : 'default',
              whiteSpace: 'nowrap',
            }}
          >
            + Add Column
          </button>
        </div>
      </div>
    </div>
  );
}
