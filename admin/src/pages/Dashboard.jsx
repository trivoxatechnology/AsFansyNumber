import React, { useState, useEffect } from 'react';
import { Package, Users, TrendingUp, RefreshCw, CloudUpload, ChevronDown, ChevronUp, FileCode2 } from 'lucide-react';
import { parseRecordIds } from '../utils/operationLog';
import { API_BASE } from '../config/api';
import { fetchWithAuth } from '../utils/api';

export default function Dashboard() {
  const [stats,   setStats]   = useState({ total:0, available:0, sold:0, onOffer:0 });
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [operationFilter, setOperationFilter] = useState('all');

  // Filter uploads based on operation type
  const filteredUploads = operationFilter === 'all' 
    ? uploads 
    : uploads.filter(u => {
        const opType = u.operation_type || 'Legacy';
        return opType.toLowerCase().includes(operationFilter.toLowerCase());
      });

  const toggleRow = (id) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const loadAll = async (signal) => {
    setLoading(true);
    const opts = signal ? { signal } : {};
    try {
      const [numRes, uploadRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/wp_fn_numbers?limit=600000&fields=number_status,offer_price`, opts),
        fetchWithAuth(`${API_BASE}/wp_fn_upload_batches?limit=100&order=upload_time&dir=desc`, opts),
      ]);

      // Numbers stats — only update if we got a real response
      if (numRes && numRes.ok) {
        const nums = await numRes.json().catch(() => null);
        if (Array.isArray(nums)) {
          setStats({
            total:     nums.length,
            available: nums.filter(n => n.number_status === 'available').length,
            sold:      nums.filter(n => n.number_status === 'sold').length,
            onOffer:   nums.filter(n => parseFloat(n.offer_price) > 0).length,
          });
        }
      }

      // Upload logs — only overwrite if we actually got data, never wipe on empty/error
      if (uploadRes && uploadRes.ok) {
        const upl = await uploadRes.json().catch(() => null);
        if (Array.isArray(upl) && upl.length > 0) {
          upl.sort((a, b) => (b.id || b.batch_id || 0) - (a.id || a.batch_id || 0));
          setUploads(upl);
          setHasMore(upl.length >= 100);
        }
        // If empty array returned, don't wipe existing uploads — just keep old data
      }
      
    } catch(e) {
      if (e?.name !== 'AbortError') {
        console.error('Dashboard fetch error', e);
        // Don't reset state on error — keep showing whatever was there before
      }
    } finally { 
      setLoading(false); 
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    loadAll(ctrl.signal);
    
    // Auto-refresh every 30 seconds for real-time updates
    const interval = setInterval(() => {
      loadAll();
    }, 30000);
    
    return () => {
      ctrl.abort();
      clearInterval(interval);
    };
  }, []);

  const kpis = [
    { label:'Total Inventory',  val:stats.total,     color:'#4a7c00', bg:'rgba(122,194,0,0.12)', icon:<Package size={22}/> },
    { label:'Available',        val:stats.available,  color:'#16a34a', bg:'#dcfce7',             icon:<TrendingUp size={22}/> },
    { label:'Sold',             val:stats.sold,       color:'#64748b', bg:'#f1f5f9',             icon:<Users size={22}/> },
    { label:'On Offer',         val:stats.onOffer,    color:'#d97706', bg:'#fef3c7',             icon:<TrendingUp size={22}/> },
  ];

  return (
    <div>
      {/* Refresh */}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'20px'}}>
        <button onClick={() => loadAll()} disabled={loading} style={styles.refreshBtn}>
          <RefreshCw size={15} style={{animation:loading?'spin 1s linear infinite':'none'}}/> Refresh
        </button>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* KPI Cards */}
      <div style={styles.kpiGrid}>
        {kpis.map(k => (
          <div key={k.label} style={styles.kpiCard}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div>
                <p style={styles.kpiLabel}>{k.label}</p>
                <h3 style={{...styles.kpiVal, color:k.color}}>
                  {loading ? '—' : k.val.toLocaleString()}
                </h3>
              </div>
              <div style={{...styles.kpiIcon, background:k.bg, color:k.color}}>{k.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Upload Logs (Full Width) ── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}><CloudUpload size={18} style={{marginRight:8}}/> Latest Update History (Last 50 Operations)</h3>
          <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
            <select 
              value={operationFilter} 
              onChange={(e) => setOperationFilter(e.target.value)}
              style={{
                padding:'6px 12px',
                border:'1px solid var(--border-color)',
                borderRadius:'6px',
                fontSize:'0.85rem',
                fontWeight:600
              }}
            >
              <option value="all">All Operations</option>
              <option value="legacy">Legacy</option>
              <option value="single">Single Updates</option>
              <option value="bulk">Bulk Actions</option>
              <option value="excel">Excel Operations</option>
            </select>
            <div style={{fontSize:'0.85rem', color:'var(--text-muted)', fontWeight:600}}>
              Showing {filteredUploads.length} of {uploads.length} operations
            </div>
          </div>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{...styles.th, width:'40px'}}></th>
                <th style={styles.th}>Batch ID</th>
                <th style={{...styles.th,textAlign:'left'}}>File Name</th>
                <th style={{...styles.th,textAlign:'left'}}>Operation</th>
                <th style={{...styles.th,textAlign:'left'}}>Table</th>
                <th style={{...styles.th,textAlign:'left'}}>Record IDs</th>
                <th style={{...styles.th,textAlign:'left'}}>User</th>
                <th style={styles.th}>Total Records</th>
                <th style={styles.th}>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.slice(0, displayLimit).map((u, i) => {
                const hasNativeFields = !!u.operation_type;
                const parts = (u.file_name || '').split('|||');
                const batchId = u.batch_id || u.id || i;
                const actualFileName = hasNativeFields ? (u.file_name || 'Unknown File') : (parts[0] || u.file_name);
                let parsedOperator = hasNativeFields ? (u.admin_name || u.uploaded_by || 'Admin') : (parts[1] || '');
                const parsedNotes = hasNativeFields ? (u.operation_data || '') : (parts[2] || '');
                const tableName = u.table_name || u.source_table || 'wp_fn_numbers';
                const singleRecordId = u.record_id || u.source_id || null;
                const recordIds = parseRecordIds(u.record_ids || u.source_ids);
                const displayTime = u.operation_time || u.upload_time || u.upload_date;
                const recordIdText = singleRecordId
                  ? `#${singleRecordId}`
                  : (recordIds.length ? `#${recordIds[0]}${recordIds.length > 1 ? ` +${recordIds.length - 1}` : ''}` : '—');

                if (u.notes && !hasNativeFields) {
                  const match = u.notes.match(/Operator:\s*([^,]+)/);
                  if (match) parsedOperator = match[1];
                }

                let operationType = u.operation_type || 'Upload';
                let opColor = '#16a34a';
                
                if (!hasNativeFields) {
                  const fnLower = actualFileName.toLowerCase();
                  const notesLower = (parsedNotes || '').toLowerCase();
                  if (fnLower.includes('bulk action')) { operationType = 'Bulk Action'; opColor = '#8b5cf6'; }
                  else if (fnLower.includes('discount')) { operationType = 'Discount'; opColor = '#d97706'; }
                  else if (notesLower.startsWith('numbers deleted') || fnLower.includes('delet')) { operationType = 'Delete'; opColor = '#ef4444'; }
                  else if (notesLower.includes('offers updated') || notesLower.includes('new added')) { operationType = 'Offer Update'; opColor = '#3b82f6'; }
                } else {
                  const otLower = operationType.toLowerCase();
                  if (otLower.includes('permanent delete')) { operationType = 'Permanent Delete'; opColor = '#ef4444'; }
                  else if (otLower.includes('push to live') || otLower === 'live') { operationType = 'Push to Live'; opColor = '#10b981'; } // Emerald
                  else if (otLower.includes('draft')) { operationType = 'Moved to Draft'; opColor = '#d97706'; } // Amber/Orange
                  else if (otLower.includes('bulk') || otLower.includes('manual')) opColor = '#8b5cf6';
                  else if (otLower.includes('delete')) opColor = '#ef4444';
                  else if (otLower.includes('offer')) opColor = '#3b82f6';
                }

                return (
                <React.Fragment key={batchId}>
                  <tr style={{cursor:'pointer', background: expandedRows.includes(batchId) ? '#f8fafc' : 'transparent'}} onClick={() => toggleRow(batchId)}>
                    <td style={styles.td}>
                      {expandedRows.includes(batchId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                    <td style={{...styles.td, color:'var(--text-muted)'}}>#{batchId}</td>
                    <td style={{...styles.td, textAlign:'left', fontWeight:600}}>{actualFileName}</td>
                    <td style={{...styles.td, textAlign:'left'}}>
                      <span style={{background: opColor + '18', color: opColor, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700}}>{operationType}</span>
                    </td>
                    <td style={{...styles.td, textAlign:'left'}}><code>{tableName}</code></td>
                    <td style={{...styles.td, textAlign:'left'}}>{recordIdText}</td>
                    <td style={{...styles.td, textAlign:'left', fontWeight: 600}}>{parsedOperator || '—'}</td>
                    <td style={styles.td}><b>{u.total_records}</b></td>
                    <td style={{...styles.td, color:'var(--text-muted)'}}>
                       {displayTime ? new Date(displayTime).toLocaleString() : '—'}
                    </td>
                  </tr>
                  {expandedRows.includes(batchId) && (
                    <tr style={{background: '#f8fafc'}}>
                      <td colSpan="9" style={{padding: '0 20px 20px 50px', borderBottom: '1px solid #e2e8f0'}}>
                        <div style={{background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', color:'var(--neon-green-dark)', fontWeight:700}}>
                            <FileCode2 size={16}/> Operation Details
                          </div>

                          <div style={{display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'12px'}}>
                            <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'20px', padding:'6px 12px', fontSize:'0.82rem'}}>
                              <span style={{color:'var(--text-muted)'}}>Table:</span> <b>{tableName}</b>
                            </div>
                            <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'20px', padding:'6px 12px', fontSize:'0.82rem'}}>
                              <span style={{color:'var(--text-muted)'}}>Record(s):</span> <b>{recordIdText}</b>
                            </div>
                            {recordIds.length > 1 && (
                              <div style={{background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'20px', padding:'6px 12px', fontSize:'0.82rem'}}>
                                <span style={{color:'var(--text-muted)'}}>IDs:</span> <b>{recordIds.slice(0, 6).join(', ')}{recordIds.length > 6 ? '...' : ''}</b>
                              </div>
                            )}
                          </div>

                          {String(parsedNotes || u.notes || '').trim() ? (
                            <div style={{display:'flex', gap:'20px', flexWrap:'wrap'}}>
                              {String(parsedNotes || u.notes || '').split(',').filter(Boolean).map((note, idx) => {
                                const splitPoint = note.indexOf(':');
                                if (splitPoint === -1) {
                                  // Plain text note without colon
                                  return (
                                    <div key={idx} style={{background: '#f1f5f9', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem'}}>
                                      <span style={{color: '#64748b', fontWeight: 600}}>{note.trim()}</span>
                                    </div>
                                  );
                                }
                                
                                const label = note.substring(0, splitPoint).trim();
                                const val = note.substring(splitPoint + 1).trim();
                                if (!label || label === 'Operator') return null;
                                let color = '#64748b';
                                if (label.includes('Insert') || label.includes('New Added') || label.includes('Published')) color = '#10b981'; // Emerald
                                if (label.includes('Update')) color = '#3b82f6';
                                if (label.includes('Delete')) color = '#ef4444';
                                if (label.includes('Hidden') || label.includes('Draft')) color = '#d97706';

                                return (
                                  <div key={idx} style={{background: '#f1f5f9', padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem'}}>
                                    <span style={{color: 'var(--text-muted)'}}>{label}:</span> <b style={{color, marginLeft:'4px'}}>{val}</b>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontStyle:'italic'}}>No detailed operation logs recorded for this batch.</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
                );
              })}
              {filteredUploads.length === 0 && !loading && (
                <tr><td colSpan="9" style={{...styles.td, textAlign:'center', color:'var(--text-muted)', padding:'24px'}}>No update history found for this filter.</td></tr>
              )}
              {hasMore && filteredUploads.length > displayLimit && (
                <tr>
                  <td colSpan="9" style={{...styles.td, textAlign:'center', padding:'16px'}}>
                    <button 
                      onClick={() => setDisplayLimit(prev => Math.min(prev + 10, filteredUploads.length))}
                      disabled={loading}
                      style={{
                        padding:'8px 20px',
                        background:'var(--neon-green-dark)',
                        color:'#fff',
                        border:'none',
                        borderRadius:'8px',
                        fontWeight:600,
                        cursor:'pointer',
                        fontSize:'0.85rem'
                      }}
                    >
                      Load More ({filteredUploads.length - displayLimit} remaining)
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles = {
  refreshBtn:{display:'flex',alignItems:'center',gap:'6px',padding:'7px 14px',background:'#f1f5f9',border:'1px solid var(--border-color)',borderRadius:'8px',cursor:'pointer',fontWeight:600,fontSize:'0.84rem',color:'var(--text-muted)'},
  kpiGrid:{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'18px',marginBottom:'28px'},
  kpiCard:{background:'var(--bg-card)',padding:'22px 24px',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-color)',boxShadow:'var(--shadow-sm)'},
  kpiLabel:{color:'var(--text-muted)',fontSize:'0.85rem',fontWeight:600,marginBottom:'6px'},
  kpiVal:{fontSize:'2rem',fontWeight:900,margin:'0'},
  kpiIcon:{width:'44px',height:'44px',borderRadius:'10px',display:'flex',alignItems:'center',justifyContent:'center'},
  section:{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-color)',boxShadow:'var(--shadow-sm)',overflow:'hidden'},
  sectionHeader:{padding:'18px 24px',borderBottom:'1px solid var(--border-color)'},
  sectionTitle:{fontSize:'1rem',fontWeight:800,color:'var(--text-main)',margin:0,display:'flex',alignItems:'center'},
  tableWrap:{overflowX:'auto'},
  table:{width:'100%',borderCollapse:'collapse'},
  th:{background:'#f8fafc',padding:'10px 14px',borderBottom:'1px solid var(--border-color)',color:'var(--text-muted)',fontWeight:700,fontSize:'0.75rem',textTransform:'uppercase',whiteSpace:'nowrap',textAlign:'center'},
  td:{padding:'10px 14px',borderBottom:'1px solid #f1f5f9',fontSize:'0.88rem',textAlign:'center'},
};
