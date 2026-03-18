import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  List, UploadCloud, Archive, LogOut, Loader2, CheckCircle, AlertCircle, X, Clock
} from 'lucide-react';
import { logout } from '../utils/authService';
<<<<<<< HEAD
import { useImport } from '../context/ImportContext';
import ErrorBoundary from '../utils/ErrorBoundary';

function ImportProgressBar() {
  const { jobs, removeJob } = useImport();
  const activeJobs = jobs.filter(j => j.status === 'running' || j.status === 'done');
  if (activeJobs.length === 0) return null;

  return (
    <div style={{ padding: '0 24px 8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {activeJobs.map(job => {
        const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;
        const isRunning = job.status === 'running';
        const isError = job.phase?.startsWith('Error');
        const isDone = job.status === 'done' && !isError;
        return (
          <div key={job.id} style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '8px 14px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600,
            background: isError ? '#fef2f2' : isDone ? '#f0fdf4' : '#eff6ff',
            border: `1px solid ${isError ? '#fecaca' : isDone ? '#bbf7d0' : '#bfdbfe'}`,
          }}>
            {isRunning && <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6', flexShrink: 0 }} />}
            {isDone && <CheckCircle size={16} style={{ color: '#16a34a', flexShrink: 0 }} />}
            {isError && <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0 }} />}
            <span style={{ flex: 1, color: isError ? '#dc2626' : isDone ? '#16a34a' : '#1d4ed8' }}>
              {job.label}: {job.phase || `${pct}%`}
            </span>
            {isRunning && (
              <div style={{ width: '120px', height: '6px', background: '#dbeafe', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: '3px', transition: 'width 0.3s' }} />
              </div>
            )}
            {!isRunning && (
              <button onClick={() => removeJob(job.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px' }}>
                <X size={14} style={{ color: '#94a3b8' }} />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
=======
import ErrorBoundary from '../utils/ErrorBoundary';
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f

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
      { path: '/inventory', icon: <List size={18} />, label: 'Inventory Manager' },
      { path: '/upload', icon: <UploadCloud size={18} />, label: 'Upload Manager' },
      { path: '/drafts', icon: <Archive size={18} />, label: 'Draft Manager' },
      { path: '/logs', icon: <Clock size={18} />, label: 'Log History' },
    ]},
  ];

  return (
    <div className="flex" style={{ minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside className="sidebar" style={{
        width: 'var(--sidebar-width)',
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        height: '100vh',
        zIndex: 50,
      }}>
        <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border)' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} onError={(e) => e.target.style.display='none'} />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>As<span style={{ color: 'var(--primary)' }}>FancyNumber</span></h2>
        </div>

        <nav style={{ flex: 1, padding: '20px 12px', overflowY: 'auto' }}>
          {navItems.map((group, idx) => (
            <div key={idx} style={{ marginBottom: '24px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)', marginLeft: '12px', marginBottom: '8px', letterSpacing: '0.05em' }}>{group.section}</p>
              {group.items.map((item) => {
                const isActive = location.pathname === item.path || (item.path === '/inventory' && location.pathname === '/');
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
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', border: 'none' }}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ 
        flex: 1, 
        marginLeft: 'var(--sidebar-width)',
        minHeight: '100vh',
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
            {navItems.flatMap(g => g.items).find(i => i.path === location.pathname)?.label || 'Admin Panel'}
          </h1>
          
          <div className="flex items-center gap-2">
            <div style={{ textAlign: 'right' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>{adminUsername}</p>
              <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-secondary)' }}>Administrator</p>
            </div>
            <div style={{ width: '36px', height: '36px', background: 'var(--primary-light)', color: 'var(--primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
              {adminUsername.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

<<<<<<< HEAD
        <ImportProgressBar />

        <div className="container-fluid" style={{ padding: '24px' }}>
=======
        <div style={styles.content}>
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
