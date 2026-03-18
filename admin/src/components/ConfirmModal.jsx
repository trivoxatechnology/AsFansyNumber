import { useState, useCallback, createContext, useContext } from 'react';

/**
 * Styled confirmation modal — replaces all window.confirm() calls.
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm('Delete 500 numbers?', 'This cannot be undone.');
 *   if (ok) { ... }
 */

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);

  const confirm = useCallback((title, message, variant = 'danger') => {
    return new Promise((resolve) => {
      setState({ title, message, variant, resolve });
    });
  }, []);

  const handleClose = (result) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div style={styles.overlay} onClick={() => handleClose(false)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.iconWrap}>
              <span style={{ fontSize: '2rem' }}>
                {state.variant === 'danger' ? '⚠️' : state.variant === 'success' ? '🚀' : 'ℹ️'}
              </span>
            </div>
            <h3 style={styles.title}>{state.title}</h3>
            {state.message && <p style={styles.message}>{state.message}</p>}
            <div style={styles.actions}>
              <button onClick={() => handleClose(false)} style={styles.cancelBtn}>Cancel</button>
              <button
                onClick={() => handleClose(true)}
                style={{
                  ...styles.confirmBtn,
                  background: state.variant === 'danger' ? '#ef4444' : state.variant === 'success' ? '#16a34a' : '#3b82f6',
                }}
              >
                {state.variant === 'danger' ? 'Yes, Delete' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be inside ConfirmProvider');
  return ctx;
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99998, backdropFilter: 'blur(4px)',
  },
  modal: {
    background: '#fff', borderRadius: '16px', padding: '32px',
    maxWidth: '420px', width: '90%', textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
    animation: 'toastSlideIn 0.2s ease-out',
  },
  iconWrap: { marginBottom: '16px' },
  title: { fontSize: '1.15rem', fontWeight: 800, marginBottom: '8px', color: '#1e293b' },
  message: { fontSize: '0.9rem', color: '#64748b', lineHeight: 1.5, marginBottom: '24px' },
  actions: { display: 'flex', gap: '12px', justifyContent: 'center' },
  cancelBtn: {
    padding: '10px 24px', borderRadius: '8px', border: '1px solid #e2e8f0',
    background: '#fff', cursor: 'pointer', fontWeight: 600, color: '#475569',
  },
  confirmBtn: {
    padding: '10px 24px', borderRadius: '8px', border: 'none',
    color: '#fff', cursor: 'pointer', fontWeight: 600,
  },
};
