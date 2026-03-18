import { useState } from 'react';
import { Employee } from '../../types';

interface ScheduleCalendarProps {
  employees: Employee[];
  schedule: ScheduleData;
  onUpdate: (schedule: ScheduleData) => void;
}

export type ScheduleData = Record<string, Record<string, CellStatus>>;

export type CellStatus = 'on-base' | 'home-leave' | 'departed' | 'returning' | 'absent' | '';

const STATUS_CONFIG: Record<CellStatus, { label: string; fullLabel: string; bg: string; color: string }> = {
  'on-base':   { label: 'B',   fullLabel: 'On Base',     bg: '#dcfce7', color: '#15803d' },
  'home-leave':{ label: 'HL',  fullLabel: 'Home Leave',  bg: '#dbeafe', color: '#1d4ed8' },
  'departed':  { label: 'OUT', fullLabel: 'Departed',    bg: '#ffedd5', color: '#c2410c' },
  'returning': { label: 'RTN', fullLabel: 'Returning',   bg: '#fef9c3', color: '#a16207' },
  'absent':    { label: 'ABS', fullLabel: 'Absent',      bg: '#fee2e2', color: '#dc2626' },
  '':          { label: '',    fullLabel: '',             bg: 'transparent', color: '' },
};

const CYCLE: CellStatus[] = ['on-base', 'home-leave', 'departed', 'returning', 'absent', ''];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getDayOfWeek(year: number, month: number, day: number) {
  return new Date(year, month, day).getDay(); // 0=Sun,6=Sat
}

const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ScheduleCalendar({ employees, schedule, onUpdate }: ScheduleCalendarProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [legend, setLegend] = useState(false);

  const daysCount = getDaysInMonth(year, month);
  const days = Array.from({ length: daysCount }, (_, i) => i + 1);

  const activeEmployees = employees.filter(e => e.status === 'Active');

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }

  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  function getStatus(empId: string, day: number): CellStatus {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const val = schedule[empId]?.[key] ?? '';
    return (val in STATUS_CONFIG) ? val as CellStatus : '';
  }

  function cycleStatus(empId: string, day: number) {
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const current = schedule[empId]?.[key] ?? '';
    const idx = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    const updated: ScheduleData = {
      ...schedule,
      [empId]: { ...(schedule[empId] ?? {}), [key]: next },
    };
    onUpdate(updated);
  }

  const isToday = (day: number) =>
    year === today.getFullYear() && month === today.getMonth() && day === today.getDate();

  const isWeekend = (day: number) => {
    const dow = getDayOfWeek(year, month, day);
    return dow === 0 || dow === 6;
  };

  const thBase: React.CSSProperties = {
    padding: '0',
    fontSize: '11px',
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    borderRight: '1px solid #e2e8f0',
    minWidth: '36px',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>

      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={prevMonth} style={navBtnStyle}>‹</button>
          <span style={{ fontSize: '18px', fontWeight: '700', minWidth: '160px', textAlign: 'center', color: '#1e293b' }}>
            {MONTH_NAMES[month]} {year}
          </span>
          <button onClick={nextMonth} style={navBtnStyle}>›</button>
          <button
            onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }}
            style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#2563eb', fontWeight: '500' }}
          >
            Today
          </button>
        </div>
        <button onClick={() => setLegend(l => !l)} style={{ padding: '6px 14px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '13px', cursor: 'pointer', color: '#475569' }}>
          {legend ? 'Hide' : 'Show'} Legend
        </button>
      </div>

      {/* Legend */}
      {legend && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {(Object.entries(STATUS_CONFIG) as [CellStatus, typeof STATUS_CONFIG[CellStatus]][])
            .filter(([k]) => k !== '')
            .map(([key, cfg]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '4px', background: cfg.bg, border: `1px solid ${cfg.color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: cfg.color, fontSize: '11px' }}>
                  {cfg.label}
                </div>
                <span style={{ color: '#475569' }}>{cfg.fullLabel}</span>
              </div>
            ))}
          <div style={{ fontSize: '12px', color: '#94a3b8', alignSelf: 'center' }}>— Click a cell to cycle status</div>
        </div>
      )}

      {/* Table */}
      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'auto', flex: 1 }}>
        {activeEmployees.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
            <div style={{ fontWeight: '500' }}>No active employees</div>
          </div>
        ) : (
          <table style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {/* Employee name column header */}
                <th style={{
                  ...thBase,
                  minWidth: '160px',
                  textAlign: 'left',
                  padding: '12px 16px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 3,
                  background: '#f8fafc',
                  borderRight: '2px solid #e2e8f0',
                }}>
                  Employee
                </th>
                {days.map(day => {
                  const dow = getDayOfWeek(year, month, day);
                  const weekend = dow === 0 || dow === 6;
                  const todayCol = isToday(day);
                  return (
                    <th key={day} style={{
                      ...thBase,
                      background: todayCol ? '#eff6ff' : weekend ? '#fafafa' : '#f8fafc',
                      borderTop: todayCol ? '2px solid #2563eb' : undefined,
                    }}>
                      <div style={{ padding: '6px 2px' }}>
                        <div style={{ color: weekend ? '#94a3b8' : todayCol ? '#2563eb' : '#374151', fontWeight: todayCol ? '700' : '600' }}>{day}</div>
                        <div style={{ color: weekend ? '#cbd5e1' : '#94a3b8', fontSize: '10px', fontWeight: '400' }}>{DAY_NAMES[dow]}</div>
                      </div>
                    </th>
                  );
                })}
                {(Object.entries(STATUS_CONFIG) as [CellStatus, typeof STATUS_CONFIG[CellStatus]][])
                  .filter(([k]) => k !== '')
                  .map(([statusKey, cfg], i) => (
                    <th key={`sum-${statusKey}`} style={{
                      ...thBase,
                      minWidth: '38px',
                      background: '#f1f5f9',
                      borderLeft: i === 0 ? '2px solid #e2e8f0' : undefined,
                    }}>
                      <div style={{ padding: '4px 2px' }}>
                        <div style={{
                          width: '22px', height: '22px', borderRadius: '4px', margin: '0 auto',
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: '700', fontSize: '10px',
                        }}>
                          {cfg.label}
                        </div>
                      </div>
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((emp, rowIdx) => (
                <tr key={emp.id} style={{ background: rowIdx % 2 === 0 ? 'white' : '#fafafa' }}>
                  {/* Sticky employee name */}
                  <td style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                    fontWeight: '500',
                    color: '#1e293b',
                    whiteSpace: 'nowrap',
                    position: 'sticky',
                    left: 0,
                    background: rowIdx % 2 === 0 ? 'white' : '#fafafa',
                    borderRight: '2px solid #e2e8f0',
                    zIndex: 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                        background: '#dbeafe', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontWeight: '700', color: '#2563eb', fontSize: '11px',
                      }}>
                        {emp.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      {emp.name}
                    </div>
                  </td>
                  {days.map(day => {
                    const status = getStatus(emp.id, day);
                    const cfg = STATUS_CONFIG[status];
                    const weekend = isWeekend(day);
                    const todayCol = isToday(day);
                    return (
                      <td
                        key={day}
                        onClick={() => cycleStatus(emp.id, day)}
                        title={status ? STATUS_CONFIG[status].fullLabel : 'Click to set'}
                        style={{
                          padding: '4px',
                          textAlign: 'center',
                          borderRight: '1px solid #f1f5f9',
                          background: todayCol ? '#f0f7ff' : weekend ? '#fafafa' : undefined,
                          cursor: 'pointer',
                        }}
                      >
                        {status ? (
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '6px', margin: '0 auto',
                            background: cfg.bg, color: cfg.color,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontWeight: '700', fontSize: '11px',
                            border: `1px solid ${cfg.color}33`,
                          }}>
                            {cfg.label}
                          </div>
                        ) : (
                          <div style={{
                            width: '28px', height: '28px', borderRadius: '6px', margin: '0 auto',
                            background: 'transparent',
                          }} />
                        )}
                      </td>
                    );
                  })}
                  {(Object.entries(STATUS_CONFIG) as [CellStatus, typeof STATUS_CONFIG[CellStatus]][])
                    .filter(([k]) => k !== '')
                    .map(([statusKey, cfg], i) => {
                      const count = days.filter(day => getStatus(emp.id, day) === statusKey).length;
                      return (
                        <td key={`sum-${statusKey}`} style={{
                          padding: '6px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '700',
                          color: count > 0 ? cfg.color : '#cbd5e1',
                          background: rowIdx % 2 === 0 ? '#f8fafc' : '#f1f5f9',
                          borderLeft: i === 0 ? '2px solid #e2e8f0' : undefined,
                          borderRight: '1px solid #e2e8f0',
                        }}>
                          {count > 0 ? count : '·'}
                        </td>
                      );
                    })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={days.length + 6} style={{ padding: 0, borderTop: '2px solid #e2e8f0' }} />
              </tr>
              {(Object.entries(STATUS_CONFIG) as [CellStatus, typeof STATUS_CONFIG[CellStatus]][])
                .filter(([k]) => k !== '')
                .map(([statusKey, cfg]) => (
                  <tr key={statusKey} style={{ background: '#f8fafc' }}>
                    <td style={{
                      padding: '6px 16px', fontSize: '12px', fontWeight: '600',
                      whiteSpace: 'nowrap', position: 'sticky', left: 0,
                      background: '#f8fafc', borderRight: '2px solid #e2e8f0', zIndex: 1,
                      display: 'flex', alignItems: 'center', gap: '6px',
                    }}>
                      <div style={{
                        width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0,
                        background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: '700', fontSize: '10px',
                      }}>
                        {cfg.label}
                      </div>
                      <span style={{ color: '#64748b' }}>{cfg.fullLabel}</span>
                    </td>
                    {days.map(day => {
                      const count = activeEmployees.filter(emp => getStatus(emp.id, day) === statusKey).length;
                      const todayCol = isToday(day);
                      return (
                        <td key={day} style={{
                          padding: '6px 2px', textAlign: 'center', fontSize: '12px', fontWeight: '600',
                          color: count > 0 ? cfg.color : '#cbd5e1',
                          borderRight: '1px solid #f1f5f9',
                          background: todayCol ? '#f0f7ff' : undefined,
                        }}>
                          {count > 0 ? count : '·'}
                        </td>
                      );
                    })}
                    {(Object.keys(STATUS_CONFIG) as CellStatus[])
                      .filter(k => k !== '')
                      .map((k, i) => (
                        <td key={`fs-${k}`} style={{
                          borderLeft: i === 0 ? '2px solid #e2e8f0' : undefined,
                          background: '#f1f5f9',
                        }} />
                      ))}
                  </tr>
                ))}
            </tfoot>
          </table>
        )}
      </div>
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  width: '32px', height: '32px', border: '1px solid #e2e8f0',
  borderRadius: '6px', background: 'white', fontSize: '18px',
  cursor: 'pointer', display: 'flex', alignItems: 'center',
  justifyContent: 'center', color: '#475569', lineHeight: 1,
};
