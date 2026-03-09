import React, { useState, useEffect } from 'react';
import { Package, Users, TrendingUp, RefreshCw, UploadCloud, Edit3, Trash2, Plus, ChevronDown, ChevronUp, FileCode2 } from 'lucide-react';

const API = 'https://asfancynumber.com/fancy_number/api.php';

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

export default function Dashboard() {
  const [stats,   setStats]   = useState({ total:0, available:0, sold:0, onOffer:0 });
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState([]);

  const toggleRow = (id) => {
    setExpandedRows(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]);
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [numRes, uploadRes] = await Promise.all([
        fetch(`${API}/wp_fn_numbers?limit=600000&fields=number_status,offer_price`),
        fetch(`${API}/wp_fn_upload_batches?limit=15&order=upload_time&dir=desc`),
      ]);

      // Numbers stats
      const nums = numRes.ok ? await numRes.json() : [];
      if (Array.isArray(nums)) {
        setStats({
          total:     nums.length,
          available: nums.filter(n => n.number_status === 'available').length,
          sold:      nums.filter(n => n.number_status === 'sold').length,
          onOffer:   nums.filter(n => parseFloat(n.offer_price) > 0).length,
        });
      }

      // Upload logs
      const upl = uploadRes.ok ? await uploadRes.json() : [];
      setUploads(Array.isArray(upl) ? upl : []);

    } catch(e) { console.error('Dashboard fetch error', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, []);

  const kpis = [
    { label:'Total Inventory',  val:stats.total,     color:'#4a7c00', bg:'rgba(122,194,0,0.12)', icon:<Package size={22}/> },
    { label:'Available',        val:stats.available,  color:'#16a34a', bg:'#dcfce7',             icon:<TrendingUp size={22}/> },
    { label:'Sold',             val:stats.sold,       color:'#64748b', bg:'#f1f5f9',             icon:<Users size={22}/> },
    { label:'On Offer',         val:stats.onOffer,    color:'#d97706', bg:'#fef3c7',             icon:<TrendingUp size={22}/> },
  ];

  const opIcon = op => {
    if (op === 'INSERT' || op === 'insert') return <Plus size={13}/>;
    if (op === 'DELETE' || op === 'delete') return <Trash2 size={13}/>;
    return <Edit3 size={13}/>;
  };
  const opColor = op => op==='DELETE'||op==='delete' ? '#dc2626' : op==='INSERT'||op==='insert' ? '#16a34a' : '#1d4ed8';

  return (
    <div>
      {/* Refresh */}
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'20px'}}>
        <button onClick={loadAll} disabled={loading} style={styles.refreshBtn}>
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
          <h3 style={styles.sectionTitle}><UploadCloud size={18} style={{marginRight:8}}/> Latest Upload History</h3>
        </div>
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{...styles.th, width:'40px'}}></th>
                <th style={styles.th}>Batch ID</th>
                <th style={{...styles.th,textAlign:'left'}}>File Name</th>
                <th style={{...styles.th,textAlign:'left'}}>Operation</th>
                <th style={{...styles.th,textAlign:'left'}}>User</th>
                <th style={styles.th}>Total Records</th>
                <th style={styles.th}>Time</th>
              </tr>
            </thead>
            <tbody>
              {uploads.slice(0, 10).map((u, i) => {
                const parts = (u.file_name || '').split('|||');
                const actualFileName = parts[0] || u.file_name;
                let parsedOperator = parts[1] || '';
                const parsedNotes = parts[2] || '';

                // Fallback for previous notes injection
                if (u.notes) {
                  const match = u.notes.match(/Operator:\s*([^,]+)/);
                  if (match) parsedOperator = match[1];
                }

                // Detect operation type from filename (NOT notes, because notes contain "Deleted: 0" for imports)
                let operationType = 'Upload';
                let opColor = '#16a34a';
                const fnLower = actualFileName.toLowerCase();
                const notesLower = (parsedNotes || '').toLowerCase();
                if (fnLower.includes('bulk action')) { operationType = 'Bulk Action'; opColor = '#8b5cf6'; }
                else if (fnLower.includes('discount')) { operationType = 'Discount'; opColor = '#d97706'; }
                else if (notesLower.startsWith('numbers deleted') || fnLower.includes('delet')) { operationType = 'Delete'; opColor = '#ef4444'; }
                else if (notesLower.includes('offers updated') || notesLower.includes('new added')) { operationType = 'Offer Update'; opColor = '#3b82f6'; }
                else { operationType = 'Upload'; opColor = '#16a34a'; }

                return (
                <React.Fragment key={u.batch_id || i}>
                  <tr style={{cursor:'pointer', background: expandedRows.includes(u.batch_id) ? '#f8fafc' : 'transparent'}} onClick={() => toggleRow(u.batch_id)}>
                    <td style={styles.td}>
                      {expandedRows.includes(u.batch_id) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                    <td style={{...styles.td, color:'var(--text-muted)'}}>#{u.batch_id}</td>
                    <td style={{...styles.td, textAlign:'left', fontWeight:600}}>{actualFileName}</td>
                    <td style={{...styles.td, textAlign:'left'}}>
                      <span style={{background: opColor + '18', color: opColor, padding: '3px 10px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700}}>{operationType}</span>
                    </td>
                    <td style={{...styles.td, textAlign:'left', fontWeight: 600}}>{parsedOperator || '—'}</td>
                    <td style={styles.td}><b>{u.total_records}</b></td>
                    <td style={{...styles.td, color:'var(--text-muted)'}}>
                       {u.upload_time ? new Date(u.upload_time).toLocaleString() : (u.upload_date || '—')}
                    </td>
                  </tr>
                  {expandedRows.includes(u.batch_id) && (
                    <tr style={{background: '#f8fafc'}}>
                      <td colSpan="7" style={{padding: '0 20px 20px 50px', borderBottom: '1px solid #e2e8f0'}}>
                        <div style={{background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'12px', color:'var(--neon-green-dark)', fontWeight:700}}>
                            <FileCode2 size={16}/> Operation Details
                          </div>
                          
                          {parsedNotes || u.notes ? (
                            <div style={{display:'flex', gap:'20px', flexWrap:'wrap'}}>
                              {(parsedNotes || u.notes).split(', ').map((note, idx) => {
                                const [label, val] = note.split(':');
                                if (!label || label.trim() === 'Operator') return null;
                                let color = '#64748b';
                                if (label.includes('Insert') || label.includes('New Added')) color = '#16a34a';
                                if (label.includes('Update')) color = '#3b82f6';
                                if (label.includes('Delete')) color = '#ef4444';

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
              {uploads.length === 0 && !loading && (
                <tr><td colSpan="7" style={{...styles.td, textAlign:'center', color:'var(--text-muted)', padding:'24px'}}>No upload history found.</td></tr>
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
