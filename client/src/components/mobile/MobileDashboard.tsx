import { Employee } from '../../types';
import { ScheduleData } from '../Schedule/ScheduleCalendar';

interface Props {
  employees: Employee[];
  schedule: ScheduleData;
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

const SCHEDULE_LABELS: Record<string, string> = {
  'on-base':    'On Base',
  'home-leave': 'At Home',
  'departed':   'Departed',
  'returning':  'Returning',
  'absent':     'Absent',
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  'Active':     { bg: '#dcfce7', color: '#16a34a' },
  'Inactive':   { bg: '#f1f5f9', color: '#64748b' },
  'Annexation': { bg: '#fef3c7', color: '#d97706' },
};

export default function MobileDashboard({ employees, schedule }: Props) {
  const today = todayKey();
  const active = employees.filter(e => e.status === 'Active' || e.status === 'Annexation');

  let onBase = 0, atHome = 0, absent = 0, unset = 0;
  active.forEach(e => {
    const s = schedule[e.id]?.[today] ?? '';
    if (s === 'on-base')    onBase++;
    else if (s === 'home-leave') atHome++;
    else if (s === 'absent')     absent++;
    else                         unset++;
  });

  const stats = [
    { label: 'Total Active',  value: active.length,    bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
    { label: 'On Base',       value: onBase + unset,   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
    { label: 'At Home',       value: atHome,           bg: '#dbeafe', color: '#1d4ed8', border: '#93c5fd' },
    { label: 'Absent',        value: absent,           bg: '#f8fafc', color: '#475569', border: '#cbd5e1' },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {stats.map(s => (
          <div key={s.label} style={{
            background: s.bg, borderRadius: '16px', padding: '16px 14px',
            border: `1px solid ${s.border}`,
          }}>
            <div style={{ fontSize: '34px', fontWeight: '800', color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '5px', fontWeight: '500' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Soldiers list */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
          All Soldiers
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          {employees.map(emp => {
            const badge  = STATUS_BADGE[emp.status] ?? STATUS_BADGE['Inactive'];
            const sched  = schedule[emp.id]?.[today] ?? '';
            const schedLabel = SCHEDULE_LABELS[sched] ?? '';
            const initials   = emp.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            return (
              <div key={emp.id} style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                background: 'white', borderRadius: '12px', padding: '12px 14px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
              }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: '800', color: '#2563eb', fontSize: '13px', flexShrink: 0,
                }}>
                  {initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {emp.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '1px' }}>
                    {[emp.department, schedLabel].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <span style={{
                  background: badge.bg, color: badge.color,
                  padding: '3px 9px', borderRadius: '9999px',
                  fontSize: '11px', fontWeight: '600', flexShrink: 0,
                }}>
                  {emp.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
