import { useState, useCallback, createContext, useContext } from 'react';
import { writeOperationLog } from '../utils/operationLog';
import { useToast } from './Toast';

const OperatorContext = createContext();

export function useOperator() {
  return useContext(OperatorContext);
}

/**
 * Wraps any admin operation with:
 * 1. Operator name prompt (modal) before executing
 * 2. After DB confirms, logs to wp_fn_upload_batches
 * 
 * Usage:
 *   const { runWithLog } = useOperator();
 *   await runWithLog({
 *     operationType: 'deleted',
 *     tableName: 'wp_fn_numbers',
 *     totalRecords: ids.length,
 *     operationData: `Deleted IDs: ${ids.join(',')}`,
 *     action: async () => { ...actual API call... return true/false; }
 *   });
 */
export function OperatorProvider({ children }) {
  const toast = useToast();
  const [pending, setPending] = useState(null);
  const [operatorInput, setOperatorInput] = useState('');

  const runWithLog = useCallback(({ operationType, tableName, totalRecords, operationData, fileName, action }) => {
    // Pre-fill from localStorage
    const saved = localStorage.getItem('ag_admin_username') || '';
    setOperatorInput(saved);
    return new Promise((resolve) => {
      setPending({ operationType, tableName, totalRecords, operationData, fileName, action, resolve });
    });
  }, []);

  const handleConfirm = async () => {
    if (!operatorInput.trim()) return;
    const { operationType, tableName, totalRecords, operationData, fileName, action, resolve } = pending;
    const operatorName = operatorInput.trim();
    localStorage.setItem('ag_operator_name', operatorName);
    setPending(null);

    let status = 'error';
    try {
      const result = await action();
      status = result ? 'completed' : 'not completed';
    } catch (err) {
      console.error('[OperationLog] Action failed:', err);
      status = 'error';
    }

    // Log to wp_fn_upload_batches with accurate timestamp from server
    await writeOperationLog({
      fileName: fileName || 'Admin Operation',
      operationType,
      operationData: typeof operationData === 'string' ? operationData : JSON.stringify(operationData),
      totalRecords: totalRecords || 0,
      tableName: tableName || 'wp_fn_numbers',
      status,
      adminName: operatorName,
    });

    if (status === 'completed') {
      toast.success(`${operationType} — ${totalRecords} record(s) — logged successfully`);
    } else if (status === 'error') {
      toast.error(`${operationType} failed — logged as error`);
    } else {
      toast.error(`${operationType} — not completed`);
    }

    resolve(status);
  };

  const handleCancel = () => {
    if (pending) pending.resolve(null);
    setPending(null);
    setOperatorInput('');
  };

  return (
    <OperatorContext.Provider value={{ runWithLog }}>
      {children}

      {/* Operator Name Prompt Modal */}
      {pending && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: '16px', padding: '32px', width: '420px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          }}>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem', fontWeight: 800 }}>Confirm Operation</h3>
            <p style={{ color: '#64748b', fontSize: '0.85rem', margin: '0 0 20px 0' }}>
              <strong style={{ textTransform: 'uppercase', color: opColor(pending.operationType) }}>
                {pending.operationType}
              </strong> — {pending.totalRecords || 0} record(s) on <code>{pending.tableName}</code>
            </p>

            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
              Operator Name *
            </label>
            <input
              type="text"
              className="input"
              placeholder="Enter your name..."
              value={operatorInput}
              onChange={(e) => setOperatorInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              autoFocus
              style={{ width: '100%', marginBottom: '24px' }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleConfirm}
                disabled={!operatorInput.trim()}
              >
                Confirm & Execute
              </button>
            </div>
          </div>
        </div>
      )}
    </OperatorContext.Provider>
  );
}

function opColor(type) {
  if (type?.includes('delete')) return '#dc2626';
  if (type?.includes('insert') || type?.includes('import')) return '#16a34a';
  if (type?.includes('edit') || type?.includes('update')) return '#2563eb';
  return '#64748b';
}
