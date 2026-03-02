import { Employee, Department, LeaveRequest } from '../../types';

interface DashboardProps {
  employees: Employee[];
  departments: Department[];
  leaves: LeaveRequest[];
}

export default function Dashboard({ employees, departments, leaves }: DashboardProps) {
  const activeEmployees = employees.filter(e => e.status === 'Active').length;
  const pendingLeaves = leaves.filter(l => l.status === 'Pending').length;
  const recentEmployees = [...employees].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 5);

  const stats = [
    { label: 'Total Employees', value: employees.length, sub: `${activeEmployees} active`, color: '#2563eb', icon: '👥' },
    { label: 'Departments', value: departments.length, sub: 'across company', color: '#7c3aed', icon: '🏢' },
    { label: 'Pending Leaves', value: pendingLeaves, sub: 'awaiting approval', color: '#d97706', icon: '📅' },
    { label: 'Active Staff', value: activeEmployees, sub: `${employees.length - activeEmployees} inactive`, color: '#059669', icon: '✅' },
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>Recent Employees</h2>
          {recentEmployees.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No employees yet.</p>
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

        <div style={{ background: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>Pending Leave Requests</h2>
          {leaves.filter(l => l.status === 'Pending').length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: '14px' }}>No pending leave requests.</p>
          ) : (
            <div>
              {leaves.filter(l => l.status === 'Pending').map(leave => (
                <div key={leave.id} style={{
                  padding: '10px 0',
                  borderBottom: '1px solid #f1f5f9',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '500', fontSize: '14px' }}>{leave.employeeName}</div>
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '9999px',
                      fontSize: '11px',
                      fontWeight: '500',
                      background: '#fef3c7',
                      color: '#d97706',
                    }}>{leave.type}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                    {leave.startDate} → {leave.endDate}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
