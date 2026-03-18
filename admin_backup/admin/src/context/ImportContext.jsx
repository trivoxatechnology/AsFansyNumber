import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { writeOperationLog } from '../utils/operationLog';
import { API_BASE } from '../config/api';

const ImportContext = createContext();

async function dbJobCreate(jobId, fileName, operation, total, adminName) {
  try {
    await fetchWithAuth(`${API_BASE}/wp_fn_background_jobs`, {
      method: 'POST',
      body: JSON.stringify({
        job_id: jobId, file_name: fileName, operation, status: 'running', total, processed: 0, admin_name: adminName,
      }),
    });
  } catch (e) { console.warn('dbJobCreate failed:', e?.message); }
}

async function dbJobUpdate(jobId, patch) {
  try {
    await fetchWithAuth(`${API_BASE}/wp_fn_background_jobs/${jobId}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    });
  } catch (e) { console.warn('dbJobUpdate failed:', e?.message); }
}

export function ImportProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const [dbJobs, setDbJobs] = useState([]);
  const mountedRef = useRef(true);
  // AbortController map — keyed by job ID
  const abortControllers = useRef({});

  const fetchDbJobs = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${API_BASE}/wp_fn_background_jobs?limit=30&order=started_at&dir=desc`);
      if (res && res.ok) {
        const json = await res.json();
        const data = Array.isArray(json) ? json : (json?.data || []);
        setDbJobs(data);
      }
    } catch (e) { }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchDbJobs();
    const timer = setInterval(() => {
      if (jobs.some(j => j.status === 'running') || dbJobs.some(j => j.status === 'running')) {
        fetchDbJobs();
      }
    }, 15000);
    return () => { mountedRef.current = false; clearInterval(timer); };
  }, [fetchDbJobs, jobs, dbJobs]);

  const hasActiveJobs = jobs.some(j => j.status === 'running') || dbJobs.some(j => j.status === 'running');

  const [parseSession, setParseSession] = useState({
    rows: [], step: 1, fileName: '', isParsing: false, parseProgress: '',
    operatorName: localStorage.getItem('adminUsername') || '',
  });

  const updateParseSession = useCallback((patch) => setParseSession(prev => ({ ...prev, ...patch })), []);
  const clearParseSession = useCallback(() => setParseSession({
    rows: [], step: 1, fileName: '', isParsing: false, parseProgress: '',
    operatorName: localStorage.getItem('adminUsername') || '',
  }), []);

  const updateJob = useCallback((id, patch) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  const removeJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    // Clean up AbortController
    if (abortControllers.current[id]) {
      delete abortControllers.current[id];
    }
  }, []);

  const removeDbJob = useCallback(async (jobId) => {
    setDbJobs(prev => prev.filter(j => j.job_id !== jobId && j.id !== jobId));
    try {
      await fetchWithAuth(`${API_BASE}/wp_fn_background_jobs/${jobId}`, { method: 'DELETE' });
    } catch (e) { /* ignore */ }
  }, []);

  // Cancel a running job via AbortController
  const cancelJob = useCallback(async (id) => {
    const ctrl = abortControllers.current[id];
    if (ctrl) {
      ctrl.abort();
      delete abortControllers.current[id];
    }
    updateJob(id, { status: 'done', phase: 'Cancelled by user' });
    await dbJobUpdate(id, { status: 'cancelled' });
    fetchDbJobs();
  }, [updateJob, fetchDbJobs]);

  // Force-dismiss a stuck DB job (mark as cancelled in DB)
  const forceStopDbJob = useCallback(async (jobId) => {
    await dbJobUpdate(jobId, { status: 'cancelled' });
    fetchDbJobs();
  }, [fetchDbJobs]);

  const runBulkImport = useCallback(async ({
    rows, fileName, importDestination, operatorName, cleanRow
  }) => {
    const id = `bulk_imp_${Date.now()}`;
    const validRows = rows.filter(r => r._status === 'valid');
    const total = validRows.length;
    const finalOperator = operatorName || localStorage.getItem('adminUsername') || 'Admin';

    // Create AbortController for this job
    const ctrl = new AbortController();
    abortControllers.current[id] = ctrl;

    setJobs(prev => [...prev, { id, label: fileName || 'Import', status: 'running', current: 0, total, phase: 'Starting...' }]);
    await dbJobCreate(id, fileName || 'Import', 'Bulk Import', total, finalOperator);

    (async () => {
      let processed = 0, lastDbUpdate = 0;
      const CHUNK_SIZE = 1000;
      const endpoint = importDestination === 'draft' ? `${API_BASE}/wp_fn_draft_numbers/bulk-insert` : `${API_BASE}/wp_fn_numbers/bulk-insert`;

      try {
        for (let i = 0; i < validRows.length; i += CHUNK_SIZE) {
          // Check if cancelled
          if (ctrl.signal.aborted) {
            updateJob(id, { status: 'done', phase: `Cancelled at ${processed}/${total}` });
            await dbJobUpdate(id, { status: 'cancelled', processed });
            return;
          }

          const chunk = validRows.slice(i, i + CHUNK_SIZE).map(r => cleanRow(r));
          const res = await fetchWithAuth(endpoint, {
            method: 'POST',
            body: JSON.stringify({ records: chunk }),
            signal: ctrl.signal,
          });
          if (!res || !res.ok) {
            const errText = await (res ? res.text() : Promise.resolve('Unknown Network Error'));
            throw new Error(`API Error: ${errText}`);
          }
          processed += chunk.length;
          updateJob(id, { current: processed, phase: `Importing ${processed}/${total}...` });
          if (Date.now() - lastDbUpdate > 3000) {
            lastDbUpdate = Date.now();
            await dbJobUpdate(id, { processed, status: 'running' });
          }
        }
        await dbJobUpdate(id, { status: 'done', processed: total });
        updateJob(id, { status: 'done', current: total, phase: 'Complete' });
      } catch (err) {
        if (err?.name === 'AbortError') {
          updateJob(id, { status: 'done', phase: `Cancelled at ${processed}/${total}` });
          await dbJobUpdate(id, { status: 'cancelled', processed });
        } else {
          const errMsg = err?.message || 'Unknown error';
          await dbJobUpdate(id, { status: 'failed', processed, phase: 'Error: ' + errMsg });
          updateJob(id, { status: 'done', phase: 'Error: ' + errMsg });
        }
      }
    })();
  }, [updateJob]);

  const runDeleteOperation = useCallback(async ({ toDelete, fileName, destination, operatorName }) => {
    const id = `bulk_del_${Date.now()}`;
    const total = toDelete.length;
    const finalOperator = operatorName || localStorage.getItem('adminUsername') || 'Admin';

    const ctrl = new AbortController();
    abortControllers.current[id] = ctrl;

    setJobs(prev => [...prev, { id, label: fileName || 'Delete', status: 'running', current: 0, total, phase: 'Deleting...' }]);
    await dbJobCreate(id, fileName, 'Bulk Delete', total, finalOperator);

    (async () => {
      const ids = toDelete.map(r => r._dbId);
      const CHUNK_SIZE = 2000;
      const endpoint = destination === 'draft' ? `${API_BASE}/wp_fn_numbers/bulk-move-to-draft` : `${API_BASE}/wp_fn_numbers/bulk-delete`;
      let processed = 0;
      try {
        for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
          if (ctrl.signal.aborted) {
            updateJob(id, { status: 'done', phase: `Cancelled at ${processed}/${total}` });
            await dbJobUpdate(id, { status: 'cancelled', processed });
            return;
          }

          const chunk = ids.slice(i, i + CHUNK_SIZE);
          const res = await fetchWithAuth(endpoint, {
            method: 'POST',
            body: JSON.stringify({ ids: chunk }),
            signal: ctrl.signal,
          });
          if (!res || !res.ok) {
            const errText = await (res ? res.text() : Promise.resolve('Unknown Network Error'));
            throw new Error(`API Error: ${errText}`);
          }
          processed += chunk.length;
          updateJob(id, { current: processed });
          await dbJobUpdate(id, { processed, status: 'running' });
        }
        await dbJobUpdate(id, { status: 'done', processed: total });
        updateJob(id, { status: 'done', current: total, phase: 'Complete' });
      } catch (e) {
        if (e?.name === 'AbortError') {
          updateJob(id, { status: 'done', phase: `Cancelled at ${processed}/${total}` });
          await dbJobUpdate(id, { status: 'cancelled', processed });
        } else {
          updateJob(id, { status: 'done', phase: 'Error' });
        }
      }
    })();
  }, [updateJob]);

  return (
    <ImportContext.Provider value={{
      jobs, dbJobs, hasActiveJobs, runBulkImport, runDeleteOperation, removeJob, removeDbJob,
      cancelJob, forceStopDbJob,
      parseSession, updateParseSession, clearParseSession,
    }}>
      {children}
    </ImportContext.Provider>
  );
}

export function useImport() {
  const context = useContext(ImportContext);
  if (!context) throw new Error('useImport must be used within an ImportProvider');
  return context;
}
