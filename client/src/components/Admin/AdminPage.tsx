import { useState, useEffect } from 'react';
import { Employee } from '../../types';
import { apiFetch } from '../../lib/api';
import AuditLogs from '../Logs/AuditLogs';
import { IDLE_TIMEOUT_KEY, IDLE_TIMEOUT_DEFAULT } from '../../App';

interface AdminPageProps {
  employees: Employee[];
  isAdmin: boolean;
}

type Tab = 'general' | 'users' | 'logs';

// ── General tab ──────────────────────────────────────────────────────────────

const TIMEOUT_OPTIONS = [
  { label: '5 minutes',  ms: 5  * 60 * 1000 },
  { label: '15 minutes', ms: 15 * 60 * 1000 },
  { label: '30 minutes', ms: 30 * 60 * 1000 },
  { label: '1 hour',     ms: 60 * 60 * 1000 },
  { label: '2 hours',    ms: 2 * 60 * 60 * 1000 },
];

function GeneralTab({ employees }: { employees: Employee[] }) {
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'error'>('checking');
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  const [idleTimeout, setIdleTimeoutState] = useState<number>(() => {
    const stored = localStorage.getItem(IDLE_TIMEOUT_KEY);
    return stored ? parseInt(stored, 10) : IDLE_TIMEOUT_DEFAULT;
  });
  const [timeoutSaved, setTimeoutSaved] = useState(false);

  function handleTimeoutChange(ms: number) {
    localStorage.setItem(IDLE_TIMEOUT_KEY, String(ms));
    setIdleTimeoutState(ms);
    setTimeoutSaved(true);
    setTimeout(() => setTimeoutSaved(false), 2000);
  }

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then(() => setServerStatus('online'))
      .catch(() => setServerStatus('error'));

    if ('storage' in navigator) {
      navigator.storage.estimate().then(({ usage, quota }) => {
        setStorage({ usage: usage ?? 0, quota: quota ?? 0 });
      });
    }
  }, []);

  const active     = employees.filter(e => e.status === 'Active').length;
  const inactive   = employees.filter(e => e.status === 'Inactive').length;
  const annexation = employees.filter(e => e.status === 'Annexation').length;
  const withLogin  = employees.filter(e => e.canLogin).length;

  const storagePct = storage ? Math.round((storage.usage / storage.quota) * 100) : 0;
  const storageMB  = storage ? (storage.usage / 1024 / 1024).toFixed(2) : '—';
  const quotaMB    = storage ? (storage.quota / 1024 / 1024).toFixed(0) : '—';

  function handleClearCache() {
    const keys = [
      'hmal-soldiers-v2', 'hmal-schedule', 'hmal-columns-v1',
      'hmal-task-templates', 'hmal-task-assignments', 'hmal-task-roles',
      'hmal-task-groups', 'hmal-cert-source-col',
    ];
    keys.forEach(k => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
    alert('Local cache cleared. The page will reload to fetch fresh data from the server.');
    window.location.reload();
  }

  function handleExportAll() {
    const keys = [
      'hmal-soldiers-v2', 'hmal-schedule', 'hmal-columns-v1',
      'hmal-task-templates', 'hmal-task-assignments', 'hmal-task-roles',
      'hmal-task-groups',
    ];
    const snapshot: Record<string, unknown> = { exportedAt: new Date().toISOString() };
    keys.forEach(k => {
      try {
        const raw = localStorage.getItem(k);
        snapshot[k] = raw ? JSON.parse(raw) : null;
      } catch { snapshot[k] = null; }
    });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hmal-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const statCard = (label: string, value: string | number, sub: string, color: string) => (
    <div style={{
      background: 'white', borderRadius: '10px', padding: '18px 20px',
      border: '1px solid #e2e8f0', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '26px', fontWeight: '700', color }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</div>
    </div>
  );

  const statusColor = serverStatus === 'online' ? '#16a34a' : serverStatus === 'error' ? '#dc2626' : '#d97706';
  const statusLabel = serverStatus === 'online' ? '● Online' : serverStatus === 'error' ? '✕ Unreachable' : '◌ Checking…';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '720px' }}>

      {/* Status cards */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>System Status</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          {statCard('Server', <span style={{ color: statusColor, fontSize: '18px' }}>{statusLabel}</span> as unknown as string, 'Firebase Cloud Run', statusColor)}
          {statCard(
            'Local Storage',
            storage ? `${storagePct}%` : '—',
            storage ? `${storageMB} MB used of ~${quotaMB} MB` : 'Estimating…',
            storagePct > 80 ? '#dc2626' : storagePct > 50 ? '#d97706' : '#2563eb',
          )}
          {statCard('Soldiers', employees.length, `${active} active · ${inactive} inactive · ${annexation} annexation`, '#7c3aed')}
          {statCard('Login Accounts', withLogin, 'soldiers with system access', '#0891b2')}
        </div>
      </div>

      {/* Storage bar */}
      {storage && (
        <div style={{ background: 'white', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#374151' }}>Browser Storage Usage</span>
            <span style={{ fontSize: '13px', color: '#64748b' }}>{storageMB} MB / ~{quotaMB} MB</span>
          </div>
          <div style={{ height: '8px', background: '#f1f5f9', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '9999px', transition: 'width 0.4s',
              width: `${Math.min(storagePct, 100)}%`,
              background: storagePct > 80 ? '#dc2626' : storagePct > 50 ? '#f59e0b' : '#2563eb',
            }} />
          </div>
          {storagePct > 80 && (
            <p style={{ marginTop: '8px', fontSize: '12px', color: '#dc2626' }}>
              Storage is nearly full. Export your data and clear the cache to free space.
            </p>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div style={{ background: 'white', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick Actions</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleExportAll} style={actionBtn('#2563eb', 'white')}>
            ⬇ Export Full Backup (JSON)
          </button>
          <button onClick={handleClearCache} style={actionBtn('#fef2f2', '#dc2626', '#fecaca')}>
            🗑 Clear Local Cache
          </button>
        </div>
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
          Export Backup downloads all application data as a JSON snapshot. Clear Local Cache forces a fresh sync from the server on next load.
        </p>
      </div>

      {/* Session timeout */}
      <div style={{ background: 'white', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Timeout</div>
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 14px' }}>
          Automatically log out after this much inactivity. Takes effect on the next check (within 30 seconds).
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {TIMEOUT_OPTIONS.map(opt => (
            <button
              key={opt.ms}
              onClick={() => handleTimeoutChange(opt.ms)}
              style={{
                padding: '7px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
                cursor: 'pointer', border: '1px solid',
                background:   idleTimeout === opt.ms ? '#2563eb' : '#f8fafc',
                color:        idleTimeout === opt.ms ? 'white'   : '#475569',
                borderColor:  idleTimeout === opt.ms ? '#2563eb' : '#e2e8f0',
              }}
            >
              {opt.label}
            </button>
          ))}
          {timeoutSaved && (
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: '600' }}>✓ Saved</span>
          )}
        </div>
      </div>

      {/* App info */}
      <div style={{ background: 'white', borderRadius: '10px', padding: '18px 20px', border: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Application Info</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[
            ['Application', 'HMAL — Soldier Management System'],
            ['Version', '0.1.0'],
            ['Backend', 'Firebase Cloud Run (us-central1)'],
            ['Database', 'Cloud Firestore'],
            ['Auth', 'Firebase Authentication (session cookies)'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
              <span style={{ width: '120px', color: '#64748b', flexShrink: 0 }}>{k}</span>
              <span style={{ color: '#1e293b', fontWeight: '500' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

function actionBtn(bg: string, color: string, borderColor?: string): React.CSSProperties {
  return {
    padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: '600',
    cursor: 'pointer', border: `1px solid ${borderColor ?? bg}`, background: bg, color,
  };
}

// ── Users tab ─────────────────────────────────────────────────────────────────

interface FirebaseUser { uid: string; email: string; admin: boolean; }

function UsersTab({ employees }: { employees: Employee[] }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [fbUsers, setFbUsers]   = useState<FirebaseUser[] | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [toggleMsg, setToggleMsg] = useState<{ uid: string; type: 'ok' | 'err'; text: string } | null>(null);

  const logins = employees.filter(e => e.canLogin);

  useEffect(() => {
    apiFetch<{ users: FirebaseUser[] }>('/api/auth/users')
      .then(({ users }) => setFbUsers(users))
      .catch(() => setFbUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!email || password.length < 8) return;
    setSaving(true); setMsg(null);
    try {
      const { uid } = await apiFetch<{ uid: string }>('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setMsg({ type: 'ok', text: `Login account created for ${email}.` });
      setEmail(''); setPassword('');
      setFbUsers(prev => prev ? [...prev, { uid, email, admin: false }] : prev);
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setMsg({ type: 'err', text: m });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleAdmin(user: FirebaseUser) {
    const newAdmin = !user.admin;
    setToggleMsg(null);
    try {
      await apiFetch(`/api/auth/users/${user.uid}/admin`, {
        method: 'PATCH',
        body: JSON.stringify({ admin: newAdmin }),
      });
      setFbUsers(prev => prev
        ? prev.map(u => u.uid === user.uid ? { ...u, admin: newAdmin } : u)
        : prev
      );
      setToggleMsg({ uid: user.uid, type: 'ok', text: newAdmin ? 'Admin granted' : 'Admin revoked' });
    } catch (err: unknown) {
      const m = err instanceof Error ? err.message : String(err);
      setToggleMsg({ uid: user.uid, type: 'err', text: m });
    }
  }

  const pwStrong = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '6px',
    fontSize: '14px', color: '#1e293b', outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '680px' }}>

      {/* Admin permissions */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Admin Permissions
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Users with the admin role can access this Admin page, view audit logs, and manage accounts.
          </div>
        </div>
        {loadingUsers ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Loading users…</div>
        ) : !fbUsers || fbUsers.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No users found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Email', 'Role', 'Action'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fbUsers.map((u, i) => (
                <tr key={u.uid} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', color: '#1e293b', fontWeight: '500' }}>{u.email || u.uid}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: '700',
                      background: u.admin ? '#dbeafe' : '#f1f5f9',
                      color: u.admin ? '#1d4ed8' : '#64748b',
                    }}>
                      {u.admin ? '🛡️ Admin' : 'User'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => handleToggleAdmin(u)}
                        style={{
                          padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', border: '1px solid',
                          background: u.admin ? '#fef2f2' : '#f0fdf4',
                          color:      u.admin ? '#dc2626'  : '#16a34a',
                          borderColor: u.admin ? '#fecaca' : '#bbf7d0',
                        }}
                      >
                        {u.admin ? 'Revoke Admin' : 'Grant Admin'}
                      </button>
                      {toggleMsg?.uid === u.uid && (
                        <span style={{ fontSize: '12px', color: toggleMsg.type === 'ok' ? '#16a34a' : '#dc2626' }}>
                          {toggleMsg.text}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Existing login accounts (soldiers) */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Soldier Login Accounts ({logins.length})
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Soldiers flagged as having system access in their profile</div>
        </div>
        {logins.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
            No soldiers have login access yet.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Name', 'Email', 'Status', 'Department'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: '600', color: '#475569', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logins.map((emp, i) => (
                <tr key={emp.id} style={{ borderTop: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                  <td style={{ padding: '10px 16px', fontWeight: '500', color: '#1e293b' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div aria-hidden="true" style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#dbeafe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#2563eb', fontSize: '11px', flexShrink: 0 }}>
                        {emp.name ? emp.name.split(' ').map((n: string) => n[0]).join('') : '?'}
                      </div>
                      {emp.name || '—'}
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#475569' }}>{emp.email || '—'}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '11px', fontWeight: '600', background: emp.status === 'Active' ? '#dcfce7' : '#fee2e2', color: emp.status === 'Active' ? '#15803d' : '#dc2626' }}>{emp.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#64748b' }}>{emp.department || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create account form */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Create Login Account
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
            Creates a Firebase Auth account. Password must be 8+ characters with an uppercase letter and a number.
          </div>
        </div>
        <form onSubmit={handleCreate} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" style={inputStyle} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: '#374151', marginBottom: '4px' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Min. 8 chars, uppercase, number"
                style={{ ...inputStyle, paddingRight: '50px' }}
                required
              />
              <button type="button" onClick={() => setShowPw(p => !p)} aria-label={showPw ? 'Hide password' : 'Show password'}
                style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '12px' }}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            {password.length > 0 && !pwStrong && (
              <p style={{ marginTop: '4px', fontSize: '11px', color: '#d97706' }}>
                Must be 8+ characters, include an uppercase letter and a number.
              </p>
            )}
          </div>

          {msg && (
            <div role="alert" style={{ padding: '10px 12px', borderRadius: '6px', fontSize: '13px', background: msg.type === 'ok' ? '#f0fdf4' : '#fef2f2', color: msg.type === 'ok' ? '#15803d' : '#dc2626', border: `1px solid ${msg.type === 'ok' ? '#bbf7d0' : '#fecaca'}` }}>
              {msg.text}
            </div>
          )}

          <div>
            <button type="submit" disabled={saving || !email || !pwStrong}
              style={{ padding: '9px 22px', borderRadius: '8px', border: 'none', fontSize: '14px', fontWeight: '600', cursor: saving ? 'default' : 'pointer', background: saving || !email || !pwStrong ? '#e2e8f0' : '#2563eb', color: saving || !email || !pwStrong ? '#94a3b8' : 'white' }}>
              {saving ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage({ employees }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const tabBtn = (tab: Tab): React.CSSProperties => ({
    padding: '9px 22px', fontSize: '14px', fontWeight: '600', cursor: 'pointer',
    border: 'none', borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent',
    background: 'none', color: activeTab === tab ? '#2563eb' : '#64748b',
    transition: 'color 0.1s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0, background: 'white', borderRadius: '12px 12px 0 0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', paddingLeft: '8px' }}>
        <button style={tabBtn('general')} onClick={() => setActiveTab('general')}>General</button>
        <button style={tabBtn('users')}   onClick={() => setActiveTab('users')}>Users</button>
        <button style={tabBtn('logs')}    onClick={() => setActiveTab('logs')}>Audit Logs</button>
      </div>

      {/* Tab content */}
      <div style={{
        flex: 1, minHeight: 0, background: 'white', borderRadius: '0 0 12px 12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
        overflow: activeTab === 'logs' ? 'hidden' : 'auto',
        padding: activeTab === 'logs' ? '16px' : '24px',
        display: 'flex', flexDirection: 'column',
      }}>
        {activeTab === 'general' && <GeneralTab employees={employees} />}
        {activeTab === 'users'   && <UsersTab employees={employees} />}
        {activeTab === 'logs'    && (
          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <AuditLogs />
          </div>
        )}
      </div>
    </div>
  );
}
