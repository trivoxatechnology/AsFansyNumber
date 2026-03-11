import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, RefreshCw, Trash2, Check, PackageOpen,
  ChevronDown, ChevronUp, CloudUpload, AlertCircle, FileText
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { writeOperationLog } from '../utils/operationLog';
import { API_BASE } from '../config/api';

export default function DraftManagement() {
  const [draftNumbers, setDraftNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [selectedGroups, setSelectedGroups] = useState([]);

  useEffect(() => {
    fetchDrafts();
  }, []);

  // Fetch ALL numbers with visibility_status = 0
  const fetchDrafts = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth(
        `${API_BASE}/wp_fn_numbers?visibility_status=0&limit=600000&fields=number_id,mobile_number,number_status,inventory_source,visibility_status,base_price,category`
      );
      if (res && res.ok) {
        const data = await res.json();
        setDraftNumbers(Array.isArray(data) ? data : []);
      } else {
        setDraftNumbers([]);
      }
    } catch (err) {
      console.error('Error fetching drafts:', err);
      setDraftNumbers([]);
    } finally {
      setLoading(false);
    }
  };

  // Group numbers by inventory_source
  const groups = useMemo(() => {
    const map = {};
    draftNumbers.forEach(n => {
      const src = n.inventory_source || 'Unknown Source';
      if (!map[src]) map[src] = [];
      map[src].push(n);
    });
    return Object.entries(map)
      .map(([src, nums]) => ({ src, nums }))
      .sort((a, b) => b.nums.length - a.nums.length);
  }, [draftNumbers]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return groups;
    const q = searchTerm.toLowerCase();
    return groups
      .map(g => ({
        ...g,
        nums: g.nums.filter(n =>
          String(n.mobile_number).includes(q) || g.src.toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.nums.length > 0);
  }, [groups, searchTerm]);

  const totalDraftCount = draftNumbers.length;

  const toggleGroup = src => {
    setExpandedGroups(prev =>
      prev.includes(src) ? prev.filter(x => x !== src) : [...prev, src]
    );
  };

  const toggleSelectGroup = src => {
    setSelectedGroups(prev =>
      prev.includes(src) ? prev.filter(x => x !== src) : [...prev, src]
    );
  };

  const toggleSelectAll = () => {
    if (selectedGroups.length === filteredGroups.length && filteredGroups.length > 0) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(filteredGroups.map(g => g.src));
    }
  };

  // Push all numbers in a group to live
  const pushGroupToLive = async (group) => {
    if (!window.confirm(`Push ${group.nums.length} numbers from "${group.src}" to live store?`)) return;
    setProcessing(true);
    const admin = localStorage.getItem('adminUsername') || 'Admin';
    const ids = group.nums.map(n => n.number_id);
    let success = 0, failed = 0;
    const CHUNK = 25;

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      setProcessingStatus(`Publishing ${i + 1}–${Math.min(i + CHUNK, ids.length)} of ${ids.length}…`);
      const results = await Promise.all(
        chunk.map(id =>
          fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ visibility_status: '1', number_status: 'available' }),
          }).then(r => r && r.ok ? 1 : 0).catch(() => 0)
        )
      );
      success += results.reduce((a, b) => a + b, 0);
      failed += results.filter(r => r === 0).length;
      if (i + CHUNK < ids.length) await new Promise(r => setTimeout(r, 150));
    }

    await writeOperationLog({
      fileName: group.src,
      operationType: 'Draft Push to Live',
      operationData: `Published: ${success}, Failed: ${failed}`,
      totalRecords: ids.length,
      tableName: 'wp_fn_numbers',
      recordIds: ids.slice(0, 200),
      adminName: admin,
      uploadedBy: admin,
    });

    setProcessing(false);
    setProcessingStatus('');
    alert(`✅ ${success} numbers pushed to live. ${failed > 0 ? failed + ' failed.' : ''}`);
    fetchDrafts();
  };

  // Permanently delete all numbers in a group
  const deleteGroupPermanently = async (group) => {
    if (!window.confirm(`⚠ PERMANENTLY DELETE ${group.nums.length} numbers from "${group.src}"? This cannot be undone.`)) return;
    setProcessing(true);
    const admin = localStorage.getItem('adminUsername') || 'Admin';
    const ids = group.nums.map(n => n.number_id);
    let success = 0, failed = 0;
    const CHUNK = 25;

    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      setProcessingStatus(`Deleting ${i + 1}–${Math.min(i + CHUNK, ids.length)} of ${ids.length}…`);
      const results = await Promise.all(
        chunk.map(id =>
          fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, { method: 'DELETE' })
            .then(r => r && r.ok ? 1 : 0).catch(() => 0)
        )
      );
      success += results.reduce((a, b) => a + b, 0);
      failed += results.filter(r => r === 0).length;
      if (i + CHUNK < ids.length) await new Promise(r => setTimeout(r, 150));
    }

    await writeOperationLog({
      fileName: group.src,
      operationType: 'Draft Permanent Delete',
      operationData: `Permanently Deleted: ${success}, Failed: ${failed}`,
      totalRecords: ids.length,
      tableName: 'wp_fn_numbers',
      recordIds: ids.slice(0, 200),
      adminName: admin,
      uploadedBy: admin,
    });

    setProcessing(false);
    setProcessingStatus('');
    alert(`🗑 ${success} numbers permanently deleted. ${failed > 0 ? failed + ' failed.' : ''}`);
    fetchDrafts();
  };

  // Bulk push selected groups to live
  const bulkPushToLive = async () => {
    const toProcess = filteredGroups.filter(g => selectedGroups.includes(g.src));
    if (toProcess.length === 0) return;
    const totalNums = toProcess.reduce((a, g) => a + g.nums.length, 0);
    if (!window.confirm(`Push ${totalNums} numbers from ${toProcess.length} groups to live?`)) return;

    setProcessing(true);
    const admin = localStorage.getItem('adminUsername') || 'Admin';
    let totalSuccess = 0;

    for (const group of toProcess) {
      const ids = group.nums.map(n => n.number_id);
      const CHUNK = 25;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        setProcessingStatus(`Publishing "${group.src}" ${i + 1}–${Math.min(i + CHUNK, ids.length)}…`);
        const results = await Promise.all(
          chunk.map(id =>
            fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, {
              method: 'PUT',
              body: JSON.stringify({ visibility_status: '1', number_status: 'available' }),
            }).then(r => r && r.ok ? 1 : 0).catch(() => 0)
          )
        );
        totalSuccess += results.reduce((a, b) => a + b, 0);
        if (i + CHUNK < ids.length) await new Promise(r => setTimeout(r, 150));
      }
    }

    await writeOperationLog({
      fileName: 'Bulk Draft Push',
      operationType: 'Bulk Draft Push to Live',
      operationData: `Pushed ${totalSuccess} numbers from ${toProcess.length} groups`,
      totalRecords: totalNums,
      tableName: 'wp_fn_numbers',
      adminName: admin,
      uploadedBy: admin,
    });

    setProcessing(false);
    setProcessingStatus('');
    setSelectedGroups([]);
    alert(`✅ ${totalSuccess} of ${totalNums} numbers pushed to live.`);
    fetchDrafts();
  };

  // Bulk permanently delete selected groups
  const bulkDeletePermanently = async () => {
    const toProcess = filteredGroups.filter(g => selectedGroups.includes(g.src));
    if (toProcess.length === 0) return;
    const totalNums = toProcess.reduce((a, g) => a + g.nums.length, 0);
    if (!window.confirm(`⚠ PERMANENTLY DELETE ${totalNums} numbers from ${toProcess.length} groups? CANNOT BE UNDONE.`)) return;

    setProcessing(true);
    const admin = localStorage.getItem('adminUsername') || 'Admin';
    let totalSuccess = 0;

    for (const group of toProcess) {
      const ids = group.nums.map(n => n.number_id);
      const CHUNK = 25;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        setProcessingStatus(`Deleting "${group.src}" ${i + 1}–${Math.min(i + CHUNK, ids.length)}…`);
        const results = await Promise.all(
          chunk.map(id =>
            fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, { method: 'DELETE' })
              .then(r => r && r.ok ? 1 : 0).catch(() => 0)
          )
        );
        totalSuccess += results.reduce((a, b) => a + b, 0);
        if (i + CHUNK < ids.length) await new Promise(r => setTimeout(r, 150));
      }
    }

    setProcessing(false);
    setProcessingStatus('');
    setSelectedGroups([]);
    alert(`🗑 ${totalSuccess} of ${totalNums} numbers permanently deleted.`);
    fetchDrafts();
  };

  return (
    <div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
            📦 Draft Workspace
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
            Numbers hidden from the store — grouped by source file.
            {!loading && (
              <span style={{
                marginLeft: '14px', background: '#fef3c7', color: '#d97706',
                padding: '3px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700
              }}>
                {totalDraftCount.toLocaleString()} total draft numbers
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchDrafts} disabled={loading || processing} style={st.refreshBtn}>
          <RefreshCw size={15} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {/* Toolbar */}
      <div style={st.toolbar}>
        <div style={st.searchWrap}>
          <Search size={16} style={st.searchIcon} />
          <input
            type="text"
            placeholder="Search file name or mobile number..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={st.searchInput}
            disabled={processing}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {processingStatus && (
            <div style={st.processingPill}>
              <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
              {processingStatus}
            </div>
          )}
          {selectedGroups.length > 0 && !processing && (
            <>
              <button onClick={bulkPushToLive} style={{ ...st.actionBtn, background: 'var(--neon-green-dark)', color: '#fff' }}>
                <CloudUpload size={15} /> Push to Live ({selectedGroups.length})
              </button>
              <button onClick={bulkDeletePermanently} style={{ ...st.actionBtn, background: '#fee2e2', color: '#ef4444' }}>
                <Trash2 size={15} /> Delete ({selectedGroups.length})
              </button>
            </>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={st.card}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={{ ...st.th, width: 40 }}>
                <input
                  type="checkbox"
                  checked={selectedGroups.length > 0 && selectedGroups.length === filteredGroups.length}
                  onChange={toggleSelectAll}
                  disabled={processing || filteredGroups.length === 0}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ ...st.th, width: 36 }} />
              <th style={{ ...st.th, textAlign: 'left' }}>Source File / Group</th>
              <th style={st.th}>Numbers in Draft</th>
              <th style={st.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={22} style={{ animation: 'spin 1s linear infinite', margin: '0 auto 10px', display: 'block' }} />
                  Loading draft numbers...
                </td>
              </tr>
            ) : filteredGroups.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '70px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <PackageOpen size={44} style={{ margin: '0 auto 14px', opacity: 0.4, display: 'block' }} />
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>No draft numbers found</p>
                  <p style={{ margin: '6px 0 0', fontSize: '0.85rem' }}>
                    Move numbers to drafts from the Import Workspace, Delete Numbers page, or Inventory Manager.
                  </p>
                </td>
              </tr>
            ) : (
              filteredGroups.map(group => {
                const isExpanded = expandedGroups.includes(group.src);
                const isSelected = selectedGroups.includes(group.src);

                return (
                  <React.Fragment key={group.src}>
                    <tr
                      style={{ background: isSelected ? '#fefce8' : 'transparent', cursor: 'pointer', transition: 'background 0.2s' }}
                      onClick={e => {
                        if (e.target.type !== 'checkbox' && e.target.tagName !== 'BUTTON') toggleGroup(group.src);
                      }}
                    >
                      <td style={st.td}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectGroup(group.src)}
                          style={{ cursor: 'pointer' }}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td style={st.td}>
                        {isExpanded ? <ChevronUp size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
                      </td>
                      <td style={{ ...st.td, textAlign: 'left', fontWeight: 700, color: 'var(--text-main)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <FileText size={16} style={{ color: '#d97706', flexShrink: 0 }} />
                          {group.src}
                        </div>
                      </td>
                      <td style={st.td}>
                        <span style={{
                          background: '#fef3c7', color: '#d97706',
                          padding: '4px 14px', borderRadius: '20px', fontSize: '0.82rem', fontWeight: 800
                        }}>
                          {group.nums.length.toLocaleString()} numbers
                        </span>
                      </td>
                      <td style={st.td}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={e => { e.stopPropagation(); pushGroupToLive(group); }}
                            disabled={processing}
                            style={{
                              ...st.miniBtn,
                              background: processing ? '#f1f5f9' : '#dcfce7',
                              color: processing ? '#94a3b8' : '#16a34a',
                              gap: '5px', padding: '6px 12px', minWidth: 110, fontSize: '0.8rem', fontWeight: 700
                            }}
                            title="Push all numbers in this group to live store"
                          >
                            <CloudUpload size={13} /> Push to Live
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); deleteGroupPermanently(group); }}
                            disabled={processing}
                            style={{
                              ...st.miniBtn,
                              background: processing ? '#f1f5f9' : '#fee2e2',
                              color: processing ? '#94a3b8' : '#ef4444',
                              gap: '5px', padding: '6px 12px', minWidth: 110, fontSize: '0.8rem', fontWeight: 700
                            }}
                            title="Permanently delete all numbers in this group"
                          >
                            <Trash2 size={13} /> Delete All
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded numbers */}
                    {isExpanded && (
                      <tr style={{ background: '#fafafa' }}>
                        <td colSpan="5" style={{ padding: '0 0 0 80px', borderBottom: '1px solid var(--border-color)' }}>
                          <div style={{ padding: '16px 16px 16px 0' }}>
                            <div style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                              gap: '8px',
                              maxHeight: '300px',
                              overflowY: 'auto',
                              paddingRight: '8px'
                            }}>
                              {group.nums.map(n => (
                                <div key={n.number_id} style={{
                                  background: '#fff',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '8px',
                                  padding: '8px 12px',
                                  fontSize: '0.83rem',
                                }}>
                                  <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.9rem' }}>
                                    {n.mobile_number}
                                  </div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                                    {n.category || 'No category'} · ₹{n.base_price || '—'}
                                  </div>
                                </div>
                              ))}
                            </div>
                            {group.nums.length > 50 && (
                              <p style={{ margin: '8px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                                Showing all {group.nums.length} numbers
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const st = {
  refreshBtn: {
    display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
    background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px',
    cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)',
  },
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '16px', gap: '16px', flexWrap: 'wrap',
  },
  searchWrap: { position: 'relative', minWidth: '280px' },
  searchIcon: { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' },
  searchInput: {
    width: '100%', padding: '9px 12px 9px 36px', border: '1px solid var(--border-color)',
    borderRadius: '8px', fontSize: '0.85rem', outline: 'none', background: '#fff',
  },
  processingPill: {
    background: '#e0f2fe', color: '#0284c7', padding: '8px 14px',
    borderRadius: '8px', fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px',
  },
  actionBtn: {
    padding: '8px 14px', border: 'none', borderRadius: '8px', display: 'flex',
    alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
  },
  card: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)', overflow: 'hidden',
  },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    background: '#f8fafc', padding: '12px 14px', borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-main)', fontWeight: 800, fontSize: '0.75rem',
    textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap',
  },
  td: { padding: '12px 14px', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem', textAlign: 'center' },
  miniBtn: {
    border: 'none', borderRadius: '6px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer', transition: '0.2s',
  },
};
