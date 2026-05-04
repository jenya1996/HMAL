import { useState } from 'react';
import { Employee } from '../../types';
import { ScheduleData, CellStatus, withTransitions, dateKey } from '../Schedule/ScheduleCalendar';
import { useFirestore } from '../../hooks/useFirestore';

interface Props {
  employees: Employee[];
  schedule: ScheduleData;
  onUpdate: (s: ScheduleData) => void;
}

const STATUS_CONFIG: Record<string, { label: string; fullLabel: string; bg: string; color: string }> = {
  'on-base':    { label: 'B',   fullLabel: 'On Base',   bg: '#4ade80', color: '#14532d' },
  'home-leave': { label: 'H',   fullLabel: 'At Home',   bg: '#60a5fa', color: '#1e3a8a' },
  'departed':   { label: 'OUT', fullLabel: 'Departed',  bg: '#ffedd5', color: '#c2410c' },
  'returning':  { label: 'RTN', fullLabel: 'Returning', bg: '#fef9c3', color: '#a16207' },
  'absent':     { label: 'ABS', fullLabel: 'Absent',    bg: '#4b5563', color: '#f9fafb' },
};

const PICKER_STATUSES: CellStatus[] = ['on-base', 'home-leave', 'absent', 'departed', 'returning'];

const SHORT_DAYS    = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const SHORT_MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function getWeekStart(d: Date): Date {
  const s = new Date(d);
  s.setDate(s.getDate() - s.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}

export default function MobileSchedule({ employees, schedule, onUpdate }: Props) {
  const [weekStart, setWeekStart]  = useState(() => getWeekStart(new Date()));
  const [picker, setPicker]        = useState<{ empId: string; dk: string } | null>(null);
  const [search, setSearch]        = useState('');
  const [autoTransitions]          = useFirestore<boolean>('schedule-auto-transitions', true);

  const today = dateKey(new Date());

  const activeEmployees = employees.filter(e =>
    (e.status === 'Active' || e.status === 'Annexation') &&
    (!search || e.name.toLowerCase().includes(search.toLowerCase()))
  );

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  function navigate(delta: -1 | 1) {
    setWeekStart(prev => {
      const d = new Date(prev);
      d.setDate(d.getDate() + delta * 7);
      return d;
    });
  }

  function goToToday() { setWeekStart(getWeekStart(new Date())); }

  function getStatus(empId: string, dk: string): CellStatus {
    const val = schedule[empId]?.[dk] ?? '';
    return (val in STATUS_CONFIG || val === '') ? val as CellStatus : '';
  }

  function setStatus(empId: string, dk: string, status: CellStatus | '') {
    const updated: ScheduleData = {
      ...schedule,
      [empId]: { ...(schedule[empId] ?? {}), [dk]: status as CellStatus },
    };
    onUpdate(autoTransitions ? withTransitions(updated) : updated);
    setPicker(null);
  }

  const weekLabel = (() => {
    const f = weekDates[0], l = weekDates[6];
    if (f.getMonth() === l.getMonth()) {
      return `${SHORT_MONTHS[f.getMonth()]} ${f.getDate()}–${l.getDate()}, ${f.getFullYear()}`;
    }
    return `${SHORT_MONTHS[f.getMonth()]} ${f.getDate()} – ${SHORT_MONTHS[l.getMonth()]} ${l.getDate()}`;
  })();

  const isToday   = (d: Date) => dateKey(d) === today;
  const isWeekend = (d: Date) => d.getDay() === 5 || d.getDay() === 6;

  const pickerEmpName = picker ? (employees.find(e => e.id === picker.empId)?.name ?? '') : '';

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Week navigation */}
      <div style={{ padding: '10px 16px', background: 'white', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button onClick={() => navigate(-1)} style={navBtn}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: '14px', fontWeight: '700', color: '#1e293b' }}>{weekLabel}</div>
        <button onClick={() => navigate(1)} style={navBtn}>›</button>
        <button onClick={goToToday} style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', fontSize: '12px', cursor: 'pointer', color: '#2563eb', fontWeight: '600' }}>
          Today
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px', background: 'white', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
        <input
          placeholder="Search soldiers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', outline: 'none', background: '#f8fafc' }}
        />
      </div>

      {/* Scrollable table */}
      <div style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        {activeEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94a3b8', padding: '48px 0', fontSize: '14px' }}>No soldiers found</div>
        ) : (
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <colgroup>
              <col style={{ width: '76px', minWidth: '76px' }} />
              {weekDates.map((_, i) => <col key={i} style={{ minWidth: '38px' }} />)}
            </colgroup>

            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 4,
                  padding: '8px 8px', fontSize: '11px', fontWeight: '600', color: '#64748b',
                  textAlign: 'left', background: '#f8fafc', borderRight: '1px solid #e2e8f0',
                }}>Soldier</th>
                {weekDates.map(d => {
                  const weekend  = isWeekend(d);
                  const todayCol = isToday(d);
                  return (
                    <th key={dateKey(d)} style={{
                      position: 'sticky', top: 0, zIndex: 2,
                      padding: '6px 2px', textAlign: 'center', fontSize: '11px', fontWeight: '600',
                      color: todayCol ? '#2563eb' : weekend ? '#7c3aed' : '#64748b',
                      background: todayCol ? '#eff6ff' : weekend ? '#fdf4ff' : '#f8fafc',
                      borderLeft:  d.getDay() === 5 ? '2px solid #a78bfa' : '1px solid #e2e8f0',
                      borderRight: d.getDay() === 6 ? '2px solid #a78bfa' : undefined,
                      borderTop: todayCol ? '2px solid #2563eb' : undefined,
                      minWidth: '38px',
                    }}>
                      <div>{SHORT_DAYS[d.getDay()]}</div>
                      <div style={{ fontWeight: todayCol ? '800' : '600', fontSize: '12px' }}>{d.getDate()}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {activeEmployees.map((emp, rowIdx) => {
                const rowBg = rowIdx % 2 === 0 ? 'white' : '#fafafa';
                const firstName = emp.name.split(' ')[0];
                return (
                  <tr key={emp.id} style={{ background: rowBg }}>
                    <td style={{
                      position: 'sticky', left: 0, padding: '5px 8px',
                      fontSize: '12px', fontWeight: '600', color: '#1e293b',
                      background: rowBg, borderRight: '1px solid #e2e8f0',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '76px',
                    }}>
                      {firstName}
                    </td>
                    {weekDates.map(d => {
                      const dk     = dateKey(d);
                      const status = getStatus(emp.id, dk);
                      const cfg    = STATUS_CONFIG[status];
                      const isPicking = picker?.empId === emp.id && picker?.dk === dk;
                      const weekend   = isWeekend(d);
                      const todayCol  = isToday(d);
                      return (
                        <td key={dk}
                          onClick={() => setPicker(isPicking ? null : { empId: emp.id, dk })}
                          style={{
                            padding: '4px 2px', textAlign: 'center', cursor: 'pointer',
                            background: isPicking ? '#dbeafe' : todayCol ? '#f0f7ff' : weekend ? '#faf5ff' : undefined,
                            borderLeft:  d.getDay() === 5 ? '2px solid #a78bfa' : '1px solid #f1f5f9',
                            borderRight: d.getDay() === 6 ? '2px solid #a78bfa' : undefined,
                            outline: isPicking ? '2px solid #2563eb' : undefined,
                            outlineOffset: '-2px',
                          }}>
                          {status ? (
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '6px', margin: '0 auto',
                              background: cfg.bg, color: cfg.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontWeight: '700', fontSize: '9px', border: `1px solid ${cfg.color}33`,
                            }}>
                              {cfg.label}
                            </div>
                          ) : (
                            <div style={{ width: '28px', height: '28px', margin: '0 auto' }} />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Status picker bottom sheet */}
      {picker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setPicker(null)}
        >
          <div
            style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'white', borderRadius: '20px 20px 0 0',
              padding: '20px 16px calc(20px + env(safe-area-inset-bottom))',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ textAlign: 'center', marginBottom: '16px' }}>
              <div style={{ fontWeight: '700', fontSize: '15px', color: '#1e293b' }}>{pickerEmpName}</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>{picker.dk}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '10px' }}>
              {PICKER_STATUSES.map(s => {
                const cfg     = STATUS_CONFIG[s];
                const current = getStatus(picker.empId, picker.dk) === s;
                return (
                  <button key={s} onClick={() => setStatus(picker.empId, picker.dk, s)} style={{
                    padding: '14px 6px', borderRadius: '12px',
                    border: `2px solid ${current ? cfg.color : '#e2e8f0'}`,
                    background: current ? cfg.bg : 'white',
                    color: current ? cfg.color : '#475569',
                    fontWeight: current ? '700' : '400',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                  }}>
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '8px',
                      background: cfg.bg, color: cfg.color,
                      border: `1px solid ${cfg.color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: '800', fontSize: '11px',
                    }}>
                      {cfg.label}
                    </div>
                    <span style={{ fontSize: '11px' }}>{cfg.fullLabel}</span>
                  </button>
                );
              })}
            </div>

            <button onClick={() => setStatus(picker.empId, picker.dk, '')} style={{
              width: '100%', padding: '14px', border: '1px solid #fca5a5', borderRadius: '12px',
              background: '#fee2e2', color: '#dc2626', fontWeight: '600', fontSize: '14px', cursor: 'pointer',
            }}>
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: '36px', height: '36px', border: '1px solid #e2e8f0', borderRadius: '8px',
  background: 'white', fontSize: '18px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#475569', flexShrink: 0,
};
