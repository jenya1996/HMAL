import { Employee } from '../../types';

interface DashboardProps {
  employees: Employee[];
}

export default function Dashboard({ employees }: DashboardProps) {
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const annexationEmployees = employees.filter(e => e.status === 'Annexation').length;
  const inactiveEmployees = employees.filter(e => e.status === 'Inactive').length;
  const recentEmployees = [...employees].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5);

  const stats = [
    { label: 'Total Soldiers', value: employees.length, sub: `${activeEmployees} active · ${annexationEmployees} annexation · ${inactiveEmployees} inactive`, color: '#2563eb', icon: '👥' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {stats.map(stat => (
          <div key={stat.label} style={{
            background: 'white',
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            borderLeft: `4px solid ${stat.color}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#64748b', marginBottom: '6px' }}>{stat.label}</div>
                <div style={{ fontSize: '32px', fontWeight: '700', color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>{stat.sub}</div>
              </div>
              <div style={{ fontSize: '28px' }}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: '480px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>Recent Soldiers</h2>
        {recentEmployees.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>No soldiers yet.</p>
        ) : (
          <div>
            {recentEmployees.map(emp => (
              <div key={emp.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: '#dbeafe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  color: '#2563eb',
                  fontSize: '14px',
                  flexShrink: 0,
                }}>
                  {emp.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: '500', fontSize: '14px', color: '#1e293b' }}>{emp.name}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{emp.position} · {emp.department}</div>
                </div>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '11px',
                  fontWeight: '500',
                  background: emp.status === 'Active' ? '#dcfce7' : '#fee2e2',
                  color: emp.status === 'Active' ? '#15803d' : '#dc2626',
                }}>{emp.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
