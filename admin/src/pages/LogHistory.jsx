import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, RefreshCw, Clock, CheckCircle, XCircle, AlertTriangle,
  ChevronLeft, ChevronRight, AlertCircle, Trash2, Filter
} from 'lucide-react';
import { getWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';
import { useToast } from '../components/Toast';

function useDebounce(value, delay) {
  const [d, setD] = useState(value);
  useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t); }, [value, delay]);
  return d;
}

const ALL_COLUMNS = [
  { key: 'batch_id', label: 'Batch ID', width: '80px' },
  { key: 'file_name', label: 'File Name', width: '220px' },
  { key: 'operation_type', label: 'Operation', width: '130px' },
  { key: 'admin_name', label: 'Operator', width: '130px' },
  { key: 'total_records', label: 'Records', width: '80px' },
  { key: 'upload_time', label: 'Date & Time', width: '180px' },
  { key: 'status', label: 'Status', width: '120px' },
  { key: 'operation_data', label: 'Details', width: '250px' },
  { key: 'table_name', label: 'Table', width: '140px' },
];

const PAGE_SIZE = 50;

const STATUS_BADGE = {
  completed:      { bg: '#dcfce7', color: '#16a34a', icon: CheckCircle },
  'not completed': { bg: '#fef9c3', color: '#a16207', icon: AlertTriangle },
  error:          { bg: '#fee2e2', color: '#dc2626', icon: XCircle },
  running:        { bg: '#dbeafe', color: '#2563eb', icon: Clock },
  cancelled:      { bg: '#f3f4f6', color: '#6b7280', icon: XCircle },
  failed:         { bg: '#fee2e2', color: '#dc2626', icon: XCircle },
};

const OP_BADGE = {
  inserted: { bg: '#dcfce7', color: '#16a34a' },
  imported: { bg: '#dcfce7', color: '#16a34a' },
  edited:   { bg: '#dbeafe', color: '#2563eb' },
  updated:  { bg: '#dbeafe', color: '#2563eb' },
  deleted:  { bg: '#fee2e2', color: '#dc2626' },
  bulk_import: { bg: '#f0fdf4', color: '#15803d' },
};

export default function LogHistory() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [statusFilter, setStatusFilter] = useState('');
  const [opFilter, setOpFilter] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWithAuth(`${API_BASE}/wp_fn_upload_batches?limit=100000&order=batch_id&dir=desc`);
      const data = await safeJson(res);
      setLogs(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error('Failed to fetch logs', err);
      toast.error('Failed to load operation logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = useMemo(() => {
    if (!Array.isArray(logs)) return [];
    return logs.filter(log => {
      const s = debouncedSearch.toLowerCase().trim();
      if (s) {
        const fields = [log.file_name, log.admin_name, log.operation_data, log.operation_type, log.table_name]
          .map(f => String(f || '').toLowerCase());
        if (!fields.some(f => f.includes(s))) return false;
      }
      if (statusFilter && log.status !== statusFilter) return false;
      if (opFilter && log.operation_type !== opFilter) return false;
      if (fileFilter && log.file_name !== fileFilter) return false;
      return true;
    });
  }, [logs, debouncedSearch, statusFilter, opFilter, fileFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Unique values for filters
  const uniqueStatuses = [...new Set(logs.map(l => l.status).filter(Boolean))];
  const uniqueOps = [...new Set(logs.map(l => l.operation_type).filter(Boolean))];
  const uniqueFiles = [...new Set(logs.map(l => l.file_name).filter(Boolean))].sort();

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'medium' }); }
    catch { return d; }
  };

  const renderStatusBadge = (status) => {
    const st = STATUS_BADGE[status] || STATUS_BADGE.error;
    const Icon = st.icon;
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '4px 10px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: 700,
        background: st.bg, color: st.color, textTransform: 'uppercase',
      }}>
        <Icon size={12} />
        {status || 'unknown'}
      </span>
    );
  };

  const renderOpBadge = (op) => {
    const key = String(op || '').toLowerCase();
    const st = Object.entries(OP_BADGE).find(([k]) => key.includes(k))?.[1] || { bg: '#f3f4f6', color: '#6b7280' };
    return (
      <span style={{
        padding: '4px 10px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 700,
        background: st.bg, color: st.color, textTransform: 'uppercase',
      }}>
        {op || '-'}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        .log-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .log-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .log-scroll::-webkit-scrollbar-thumb { background: var(--neon-green-dark, #16a34a); border-radius: 4px; }
        .log-scroll::-webkit-scrollbar-thumb:hover { background: var(--neon-green, #22c55e); }
        .log-scroll { scrollbar-color: var(--neon-green-dark, #16a34a) #f1f5f9; scrollbar-width: thin; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Clock size={22} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Operation Log History</h2>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
            {filtered.length}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search + Filters */}
      <div className="card" style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search file name, operator, details..."
            className="input"
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>
        <select className="input" style={{ width: '160px' }} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}>
          <option value="">All Statuses</option>
          {uniqueStatuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" style={{ width: '160px' }} value={opFilter} onChange={(e) => { setOpFilter(e.target.value); setPage(0); }}>
          <option value="">All Operations</option>
          {uniqueOps.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className="input" style={{ width: '200px' }} value={fileFilter} onChange={(e) => { setFileFilter(e.target.value); setPage(0); }}>
          <option value="">All Files</option>
          {uniqueFiles.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Ops', value: logs.length, color: '#3b82f6' },
          { label: 'Completed', value: logs.filter(l => l.status === 'completed').length, color: '#16a34a' },
          { label: 'Errors', value: logs.filter(l => l.status === 'error' || l.status === 'failed').length, color: '#dc2626' },
          { label: 'Today', value: logs.filter(l => { try { return new Date(l.upload_time).toDateString() === new Date().toDateString(); } catch { return false; } }).length, color: '#8b5cf6' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '14px 18px', textAlign: 'center' }}>
            <p style={{ fontSize: '0.72rem', fontWeight: 700, color: '#94a3b8', margin: 0, textTransform: 'uppercase' }}>{stat.label}</p>
            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: stat.color, margin: '4px 0 0' }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div className="log-scroll" style={{ overflow: 'auto', maxHeight: '60vh' }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                {ALL_COLUMNS.map(col => (
                  <th key={col.key} style={{ ...thStyle, minWidth: col.width }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={ALL_COLUMNS.length}><div className="skeleton" style={{ height: '36px', margin: '6px 10px' }} /></td></tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={ALL_COLUMNS.length} style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <AlertCircle size={48} />
                      <p style={{ fontWeight: 600 }}>No operation logs found.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map(log => (
                  <tr key={log.batch_id} style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === log.batch_id ? null : log.batch_id)}>
                    {ALL_COLUMNS.map(col => (
                      <td key={col.key} style={{ ...tdStyle, maxWidth: col.key === 'operation_data' ? '300px' : '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: col.key === 'operation_data' && expanded === log.batch_id ? 'pre-wrap' : 'nowrap' }}>
                        {col.key === 'status' ? renderStatusBadge(log.status) :
                         col.key === 'operation_type' ? renderOpBadge(log.operation_type) :
                         col.key === 'upload_time' ? (
                           <span style={{ fontSize: '0.78rem', color: '#64748b', fontFamily: 'monospace' }}>{formatDate(log.upload_time)}</span>
                         ) :
                         col.key === 'batch_id' ? (
                           <span style={{ fontWeight: 700, color: '#64748b', fontFamily: 'monospace' }}>#{log.batch_id}</span>
                         ) :
                         col.key === 'total_records' ? (
                           <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{log.total_records || 0}</span>
                         ) :
                         col.key === 'admin_name' ? (
                           <span style={{ fontWeight: 600 }}>{log.admin_name || '-'}</span>
                         ) :
                         col.key === 'file_name' ? (
                           <span style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.85rem' }} title={log.file_name || ''}>{log.file_name || '-'}</span>
                         ) :
                         col.key === 'table_name' ? (
                           <code style={{ fontSize: '0.75rem', padding: '2px 6px', background: '#f1f5f9', borderRadius: '4px' }}>{log.table_name || '-'}</code>
                         ) :
                         col.key === 'operation_data' ? (
                           <span style={{ fontSize: '0.8rem', color: '#475569' }} title={log.operation_data || ''}>
                             {expanded === log.batch_id ? (log.operation_data || '-') : (log.operation_data || '-').slice(0, 60) + ((log.operation_data || '').length > 60 ? '…' : '')}
                           </span>
                         ) :
                         String(log[col.key] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > 0 && (
          <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', background: '#fafbfc' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              {filtered.length} entries · Page {page + 1} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button className="btn btn-secondary btn-sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} /> Prev
              </button>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  background: '#f8fafc', padding: '10px 12px', textAlign: 'left',
  fontSize: '0.72rem', fontWeight: 800, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: '0.03em',
  borderBottom: '2px solid #e2e8f0', whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '10px 12px', borderBottom: '1px solid #f1f5f9',
  fontSize: '0.85rem', color: 'var(--text-primary)',
};
