import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, RefreshCw, Trash2, Upload, Copy, Check, X,
  Archive, AlertCircle, ChevronLeft, ChevronRight, Eye, Loader2
} from 'lucide-react';
import { getWithAuth, postWithAuth, deleteWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';
import { useToast } from '../components/Toast';
import { useOperator } from '../components/OperatorPrompt';

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

// All columns from wp_fn_draft_numbers
const ALL_COLUMNS = [
  { key: 'number_id', label: 'ID', width: '60px' },
  { key: 'mobile_number', label: 'Mobile Number', width: '150px' },
  { key: 'number_type', label: 'Type', width: '60px' },
  { key: 'category', label: 'Category', width: '90px' },
  { key: 'pattern_name', label: 'Pattern Name', width: '140px' },
  { key: 'pattern_type', label: 'Pattern Type', width: '120px' },
  { key: 'prefix', label: 'Prefix', width: '70px' },
  { key: 'suffix', label: 'Suffix', width: '70px' },
  { key: 'digit_sum', label: 'Digit Sum', width: '80px' },
  { key: 'repeat_count', label: 'Repeat', width: '70px' },
  { key: 'vip_score', label: 'VIP Score', width: '80px' },
  { key: 'auto_detected', label: 'Auto', width: '60px' },
  { key: 'base_price', label: 'Base Price', width: '100px' },
  { key: 'offer_price', label: 'Offer Price', width: '100px' },
  { key: 'offer_start_date', label: 'Offer Start', width: '120px' },
  { key: 'offer_end_date', label: 'Offer End', width: '120px' },
  { key: 'platform_commission', label: 'Commission', width: '100px' },
  { key: 'number_status', label: 'Status', width: '100px' },
  { key: 'visibility_status', label: 'Visibility', width: '80px' },
  { key: 'inventory_source', label: 'Source', width: '140px' },
  { key: 'dealer_id', label: 'Dealer', width: '70px' },
  { key: 'remarks', label: 'Remarks', width: '150px' },
  { key: 'draft_reason', label: 'Draft Reason', width: '130px' },
  { key: 'created_at', label: 'Created', width: '150px' },
  { key: 'updated_at', label: 'Updated', width: '150px' },
];

const PAGE_SIZE = 100;

export default function DraftManager() {
  const toast = useToast();
  const { runWithLog } = useOperator();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(0);
  const [pushing, setPushing] = useState(false);
  const [selectCount, setSelectCount] = useState('');

  const fetchDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getWithAuth(`${API_BASE}/wp_fn_draft_numbers?limit=100000&order=number_id&dir=desc`);
      const data = await safeJson(res);
      setItems(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
      console.error('Failed to fetch drafts', err);
      toast.error('Failed to load draft numbers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDrafts(); }, [fetchDrafts]);

  const filtered = useMemo(() => {
    if (!Array.isArray(items)) return [];
    const s = debouncedSearch.toLowerCase().trim();
    if (!s) return items;
    return items.filter(item => {
      const num = String(item.mobile_number || '').toLowerCase();
      const src = String(item.inventory_source || '').toLowerCase();
      const rem = String(item.remarks || '').toLowerCase();
      return num.includes(s) || src.includes(s) || rem.includes(s);
    });
  }, [items, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSelectAll = () => {
    const allFilteredIds = filtered.map(i => i.number_id);
    if (selectedIds.length === allFilteredIds.length) setSelectedIds([]);
    else setSelectedIds(allFilteredIds);
  };
  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const selectByFile = (source) => {
    const ids = items.filter(i => i.inventory_source === source).map(i => i.number_id);
    setSelectedIds(ids);
  };

  const selectByCount = () => {
    const n = parseInt(selectCount) || 0;
    if (n <= 0) return;
    setSelectedIds(filtered.slice(0, n).map(i => i.number_id));
  };

  // Unique file sources
  const fileSources = useMemo(() => {
    const sources = new Set();
    items.forEach(i => { if (i.inventory_source) sources.add(i.inventory_source); });
    return [...sources].sort();
  }, [items]);

  // Most common file of selected items (for logging)
  const selectedFileName = useMemo(() => {
    if (!selectedIds.length) return '';
    const counts = {};
    items.filter(i => selectedIds.includes(i.number_id)).forEach(i => {
      const src = i.inventory_source || 'Manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Admin Operation';
  }, [selectedIds, items]);
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const pushToLive = async () => {
    if (!selectedIds.length) return;
    await runWithLog({
      operationType: 'push_to_live',
      tableName: 'wp_fn_draft_numbers',
      fileName: selectedFileName,
      totalRecords: selectedIds.length,
      operationData: `Pushed draft IDs to live: ${selectedIds.slice(0, 20).join(',')}${selectedIds.length > 20 ? '...' : ''}`,
      action: async () => {
        setPushing(true);
        try {
          const res = await postWithAuth(`${API_BASE}/wp_fn_draft_numbers/bulk-restore`, { ids: selectedIds });
          if (res?.ok) {
            setSelectedIds([]);
            fetchDrafts();
            return true;
          }
          return false;
        } finally {
          setPushing(false);
        }
      }
    });
  };

  const bulkDelete = async () => {
    if (!selectedIds.length) return;
    await runWithLog({
      operationType: 'deleted',
      tableName: 'wp_fn_draft_numbers',
      fileName: selectedFileName,
      totalRecords: selectedIds.length,
      operationData: `Deleted draft IDs: ${selectedIds.slice(0, 20).join(',')}${selectedIds.length > 20 ? '...' : ''}`,
      action: async () => {
        const res = await postWithAuth(`${API_BASE}/wp_fn_draft_numbers/bulk-delete`, { ids: selectedIds });
        if (res?.ok) {
          setSelectedIds([]);
          fetchDrafts();
          return true;
        }
        return false;
      }
    });
  };

  const formatDate = (d) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return d; }
  };

  const renderCell = (item, col) => {
    const val = item[col.key];
    if (col.key === 'mobile_number') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.95rem' }}>{val}</span>
          <Copy size={12} style={{ cursor: 'pointer', color: '#94a3b8', flexShrink: 0 }} onClick={() => copyToClipboard(val)} />
        </div>
      );
    }
    if (col.key === 'base_price' || col.key === 'offer_price' || col.key === 'platform_commission') {
      return val ? `₹${Number(val).toLocaleString('en-IN')}` : '-';
    }
    if (col.key === 'number_status') {
      const colors = { available: '#16a34a', sold: '#dc2626', reserved: '#d97706', booked: '#d97706' };
      return <span style={{ fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', color: colors[val] || '#64748b' }}>{val || '-'}</span>;
    }
    if (col.key === 'visibility_status') {
      return val === '1' || val === 1 ? <Eye size={14} style={{ color: '#16a34a' }} /> : <span style={{ color: '#94a3b8' }}>Hidden</span>;
    }
    if (col.key === 'category') {
      const catLabels = { 1: 'VIP', 2: 'Fancy', 3: 'Semi-Fancy', 4: 'Normal' };
      const catColors = { 1: '#3b82f6', 2: '#8b5cf6', 3: '#f59e0b', 4: '#64748b' };
      return <span style={{ fontWeight: 700, fontSize: '0.78rem', color: catColors[val] || '#64748b' }}>{catLabels[val] || val || '-'}</span>;
    }
    if (col.key === 'vip_score') {
      const score = Number(val) || 0;
      const color = score >= 80 ? '#3b82f6' : score >= 50 ? '#8b5cf6' : score >= 25 ? '#f59e0b' : '#94a3b8';
      return <span style={{ fontWeight: 700, color }}>{score}</span>;
    }
    if (col.key === 'created_at' || col.key === 'updated_at' || col.key === 'offer_start_date' || col.key === 'offer_end_date') {
      return <span style={{ fontSize: '0.78rem', color: '#64748b' }}>{formatDate(val)}</span>;
    }
    if (val === null || val === undefined || val === '') return <span style={{ color: '#cbd5e1' }}>-</span>;
    return String(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <style>{`
        .draft-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .draft-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .draft-scroll::-webkit-scrollbar-thumb { background: var(--neon-green-dark, #16a34a); border-radius: 4px; }
        .draft-scroll::-webkit-scrollbar-thumb:hover { background: var(--neon-green, #22c55e); }
        .draft-scroll { scrollbar-color: var(--neon-green-dark, #16a34a) #f1f5f9; scrollbar-width: thin; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Archive size={22} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>Draft Manager</h2>
          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '2px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
            {filtered.length}
          </span>
        </div>
        <button className="btn btn-secondary" onClick={fetchDrafts} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '14px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search mobile number, source, or remarks..."
            className="input"
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
          />
        </div>
      </div>

      {/* Select-by-File / Select-by-Count Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>SELECT:</span>
        <button className="btn btn-secondary btn-sm" onClick={toggleSelectAll}>
          {selectedIds.length === filtered.length && filtered.length > 0 ? 'Deselect All' : `All (${filtered.length})`}
        </button>
        <select className="input" style={{ width: '220px', fontSize: '0.82rem' }} value="" onChange={(e) => { if (e.target.value) selectByFile(e.target.value); }}>
          <option value="">Select by File Source...</option>
          {fileSources.map(src => {
            const cnt = items.filter(i => i.inventory_source === src).length;
            return <option key={src} value={src}>{src} ({cnt})</option>;
          })}
        </select>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="number" className="input" placeholder="Count" min="1" value={selectCount} onChange={(e) => setSelectCount(e.target.value)} style={{ width: '80px', fontSize: '0.82rem' }} />
          <button className="btn btn-secondary btn-sm" onClick={selectByCount} disabled={!selectCount}>Select First {selectCount || 'N'}</button>
        </div>
        {selectedIds.length > 0 && <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>✓ {selectedIds.length} selected</span>}
      </div>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <div style={{
          position: 'sticky', top: '80px', zIndex: 100, background: 'var(--primary)', color: 'white',
          padding: '12px 24px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(122, 194, 0, 0.2)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Check size={20} />
            <span style={{ fontWeight: 700 }}>{selectedIds.length} drafts selected</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.95)', color: 'var(--primary)', border: 'none', fontWeight: 700 }}
              onClick={pushToLive}
              disabled={pushing}
            >
              {pushing ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={16} />}
              Push to Live
            </button>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }} onClick={bulkDelete}>
              <Trash2 size={16} /> Delete
            </button>
            <button className="btn" style={{ background: 'white', color: 'var(--primary)', border: 'none' }} onClick={() => setSelectedIds([])}>Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--border)', borderRadius: '12px' }}>
        <div className="draft-scroll" style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={thStyle}><input type="checkbox" checked={selectedIds.length === pageItems.length && pageItems.length > 0} onChange={toggleSelectAll} /></th>
                {ALL_COLUMNS.map(col => (
                  <th key={col.key} style={{ ...thStyle, minWidth: col.width }}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(8).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={ALL_COLUMNS.length + 1}><div className="skeleton" style={{ height: '36px', margin: '6px 10px' }} /></td></tr>
                ))
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={ALL_COLUMNS.length + 1} style={{ textAlign: 'center', padding: '80px 20px', color: '#94a3b8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <AlertCircle size={48} />
                      <p style={{ fontWeight: 600 }}>{searchTerm ? 'No drafts match your search.' : 'No draft numbers found.'}</p>
                      {searchTerm && <button className="btn btn-secondary" onClick={() => setSearchTerm('')}>Clear Search</button>}
                    </div>
                  </td>
                </tr>
              ) : (
                pageItems.map(item => (
                  <tr key={item.number_id} style={{ background: selectedIds.includes(item.number_id) ? 'var(--primary-light)' : undefined }}>
                    <td style={tdStyle}><input type="checkbox" checked={selectedIds.includes(item.number_id)} onChange={() => toggleSelect(item.number_id)} /></td>
                    {ALL_COLUMNS.map(col => (
                      <td key={col.key} style={{ ...tdStyle, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {renderCell(item, col)}
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
              {filtered.length} total · Page {page + 1} of {totalPages}
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
