import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, FileSpreadsheet, LogOut, Database, Tag, Trash2, FileText } from 'lucide-react';
import BackgroundImportWidget from './BackgroundImportWidget';
import { logout } from '../utils/authService';

export default function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const adminUsername = localStorage.getItem('adminUsername') || 'Admin';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/dashboard',          icon: <LayoutDashboard size={20} />, label: 'Overview' },
    { path: '/import-workspace',   icon: <FileSpreadsheet size={20} />, label: 'Import Workspace' },
    { path: '/offer-upload',       icon: <Tag size={20} />,             label: 'Offer Management' },
    { path: '/inventory',          icon: <Database size={20} />,        label: 'Inventory Manager' },
    { path: '/delete-excel',       icon: <Trash2 size={20} />,          label: 'Delete Numbers' },
    { path: '/draft-management',   icon: <FileText size={20} />,         label: 'Draft Management' },
  ];

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.logoSection}>
          <img src="/logo.png" alt="Logo" style={styles.logo} onError={(e) => e.target.style.display='none'} />
          <h2 style={styles.brand}>Admin<span style={{color: 'var(--neon-green-dark)'}}>Panel</span></h2>
        </div>

        <nav style={styles.nav}>
          {navItems.map((item) => {
            const isActive = location.pathname.includes(item.path);
            return (
              <Link 
                key={item.path} 
                to={item.path} 
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {})
                }}
              >
                {item.icon} {item.label}
              </Link>
            )
          })}
        </nav>

        <button onClick={handleLogout} style={styles.logoutBtn}>
          <LogOut size={20} /> Logout
        </button>
      </aside>

      {/* Main Content Area */}
      <main style={styles.main}>
        <header style={styles.header}>
          <div style={styles.headerInfo}>
            <h1 style={styles.pageTitle}>
              {navItems.find(i => location.pathname.includes(i.path))?.label || 'Dashboard'}
            </h1>
          </div>
          <div style={{display: 'flex', alignItems: 'center'}}>
            <BackgroundImportWidget />
            <div style={styles.adminProfile}>
              <div style={styles.avatar}>A</div>
              <span style={{fontWeight: 600}}>{adminUsername}</span>
            </div>
          </div>
        </header>

        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--bg-main)',
  },
  sidebar: {
    width: '260px',
    background: 'var(--bg-card)',
    borderRight: '1px solid var(--border-color)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    position: 'fixed',
    height: '100vh',
    left: 0,
    top: 0,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '40px',
    padding: '0 10px',
  },
  logo: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
  },
  brand: {
    fontSize: '1.4rem',
    fontWeight: 800,
    color: 'var(--text-main)',
  },
  nav: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    transition: 'var(--transition)',
  },
  navItemActive: {
    background: '#f1f5f9',
    color: 'var(--neon-green-dark)',
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    fontWeight: 600,
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    transition: 'var(--transition)',
    marginTop: 'auto',
  },
  main: {
    flex: 1,
    marginLeft: '260px', /* Match sidebar width */
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
  },
  header: {
    height: '80px',
    background: 'rgba(255,255,255,0.9)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 40px',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  pageTitle: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-main)',
  },
  adminProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: '#f8fafc',
    padding: '6px 16px 6px 6px',
    borderRadius: '40px',
    border: '1px solid var(--border-color)',
  },
  avatar: {
    width: '32px',
    height: '32px',
    background: 'var(--neon-green-dark)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 800,
    fontSize: '0.9rem',
  },
  content: {
    padding: '40px',
    flex: 1,
  }
};
