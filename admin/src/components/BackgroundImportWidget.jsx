import React, { useState, useEffect, useCallback } from 'react';
import { useImport } from '../context/ImportContext';
import { fetchWithAuth } from '../utils/api';
import { API_BASE } from '../config/api';
import {
  RefreshCw, X, CheckCircle, AlertTriangle,
  Bell, Inbox,
} from 'lucide-react';

const POLL_INTERVAL_MS = 5000; // poll DB every 5 seconds

export default function BackgroundImportWidget() {
  const { jobs: memJobs, dbJobs, removeJob, removeDbJob, cancelJob, forceStopDbJob } = useImport();
  const [open, setOpen]       = useState(false);

  // ── Merge in-memory + DB jobs ───────────────────────────────────────────────
  const memJobIds = new Set(memJobs.map(j => j.id));

  const dbOnlyJobs = dbJobs
    .filter(d => !memJobIds.has(d.job_id))
    .map(d => ({
      id:       d.job_id,
      label:    d.file_name,
      status:   d.status === 'running' ? 'db_running' : d.status,
      current:  d.processed ?? 0,
      total:    d.total ?? 0,
      phase:    d.status === 'running' ? (d.phase || `Processing… (${d.processed ?? 0}/${d.total ?? 0})`) : d.status,
      summary:  d.status === 'done' || d.status === 'failed'
        ? { inserted: d.inserted ?? 0, updated: d.updated ?? 0, deleted: d.deleted ?? 0, failed: d.failed ?? 0 }
        : null,
      operationType: d.operation,
      adminName: d.admin_name,
      dbOnly: true,
      startedAt: d.started_at,
      finishedAt: d.finished_at,
    }));

  const allJobs = [...memJobs, ...dbOnlyJobs];

  // ── Counts ──────────────────────────────────────────────────────────────────
  const activeJobs   = allJobs.filter(j => j.status === 'running' || j.status === 'db_running');
  const finishedJobs = allJobs.filter(j => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled');
  const totalJobs    = allJobs.length;

  const pct = (job) => job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;

  const statusColor = (j) => {
    if (j.status === 'running' || j.status === 'db_running') return 'var(--neon-green-dark)';
    if (j.status === 'failed') return '#ef4444';
    if (j.summary?.error)  return '#ef4444';
    return '#16a34a';
  };

  const StatusIcon = ({ job }) => {
    if (job.status === 'running' || job.status === 'db_running')
      return <RefreshCw size={14} style={{ animation: 'spin 1.2s linear infinite', color: statusColor(job) }} />;
    if (job.status === 'failed' || job.summary?.error)
      return <AlertTriangle size={14} style={{ color: '#ef4444' }} />;
    return <CheckCircle size={14} style={{ color: '#16a34a' }} />;
  };

  const dismissJob = (job) => {
    if (job.dbOnly) {
      removeDbJob(job.id);
    } else {
      removeJob(job.id);
      fetchWithAuth(`${API_BASE}/wp_fn_background_jobs/${job.id}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  return (
    <div style={{ position: 'relative', marginRight: '16px' }}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

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
            <button onClick={() => setOpen(false)}
              style={{ background: '#f1f5f9', border: 'none', padding: '8px', borderRadius: '10px', cursor: 'pointer' }}>
              <X size={16} color="#64748b" />
            </button>
          </div>

          {/* Job List */}
          <div style={{ maxHeight: '480px', overflowY: 'auto' }}>
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
              <div key={job.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                <div style={{ padding: '14px 20px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>
                    <StatusIcon job={job} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{
                        fontWeight: 700, fontSize: '0.88rem', color: '#0f172a',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px',
                      }} title={job.label}>{job.label}</span>
                      <span style={{
                        background: statusColor(job) + '18', color: statusColor(job),
                        fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '20px',
                      }}>
                        {job.operationType?.toLowerCase().includes('delete') ? 'Deleting' :
                         job.operationType?.toLowerCase().includes('draft')  ? 'Drafting' :
                         job.status === 'running'    ? 'Running' :
                         job.status === 'db_running' ? 'Running (BG)' :
                         job.status === 'failed'     ? 'Failed' :
                         job.status === 'cancelled'  ? 'Cancelled' :
                         job.summary?.error          ? 'Error' : 'Done'}
                      </span>
                    </div>

                    <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>
                      {job.phase}
                    </p>

                    {(job.status === 'running' || job.status === 'db_running') && job.total > 0 && (
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

                    {job.dbOnly && job.startedAt && (
                      <p style={{ margin: '4px 0 0', fontSize: '0.73rem', color: '#94a3b8' }}>
                        Started: {new Date(job.startedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        {job.finishedAt ? ` · Finished: ${new Date(job.finishedAt).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
                      </p>
                    )}

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
                    {/* Cancel button for in-memory running jobs */}
                    {job.status === 'running' && !job.dbOnly && (
                      <button
                        onClick={e => { e.stopPropagation(); cancelJob(job.id); }}
                        style={{ ...iconBtn, background: '#fee2e2', borderColor: '#fecaca' }}
                        title="Cancel this operation"
                      >
                        <X size={14} color="#ef4444" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444', marginLeft: '2px' }}>Cancel</span>
                      </button>
                    )}
                    {/* Force stop for stuck DB-only running jobs */}
                    {job.status === 'db_running' && job.dbOnly && (
                      <button
                        onClick={e => { e.stopPropagation(); forceStopDbJob(job.id); }}
                        style={{ ...iconBtn, background: '#fef3c7', borderColor: '#fcd34d' }}
                        title="Force stop this stuck operation"
                      >
                        <AlertTriangle size={14} color="#b45309" />
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', marginLeft: '2px' }}>Stop</span>
                      </button>
                    )}
                    {/* Dismiss for completed/failed/cancelled */}
                    {(job.status === 'done' || job.status === 'failed' || job.status === 'cancelled') && (
                      <button onClick={e => { e.stopPropagation(); dismissJob(job); }} style={iconBtn} title="Dismiss">
                        <X size={14} color="#94a3b8" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          {(finishedJobs.length > 0 || allJobs.length > 0) && (
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                Polls DB every 15s · survives refresh
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
