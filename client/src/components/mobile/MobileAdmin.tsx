import { useState, useEffect } from 'react';
import { Employee } from '../../types';
import { apiFetch } from '../../lib/api';

interface Props {
  employees: Employee[];
}

const IDLE_TIMEOUT_KEY = 'hmal-idle-timeout-ms';

function storageUsedKB(): number {
  let total = 0;
  for (const key of Object.keys(localStorage)) {
    total += (localStorage.getItem(key) ?? '').length * 2;
  }
  return Math.round(total / 1024);
}

interface FirebaseUser {
  uid: string;
  email: string;
  admin?: boolean;
  disabled?: boolean;
}

export default function MobileAdmin({ employees }: Props) {
  const [timeoutMin, setTimeoutMin] = useState(() => {
    const stored = localStorage.getItem(IDLE_TIMEOUT_KEY);
    return stored ? Math.round(+stored / 60_000) : 15;
  });
  const [users,    setUsers]    = useState<FirebaseUser[]>([]);
  const [usersErr, setUsersErr] = useState('');
  const [storageKB] = useState(storageUsedKB);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    apiFetch<{ users: FirebaseUser[] }>('/api/auth/users')
      .then(({ users }) => setUsers(users))
      .catch(() => setUsersErr('Could not load users'));
  }, []);

  function saveTimeout(min: number) {
    const clamped = Math.max(1, Math.min(480, min));
    setTimeoutMin(clamped);
    localStorage.setItem(IDLE_TIMEOUT_KEY, String(clamped * 60_000));
  }

  function exportData() {
    const data: Record<string, unknown> = {};
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('hmal-') || key.startsWith('schedule-') || key.startsWith('tasks-')) {
        try { data[key] = JSON.parse(localStorage.getItem(key) ?? ''); } catch { data[key] = null; }
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hmal-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  async function clearCache() {
    setClearing(true);
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith('hmal-') || k.startsWith('schedule-') || k.startsWith('tasks-')
    );
    keys.forEach(k => localStorage.removeItem(k));
    window.location.reload();
  }

  const storagePercent = Math.min(100, Math.round((storageKB / 5120) * 100));
  const storageColor   = storagePercent > 80 ? '#dc2626' : storagePercent > 60 ? '#d97706' : '#16a34a';

  const soldierCount  = employees.length;
  const activeCount   = employees.filter(e => e.status === 'Active' || e.status === 'Annexation').length;
  const loginCount    = employees.filter(e => e.canLogin).length;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* System stats */}
      <Section title="System">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Total Soldiers', value: soldierCount },
            { label: 'Active',         value: activeCount },
            { label: 'With Login',     value: loginCount },
            { label: 'Firebase Users', value: users.length || '…' },
          ].map(s => (
            <div key={s.label} style={{ background: '#f8fafc', borderRadius: '10px', padding: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#1e293b' }}>{s.value}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Storage */}
      <Section title="Storage">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', color: '#475569' }}>{storageKB} KB used</span>
          <span style={{ fontSize: '13px', fontWeight: '700', color: storageColor }}>{storagePercent}%</span>
        </div>
        <div style={{ height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${storagePercent}%`, background: storageColor, borderRadius: '4px', transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px' }}>of ~5 MB browser storage</div>
      </Section>

      {/* Session timeout */}
      <Section title="Session Timeout">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <input
            type="number" min={1} max={480} value={timeoutMin}
            onChange={e => saveTimeout(+e.target.value)}
            style={{ width: '80px', padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '15px', fontWeight: '600', textAlign: 'center', outline: 'none', background: '#f8fafc' }}
          />
          <span style={{ fontSize: '14px', color: '#475569' }}>minutes of inactivity</span>
        </div>
      </Section>

      {/* Users */}
      <Section title="Users">
        {usersErr && <div style={{ fontSize: '13px', color: '#dc2626' }}>{usersErr}</div>}
        {!usersErr && users.length === 0 && <div style={{ fontSize: '13px', color: '#94a3b8' }}>Loading…</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {users.map(u => (
            <div key={u.uid} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f8fafc', borderRadius: '10px', padding: '10px 12px', border: '1px solid #e2e8f0' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: u.admin ? '#dbeafe' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: u.admin ? '#2563eb' : '#64748b', fontSize: '13px', flexShrink: 0 }}>
                {(u.email?.[0] ?? '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                <div style={{ fontSize: '11px', color: u.disabled ? '#dc2626' : '#64748b', marginTop: '1px' }}>
                  {u.admin ? 'Admin · ' : ''}{u.disabled ? 'Disabled' : 'Active'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Data actions */}
      <Section title="Data">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={exportData} style={{
            padding: '13px', border: '1px solid #e2e8f0', borderRadius: '10px',
            background: 'white', color: '#1e293b', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
          }}>
            Export backup (JSON)
          </button>
          {!confirmClear ? (
            <button onClick={() => setConfirmClear(true)} style={{
              padding: '13px', border: '1px solid #fca5a5', borderRadius: '10px',
              background: '#fff5f5', color: '#dc2626', fontSize: '14px', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
            }}>
              Clear local cache
            </button>
          ) : (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px' }}>
              <div style={{ fontSize: '13px', color: '#dc2626', marginBottom: '12px', fontWeight: '500' }}>
                This clears the local cache and reloads. Server data is safe.
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setConfirmClear(false)} style={{ flex: 1, padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', color: '#475569', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
                <button onClick={clearCache} disabled={clearing} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '8px', background: '#dc2626', color: 'white', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                  {clearing ? 'Clearing…' : 'Clear'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Section>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: '14px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  );
}
