import { useState, useCallback, createContext, useContext } from 'react';

/** 
 * Toast notification system — replaces all alert() calls across admin panel.
 * Usage:
 *   const toast = useToast();
 *   toast.success('Saved!');
 *   toast.error('Failed');
 *   toast.info('Processing...');
 */

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const toast = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error', 5000),
    info: (msg) => addToast(msg, 'info'),
    warn: (msg) => addToast(msg, 'warn', 4500),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div style={styles.container}>
        {toasts.map(t => (
          <div key={t.id} style={{ ...styles.toast, ...styles[t.type] }}>
            <span style={styles.icon}>{icons[t.type]}</span>
            <span style={styles.message}>{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={styles.close}
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

const icons = {
  success: '✅',
  error: '❌',
  info: 'ℹ️',
  warn: '⚠️',
};

const styles = {
  container: {
    position: 'fixed',
    top: '24px',
    right: '24px',
    zIndex: 99999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '400px',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 18px',
    borderRadius: '12px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
    animation: 'toastSlideIn 0.3s ease-out',
    fontSize: '0.9rem',
    fontWeight: 600,
    backdropFilter: 'blur(10px)',
    border: '1px solid',
  },
  success: {
    background: '#f0fdf4',
    color: '#166534',
    borderColor: '#bbf7d0',
  },
  error: {
    background: '#fef2f2',
    color: '#991b1b',
    borderColor: '#fecaca',
  },
  info: {
    background: '#eff6ff',
    color: '#1e40af',
    borderColor: '#bfdbfe',
  },
  warn: {
    background: '#fffbeb',
    color: '#92400e',
    borderColor: '#fde68a',
  },
  icon: { fontSize: '1.1rem', flexShrink: 0 },
  message: { flex: 1 },
  close: {
    background: 'transparent',
    border: 'none',
    fontSize: '1.2rem',
    cursor: 'pointer',
    opacity: 0.5,
    padding: '0 4px',
    color: 'inherit',
  },
};
