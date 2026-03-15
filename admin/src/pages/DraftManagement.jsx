import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search, RefreshCw, Trash2, Edit2, Check, X, CloudUpload, FileText,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { writeOperationLog } from '../utils/operationLog';
import { fetchWithAuth } from '../utils/api';
import { usePageData } from '../utils/usePageData';
import { BannerView } from '../utils/BannerView';
import { Cache } from '../utils/cache';
import { API_BASE } from '../config/api';
import { useImport } from '../context/ImportContext';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' },
  title: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' },
  searchBar: { position: 'relative', width: '300px' },
  searchIcon: { position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' },
  searchInput: { width: '100%', padding: '10px 10px 10px 40px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)' },
  fileSelect: { padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600 },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' },
  kpiCard: { background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' },
  kpiLabel: { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' },
  kpiValue: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' },
  bulkActionBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef3c7', padding: '12px 20px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid #fcd34d' },
  bulkCount: { fontWeight: 700, color: '#b45309', fontSize: '0.9rem' },
  tableCard: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', padding: '20px', marginBottom: '20px' },
  tableWrapper: { overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' },
  td: { padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem' },
  editingRow: { background: '#f1f5f9' },
  editInput: { width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none' },
  statusGreen: { background: 'rgba(122, 194, 0, 0.1)', color: 'var(--neon-green-dark)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 },
  statusRed: { background: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 },
  editBtn: { background: 'transparent', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 },
  actionBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  saveBtn: { background: 'var(--neon-green-dark)', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' },
  cancelBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' },
  refreshBtn: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' },
};

export default function DraftManagement() {
  const toast = useToast();
  const confirm = useConfirm();
  const [draftNumbers, setDraftNumbers] = useState(() => Cache.get('fn_drafts') || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [fileFilter, setFileFilter] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [expandedSources, setExpandedSources] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [displayLimits, setDisplayLimits] = useState({});

  const loadDrafts = useCallback(async () => {
    const res = await fetchWithAuth(
      `${API_BASE}/wp_fn_draft_numbers?limit=10000&order=number_id&dir=desc`
    );
    if (!res || !res.ok) return null;
    const json = await res.json();
    // Handle both old format (array) and new v4.0 format ({data, total})
    if (Array.isArray(json)) return json;
    if (json?.data && Array.isArray(json.data)) return json.data;
    return null;
  }, []);

  const { data: draftsData, loading, showBanner, refresh: refreshDrafts }
    = usePageData(loadDrafts, 'fn_drafts', 60000);

  useEffect(() => {
    if (draftsData) setDraftNumbers(draftsData);
  }, [draftsData]);

  const availableFiles = useMemo(() =>
    [...new Set(draftNumbers.map(n => n.inventory_source).filter(Boolean))].sort(),
    [draftNumbers]
  );

  const filteredDrafts = useMemo(() => {
    return draftNumbers.filter(item => {
      const matchSearch = String(item.mobile_number || '').includes(searchTerm);
      const matchFile = fileFilter ? item.inventory_source === fileFilter : true;
      return matchSearch && matchFile;
    });
  }, [draftNumbers, searchTerm, fileFilter]);

  const groupsBySource = useMemo(() => {
    const map = {};
    filteredDrafts.forEach(n => {
      const src = n.inventory_source || 'Unknown Source';
      if (!map[src]) map[src] = [];
      map[src].push(n);
    });
    return Object.entries(map).map(([src, nums]) => ({ src, nums })).sort((a, b) => b.nums.length - a.nums.length);
  }, [filteredDrafts]);

  const toggleSource = (src) => {
    setExpandedSources(prev => prev.includes(src) ? prev.filter(x => x !== src) : [...prev, src]);
  };

  const handleEditClick = (item) => {
    setEditingId(item.number_id);
    setEditForm({ ...item });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const { number_id, ...cleanForm } = editForm;
    const res = await fetchWithAuth(`${API_BASE}/wp_fn_draft_numbers/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify(cleanForm),
    });
    if (!res || !res.ok) { toast.error('Update failed'); return; }

    const updated = draftNumbers.map(n => n.number_id === editingId ? { ...n, ...cleanForm } : n);
    setDraftNumbers(updated);
    Cache.set('fn_drafts', updated);
    
    await writeOperationLog({
      fileName: 'Draft Edit',
      operationType: 'Single Update',
      operationData: `Draft row updated: ${editingId}`,
      totalRecords: 1,
      tableName: 'wp_fn_draft_numbers',
      adminName: localStorage.getItem('adminUsername') || 'Admin'
    });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete Draft', 'Permanently delete this draft number?', 'danger');
    if (!ok) return;
    const res = await fetchWithAuth(`${API_BASE}/wp_fn_draft_numbers/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) { toast.error('Delete failed'); return; }

    const updated = draftNumbers.filter(n => n.number_id !== id);
    setDraftNumbers(updated);
    Cache.set('fn_drafts', updated);
    
    await writeOperationLog({
      fileName: 'Draft Delete',
      operationType: 'Single Delete',
      operationData: `Draft deleted: ${id}`,
      totalRecords: 1,
      tableName: 'wp_fn_draft_numbers',
      adminName: localStorage.getItem('adminUsername') || 'Admin'
    });
  };

  const handleSelectAll = (group) => (e) => {
    if (e.target.checked) {
      setSelectedIds(prev => [...new Set([...prev, ...group.nums.map(n => n.number_id)])]);
    } else {
      const ids = new Set(group.nums.map(n => n.number_id));
      setSelectedIds(prev => prev.filter(id => !ids.has(id)));
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const pushSelectedToLive = async () => {
    const ids = draftNumbers
      .filter(n => selectedIds.includes(n.number_id))
      .map(n => n.number_id);
    if (!ids.length) return;
    const ok = await confirm('Push to Live', `Push ${ids.length} numbers to live store?`, 'success');
    if (!ok) return;

    setProcessing(true);
    setProcessingStatus('Restoring to live...');

    const res = await fetchWithAuth(
      `${API_BASE}/wp_fn_draft_numbers/bulk-restore`,
      { method: 'POST', body: JSON.stringify({ ids }) }
    );
    const data  = res && res.ok ? await res.json() : null;
    const moved = data?.moved ?? 0;

    await writeOperationLog({
      fileName: 'Draft Restore',
      operationType: 'Draft Push to Live',
      operationData: `Restored ${moved} numbers to live`,
      totalRecords: moved,
      tableName: 'wp_fn_draft_numbers',
      adminName: localStorage.getItem('adminUsername') || 'Admin'
    });

    const remaining = draftNumbers.filter(n => !ids.includes(n.number_id));
    setDraftNumbers(remaining);
    Cache.set('fn_drafts', remaining);
    setSelectedIds([]);
    setProcessing(false);
    setProcessingStatus(`✅ ${moved} numbers restored`);
    setTimeout(() => setProcessingStatus(''), 3000);
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (!ids.length) return;
    const ok = await confirm('Delete Permanently', `Permanently delete ${ids.length} draft numbers? CANNOT BE UNDONE.`, 'danger');
    if (!ok) return;

    setProcessing(true);
    setProcessingStatus('Deleting permanently...');

    const res = await fetchWithAuth(
      `${API_BASE}/wp_fn_draft_numbers/bulk-delete`,
      { method: 'POST', body: JSON.stringify({ ids }) }
    );
    const data    = res && res.ok ? await res.json() : null;
    const deleted = data?.deleted ?? data?.processed ?? 0;

    await writeOperationLog({
      fileName: 'Draft Bulk Delete',
      operationType: 'Draft Bulk Delete',
      operationData: `Deleted ${deleted} drafts permanently`,
      totalRecords: deleted,
      tableName: 'wp_fn_draft_numbers',
      adminName: localStorage.getItem('adminUsername') || 'Admin'
    });

    const remaining = draftNumbers.filter(n => !ids.includes(n.number_id));
    setDraftNumbers(remaining);
    Cache.set('fn_drafts', remaining);
    setSelectedIds([]);
    setProcessing(false);
    setProcessingStatus(`✅ ${deleted} drafts deleted`);
    setTimeout(() => setProcessingStatus(''), 3000);
  };

  return (
    <div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      <div style={styles.header}>
        <div style={{display:'flex', flexDirection:'column'}}>
          <h2 style={styles.title}>📦 Draft Management</h2>
          <BannerView show={showBanner} onRetry={refreshDrafts} />
        </div>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {availableFiles.length > 0 && (
            <select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} style={styles.fileSelect}>
              <option value="">All Source Files</option>
              {availableFiles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <div style={styles.searchBar}>
            <Search size={20} style={styles.searchIcon} />
            <input type="text" placeholder="Search mobile number..." style={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
          <button onClick={refreshDrafts} disabled={loading || processing} style={styles.refreshBtn}>
            <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
          </button>
        </div>
      </div>

      <div style={styles.dashboardGrid}>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Total Drafts</p>
          <h3 style={styles.kpiValue}>{filteredDrafts.length}</h3>
        </div>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Source Files</p>
          <h3 style={{ ...styles.kpiValue, color: '#d97706' }}>{groupsBySource.length}</h3>
        </div>
        <div style={styles.kpiCard}>
          <p style={styles.kpiLabel}>Selected</p>
          <h3 style={{ ...styles.kpiValue, color: '#3b82f6' }}>{selectedIds.length}</h3>
        </div>
      </div>

      {processingStatus && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: processingStatus.startsWith('✅') ? '#dcfce7' : '#e0f2fe', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontWeight: 700, color: processingStatus.startsWith('✅') ? '#16a34a' : '#0369a1' }}>
          {!processingStatus.startsWith('✅') && <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />} {processingStatus}
        </div>
      )}

      {selectedIds.length > 0 && (
        <div style={styles.bulkActionBar}>
          <span style={styles.bulkCount}>{selectedIds.length} numbers selected</span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={pushSelectedToLive} disabled={processing} style={{ ...styles.editBtn, background: 'var(--neon-green-dark)', color: '#fff', border: 'none' }}>
              <CloudUpload size={16} /> Push to Live
            </button>
            <button onClick={deleteSelected} disabled={processing} style={{ ...styles.editBtn, background: '#ef4444', color: '#fff', border: 'none' }}>
              <Trash2 size={16} /> Delete Selected
            </button>
          </div>
        </div>
      )}

      {loading && draftNumbers.length === 0 ? (
        <div style={{ ...styles.tableCard, textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--neon-green-dark)', margin: '0 auto 12px', display: 'block' }} />
          <p>Loading draft numbers...</p>
        </div>
      ) : groupsBySource.length === 0 ? (
        <div style={{ ...styles.tableCard, textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <FileText size={48} style={{ opacity: 0.4, marginBottom: '16px', display: 'block' }} />
          <p style={{ fontWeight: 700 }}>No draft numbers found</p>
          <p style={{ marginTop: '8px', fontSize: '0.9rem' }}>Move numbers to drafts from Import Workspace, Delete Numbers, or Inventory Manager.</p>
        </div>
      ) : (
        groupsBySource.map(group => {
          const isExpanded = expandedSources.includes(group.src);
          const groupLimit = displayLimits[group.src] || 500;
          const groupDisplay = group.nums.slice(0, groupLimit);
          const allInGroupSelected = groupDisplay.length > 0 && groupDisplay.every(n => selectedIds.includes(n.number_id));

          return (
            <div key={group.src} style={styles.tableCard}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', marginBottom: '16px', cursor: 'pointer' }}
                onClick={() => toggleSource(group.src)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  <FileText size={18} style={{ color: '#d97706' }} />
                  <span style={{ fontWeight: 800, fontSize: '1rem' }}>{group.src}</span>
                  <span style={{ background: '#fef3c7', color: '#b45309', padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700 }}>
                    {group.nums.length} numbers
                  </span>
                </div>
              </div>

              {isExpanded && (
                <>
                  <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={{ ...styles.th, width: '40px', textAlign: 'center' }}>
                            <input type="checkbox" checked={allInGroupSelected} onChange={handleSelectAll(group)} disabled={processing} />
                          </th>
                          <th style={styles.th}>Mobile Number</th>
                          <th style={styles.th}>Source File</th>
                          <th style={styles.th}>Base Price (₹)</th>
                          <th style={styles.th}>Offer Price (₹)</th>
                          <th style={styles.th}>Category ID</th>
                          <th style={styles.th}>Incharge</th>
                          <th style={styles.th}>WhatsApp Group</th>
                          <th style={styles.th}>Status</th>
                          <th style={styles.th}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupDisplay.map(item => {
                          const isEditing = editingId === item.number_id;
                          const isSelected = selectedIds.includes(item.number_id);
                          return (
                            <tr key={item.number_id} style={isEditing || isSelected ? styles.editingRow : {}}>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(item.number_id)} disabled={processing} />
                              </td>
                              <td style={styles.td}>
                                {isEditing ? (
                                  <input name="mobile_number" value={editForm.mobile_number} onChange={handleChange} style={styles.editInput} />
                                ) : (
                                  <b>{item.mobile_number}</b>
                                )}
                              </td>
                              <td style={{ ...styles.td, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.inventory_source || '—'}</td>
                              <td style={styles.td}>
                                {isEditing ? <input type="number" name="base_price" value={editForm.base_price} onChange={handleChange} style={styles.editInput} /> : (item.base_price ?? '—')}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? <input type="number" name="offer_price" value={editForm.offer_price || ''} onChange={handleChange} style={styles.editInput} /> : (item.offer_price || '-')}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? <input type="text" name="number_category" value={editForm.number_category} onChange={handleChange} style={{ ...styles.editInput, width: '80px' }} /> : (item.number_category || '-')}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? <input name="primary_incharge_name" value={editForm.primary_incharge_name} onChange={handleChange} style={styles.editInput} /> : (item.primary_incharge_name || '-')}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? <input name="whatsapp_group_name" value={editForm.whatsapp_group_name} onChange={handleChange} style={styles.editInput} /> : (item.whatsapp_group_name || '-')}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? (
                                  <select name="number_status" value={editForm.number_status} onChange={handleChange} style={styles.editInput}>
                                    <option value="available">Available</option>
                                    <option value="booked">Booked</option>
                                    <option value="sold">Sold</option>
                                  </select>
                                ) : (
                                  <span style={(item.number_status || '') === 'available' ? styles.statusGreen : styles.statusRed}>{(item.number_status || 'unknown').toUpperCase()}</span>
                                )}
                              </td>
                              <td style={styles.td}>
                                {isEditing ? (
                                  <div style={styles.actionBtns}>
                                    <button onClick={handleSave} style={styles.saveBtn} title="Save"><Check size={16} /></button>
                                    <button onClick={handleCancel} style={styles.cancelBtn} title="Cancel"><X size={16} /></button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <button onClick={() => handleEditClick(item)} style={styles.editBtn}><Edit2 size={16} /> Edit</button>
                                    <button onClick={() => handleDelete(item.number_id)} style={{ ...styles.editBtn, borderColor: '#ef4444', color: '#ef4444' }}>Delete</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {group.nums.length > groupLimit && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Showing {groupLimit} of {group.nums.length}</span>
                      <button onClick={() => setDisplayLimits(p => ({...p, [group.src]: (p[group.src] || 500) + 500}))} style={{ padding: '8px 16px', background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>Load Next 500</button>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
