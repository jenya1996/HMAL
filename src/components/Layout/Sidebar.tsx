import { useState } from 'react';

type Page = 'dashboard' | 'employees' | 'schedule' | 'tasks' | 'settings';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const navItems: { page: Page; label: string; icon: string }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { page: 'employees', label: 'Soldiers',  icon: '🪖' },
  { page: 'schedule',  label: 'Schedule',  icon: '📆' },
  { page: 'tasks',     label: 'Tasks',     icon: '✅' },
];

function NavButton({ item, currentPage, collapsed, onNavigate }: {
  item: { page: Page; label: string; icon: string };
  currentPage: Page;
  collapsed: boolean;
  onNavigate: (page: Page) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(item.page)}
      title={collapsed ? item.label : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: '10px',
        width: '100%',
        padding: collapsed ? '10px 0' : '10px 12px',
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
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: '18px', flexShrink: 0 }}>{item.icon}</span>
      {!collapsed && item.label}
    </button>
  );
}

export default function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside style={{
      width: collapsed ? '60px' : '240px',
      background: '#f1f5f9',
      borderRight: '1px solid #e2e8f0',
      display: 'flex',
      flexDirection: 'column',
      padding: '0',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px',
        borderBottom: '1px solid #e2e8f0',
        background: '#2563eb',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        overflow: 'hidden',
        minHeight: '68px',
      }}>
        {!collapsed && (
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', whiteSpace: 'nowrap' }}>🏛️ HMAL</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px', whiteSpace: 'nowrap' }}></div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '6px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px 8px',
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {collapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, padding: '16px 8px' }}>
        {navItems.map(item => (
          <NavButton key={item.page} item={item} currentPage={currentPage} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {/* Bottom: Settings */}
      <div style={{ padding: '8px', borderTop: '1px solid #e2e8f0' }}>
        <NavButton
          item={{ page: 'settings', label: 'Settings', icon: '⚙️' }}
          currentPage={currentPage}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        {!collapsed && (
          <div style={{ padding: '8px 12px 4px', fontSize: '11px', color: '#94a3b8' }}>
            © 2024 HR Management
          </div>
        )}
      </div>
    </aside>
  );
}
