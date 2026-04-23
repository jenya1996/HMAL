import { useState, useRef } from 'react';
import { ColumnDef, FieldType, TaskTemplate, TaskGroup } from '../../types';
import { useFirestore } from '../../hooks/useFirestore';

const PRESET_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#ea580c',
  '#d97706', '#7c3aed', '#0891b2', '#db2777',
];

interface SettingsProps {
  columnDefs: ColumnDef[];
  onUpdateColumns: (cols: ColumnDef[]) => void;
  taskTemplates: TaskTemplate[];
  onUpdateTaskTemplates: (t: TaskTemplate[]) => void;
  taskGroups: TaskGroup[];
  onUpdateTaskGroups: (g: TaskGroup[]) => void;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:        'Text',
  number:      'Number',
  dropdown:    'Dropdown',
  multiselect: 'Multi-select',
};

export default function Settings({ columnDefs, onUpdateColumns, taskTemplates, onUpdateTaskTemplates, taskGroups, onUpdateTaskGroups }: SettingsProps) {
  const [activeTab, setActiveTab] = useState<'soldiers' | 'tasks'>('soldiers');
  const [newColLabel, setNewColLabel] = useState('');
  const [newColType, setNewColType] = useState<FieldType>('text');

  // Task template form state
  const [tplName, setTplName]         = useState('');
  const [tplStart, setTplStart]       = useState('08:00');
  const [tplEnd, setTplEnd]           = useState('16:00');
  const [tplSoldiers, setTplSoldiers] = useState(1);
  const [tplColor, setTplColor]       = useState(PRESET_COLORS[0]);
  const [tplCerts, setTplCerts]           = useState<string[]>([]);
  const [tplCertLimits, setTplCertLimits] = useState<Record<string, number>>({});
  const [tplGroupId, setTplGroupId]       = useState<string>('');
  const [editingTpl, setEditingTpl]     = useState<string | null>(null);
  const [certSourceKey, setCertSourceKey] = useFirestore<string>('hmal-cert-source-col', '');

  // Group management state
  const [newGroupName, setNewGroupName]         = useState('');
  const [newGroupInterval, setNewGroupInterval] = useState(8);
  const [newGroupAlert, setNewGroupAlert]       = useState(16);

  function resetTplForm() {
    setTplName(''); setTplStart('08:00'); setTplEnd('16:00');
    setTplSoldiers(1); setTplColor(PRESET_COLORS[0]); setTplCerts([]); setTplCertLimits({}); setTplGroupId('');
  }

  function addGroup() {
    const name = newGroupName.trim();
    if (!name) return;
    onUpdateTaskGroups([...taskGroups, { id: `grp_${Date.now()}`, name, intervalHours: newGroupInterval, alertHours: newGroupAlert }]);
    setNewGroupName('');
    setNewGroupInterval(8);
    setNewGroupAlert(16);
  }

  function deleteGroup(id: string) {
    onUpdateTaskGroups(taskGroups.filter(g => g.id !== id));
    onUpdateTaskTemplates(taskTemplates.map(t => t.groupId === id ? { ...t, groupId: undefined } : t));
  }

  function addTemplate() {
    const name = tplName.trim();
    if (!name) return;
    const certLimits = Object.fromEntries(tplCerts.map(c => [c, tplCertLimits[c] ?? 1]));
    if (editingTpl) {
      onUpdateTaskTemplates(taskTemplates.map(t =>
        t.id === editingTpl ? { ...t, name, startTime: tplStart, endTime: tplEnd, requiredSoldiers: tplSoldiers, color: tplColor, certifications: tplCerts, certLimits, groupId: tplGroupId || undefined } : t
      ));
      setEditingTpl(null);
    } else {
      onUpdateTaskTemplates([...taskTemplates, { id: `tpl_${Date.now()}`, name, startTime: tplStart, endTime: tplEnd, requiredSoldiers: tplSoldiers, color: tplColor, certifications: tplCerts, certLimits, groupId: tplGroupId || undefined }]);
    }
    resetTplForm();
  }

  function startEdit(tpl: TaskTemplate) {
    setEditingTpl(tpl.id);
    setTplName(tpl.name);
    setTplStart(tpl.startTime);
    setTplEnd(tpl.endTime);
    setTplSoldiers(tpl.requiredSoldiers);
    setTplColor(tpl.color);
    setTplCerts(tpl.certifications ?? []);
    setTplCertLimits(tpl.certLimits ?? {});
    setTplGroupId(tpl.groupId ?? '');
  }

  function cancelEdit() {
    setEditingTpl(null);
    resetTplForm();
  }

  function toggleCert(c: string) {
    setTplCerts(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  }

  // Columns eligible to be the cert source
  const certCols = columnDefs.filter(c => (c.fieldType === 'multiselect' || c.fieldType === 'dropdown') && !c.builtin);
  // Options from the user-selected source column only
  const certPool = certCols.find(c => c.key === certSourceKey)?.options ?? [];

  function deleteTemplate(id: string) {
    onUpdateTaskTemplates(taskTemplates.filter(t => t.id !== id));
    if (editingTpl === id) cancelEdit();
  }

  function durationLabel(start: string, end: string): string {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let mins = (eh * 60 + em) - (sh * 60 + sm);
    if (mins <= 0) mins += 24 * 60;
    const h = Math.floor(mins / 60), m = mins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
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
    const newColors = { ...col.optionColors };
    delete newColors[opt];
    updateCol(key, { options: (col.options ?? []).filter(o => o !== opt), optionColors: newColors });
  }

  function updateOptionColor(key: string, opt: string, color: string) {
    const col = columnDefs.find(c => c.key === key);
    if (!col) return;
    updateCol(key, { optionColors: { ...col.optionColors, [opt]: color } });
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

  const tabBtn = (tab: 'soldiers' | 'tasks'): React.CSSProperties => ({
    padding: '9px 22px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    border: 'none', borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
    background: 'none', color: activeTab === tab ? '#2563eb' : '#64748b',
    transition: 'color 0.1s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '0' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: 'white', borderRadius: '12px 12px 0 0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', paddingLeft: '8px' }}>
        <button style={tabBtn('soldiers')} onClick={() => setActiveTab('soldiers')}>Soldier Table</button>
        <button style={tabBtn('tasks')} onClick={() => setActiveTab('tasks')}>Task Templates</button>
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px', background: 'white', borderRadius: '0 0 12px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>

      {activeTab === 'soldiers' && (
      <div style={{ maxWidth: '600px' }}>
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

                {/* Options toggle (dropdown/multiselect) — shown for all such columns, builtin or not */}
                {needsOptions(col.fieldType) && (
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
                  {col.builtin && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: '0 0 8px', fontStyle: 'italic' }}>
                      Click the color dot inside each option to set the row background color.
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                    {(col.options ?? []).length === 0 && (
                      <span style={{ fontSize: '13px', color: '#94a3b8' }}>No options yet. Add some below.</span>
                    )}
                    {(col.options ?? []).map(opt => (
                      <span key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px 3px 4px', borderRadius: '9999px', background: col.optionColors?.[opt] ?? '#e0e7ff', color: '#1e293b', fontSize: '12px', fontWeight: '500' }}>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }} title="Row color">
                          <input
                            type="color"
                            value={col.optionColors?.[opt] ?? '#e0e7ff'}
                            onChange={e => updateOptionColor(col.key, opt, e.target.value)}
                            style={{ width: '14px', height: '14px', border: '1px solid rgba(0,0,0,0.2)', cursor: 'pointer', padding: 0, borderRadius: '50%', outline: 'none', flexShrink: 0 }}
                          />
                        </label>
                        {opt}
                        <button onClick={() => removeOption(col.key, opt)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(0,0,0,0.4)', fontWeight: '700', padding: '0 1px', fontSize: '13px', lineHeight: 1 }}>×</button>
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
      )}

      {activeTab === 'tasks' && (
      <div style={{ maxWidth: '600px' }}>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
          Define recurring tasks with time slots and required headcount.
        </p>

        {/* ── Groups ── */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '10px' }}>Groups</div>

          {/* Existing groups */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
            {taskGroups.length === 0 && (
              <span style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic' }}>No groups yet.</span>
            )}
            {taskGroups.map(g => (
              <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 10px', borderRadius: '8px', background: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{g.name}</span>
                <span style={{ fontSize: '11px', color: '#64748b', background: '#e2e8f0', borderRadius: '4px', padding: '1px 6px' }}>{g.intervalHours}h rest</span>
                <span style={{ fontSize: '11px', color: '#dc2626', background: '#fef2f2', borderRadius: '4px', padding: '1px 6px' }}>⚠ {g.alertHours ?? 16}h alert</span>
                <button onClick={() => deleteGroup(g.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '14px', lineHeight: 1, padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>

          {/* Add group form */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              value={newGroupName}
              onChange={e => setNewGroupName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGroup()}
              placeholder="Group name..."
              style={{ ...inputStyle, flex: 1, minWidth: '140px', padding: '7px 10px' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap' }}>Rest interval</span>
              <input type="number" min={1} max={72} value={newGroupInterval}
                onChange={e => setNewGroupInterval(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ ...inputStyle, width: '54px', textAlign: 'center' }} />
              <span style={{ fontSize: '12px', color: '#64748b' }}>h</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500', whiteSpace: 'nowrap' }}>⚠ Alert after</span>
              <input type="number" min={1} max={24} value={newGroupAlert}
                onChange={e => setNewGroupAlert(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ ...inputStyle, width: '54px', textAlign: 'center' }} />
              <span style={{ fontSize: '12px', color: '#64748b' }}>h</span>
            </div>
            <button onClick={addGroup} disabled={!newGroupName.trim()}
              style={{ padding: '7px 14px', border: 'none', borderRadius: '6px', background: newGroupName.trim() ? '#2563eb' : '#e2e8f0', color: newGroupName.trim() ? 'white' : '#94a3b8', fontSize: '13px', fontWeight: '500', cursor: newGroupName.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
              + Add Group
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e2e8f0', marginBottom: '20px' }} />

        {/* Template list */}
        {taskTemplates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {taskTemplates.map(tpl => (
              <div key={tpl.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px', padding: '10px 12px', borderRadius: '8px', border: `2px solid ${editingTpl === tpl.id ? tpl.color : '#e2e8f0'}`, background: editingTpl === tpl.id ? tpl.color + '11' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '14px', height: '14px', borderRadius: '4px', background: tpl.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>{tpl.name}</span>
                  {tpl.groupId && (() => { const g = taskGroups.find(x => x.id === tpl.groupId); return g ? <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: '#e0e7ff', color: '#4338ca', border: '1px solid #c7d2fe' }}>{g.name}</span> : null; })()}
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{tpl.startTime}–{tpl.endTime}</span>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{durationLabel(tpl.startTime, tpl.endTime)}</span>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: tpl.color, minWidth: '60px', textAlign: 'right' }}>{tpl.requiredSoldiers} soldier{tpl.requiredSoldiers !== 1 ? 's' : ''}</span>
                  <button onClick={() => startEdit(tpl)} style={{ padding: '3px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontSize: '12px', cursor: 'pointer' }}>Edit</button>
                  <button onClick={() => deleteTemplate(tpl.id)} style={{ padding: '3px 8px', borderRadius: '6px', border: '1px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                </div>
                {(tpl.certifications ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '22px' }}>
                    {tpl.certifications.map(c => (
                      <span key={c} style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '9999px', background: tpl.color + '18', color: tpl.color, border: `1px solid ${tpl.color}44` }}>{c}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add / Edit form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '8px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>{editingTpl ? 'Edit Template' : 'New Template'}</div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input value={tplName} onChange={e => setTplName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTemplate()}
              placeholder="Task name..." style={{ ...inputStyle, flex: 1, minWidth: '140px', padding: '8px 12px' }} />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Start</span>
              <input type="time" value={tplStart} onChange={e => setTplStart(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>End</span>
              <input type="time" value={tplEnd} onChange={e => setTplEnd(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Soldiers</span>
              <input type="number" min={1} max={99} value={tplSoldiers} onChange={e => setTplSoldiers(Math.max(1, parseInt(e.target.value) || 1))}
                style={{ ...inputStyle, width: '60px', textAlign: 'center' }} />
            </div>
            {tplStart && tplEnd && (
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{durationLabel(tplStart, tplEnd)}</span>
            )}
          </div>

          {/* Certifications */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Required Certifications</span>
              {certCols.length > 0 && (
                <select
                  value={certSourceKey}
                  onChange={e => { setCertSourceKey(e.target.value); setTplCerts([]); }}
                  style={{ ...inputStyle, fontSize: '12px', padding: '3px 8px', cursor: 'pointer', color: certSourceKey ? '#1e293b' : '#94a3b8' }}
                >
                  <option value="">— pick column —</option>
                  {certCols.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                </select>
              )}
            </div>
            {certCols.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                No options available. Add a <strong>Multiselect</strong> or <strong>Dropdown</strong> column with options to the Soldier Table above.
              </p>
            ) : !certSourceKey ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                Select a column above to pick certifications from.
              </p>
            ) : certPool.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>
                The selected column has no options yet. Add options to it in the Soldier Table above.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {certPool.map(c => {
                  const selected = tplCerts.includes(c);
                  const limit = tplCertLimits[c] ?? 1;
                  return (
                    <div key={c} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      <button onClick={() => toggleCert(c)} style={{
                        padding: '4px 10px', cursor: 'pointer', fontSize: '12px',
                        fontWeight: selected ? '700' : '400',
                        background: selected ? tplColor + '22' : 'white',
                        border: `1.5px solid ${selected ? tplColor : '#e2e8f0'}`,
                        borderRight: selected ? 'none' : undefined,
                        borderRadius: selected ? '9999px 0 0 9999px' : '9999px',
                        color: selected ? tplColor : '#64748b',
                        transition: 'all 0.1s',
                      }}>
                        {selected ? '✓ ' : ''}{c}
                      </button>
                      {selected && (
                        <input
                          type="number" min={1} max={99}
                          value={limit}
                          onChange={e => setTplCertLimits(prev => ({ ...prev, [c]: Math.max(1, parseInt(e.target.value) || 1) }))}
                          onClick={e => e.stopPropagation()}
                          title="Max soldiers for this cert"
                          style={{
                            width: '38px', padding: '4px 4px', textAlign: 'center',
                            border: `1.5px solid ${tplColor}`, borderLeft: 'none',
                            borderRadius: '0 9999px 9999px 0',
                            fontSize: '12px', fontWeight: '700',
                            color: tplColor, background: tplColor + '22', outline: 'none',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* Group */}
          {taskGroups.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Group</span>
              <select value={tplGroupId} onChange={e => setTplGroupId(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="">— none —</option>
                {taskGroups.map(g => <option key={g.id} value={g.id}>{g.name} ({g.intervalHours}h rest)</option>)}
              </select>
            </div>
          )}

          {/* Color picker */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '500' }}>Color</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              {PRESET_COLORS.map(c => (
                <button key={c} onClick={() => setTplColor(c)} style={{ width: '24px', height: '24px', borderRadius: '6px', background: c, border: tplColor === c ? '3px solid #1e293b' : '3px solid transparent', cursor: 'pointer', padding: 0, flexShrink: 0 }} />
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={addTemplate} disabled={!tplName.trim()} style={{ padding: '8px 18px', border: 'none', borderRadius: '6px', background: tplName.trim() ? tplColor : '#e2e8f0', color: tplName.trim() ? 'white' : '#94a3b8', fontSize: '13px', fontWeight: '600', cursor: tplName.trim() ? 'pointer' : 'default' }}>
              {editingTpl ? 'Save Changes' : '+ Add Template'}
            </button>
            {editingTpl && (
              <button onClick={cancelEdit} style={{ padding: '8px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
            )}
          </div>
        </div>
      </div>
      )}


</div>
    </div>
  );
}
