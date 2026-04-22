import { apiFetch } from '../../lib/api';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  async function handleSignOut() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    window.location.reload();
  }

  return (
    <header style={{
      background: 'white', borderBottom: '1px solid #e2e8f0',
      padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    }}>
      <h1 style={{ fontSize: '20px', fontWeight: '600', color: '#1e293b' }}>{title}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ fontSize: '13px', color: '#64748b' }}>{dateStr}</div>
        <button
          onClick={handleSignOut}
          style={{
            padding: '6px 14px', borderRadius: '8px', border: '1px solid #e2e8f0',
            background: 'white', color: '#64748b', fontSize: '13px',
            fontWeight: '500', cursor: 'pointer',
          }}
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
