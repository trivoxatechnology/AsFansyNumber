import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { fetchWithAuth } from '../utils/api';
import { writeOperationLog } from '../utils/operationLog';
import { API_BASE } from '../config/api';

const ImportContext = createContext();

// ── DB Job Tracking Helpers ───────────────────────────────────────────────────
// These write to wp_fn_background_jobs to make progress survive page refresh.

async function dbJobCreate(jobId, fileName, operation, total, adminName) {
  try {
    await fetchWithAuth(`${API_BASE}/wp_fn_background_jobs`, {
      method: 'POST',
      body: JSON.stringify({
        job_id:     jobId,
        file_name:  fileName,
        operation,
        status:     'running',
        total,
        processed:  0,
        inserted:   0,
        updated:    0,
        deleted:    0,
        failed:     0,
        admin_name: adminName,
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

// ── Context ───────────────────────────────────────────────────────────────────

export function ImportProvider({ children }) {
  const [jobs, setJobs] = useState([]);
  const jobRefs = useRef({}); // id → { insertedIds[], abortRequested, abortType }

  // ── Parse Session State ─────────────────────────────────────────────────────
  // Lives here so it survives navigation away from ImportWorkspace
  const [parseSession, setParseSession] = useState({
    rows: [],
    step: 1,
    fileName: '',
    isParsing: false,
    parseProgress: '',
    operatorName: localStorage.getItem('adminUsername') || '',
  });

  const updateParseSession = useCallback((patch) => {
    setParseSession(prev => ({ ...prev, ...patch }));
  }, []);

  const clearParseSession = useCallback(() => {
    setParseSession({
      rows: [], step: 1, fileName: '',
      isParsing: false, parseProgress: '',
      operatorName: localStorage.getItem('adminUsername') || '',
    });
  }, []);

  const updateJob = useCallback((id, patch) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  const removeJob = useCallback((id) => {
    setJobs(prev => prev.filter(j => j.id !== id));
    delete jobRefs.current[id];
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────────
  const runImport = useCallback(async ({
    rows,
    fileName,
    importDestination,
    operatorName,
    cleanRow,
  }) => {
    const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const validRows = rows.filter(r => r._status === 'valid');
    const toInsert  = validRows.filter(r => r._operation === 'insert');
    const toUpdate  = validRows.filter(r => r._operation === 'update');
    const toDelete  = validRows.filter(r => r._operation === 'delete');
    const total = toInsert.length + toUpdate.length + toDelete.length;

    const finalOperator = operatorName || localStorage.getItem('adminUsername') || 'Admin';

    jobRefs.current[id] = {
      insertedIds: [],
      abortRequested: false,
      abortType: null,
    };

    setJobs(prev => [...prev, {
      id,
      label: fileName || 'Import',
      status: 'running',
      current: 0,
      total,
      phase: 'Starting…',
      summary: null,
      abortRequested: false,
    }]);

    // Create DB job record immediately so it's visible after refresh
    await dbJobCreate(id, fileName || 'Import', 'Excel Import', total, finalOperator);

    // ── Run async ─────────────────────────────────────────────────────────────
    (async () => {
      const ref = jobRefs.current[id];
      let inserted = 0, updated = 0, deleted = 0, failed = 0;
      const touchedRecordIds = [];
      let completedOps = 0;
      const CONCURRENCY = 10;
      let lastDbUpdate = 0; // throttle DB updates to every 2s

      const isAborted   = () => ref ? ref.abortRequested : false;
      const getAbortType = () => ref ? ref.abortType : null;

      const maybeDbUpdate = async (status = 'running') => {
        const now = Date.now();
        if (status !== 'running' || now - lastDbUpdate > 2000) {
          lastDbUpdate = now;
          await dbJobUpdate(id, { processed: completedOps, inserted, updated, deleted, failed, status });
        }
      };

      const processBatch = async (batch, method, phaseLabel) => {
        if (batch.length === 0 || isAborted()) return;
        for (let i = 0; i < batch.length; i += CONCURRENCY) {
          if (isAborted()) break;

          const chunk = batch.slice(i, i + CONCURRENCY);
          const msg = `${phaseLabel}: ${i + 1}–${Math.min(i + CONCURRENCY, batch.length)} of ${batch.length}`;

          updateJob(id, { phase: msg, current: completedOps + i });

          const promises = chunk.map(async (row) => {
            try {
              const payload = method === 'DELETE' ? { number_status: 'deleted' } : cleanRow(row);
              let targetPath = `${API_BASE}/wp_fn_numbers`;
              if (method === 'PUT' || method === 'DELETE') {
                targetPath = row._dbId
                  ? `${API_BASE}/wp_fn_numbers/${row._dbId}`
                  : `${API_BASE}/wp_fn_numbers?mobile_number=${row.mobile_number}`;
              }
              const res = await fetchWithAuth(targetPath, {
                method: method === 'DELETE' ? 'PUT' : method,
                body: JSON.stringify(payload),
              });
              if (res && res.ok) {
                const body = method === 'POST' ? await res.json().catch(() => null) : null;
                const resId = body?.id ?? body?.insert_id ?? row._dbId ?? null;
                if (method === 'POST' && resId && ref) ref.insertedIds.push(resId);
                return { ok: true, id: resId, ref: row.mobile_number };
              }
              return { ok: false, ref: row.mobile_number };
            } catch (err) {
              console.error(`${phaseLabel} Error:`, err);
              return { ok: false, ref: row.mobile_number };
            }
          });

          const results = await Promise.all(promises);
          results.forEach(r => {
            if (r.ok) {
              if (method === 'POST') inserted++;
              else if (method === 'PUT') updated++;
              else if (method === 'DELETE') deleted++;
              if (r.id) touchedRecordIds.push(r.id);
              else if (r.ref) touchedRecordIds.push(`mobile:${r.ref}`);
            } else { failed++; }
          });
          completedOps += chunk.length;
          updateJob(id, { current: completedOps });

          await maybeDbUpdate();

          if (i + CONCURRENCY < batch.length) {
            await new Promise(r => setTimeout(r, 200));
          }
        }
      };

      try {
        await processBatch(toInsert, 'POST', 'Inserting');
        await processBatch(toUpdate, 'PUT',  'Updating');
        await processBatch(toDelete, 'DELETE', 'Deleting');

        // ── Stop & Delete path ────────────────────────────────────────────────
        if (isAborted() && getAbortType() === 'delete') {
          updateJob(id, { status: 'cleaning', phase: 'Rolling back inserts…' });
          await maybeDbUpdate('cleaning');
          await new Promise(r => setTimeout(r, 1500));

          const finalIds = (ref ? ref.insertedIds : []).filter(Boolean);
          let deletedCount = 0;

          if (finalIds.length > 0) {
            try {
              const CHUNK = 10;
              for (let i = 0; i < finalIds.length; i += CHUNK) {
                const chunk = finalIds.slice(i, i + CHUNK);
                await Promise.all(chunk.map(rid =>
                  fetchWithAuth(`${API_BASE}/wp_fn_numbers/${rid}`, { method: 'DELETE' })
                ));
                deletedCount += chunk.length;
                updateJob(id, { phase: `Rolling back ${deletedCount}/${finalIds.length}…` });
                if (i + CHUNK < finalIds.length) await new Promise(r => setTimeout(r, 200));
              }
            } catch (err) { console.error('Rollback failed:', err); }
          }

          await writeOperationLog({
            fileName: fileName || 'Import Workspace',
            operationType: finalIds.length > 0 ? 'Excel Import (Aborted & Deleted)' : 'Excel Import (Aborted)',
            operationData: finalIds.length > 0
              ? `Import stopped by user. Rolled back ${deletedCount} inserted records.`
              : `Import stopped by user. 0 records had been inserted.`,
            totalRecords: deletedCount,
            tableName: 'wp_fn_numbers',
            adminName: finalOperator,
          });

          // Final DB job update
          await dbJobUpdate(id, {
            status: 'aborted', processed: completedOps,
            inserted: 0, updated: 0, deleted: deletedCount, failed,
            finished_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
          });

          updateJob(id, {
            status: 'aborted',
            phase: `Aborted — ${deletedCount} records rolled back`,
            summary: { inserted: 0, updated: 0, deleted: deletedCount, failed: 0, aborted: true },
          });
          return;
        }

        // ── Stop & Save / Normal completion ───────────────────────────────────
        const wasAborted = isAborted();
        const opType = wasAborted
          ? (importDestination === 'draft' ? 'Draft (Partial Save)' : 'Excel Import (Partial Save)')
          : (importDestination === 'draft' ? 'Draft' : 'Excel Import');

        await writeOperationLog({
          fileName: fileName || 'Import Workspace',
          operationType: opType,
          operationData: `Inserted: ${inserted}, Updated: ${updated}, Deleted: ${deleted}, Failed: ${failed}`,
          totalRecords: validRows.length,
          tableName: 'wp_fn_numbers',
          adminName: finalOperator,
        });

        // Final DB job update
        await dbJobUpdate(id, {
          status: 'done', processed: total,
          inserted, updated, deleted, failed,
          finished_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });

        updateJob(id, {
          status: 'done',
          current: total,
          phase: wasAborted ? 'Stopped & saved' : 'Complete',
          summary: { inserted, updated, deleted, failed, aborted: wasAborted },
        });

      } catch (err) {
        console.error('Import job failed:', err);
        await dbJobUpdate(id, {
          status: 'failed', processed: completedOps, inserted, updated, deleted, failed,
          finished_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        });
        updateJob(id, {
          status: 'done',
          phase: `Error: ${err.message || 'Unknown error'}`,
          summary: { inserted, updated, deleted, failed, aborted: false, error: true },
        });
      }
    })();

    return id;
  }, [updateJob]);

  const requestAbort = useCallback((id, type = 'save') => {
    if (jobRefs.current[id]) {
      jobRefs.current[id].abortRequested = true;
      jobRefs.current[id].abortType = type;
      updateJob(id, { abortRequested: true });
    }
  }, [updateJob]);

  return (
    <ImportContext.Provider value={{
      jobs,
      runImport,
      requestAbort,
      removeJob,
      parseSession,
      updateParseSession,
      clearParseSession,
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
