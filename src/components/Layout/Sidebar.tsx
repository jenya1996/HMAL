type Page = 'dashboard' | 'employees' | 'schedule';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { page: 'employees', label: 'Soldiers', icon: '🪖' },
  { page: 'schedule', label: 'Schedule', icon: '📆' },
];

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  return (
    <aside style={{
      width: '240px',
      background: '#f1f5f9',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
    }}>
      <div style={{
        padding: '20px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#2563eb',
        color: 'white',
      }}>
        <div style={{ fontSize: '20px', fontWeight: '700' }}>🏛️ HR Manager</div>
        <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>Human Resources System</div>
      </div>
      <nav style={{ flex: 1, padding: '16px 8px' }}>
        {navItems.map(item => (
          <button
            key={item.page}
            onClick={() => onNavigate(item.page)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              width: '100%',
              padding: '10px 12px',
              border: 'none',
              borderRadius: '8px',
              background: currentPage === item.page ? '#2563eb' : 'transparent',
              color: currentPage === item.page ? 'white' : '#475569',
              fontSize: '14px',
              fontWeight: currentPage === item.page ? '600' : '400',
              cursor: 'pointer',
              marginBottom: '4px',
              textAlign: 'left',
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <span style={{ fontSize: '18px' }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </nav>
      <div style={{ padding: '16px', borderTop: '1px solid #e2e8f0', fontSize: '12px', color: '#94a3b8' }}>
        © 2024 HR Management
      </div>
    </aside>
  );
}
