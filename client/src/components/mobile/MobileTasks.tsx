import { useState } from 'react';
import { Employee, TaskTemplate, TaskAssignments, TaskRoles, TaskGroup } from '../../types';
import { ScheduleData, dateKey } from '../Schedule/ScheduleCalendar';

interface Props {
  employees: Employee[];
  schedule: ScheduleData;
  taskTemplates: TaskTemplate[];
  taskAssignments: TaskAssignments;
  taskRoles: TaskRoles;
  taskGroups: TaskGroup[];
  onUpdateAssignments: (a: TaskAssignments) => void;
  onUpdateRoles: (r: TaskRoles) => void;
}

const SHORT_DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES  = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function minutesSinceMidnight(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function taskDurationHours(tpl: TaskTemplate): number {
  let s = minutesSinceMidnight(tpl.startTime);
  let e = minutesSinceMidnight(tpl.endTime);
  if (e <= s) e += 24 * 60;
  return (e - s) / 60;
}

export default function MobileTasks({ employees, schedule, taskTemplates, taskAssignments, taskRoles, taskGroups, onUpdateAssignments, onUpdateRoles }: Props) {
  const [anchor, setAnchor] = useState<Date>(() => { const d = new Date(); d.setHours(0,0,0,0); return d; });
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  const dk     = dateKey(anchor);
  const today  = dateKey(new Date());
  const isToday = dk === today;

  function navigate(delta: -1 | 1) {
    setAnchor(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta);
      return d;
    });
  }

  function goToday() {
    const d = new Date(); d.setHours(0,0,0,0);
    setAnchor(d);
  }

  const dateLabel = `${SHORT_DAYS[anchor.getDay()]}, ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}`;
  const sortedTemplates = [...taskTemplates].sort((a, b) => a.startTime.localeCompare(b.startTime));

  const activeEmployees = employees.filter(e => e.status === 'Active' || e.status === 'Annexation');

  function getAssigned(tplId: string): Employee[] {
    const ids = taskAssignments[tplId]?.[dk] ?? [];
    return ids.map(id => employees.find(e => e.id === id)).filter(Boolean) as Employee[];
  }

  function isSoldierAvailable(emp: Employee): boolean {
    const s = schedule[emp.id]?.[dk] ?? '';
    return s !== 'home-leave' && s !== 'absent' && s !== 'departed';
  }

  function assign(tplId: string, empId: string, tpl: TaskTemplate) {
    const current = taskAssignments[tplId]?.[dk] ?? [];
    if (current.includes(empId) || current.length >= tpl.requiredSoldiers) return;
    onUpdateAssignments({
      ...taskAssignments,
      [tplId]: { ...(taskAssignments[tplId] ?? {}), [dk]: [...current, empId] },
    });
  }

  function unassign(tplId: string, empId: string) {
    const current = taskAssignments[tplId]?.[dk] ?? [];
    onUpdateAssignments({
      ...taskAssignments,
      [tplId]: { ...(taskAssignments[tplId] ?? {}), [dk]: current.filter(id => id !== empId) },
    });
    const newRoles = { ...taskRoles };
    if (newRoles[tplId]?.[dk]) {
      const dr = { ...newRoles[tplId][dk] };
      delete dr[empId];
      newRoles[tplId] = { ...newRoles[tplId], [dk]: dr };
      onUpdateRoles(newRoles);
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Date navigation */}
      <div style={{ padding: '10px 16px', background: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={navBtn}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: '700', color: isToday ? '#2563eb' : '#1e293b' }}>{dateLabel}</div>
          {isToday && <div style={{ fontSize: '11px', color: '#2563eb', fontWeight: '500', marginTop: '1px' }}>Today</div>}
        </div>
        <button onClick={() => navigate(1)} style={navBtn}>›</button>
        {!isToday && (
          <button onClick={goToday} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#2563eb', fontWeight: '600' }}>
            Today
          </button>
        )}
      </div>

      {/* Task cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {sortedTemplates.length === 0 && (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 0', fontSize: '14px' }}>
            No tasks configured
          </div>
        )}

        {sortedTemplates.map(tpl => {
          const assigned  = getAssigned(tpl.id);
          const filled    = assigned.length;
          const required  = tpl.requiredSoldiers;
          const isFull    = filled >= required;
          const isExpanded = expandedTask === tpl.id;
          const duration  = taskDurationHours(tpl);
          const group     = taskGroups.find(g => g.id === tpl.groupId);

          const available = activeEmployees.filter(e =>
            !assigned.find(a => a.id === e.id) && isSoldierAvailable(e)
          );

          return (
            <div key={tpl.id} style={{
              background: 'white', borderRadius: '14px', overflow: 'hidden',
              boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
              border: `1px solid ${tpl.color ? tpl.color + '33' : '#e2e8f0'}`,
            }}>
              {/* Header row */}
              <div
                onClick={() => setExpandedTask(isExpanded ? null : tpl.id)}
                style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
              >
                <div style={{ width: '4px', alignSelf: 'stretch', borderRadius: '2px', background: tpl.color ?? '#94a3b8', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{tpl.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {tpl.startTime} – {tpl.endTime}
                    {' · '}{duration.toFixed(1)}h
                    {group ? ` · ${group.name}` : ''}
                  </div>
                </div>
                <div style={{
                  padding: '5px 11px', borderRadius: '9999px', fontSize: '13px', fontWeight: '700', flexShrink: 0,
                  background: isFull ? '#f0fdf4' : '#fff7ed',
                  color: isFull ? '#16a34a' : '#ea580c',
                }}>
                  {filled}/{required}
                </div>
                <span style={{ color: '#cbd5e1', fontSize: '14px', transform: isExpanded ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
              </div>

              {/* Expanded panel */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid #f1f5f9', background: '#f8fafc' }}>

                  {/* Assigned soldiers */}
                  <div style={{ padding: '12px 16px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                      Assigned ({filled}/{required})
                    </div>
                    {assigned.length === 0 ? (
                      <div style={{ fontSize: '13px', color: '#94a3b8', padding: '8px 0' }}>No soldiers assigned yet</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {assigned.map(emp => (
                          <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', borderRadius: '10px', padding: '10px 12px' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#2563eb', fontSize: '11px', flexShrink: 0 }}>
                              {emp.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                            </div>
                            <span style={{ flex: 1, fontSize: '14px', fontWeight: '500', color: '#1e293b' }}>{emp.name}</span>
                            <button onClick={() => unassign(tpl.id, emp.id)} style={{
                              width: '26px', height: '26px', borderRadius: '50%', border: 'none',
                              background: '#fee2e2', color: '#dc2626', fontSize: '15px', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Available to add */}
                  {!isFull && available.length > 0 && (
                    <div style={{ padding: '0 16px 14px' }}>
                      <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                        Add Soldier
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {available.map(emp => (
                          <button key={emp.id} onClick={() => assign(tpl.id, emp.id, tpl)} style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            background: 'white', borderRadius: '10px', padding: '10px 12px',
                            border: '1px solid #e2e8f0', cursor: 'pointer', textAlign: 'left', width: '100%',
                          }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#475569', fontSize: '11px', flexShrink: 0 }}>
                              {emp.name.split(' ').map(n => n[0]).join('').slice(0,2)}
                            </div>
                            <span style={{ flex: 1, fontSize: '14px', color: '#475569' }}>{emp.name}</span>
                            <span style={{ fontSize: '20px', color: '#94a3b8', fontWeight: '300' }}>+</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {!isFull && available.length === 0 && (
                    <div style={{ padding: '0 16px 14px', fontSize: '13px', color: '#94a3b8' }}>
                      No available soldiers on this day
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: '36px', height: '36px', border: '1px solid #e2e8f0', borderRadius: '8px',
  background: 'white', fontSize: '18px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#475569', flexShrink: 0,
};
