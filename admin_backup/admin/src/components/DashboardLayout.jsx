import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutGrid, List, UploadCloud, FileText, Archive, 
  CheckCircle, Users, MessageCircle, Clock, LogOut 
} from 'lucide-react';
import { logout } from '../utils/authService';
import ErrorBoundary from '../utils/ErrorBoundary';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminUsername = localStorage.getItem('ag_admin_username') || 'Admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { section: 'MAIN', items: [
      { path: '/dashboard', icon: <LayoutGrid size={18} />, label: 'Dashboard' },
      { path: '/inventory', icon: <List size={18} />, label: 'Inventory' },
      { path: '/upload', icon: <UploadCloud size={18} />, label: 'Upload Center' },
      { path: '/logs', icon: <FileText size={18} />, label: 'Upload Logs' },
      { path: '/drafts', icon: <Archive size={18} />, label: 'Draft Manager' },
      { path: '/sold', icon: <CheckCircle size={18} />, label: 'Sold Numbers' },
    ]},
    { section: 'MANAGEMENT', items: [
      { path: '/dealers', icon: <Users size={18} />, label: 'Dealers' },
      { path: '/whatsapp', icon: <MessageCircle size={18} />, label: 'WhatsApp Config' },
    ]},
    { section: 'SYSTEM', items: [
      { path: '/activity', icon: <Clock size={18} />, label: 'Activity Log' },
    ]}
  ];

  const sidebarCollapsed = localStorage.getItem('ag_sidebar_collapsed') === 'true';

  return (
    <div className="flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{
        width: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 50,
        transition: 'width 0.3s ease'
      }}>
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: '32px', height: '32px', background: 'var(--primary)', borderRadius: '8px', flexShrink: 0 }} />
          {!sidebarCollapsed && <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>Antigravity</h2>}
        </div>

        <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
          {navItems.map((group, idx) => (
            <div key={idx} style={{ marginBottom: '24px' }}>
              {!sidebarCollapsed && <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginLeft: '12px', marginBottom: '8px', letterSpacing: '0.05em' }}>{group.section}</p>}
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/dashboard' && location.pathname === '/');
                return (
                  <Link 
                    key={item.path} 
                    to={item.path} 
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-md)',
                      color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                      background: isActive ? 'var(--primary-light)' : 'transparent',
                      fontWeight: isActive ? 600 : 500,
                      marginBottom: '4px',
                      textDecoration: 'none'
                    }}
                  >
                    <span style={{ flexShrink: 0 }}>{item.icon}</span>
                    {!sidebarCollapsed && <span>{item.label}</span>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', border: 'none' }}>
            <LogOut size={18} />
            {!sidebarCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ 
        flex: 1, 
        marginLeft: sidebarCollapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        minHeight: '100vh',
        transition: 'margin-left 0.3s ease'
      }}>
        <header style={{
          height: 'var(--topbar-height)',
          background: 'rgba(255,255,255,0.8)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 40
        }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
            {navItems.flatMap(g => g.items).find(i => i.path === location.pathname)?.label || 'Dashboard'}
          </h1>
          
          <div className="flex items-center gap-2">
            <div style={{ textAlign: 'right', display: sidebarCollapsed ? 'none' : 'block' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{adminUsername}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>Administrator</p>
            </div>
            <div style={{ width: '36px', height: '36px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyCenter: 'center', fontWeight: 700 }}>
              {adminUsername.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        <div className="container-fluid" style={{ padding: '24px' }}>
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}

