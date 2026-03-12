import React, { useState, useEffect, useCallback } from 'react';
import { useImport } from '../context/ImportContext';
import { fetchWithAuth } from '../utils/api';
import { API_BASE } from '../config/api';
import {
  RefreshCw, X, Trash2, Save, CheckCircle, AlertTriangle,
  Bell, ChevronDown, ChevronUp, Inbox,
} from 'lucide-react';

const POLL_INTERVAL_MS = 5000; // poll DB every 5 seconds

export default function BackgroundImportWidget() {
  const { jobs: memJobs, requestAbort, removeJob } = useImport();
  const [open, setOpen]       = useState(false);
  const [expanded, setExpanded] = useState({});
  const [dbJobs, setDbJobs]   = useState([]);   // jobs fetched from DB
  const [dbLoading, setDbLoading] = useState(false);

  // ── Poll DB for job status ──────────────────────────────────────────────────
  const fetchDbJobs = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `${API_BASE}/wp_fn_background_jobs?limit=30&order=started_at&dir=desc`
      );
      if (res && res.ok) {
        const data = await res.json();
        setDbJobs(Array.isArray(data) ? data : []);
      }
    } catch (e) {
      // silently fail — widget still shows in-memory jobs
    }
  }, []);

  useEffect(() => {
    fetchDbJobs();
    const timer = setInterval(fetchDbJobs, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchDbJobs]);

  // ── Merge in-memory + DB jobs ───────────────────────────────────────────────
  // In-memory jobs take priority (they have live progress).
  // DB jobs fill in jobs from previous sessions / page refreshes.
  const memJobIds = new Set(memJobs.map(j => j.id));

  const dbOnlyJobs = dbJobs
    .filter(d => !memJobIds.has(d.job_id))
    .map(d => ({
      id:       d.job_id,
      label:    d.file_name,
      status:   d.status === 'running' ? 'db_running' : d.status,      // db_running = running but not in-memory
      current:  d.processed ?? 0,
      total:    d.total ?? 0,
      phase:    d.status === 'running' ? `Processing… (${d.processed ?? 0}/${d.total ?? 0})` : d.status,
      summary:  d.status === 'done' || d.status === 'aborted' || d.status === 'failed'
        ? { inserted: d.inserted ?? 0, updated: d.updated ?? 0, deleted: d.deleted ?? 0, failed: d.failed ?? 0 }
        : null,
      adminName: d.admin_name,
      dbOnly: true,
      startedAt: d.started_at,
      finishedAt: d.finished_at,
    }));

  const allJobs = [...memJobs, ...dbOnlyJobs];

  // ── Counts ──────────────────────────────────────────────────────────────────
  const activeJobs   = allJobs.filter(j => j.status === 'running' || j.status === 'cleaning' || j.status === 'db_running');
  const finishedJobs = allJobs.filter(j => j.status === 'done' || j.status === 'aborted' || j.status === 'failed');
  const totalJobs    = allJobs.length;

  const toggleExpand = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const pct = (job) => job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;

  const statusColor = (j) => {
    if (j.status === 'cleaning')  return '#f59e0b';
    if (j.status === 'running' || j.status === 'db_running') return 'var(--neon-green-dark)';
    if (j.status === 'aborted' || j.status === 'failed') return '#ef4444';
    if (j.summary?.error)  return '#ef4444';
    return '#16a34a';
  };

  const StatusIcon = ({ job }) => {
    if (job.status === 'running' || job.status === 'cleaning' || job.status === 'db_running')
      return <RefreshCw size={14} style={{ animation: 'spin 1.2s linear infinite', color: statusColor(job) }} />;
    if (job.status === 'aborted' || job.status === 'failed' || job.summary?.error)
      return <AlertTriangle size={14} style={{ color: '#ef4444' }} />;
    return <CheckCircle size={14} style={{ color: '#16a34a' }} />;
  };

  const dismissDbJob = async (jobId) => {
    // Mark as dismissed by deleting from DB
    try {
      await fetchWithAuth(`${API_BASE}/wp_fn_background_jobs/${jobId}`, { method: 'DELETE' });
    } catch (e) { /* ignore */ }
    setDbJobs(prev => prev.filter(d => d.job_id !== jobId));
  };

  const dismissJob = (job) => {
    if (job.dbOnly) {
      dismissDbJob(job.id);
    } else {
      removeJob(job.id);
      // Also clean DB record after dismissing
      fetchWithAuth(`${API_BASE}/wp_fn_background_jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  return (
    <div style={{ position: 'relative', marginRight: '16px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* ── Bell Pill — always visible ──────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          background: activeJobs.length > 0 ? 'var(--neon-green-dark)' : '#f8fafc',
          color: activeJobs.length > 0 ? '#fff' : 'var(--text-main)',
          padding: '8px 16px', borderRadius: '40px', cursor: 'pointer',
          border: `1px solid ${activeJobs.length > 0 ? 'transparent' : 'var(--border-color)'}`,
          fontWeight: 700, fontSize: '0.85rem',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)', transition: 'all 0.2s',
          position: 'relative',
        }}
      >
        {activeJobs.length > 0
          ? <RefreshCw size={16} style={{ animation: 'spin 2s linear infinite' }} />
          : <Bell size={16} />
        }
        {activeJobs.length > 0
          ? `${activeJobs.length} Running`
          : totalJobs > 0 ? `${finishedJobs.length} Done` : 'Operations'
        }
        {/* Badge — only shows when there are jobs */}
        {totalJobs > 0 && (
          <span style={{
            position: 'absolute', top: '-5px', right: '-5px',
            background: activeJobs.length > 0 ? '#ef4444' : '#64748b',
            color: '#fff', borderRadius: '50%', width: '18px', height: '18px',
            fontSize: '0.7rem', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{totalJobs}</span>
        )}
      </button>

      {/* ── Dropdown Panel ─────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 15px)', right: 0,
          background: '#fff', width: '440px', borderRadius: '20px',
          boxShadow: '0 20px 50px -10px rgba(0,0,0,0.18)',
          border: '1px solid #e2e8f0', zIndex: 99999, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '18px 20px', borderBottom: '1px solid #f1f5f9',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#0f172a' }}>
                Background Operations
              </h3>
              <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#64748b' }}>
                {activeJobs.length > 0
                  ? `${activeJobs.length} running · ${finishedJobs.length} completed`
                  : totalJobs > 0
                    ? `${finishedJobs.length} completed`
                    : 'No active operations'}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {dbLoading && <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite', color: '#94a3b8' }} />}
              <button onClick={() => setOpen(false)}
                style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
                <X size={16} color="#64748b" />
              </button>
            </div>
          </div>

          {/* Job List */}
          <div style={{ maxHeight: '480px', overflowY: 'auto' }}>

            {/* ── Empty State ── */}
            {allJobs.length === 0 && (
              <div style={{
                padding: '48px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '52px', height: '52px', background: '#f8fafc',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '1px solid #e2e8f0',
                }}>
                  <Inbox size={24} color="#94a3b8" />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>No operations yet</p>
                  <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '0.8rem' }}>
                    Import or upload jobs will appear here with live progress.
                  </p>
                </div>
              </div>
            )}

            {allJobs.map(job => (
              <div key={job.id} style={{ borderBottom: '1px solid #f8fafc', transition: 'background 0.2s' }}>

                {/* Job Row */}
                <div
                  style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'flex-start' }}
                  onClick={() => toggleExpand(job.id)}
                >
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>
                    <StatusIcon job={job} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* File name + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: 700, fontSize: '0.88rem', color: '#0f172a',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px',
                      }} title={job.label}>{job.label}</span>
                      <span style={{
                        background: statusColor(job) + '18', color: statusColor(job),
                        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                      }}>
                        {job.status === 'cleaning'   ? 'Rolling back…' :
                         job.status === 'running'    ? 'Running' :
                         job.status === 'db_running' ? 'Running (BG)' :
                         job.status === 'aborted'    ? 'Aborted' :
                         job.status === 'failed'     ? 'Failed' :
                         job.summary?.error          ? 'Error' : 'Done'}
                      </span>
                      {job.dbOnly && (
                        <span style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 600 }}>
                          {job.adminName ? `by ${job.adminName}` : ''}
                        </span>
                      )}
                    </div>

                    {/* Phase text */}
                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                      {job.phase}
                    </p>

                    {/* Progress bar for running jobs */}
                    {(job.status === 'running' || job.status === 'cleaning' || job.status === 'db_running') && job.total > 0 && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
                          <span>{job.current.toLocaleString()} / {job.total.toLocaleString()}</span>
                          <span>{pct(job)}%</span>
                        </div>
                        <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '10px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: '10px',
                            background: statusColor(job),
                            width: `${pct(job)}%`, transition: 'width 0.4s ease',
                          }} />
                        </div>
                      </div>
                    )}

                    {/* time for DB-only jobs */}
                    {job.dbOnly && job.startedAt && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                        Started: {new Date(job.startedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {job.finishedAt ? ` · Finished: ${new Date(job.finishedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    )}

                    {/* Summary pills for done jobs */}
                    {job.summary && job.status !== 'running' && job.status !== 'db_running' && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                        {job.summary.inserted > 0 && <Pill label="Inserted" val={job.summary.inserted} color="#16a34a" />}
                        {job.summary.updated  > 0 && <Pill label="Updated"  val={job.summary.updated}  color="#3b82f6" />}
                        {job.summary.deleted  > 0 && <Pill label="Deleted"  val={job.summary.deleted}  color="#ef4444" />}
                        {job.summary.failed   > 0 && <Pill label="Failed"   val={job.summary.failed}   color="#f59e0b" />}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '6px', flexShrink: 0, alignItems: 'center' }}>
                    {/* Expand toggle for live in-memory running jobs */}
                    {job.status === 'running' && !job.abortRequested && !job.dbOnly && (
                      <button
                        onClick={e => { e.stopPropagation(); toggleExpand(job.id); }}
                        style={iconBtn}
                      >
                        {expanded[job.id] ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                    )}
                    {/* Dismiss finished jobs */}
                    {(job.status === 'done' || job.status === 'aborted' || job.status === 'failed') && (
                      <button onClick={e => { e.stopPropagation(); dismissJob(job); }} style={iconBtn} title="Dismiss">
                        <X size={14} color="#94a3b8" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Abort controls for live in-memory jobs */}
                {expanded[job.id] && job.status === 'running' && !job.abortRequested && !job.dbOnly && (
                  <div style={{ padding: '0 20px 16px 46px', display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => { requestAbort(job.id, 'save'); setExpanded(p => ({ ...p, [job.id]: false })); }}
                      style={abortSaveBtn}
                    >
                      <Save size={14} /> Stop & Save
                    </button>
                    <button
                      onClick={() => { requestAbort(job.id, 'delete'); setExpanded(p => ({ ...p, [job.id]: false })); }}
                      style={abortDelBtn}
                    >
                      <Trash2 size={14} /> Stop & Delete All
                    </button>
                  </div>
                )}

                {/* Abort requested indicator */}
                {job.abortRequested && job.status === 'running' && (
                  <div style={{ padding: '0 20px 14px 46px' }}>
                    <span style={{ fontSize: '0.78rem', color: '#ef4444', fontWeight: 700 }}>
                      ⏹ Stopping — finishing current chunk…
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          {finishedJobs.length > 0 && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Polls DB every 5s · survives refresh
              </span>
              <button
                onClick={() => finishedJobs.forEach(j => dismissJob(j))}
                style={{ background: 'none', border: 'none', fontSize: '0.8rem', color: '#94a3b8', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear {finishedJobs.length} completed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Pill({ label, val, color }) {
  return (
    <span style={{
      background: color + '15', color, fontSize: '0.72rem',
      fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
    }}>
      {label}: {val}
    </span>
  );
}

const iconBtn = {
  background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px',
  padding: '5px 7px', cursor: 'pointer', display: 'flex', alignItems: 'center',
};
const abortSaveBtn = {
  display: 'flex', alignItems: 'center', gap: '6px',
  padding: '8px 14px', borderRadius: '10px', fontWeight: 700, fontSize: '0.8rem',
  background: '#f8fafc', border: '1px solid #e2e8f0', color: '#0f172a', cursor: 'pointer',
};
const abortDelBtn = {
  ...abortSaveBtn,
  background: '#fef2f2', border: '1px solid #fee2e2', color: '#ef4444',
};
