import { useState } from 'react';
import { ColumnDef, TaskTemplate, TaskGroup } from '../../types';

interface Props {
  columnDefs: ColumnDef[];
  onUpdateColumns: (cols: ColumnDef[]) => void;
  taskTemplates: TaskTemplate[];
  onUpdateTaskTemplates: (t: TaskTemplate[]) => void;
  taskGroups: TaskGroup[];
  onUpdateTaskGroups: (g: TaskGroup[]) => void;
}

type Tab = 'columns' | 'tasks';

const PRESET_COLORS = ['#2563eb','#16a34a','#dc2626','#ea580c','#d97706','#7c3aed','#0891b2','#db2777'];

export default function MobileSettings({ columnDefs, onUpdateColumns, taskTemplates, onUpdateTaskTemplates, taskGroups, onUpdateTaskGroups }: Props) {
  const [tab, setTab] = useState<Tab>('columns');

  // ── task template form ──────────────────────────────────────────────────────
  const [tplName,     setTplName]     = useState('');
  const [tplStart,    setTplStart]    = useState('08:00');
  const [tplEnd,      setTplEnd]      = useState('16:00');
  const [tplSoldiers, setTplSoldiers] = useState(1);
  const [tplColor,    setTplColor]    = useState(PRESET_COLORS[0]);
  const [showTplForm, setShowTplForm] = useState(false);

  // ── task group form ─────────────────────────────────────────────────────────
  const [grpName,     setGrpName]     = useState('');
  const [grpInterval, setGrpInterval] = useState(8);
  const [showGrpForm, setShowGrpForm] = useState(false);

  function toggleColumn(key: string) {
    onUpdateColumns(columnDefs.map(c => c.key === key ? { ...c, visible: !c.visible } : c));
  }

  function addTemplate() {
    if (!tplName.trim()) return;
    const newTpl: TaskTemplate = {
      id: `tpl_${Date.now()}`, name: tplName.trim(),
      startTime: tplStart, endTime: tplEnd,
      requiredSoldiers: tplSoldiers, color: tplColor, certifications: [],
    };
    onUpdateTaskTemplates([...taskTemplates, newTpl]);
    setTplName(''); setTplStart('08:00'); setTplEnd('16:00'); setTplSoldiers(1); setTplColor(PRESET_COLORS[0]);
    setShowTplForm(false);
  }

  function deleteTpl(id: string) {
    onUpdateTaskTemplates(taskTemplates.filter(t => t.id !== id));
  }

  function addGroup() {
    if (!grpName.trim()) return;
    onUpdateTaskGroups([...taskGroups, { id: `grp_${Date.now()}`, name: grpName.trim(), intervalHours: grpInterval, alertHours: 16 }]);
    setGrpName(''); setGrpInterval(8);
    setShowGrpForm(false);
  }

  function deleteGroup(id: string) {
    onUpdateTaskGroups(taskGroups.filter(g => g.id !== id));
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Tab switcher */}
      <div style={{ display: 'flex', background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        {(['columns', 'tasks'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            flex: 1, padding: '13px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '14px', fontWeight: tab === t ? '700' : '400',
            color: tab === t ? '#2563eb' : '#64748b',
            borderBottom: `2px solid ${tab === t ? '#2563eb' : 'transparent'}`,
          }}>
            {t === 'columns' ? 'Columns' : 'Tasks'}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

        {/* ── COLUMNS TAB ─────────────────────────────────────────── */}
        {tab === 'columns' && (
          <>
            <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Show / Hide Columns
            </div>
            {columnDefs.map(col => (
              <div key={col.key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'white', borderRadius: '12px', padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{col.label}</div>
                  {col.fieldType && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{col.fieldType}</div>}
                </div>
                <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '26px', flexShrink: 0 }}>
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={() => toggleColumn(col.key)}
                    style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                  />
                  <span style={{
                    position: 'absolute', inset: 0, borderRadius: '13px', cursor: 'pointer',
                    background: col.visible ? '#2563eb' : '#cbd5e1',
                    transition: 'background 0.2s',
                  }}>
                    <span style={{
                      position: 'absolute', top: '3px',
                      left: col.visible ? '21px' : '3px',
                      width: '20px', height: '20px', borderRadius: '50%', background: 'white',
                      transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    }} />
                  </span>
                </label>
              </div>
            ))}
          </>
        )}

        {/* ── TASKS TAB ───────────────────────────────────────────── */}
        {tab === 'tasks' && (
          <>
            {/* Task Templates */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Task Templates
              </div>
              <button onClick={() => setShowTplForm(v => !v)} style={{
                padding: '6px 14px', border: 'none', borderRadius: '8px',
                background: '#2563eb', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}>
                {showTplForm ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showTplForm && (
              <div style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SettingField label="Name">
                  <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Task name" style={inputSt} />
                </SettingField>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <SettingField label="Start">
                    <input type="time" value={tplStart} onChange={e => setTplStart(e.target.value)} style={inputSt} />
                  </SettingField>
                  <SettingField label="End">
                    <input type="time" value={tplEnd} onChange={e => setTplEnd(e.target.value)} style={inputSt} />
                  </SettingField>
                </div>
                <SettingField label="Required Soldiers">
                  <input type="number" min={1} value={tplSoldiers} onChange={e => setTplSoldiers(Math.max(1, +e.target.value))} style={inputSt} />
                </SettingField>
                <SettingField label="Color">
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {PRESET_COLORS.map(c => (
                      <button key={c} onClick={() => setTplColor(c)} style={{
                        width: '28px', height: '28px', borderRadius: '50%', background: c, border: `3px solid ${tplColor === c ? '#1e293b' : 'transparent'}`, cursor: 'pointer',
                      }} />
                    ))}
                  </div>
                </SettingField>
                <button onClick={addTemplate} disabled={!tplName.trim()} style={{
                  padding: '12px', border: 'none', borderRadius: '10px',
                  background: tplName.trim() ? '#2563eb' : '#e2e8f0',
                  color: tplName.trim() ? 'white' : '#94a3b8',
                  fontWeight: '700', fontSize: '14px', cursor: tplName.trim() ? 'pointer' : 'default',
                }}>Add Template</button>
              </div>
            )}

            {taskTemplates.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>No task templates yet</div>
            )}
            {taskTemplates.map(tpl => (
              <div key={tpl.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'white', borderRadius: '12px', padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ width: '4px', alignSelf: 'stretch', borderRadius: '2px', background: tpl.color ?? '#94a3b8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{tpl.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {tpl.startTime}–{tpl.endTime} · {tpl.requiredSoldiers} soldier{tpl.requiredSoldiers !== 1 ? 's' : ''}
                  </div>
                </div>
                <button onClick={() => deleteTpl(tpl.id)} style={{
                  width: '30px', height: '30px', borderRadius: '50%', border: 'none',
                  background: '#fee2e2', color: '#dc2626', fontSize: '16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>×</button>
              </div>
            ))}

            {/* Task Groups */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Task Groups
              </div>
              <button onClick={() => setShowGrpForm(v => !v)} style={{
                padding: '6px 14px', border: 'none', borderRadius: '8px',
                background: '#2563eb', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
              }}>
                {showGrpForm ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {showGrpForm && (
              <div style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <SettingField label="Group Name">
                  <input value={grpName} onChange={e => setGrpName(e.target.value)} placeholder="Group name" style={inputSt} />
                </SettingField>
                <SettingField label="Min Rest (hours)">
                  <input type="number" min={1} max={24} value={grpInterval} onChange={e => setGrpInterval(Math.max(1, +e.target.value))} style={inputSt} />
                </SettingField>
                <button onClick={addGroup} disabled={!grpName.trim()} style={{
                  padding: '12px', border: 'none', borderRadius: '10px',
                  background: grpName.trim() ? '#2563eb' : '#e2e8f0',
                  color: grpName.trim() ? 'white' : '#94a3b8',
                  fontWeight: '700', fontSize: '14px', cursor: grpName.trim() ? 'pointer' : 'default',
                }}>Add Group</button>
              </div>
            )}

            {taskGroups.length === 0 && (
              <div style={{ color: '#94a3b8', fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>No task groups yet</div>
            )}
            {taskGroups.map(g => (
              <div key={g.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'white', borderRadius: '12px', padding: '14px 16px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b' }}>{g.name}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Min rest: {g.intervalHours}h · Alert: {g.alertHours}h
                  </div>
                </div>
                <button onClick={() => deleteGroup(g.id)} style={{
                  width: '30px', height: '30px', borderRadius: '50%', border: 'none',
                  background: '#fee2e2', color: '#dc2626', fontSize: '16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>×</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SettingField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: '11px', fontWeight: '600', color: '#64748b', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>{label}</div>
      {children}
    </div>
  );
}

const inputSt: React.CSSProperties = {
  width: '100%', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px',
  fontSize: '14px', boxSizing: 'border-box', outline: 'none', background: '#f8fafc', color: '#1e293b',
};
