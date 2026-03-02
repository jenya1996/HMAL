import { useState } from 'react';
import { LeaveRequest, Employee, LeaveStatus } from '../../types';
import LeaveForm from './LeaveForm';

interface LeaveListProps {
  leaves: LeaveRequest[];
  employees: Employee[];
  onUpdate: (leaves: LeaveRequest[]) => void;
}

const statusColors: Record<LeaveStatus, { bg: string; color: string }> = {
  Pending: { bg: '#fef3c7', color: '#d97706' },
  Approved: { bg: '#dcfce7', color: '#15803d' },
  Rejected: { bg: '#fee2e2', color: '#dc2626' },
};

export default function LeaveList({ leaves, employees, onUpdate }: LeaveListProps) {
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<LeaveStatus | ''>('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = statusFilter ? leaves.filter(l => l.status === statusFilter) : leaves;

  function handleSave(leave: LeaveRequest) {
    const exists = leaves.find(l => l.id === leave.id);
    if (exists) {
      onUpdate(leaves.map(l => l.id === leave.id ? leave : l));
    } else {
      onUpdate([...leaves, leave]);
    }
    setShowForm(false);
  }

  function handleStatus(id: string, status: LeaveStatus) {
    onUpdate(leaves.map(l => l.id === id ? { ...l, status } : l));
  }

  function handleDelete(id: string) {
    onUpdate(leaves.filter(l => l.id !== id));
    setDeleteId(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as LeaveStatus | '')}
          style={{ padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '14px', minWidth: '160px' }}
        >
          <option value="">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowForm(true)} style={{
          padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none',
          borderRadius: '6px', fontSize: '14px', fontWeight: '500',
        }}>+ New Request</button>
      </div>

      <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>📅</div>
            <div style={{ fontWeight: '500' }}>No leave requests found</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  {['Employee', 'Type', 'Start Date', 'End Date', 'Status', 'Reason', 'Actions'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((leave, i) => (
                  <tr key={leave.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '500', fontSize: '14px' }}>{leave.employeeName}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px' }}>{leave.type}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{leave.startDate}</td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b' }}>{leave.endDate}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '2px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: '500',
                        ...statusColors[leave.status],
                      }}>{leave.status}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '14px', color: '#64748b', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{leave.reason}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {leave.status === 'Pending' && (
                          <>
                            <button onClick={() => handleStatus(leave.id, 'Approved')} style={{
                              padding: '3px 10px', background: '#dcfce7', color: '#15803d',
                              border: 'none', borderRadius: '5px', fontSize: '12px',
                            }}>Approve</button>
                            <button onClick={() => handleStatus(leave.id, 'Rejected')} style={{
                              padding: '3px 10px', background: '#fee2e2', color: '#dc2626',
                              border: 'none', borderRadius: '5px', fontSize: '12px',
                            }}>Reject</button>
                          </>
                        )}
                        <button onClick={() => setDeleteId(leave.id)} style={{
                          padding: '3px 10px', background: '#f1f5f9', color: '#64748b',
                          border: 'none', borderRadius: '5px', fontSize: '12px',
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <LeaveForm
          employees={employees}
          onSave={handleSave}
          onClose={() => setShowForm(false)}
        />
      )}

      {deleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '28px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '10px' }}>Confirm Delete</h3>
            <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>Delete this leave request?</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeleteId(null)} style={{ padding: '8px 20px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', fontSize: '14px' }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ padding: '8px 20px', border: 'none', borderRadius: '6px', background: '#dc2626', color: 'white', fontSize: '14px' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
