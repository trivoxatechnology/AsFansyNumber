import React, { useState, useEffect } from 'react';
import { Package, Users, TrendingUp, RefreshCw, CloudUpload, ChevronDown, ChevronUp, FileCode2 } from 'lucide-react';

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

  /**
   * Parse operation_data string to extract number of actually successful records.
   * Handles patterns like:
   *   "Inserted: 54, Updated: 0, Deleted: 0, Failed: 46"  → 54
   *   "Delete Numbers: 582, Failed: 0"                    → 582
   *   "Offers Updated: 5, Failed: 0"                      → 5
   *   "Hide Numbers: 1558, Failed: 727"                   → 1558
   *   "Numbers Deleted: 100, Failed: 0"                   → 100
   */
  const parseSuccessCount = (operationData) => {
    if (!operationData) return null;
    const text = String(operationData);
    let success = 0;
    // Pattern: label: number  — sum all non-Failed/Skipped values
    const parts = text.split(',');
    let foundAny = false;
    for (const part of parts) {
      const colon = part.indexOf(':');
      if (colon === -1) continue;
      const label = part.substring(0, colon).trim().toLowerCase();
      const val   = parseInt(part.substring(colon + 1).trim(), 10);
      if (isNaN(val) || val < 0) continue;
      // Skip failed/skipped/error counts
      if (label.includes('fail') || label.includes('skip') || label.includes('error') || label.includes('operation')) continue;
      success += val;
      foundAny = true;
    }
    return foundAny ? success : null;
  };

  const loadAll = async (signal) => {
    setLoading(true);
    const opts = signal ? { signal } : {};
    try {
      const [numRes, uploadRes] = await Promise.all([
        fetchWithAuth(`${API_BASE}/wp_fn_numbers?limit=600000&fields=number_status,offer_price,visibility_status`, opts),
        fetchWithAuth(`${API_BASE}/wp_fn_upload_batches?limit=100&order=upload_time&dir=desc`, opts),
      ]);

      // Numbers stats — only update if we got a real response
      if (numRes && numRes.ok) {
        const rawNums = await numRes.json().catch(() => null);
        if (Array.isArray(rawNums)) {
          // Force client-side filter since the API might ignore the query param
          const nums = rawNums.filter(n => String(n.visibility_status) !== '0');
          setStats({
            total:     nums.length,
            available: nums.filter(n => String(n.number_status).toLowerCase() === 'available').length,
            sold:      nums.filter(n => String(n.number_status).toLowerCase() === 'sold').length,
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
                <th style={{...styles.th,textAlign:'left'}}>Done By</th>
                <th style={{...styles.th,textAlign:'center'}}>Status</th>
                <th style={styles.th}>Records</th>
                <th style={styles.th}>Time</th>
              </tr>
            </thead>
            <tbody>
              {filteredUploads.slice(0, displayLimit).map((u, i) => {
                const hasNativeFields = !!u.operation_type;
                const parts = (u.file_name || '').split('|||');
                const batchId = u.batch_id || u.id || i;

                // File name — strip legacy packed format
                const actualFileName = hasNativeFields
                  ? (u.file_name || 'Unknown File')
                  : (parts[0] || u.file_name || 'Unknown File');

                // Done By — admin_name is authoritative; fall back to packed format for legacy rows
                const doneBy = u.admin_name
                  || (hasNativeFields ? (u.uploaded_by || 'Admin') : (parts[1] || 'Admin'));

                // Operation details / notes
                const parsedNotes = hasNativeFields
                  ? (u.operation_data || '')
                  : (parts[2] || '');

                // Time — operation_time is preferred
                const displayTime = u.operation_time || u.upload_time;

                // Status badge — detect actual status from DB field + operation_type hints + operation_data hints
                let statusVal = (u.status || 'completed').toLowerCase();
                const opDataLower = String(u.operation_data || '').toLowerCase();
                const rawOpType = u.operation_type || '';
                
                // Extract parenthetical from operation_type, e.g. "Excel Import (Aborted & Deleted)" → "(Aborted & Deleted)"
                let opTypeParenthetical = '';
                const parenMatch = rawOpType.match(/\(([^)]+)\)/);
                if (parenMatch) {
                  opTypeParenthetical = parenMatch[1].trim(); // "Aborted & Deleted"
                }
                const parenLower = opTypeParenthetical.toLowerCase();

                // Infer real status: parenthetical in operation_type takes priority, then operation_data text
                if (statusVal === 'completed' || statusVal === 'draft') {
                  if (parenLower.includes('abort') && parenLower.includes('delet'))  statusVal = 'aborted & deleted';
                  else if (parenLower.includes('abort'))                              statusVal = 'aborted';
                  else if (parenLower.includes('stopped'))                            statusVal = 'stopped';
                  else if (parenLower.includes('fail'))                               statusVal = 'failed';
                  else if (opDataLower.includes('interrupted'))                       statusVal = 'interrupted';
                  else if (opDataLower.includes('abort'))                             statusVal = 'aborted';
                  else if (opDataLower.includes('stopped'))                           statusVal = 'stopped';
                }

                const statusColor =
                  statusVal.includes('abort')   ? '#ef4444' :
                  statusVal === 'failed'        ? '#ef4444' :
                  statusVal === 'stopped'       ? '#ef4444' :
                  statusVal === 'interrupted'   ? '#f59e0b' :
                  statusVal === 'running'       ? '#16a34a' :
                  statusVal === 'draft'         ? '#d97706' :
                  statusVal === 'restored'      ? '#3b82f6' :
                  statusVal === 'completed'     ? '#16a34a' :
                  '#64748b';

                // Status label — use extracted parenthetical if meaningful, otherwise capitalize status
                let statusLabel;
                if (opTypeParenthetical && (parenLower.includes('abort') || parenLower.includes('delet') || parenLower.includes('stop') || parenLower.includes('fail'))) {
                  statusLabel = opTypeParenthetical; // e.g. "Aborted & Deleted"
                } else {
                  statusLabel =
                    statusVal === 'aborted & deleted' ? 'Aborted & Deleted' :
                    statusVal === 'aborted'           ? 'Aborted' :
                    statusVal === 'stopped'           ? 'Stopped' :
                    statusVal === 'failed'            ? 'Failed' :
                    statusVal === 'interrupted'       ? 'Interrupted' :
                    statusVal === 'running'           ? 'Running' :
                    statusVal === 'draft'             ? 'Draft' :
                    statusVal === 'restored'          ? 'Restored' :
                    statusVal === 'completed'         ? 'Completed' :
                    statusVal.charAt(0).toUpperCase() + statusVal.slice(1);
                }

                // Operation type & colour — strip parenthetical from display name
                let operationType = rawOpType.replace(/\s*\([^)]*\)/, '').trim() || 'Upload';
                let opColor = '#16a34a';

                if (!hasNativeFields) {
                  const fnLower = actualFileName.toLowerCase();
                  const notesLower = (parsedNotes || '').toLowerCase();
                  if (fnLower.includes('bulk action'))                              { operationType = 'Bulk Action';   opColor = '#8b5cf6'; }
                  else if (fnLower.includes('discount'))                            { operationType = 'Discount';       opColor = '#d97706'; }
                  else if (notesLower.startsWith('numbers deleted') || fnLower.includes('delet')) { operationType = 'Delete'; opColor = '#ef4444'; }
                  else if (notesLower.includes('offers updated') || notesLower.includes('new added')) { operationType = 'Offer Update'; opColor = '#3b82f6'; }
                } else {
                  const otLower = operationType.toLowerCase();
                  if      (otLower.includes('permanent delete'))                    { operationType = 'Permanent Delete'; opColor = '#ef4444'; }
                  else if (otLower.includes('push to live') || otLower === 'live') { operationType = 'Push to Live';    opColor = '#10b981'; }
                  else if (otLower.includes('draft'))                               { operationType = 'Moved to Draft';  opColor = '#d97706'; }
                  else if (otLower.includes('bulk') || otLower.includes('manual'))  opColor = '#8b5cf6';
                  else if (otLower.includes('delete'))                              opColor = '#ef4444';
                  else if (otLower.includes('offer'))                               opColor = '#3b82f6';
                }

                return (
                <React.Fragment key={batchId}>
                  <tr style={{cursor:'pointer', background: expandedRows.includes(batchId) ? '#f8fafc' : 'transparent'}} onClick={() => toggleRow(batchId)}>
                    <td style={styles.td}>
                      {expandedRows.includes(batchId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                    <td style={{...styles.td, color:'var(--text-muted)'}}>#{batchId}</td>
                    <td style={{...styles.td, textAlign:'left', fontWeight:600, maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{actualFileName}</td>
                    <td style={{...styles.td, textAlign:'left'}}>
                      <span style={{background: opColor + '18', color: opColor, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700}}>{operationType}</span>
                    </td>
                    <td style={{...styles.td, textAlign:'left', fontWeight:600}}>{doneBy || '—'}</td>
                    <td style={{...styles.td, textAlign:'center'}}>
                      <span style={{background: statusColor + '18', color: statusColor, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700}}>{statusLabel}</span>
                    </td>
                    <td style={styles.td}>
                      {(() => {
                        const tried   = u.total_records ?? null;
                        const success = parseSuccessCount(parsedNotes);
                        if (tried === null) return '—';
                        if (success !== null && success !== tried) {
                          return (
                            <>
                              <b style={{color: success < tried ? '#ef4444' : 'inherit'}}>{success.toLocaleString()}</b>
                              <span style={{display:'block', fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:600}}>
                                of {tried.toLocaleString()} tried
                              </span>
                            </>
                          );
                        }
                        return <b>{tried.toLocaleString()}</b>;
                      })()}
                    </td>
                    <td style={{...styles.td, color:'var(--text-muted)', whiteSpace:'nowrap'}}>
                      {displayTime ? new Date(displayTime).toLocaleString('en-IN', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                      }) : '—'}
                    </td>
                  </tr>
                  {expandedRows.includes(batchId) && (
                    <tr style={{background: '#f8fafc'}}>
                      <td colSpan="8" style={{padding: '0 20px 20px 50px', borderBottom: '1px solid #e2e8f0'}}>
                        <div style={{background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', color:'var(--neon-green-dark)', fontWeight:700}}>
                            <FileCode2 size={16}/> Operation Details
                          </div>

                          {/* Tried vs Uploaded summary */}
                          {(() => {
                            const tried   = u.total_records ?? null;
                            const success = parseSuccessCount(parsedNotes);
                            const failed  = tried !== null && success !== null ? tried - success : null;
                            if (tried === null) return null;
                            return (
                              <div style={{display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'14px', padding:'10px 14px', background:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:'70px'}}>
                                  <span style={{fontSize:'1.3rem', fontWeight:900, color:'var(--text-main)'}}>{tried.toLocaleString()}</span>
                                  <span style={{fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase'}}>Tried</span>
                                </div>
                                {success !== null && (
                                  <>
                                    <div style={{width:'1px', background:'#e2e8f0', alignSelf:'stretch'}} />
                                    <div style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:'70px'}}>
                                      <span style={{fontSize:'1.3rem', fontWeight:900, color:'#16a34a'}}>{success.toLocaleString()}</span>
                                      <span style={{fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase'}}>Uploaded</span>
                                    </div>
                                    {failed > 0 && (
                                      <>
                                        <div style={{width:'1px', background:'#e2e8f0', alignSelf:'stretch'}} />
                                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:'70px'}}>
                                          <span style={{fontSize:'1.3rem', fontWeight:900, color:'#ef4444'}}>{failed.toLocaleString()}</span>
                                          <span style={{fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase'}}>Failed</span>
                                        </div>
                                      </>
                                    )}
                                  </>
                                )}
                                <div style={{width:'1px', background:'#e2e8f0', alignSelf:'stretch'}} />
                                <div style={{display:'flex', flexDirection:'column', alignItems:'center', minWidth:'80px'}}>
                                  <span style={{fontSize:'0.8rem', fontWeight:700, color:'var(--text-main)'}}>{u.table_name || 'wp_fn_numbers'}</span>
                                  <span style={{fontSize:'0.72rem', color:'var(--text-muted)', fontWeight:600, textTransform:'uppercase'}}>Table</span>
                                </div>
                              </div>
                            );
                          })()}

                          {/* operation_data breakdown */}
                          {String(parsedNotes).trim() ? (
                            <div style={{display:'flex', gap:'10px', flexWrap:'wrap'}}>
                              {String(parsedNotes).split(',').filter(Boolean).map((note, idx) => {
                                const splitPoint = note.indexOf(':');
                                if (splitPoint === -1) {
                                  return (
                                    <div key={idx} style={{background:'#f1f5f9', padding:'8px 16px', borderRadius:'20px', fontSize:'0.85rem'}}>
                                      <span style={{color:'#64748b', fontWeight:600}}>{note.trim()}</span>
                                    </div>
                                  );
                                }
                                const label = note.substring(0, splitPoint).trim();
                                const val   = note.substring(splitPoint + 1).trim();
                                if (!label || label === 'Operator') return null;
                                let color = '#64748b';
                                if (label.includes('Insert') || label.includes('New Added') || label.includes('Published')) color = '#10b981';
                                if (label.includes('Update'))  color = '#3b82f6';
                                if (label.includes('Delete'))  color = '#ef4444';
                                if (label.includes('Hidden') || label.includes('Draft')) color = '#d97706';
                                return (
                                  <div key={idx} style={{background:'#f1f5f9', padding:'8px 16px', borderRadius:'20px', fontSize:'0.85rem'}}>
                                    <span style={{color:'var(--text-muted)'}}>{label}:</span> <b style={{color, marginLeft:'4px'}}>{val}</b>
                                  </div>
                                );
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
                <tr><td colSpan="8" style={{...styles.td, textAlign:'center', color:'var(--text-muted)', padding:'24px'}}>No update history found for this filter.</td></tr>
              )}
              {hasMore && filteredUploads.length > displayLimit && (
                <tr>
                  <td colSpan="8" style={{...styles.td, textAlign:'center', padding:'16px'}}>
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
