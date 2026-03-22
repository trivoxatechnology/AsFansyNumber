import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { fetchWithAuth } from '../utils/api';
import { API_BASE } from '../config/api';
import { writeOperationLog } from '../utils/operationLog';

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
    return () => { mountedRef.current = false; };
  }, [fetchDbJobs]);

  const hasActiveJobs = jobs.some(j => j.status === 'running') || dbJobs.some(j => j.status === 'running');

  const [parseSession, setParseSession] = useState({
    rows: [], step: 1, fileName: '', isParsing: false, parseProgress: '',
    operatorName: localStorage.getItem('ag_admin_username') || '',
  });

  const updateParseSession = useCallback((patch) => setParseSession(prev => ({ ...prev, ...patch })), []);
  const clearParseSession = useCallback(() => setParseSession({
    rows: [], step: 1, fileName: '', isParsing: false, parseProgress: '',
    operatorName: localStorage.getItem('ag_admin_username') || '',
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
    const validRows = rows.filter(r => r._status === 'valid' || r._status === 'conflict');
    const total = validRows.length;
    const finalOperator = operatorName || localStorage.getItem('ag_admin_username') || 'Admin';

    // Create AbortController for this job
    const ctrl = new AbortController();
    abortControllers.current[id] = ctrl;

    setJobs(prev => [...prev, { id, label: fileName || 'Import', status: 'running', current: 0, total, phase: 'Starting...' }]);
    await dbJobCreate(id, fileName || 'Import', 'Bulk Import', total, finalOperator);

    (async () => {
      try {
        const cleanedRows = validRows.map(r => cleanRow(r));
        const formData = new FormData();
        formData.append('json_data', JSON.stringify(cleanedRows));
        formData.append('file_name', fileName || 'Import');
        formData.append('uploaded_by', finalOperator);
        if (importDestination === 'draft') {
            formData.append('target', 'draft');
        }

        updateJob(id, { phase: 'Processing on server...' });

        let res;
        try {
          res = await fetchWithAuth(`${API_BASE}/upload-process`, {
            method: 'POST',
            body: formData,
            signal: ctrl.signal,
          });
        } catch (fetchErr) {
          console.error('[Import] Network error:', fetchErr);
          throw new Error(`Network Error: ${fetchErr.message} — check if API server is reachable`);
        }

        if (!res) throw new Error('Auth failed (401) — please re-login and try again');

        if (!res.ok && res.status !== 200) {
          const errBody = await res.text().catch(() => 'Could not read response');
          console.error(`[Import] HTTP ${res.status}:`, errBody.slice(0, 500));
          throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }

        const rawText = await res.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch(e) {
            const cleanText = rawText.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
            throw new Error(`PHP Fatal Error: ${cleanText.substring(0, 250)}`);
        }

        if (!result.success) throw new Error(result.error || 'Upload failed');

        const s = result.summary;
        const phaseSummary = [
          `${s.total_inserted} inserted`,
          s.couple_count > 0 ? `${s.couple_count} couples (${s.couple_numbers} numbers)` : null,
          s.group_count > 0 ? `${s.group_count} groups (${s.group_numbers} numbers)` : null,
          s.flagged > 0 ? `${s.flagged} flagged` : null,
          s.errors > 0 ? `${s.errors} errors` : null,
        ].filter(Boolean).join(', ');

        await dbJobUpdate(id, { status: 'done', processed: s.total_inserted });
        updateJob(id, { status: 'done', current: total, phase: `Complete: ${phaseSummary}`, serverResult: result });
        await writeOperationLog({
          fileName: fileName || 'Import',
          operationType: 'imported',
          operationData: `Imported ${s.total_inserted} records. Flags: ${s.flagged}, Errors: ${s.errors}`,
          totalRecords: s.total_inserted,
          tableName: importDestination === 'draft' ? 'wp_fn_draft_numbers (Plus Couple/Group)' : 'wp_fn_numbers (Plus Couple/Group)',
          status: 'completed',
          adminName: finalOperator,
        });

      } catch (err) {
        if (err?.name === 'AbortError') {
          updateJob(id, { status: 'done', phase: `Cancelled` });
          await dbJobUpdate(id, { status: 'cancelled', processed: 0 });
        } else {
          const errMsg = err?.message || 'Unknown error';
          await dbJobUpdate(id, { status: 'failed', processed: 0, phase: 'Error: ' + errMsg });
          updateJob(id, { status: 'done', phase: 'Error: ' + errMsg });
          await writeOperationLog({
            fileName: fileName || 'Import',
            operationType: 'imported',
            operationData: `Error: ${errMsg}`,
            totalRecords: 0,
            tableName: importDestination === 'draft' ? 'wp_fn_draft_numbers' : 'wp_fn_numbers',
            status: 'error',
            adminName: finalOperator,
          });
        }
      }
    })();
  }, [updateJob]);

  // ── Server-Side Upload Processor ──────────────────────────────────────────
  // Sends the raw file to the PHP upload-process endpoint.
  // The server handles parsing, validation, bucketing, dedup, and insertion.
  const runServerUpload = useCallback(async ({ file, operatorName }) => {
    const id = `srv_upload_${Date.now()}`;
    const finalOperator = operatorName || localStorage.getItem('ag_admin_username') || 'Admin';

    const ctrl = new AbortController();
    abortControllers.current[id] = ctrl;

    setJobs(prev => [...prev, {
      id, label: file.name || 'Upload', status: 'running',
      current: 0, total: 1, phase: 'Uploading file to server...'
    }]);
    await dbJobCreate(id, file.name || 'Upload', 'Server Upload', 1, finalOperator);

    (async () => {
      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('uploaded_by', finalOperator);

        updateJob(id, { phase: 'Processing on server...' });

        const token = localStorage.getItem('ag_admin_token') || '';
        const res = await fetch(`${API_BASE}/upload-process`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData,
          signal: ctrl.signal,
        });

        if (!res || !res.ok) {
          const errText = await (res ? res.text() : Promise.resolve('Network Error'));
          throw new Error(`HTTP ${res?.status}: ${errText}`);
        }

        const result = await res.json();
        if (!result.success) throw new Error(result.error || 'Upload failed');

        const s = result.summary;
        const phaseSummary = [
          `${s.total_inserted} inserted`,
          s.couple_count > 0 ? `${s.couple_count} couples (${s.couple_numbers} numbers)` : null,
          s.group_count > 0 ? `${s.group_count} groups (${s.group_numbers} numbers)` : null,
          s.flagged > 0 ? `${s.flagged} flagged` : null,
          s.errors > 0 ? `${s.errors} errors` : null,
        ].filter(Boolean).join(', ');

        updateJob(id, {
          status: 'done', current: 1, total: 1,
          phase: `Complete: ${phaseSummary}`,
          serverResult: result,
        });
        await dbJobUpdate(id, { status: 'done', processed: s.total_inserted });
        await writeOperationLog({
          fileName: file.name,
          operationType: 'server-upload',
          operationData: phaseSummary,
          totalRecords: s.total_inserted,
          tableName: 'wp_fn_numbers',
          status: 'complete',
          adminName: finalOperator,
        });
        fetchDbJobs();
      } catch (e) {
        if (e?.name === 'AbortError') {
          updateJob(id, { status: 'done', phase: 'Cancelled by user' });
          await dbJobUpdate(id, { status: 'cancelled' });
        } else {
          const errMsg = e?.message || 'Unknown error';
          updateJob(id, { status: 'done', phase: `Error: ${errMsg}` });
          await dbJobUpdate(id, { status: 'error' });
          await writeOperationLog({
            fileName: file.name,
            operationType: 'server-upload',
            operationData: `Error: ${errMsg}`,
            totalRecords: 0,
            tableName: 'wp_fn_numbers',
            status: 'error',
            adminName: finalOperator,
          });
        }
      }
    })();

    return id;
  }, [updateJob, fetchDbJobs]);

  const runDeleteOperation = useCallback(async ({ toDelete, fileName, destination, operatorName }) => {
    const id = `bulk_del_${Date.now()}`;
    const total = toDelete.length;
    const finalOperator = operatorName || localStorage.getItem('ag_admin_username') || 'Admin';

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
      jobs, dbJobs, hasActiveJobs, runBulkImport, runServerUpload, runDeleteOperation, removeJob, removeDbJob,
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
