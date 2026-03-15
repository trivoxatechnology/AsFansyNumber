import React, { useState, useCallback } from 'react';
import { Package, Users, TrendingUp, RefreshCw, CloudUpload, ChevronDown, ChevronUp } from 'lucide-react';
import { API_BASE } from '../config/api';
import { fetchWithAuth } from '../utils/api';
import { usePageData } from '../utils/usePageData';
import { BannerView } from '../utils/BannerView';

const STATS_CACHE = 'fn_stats';
const LOGS_CACHE = 'fn_upload_logs';

export default function Dashboard() {
  const [expandedRows, setExpandedRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [operationFilter, setOperationFilter] = useState('all');

  // v4.0: Single stats query — <100ms for 5 lakh records
  const fetchStats = useCallback(async () => {
    const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/stats`);
    if (!res || !res.ok) throw new Error('Stats fetch failed');
    const json = await res.json();
    const s = json?.stats || json || {};
    return {
      total: s.visible ?? s.total ?? 0,
      available: s.available ?? 0,
      sold: s.sold ?? 0,
      onOffer: s.on_offer ?? 0,
      premium: s.premium ?? 0,
    };
  }, []);

  // Logs: uses new paginated response format {data, total}
  const fetchLogs = useCallback(async () => {
    const res = await fetchWithAuth(`${API_BASE}/wp_fn_upload_batches?limit=100&order=upload_time&dir=desc`);
    if (!res || !res.ok) throw new Error('Logs fetch failed');
    const json = await res.json();
    // Handle both old format (array) and new format ({data, total})
    const logs = Array.isArray(json) ? json : (json?.data || []);
    return logs.sort((a, b) => (b.batch_id || b.id || 0) - (a.batch_id || a.id || 0));
  }, []);

  const { data: stats, loading: statsLoading, showBanner: statsErr, refresh: refreshStats } = usePageData(fetchStats, STATS_CACHE, 300000);
  const { data: logs, loading: logsLoading, showBanner: logsErr, refresh: refreshLogs } = usePageData(fetchLogs, LOGS_CACHE, 60000);

  const refreshAll = () => { refreshStats(); refreshLogs(); };

  const filteredUploads = (logs || []).filter(u => operationFilter === 'all' || (u.operation_type || '').toLowerCase().includes(operationFilter.toLowerCase()));

  const parseSuccessCount = (operationData) => {
    if (!operationData) return null;
    let success = 0; let foundAny = false;
    String(operationData).split(',').forEach(part => {
      const [l, v] = part.split(':').map(s => s.trim());
      const val = parseInt(v, 10);
      if (!isNaN(val) && !['fail', 'skip', 'error'].some(e => l.toLowerCase().includes(e))) {
        success += val; foundAny = true;
      }
    });
    return foundAny ? success : null;
  };

  const kpis = [
    { label:'Total Inventory', val:stats?.total, color:'#4a7c00', bg:'rgba(122,194,0,0.12)', icon:<Package size={22}/> },
    { label:'Available', val:stats?.available, color:'#16a34a', bg:'#dcfce7', icon:<TrendingUp size={22}/> },
    { label:'Sold', val:stats?.sold, color:'#64748b', bg:'#f1f5f9', icon:<Users size={22}/> },
    { label:'On Offer', val:stats?.onOffer, color:'#d97706', bg:'#fef3c7', icon:<TrendingUp size={22}/> },
    { label:'Premium (>₹50k)', val:stats?.premium, color:'#8b5cf6', bg:'#f3e8ff', icon:<Package size={22}/> },
  ];

  return (
    <div>
      <BannerView show={statsErr || logsErr} onRetry={refreshAll} />
      
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'20px'}}>
        <button onClick={refreshAll} disabled={statsLoading || logsLoading} style={s.refreshBtn}>
          <RefreshCw size={15} style={{animation:(statsLoading||logsLoading)?'spin 1s linear infinite':'none'}}/> Refresh
        </button>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div style={s.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={s.kpiCard}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div><p style={s.kpiLabel}>{k.label}</p><h3 style={{...s.kpiVal, color:k.color}}>{(k.val ?? 0).toLocaleString()}</h3></div>
              <div style={{...s.kpiIcon, background:k.bg, color:k.color}}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={s.section}>
        <div style={s.sectionHeader}>
          <h3 style={s.sectionTitle}><CloudUpload size={18} style={{marginRight:8}}/> Operation History</h3>
          <select value={operationFilter} onChange={e => setOperationFilter(e.target.value)} style={s.select}>
            <option value="all">All</option>
            <option value="bulk">Bulk Action</option>
            <option value="excel">Excel</option>
          </select>
        </div>
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr><th></th><th>ID</th><th style={{textAlign:'left'}}>File / Action</th><th style={{textAlign:'left'}}>Type</th><th>Done By</th><th>Status</th><th>Records</th><th>Time</th></tr>
            </thead>
            <tbody>
              {filteredUploads.length === 0 ? (
                <tr><td colSpan="8" style={{...s.td, padding:'30px', color:'var(--text-muted)'}}>No operations recorded yet.</td></tr>
              ) : filteredUploads.slice(0, displayLimit).map((u, i) => {
                const batchId = u.batch_id || u.id || i;
                const statusColor = (u.status === 'completed' || u.status === 'running') ? '#16a34a' : (u.status === 'draft' ? '#d97706' : '#ef4444');
                const tried = u.total_records ?? 0;
                const success = parseSuccessCount(u.operation_data);
                return (
                  <React.Fragment key={batchId}>
                    <tr onClick={() => setExpandedRows(p => p.includes(batchId) ? p.filter(x => x !== batchId) : [...p, batchId])} style={{cursor:'pointer'}}>
                      <td style={s.td}>{expandedRows.includes(batchId) ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</td>
                      <td style={s.td}>#{batchId}</td>
                      <td style={{...s.td, textAlign:'left', fontWeight:600}}>{u.file_name || 'Manual Action'}</td>
                      <td style={{...s.td, textAlign:'left'}}><span style={{background:'#f3e8ff', color:'#8b5cf6', padding:'3px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:700}}>{u.operation_type || 'Legacy'}</span></td>
                      <td style={s.td}><b>{u.admin_name || 'Admin'}</b></td>
                      <td style={s.td}><span style={{background:statusColor+'18', color:statusColor, padding:'3px 10px', borderRadius:'20px', fontSize:'0.75rem', fontWeight:700}}>{u.status}</span></td>
                      <td style={s.td}><b>{success ?? tried}</b> / {tried}</td>
                      <td style={s.td}>{(u.upload_time || u.operation_time) ? new Date(u.upload_time || u.operation_time).toLocaleString() : '—'}</td>
                    </tr>
                    {expandedRows.includes(batchId) && (
                      <tr style={{background:'#f8fafc'}}>
                        <td colSpan="8" style={{padding:'16px 24px'}}>
                           <div style={{background:'#fff', border:'1px solid #e2e8f0', padding:'16px', borderRadius:'8px'}}>
                              <p style={{fontWeight:700,color:'var(--neon-green-dark)',marginBottom:'8px'}}>Logs:</p>
                              <p style={{fontSize:'0.85rem', color:'var(--text-muted)'}}>{u.operation_data || 'No detailed logs.'}</p>
                           </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredUploads.length > displayLimit && (
          <div style={{padding:'12px 20px', borderTop:'1px solid #e2e8f0', textAlign:'center'}}>
            <button onClick={() => setDisplayLimit(p => p + 20)} style={{background:'transparent', border:'1px solid #e2e8f0', padding:'8px 20px', borderRadius:'8px', cursor:'pointer', fontWeight:600}}>
              Load More ({filteredUploads.length - displayLimit} remaining)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  refreshBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: '#f1f5f9', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, color: '#475569' },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '20px', marginBottom: '32px' },
  kpiCard: { background: '#fff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' },
  kpiLabel: { color: '#64748b', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' },
  kpiVal: { fontSize: '2rem', fontWeight: 900, margin: 0 },
  kpiIcon: { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  section: { background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0', overflow: 'hidden' },
  sectionHeader: { padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: '1rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center' },
  select: { padding: '6px 12px', borderRadius: '6px', border: '1px solid #e2e8f0' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  td: { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.85rem', textAlign: 'center' },
};
