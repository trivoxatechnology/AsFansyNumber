import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Download, RefreshCw, Check, CircleAlert, CircleCheck, Trash2, X, FileText } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { writeOperationLog } from '../utils/operationLog';
import { API_BASE } from '../config/api';

function validateDeleteRow(row, idx) {
  const errors = [];
  const mobile = String(row.mobile_number || '').replace(/\D/g, '');
  if (!mobile || mobile.length !== 10) errors.push('Invalid mobile number');
  return {
    _rowId: idx + 2,
    _errors: errors,
    _status: errors.length ? 'error' : 'valid',
    mobile_number: mobile || String(row.mobile_number || ''),
  };
}

export default function DeleteExcel() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [step, setStep] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [operatorName, setOperatorName] = useState(localStorage.getItem('adminUsername') || '');
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(500);
  const fileRef = useRef('');
  const [filter, setFilter] = useState('all');
  const [parseProgress, setParseProgress] = useState('');
  const [deleteProgressState, setDeleteProgressState] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteDestination, setDeleteDestination] = useState('permanent'); // 'permanent' | 'draft'
  // no import context needed — delete runs synchronously in this component

  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    fileRef.current = file.name;
    setIsParsing(true);
    setParseProgress('Reading file...');
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      setParseProgress('Extracting spreadsheet data...');
      await new Promise(r => setTimeout(r, 50));
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Normalize headers
      const json = rawJson.map(row => {
        const norm = {};
        for (let key in row) {
          let safeKey = key.trim().toLowerCase().replace(/[\s-.]+/g, '_');
          if (['mobile_no', 'phone', 'contact', 'number'].includes(safeKey)) safeKey = 'mobile_number';
          norm[safeKey] = row[key];
        }
        return norm;
      });

      const validRows = json.filter(r => r.mobile_number);
      setParseProgress(`Validating ${validRows.length.toLocaleString()} rows...`);
      await new Promise(r => setTimeout(r, 50));

      // Check which numbers exist in DB
      setParseProgress('Fetching existing numbers from database...');
      let existingMap = {};
      try {
        const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers?limit=600000&fields=number_id,mobile_number`);
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d)) d.forEach(r => { 
            const stripped = String(r.mobile_number).replace(/\D/g, '');
            existingMap[stripped] = r.number_id; 
          });
        }
      } catch (e) {
        console.error('API error on fetch:', e);
      }

      setParseProgress('Matching numbers...');
      await new Promise(r => setTimeout(r, 50));
      const parsed = [];
      for (let i = 0; i < validRows.length; i++) {
        const v = validateDeleteRow(validRows[i], i);
        const m = String(v.mobile_number);
        if (v._status === 'valid') {
          if (existingMap[m]) {
            v._dbId = existingMap[m];
            v._found = true;
          } else {
            v._found = false;
            v._status = 'not_found';
            v._errors.push('Number not found in database');
          }
        }
        parsed.push(v);
      }

      setParseProgress('Finalising...');
      await new Promise(r => setTimeout(r, 50));
      setRows(parsed);
      setStep(2);
    } catch (e) {
      alert('Parse error: ' + e.message);
    } finally {
      setIsParsing(false);
      setParseProgress('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    }
  });

  const stats = {
    total: rows.length,
    found: rows.filter(r => r._found).length,
    notFound: rows.filter(r => r._status === 'not_found').length,
    error: rows.filter(r => r._status === 'error').length,
  };

  let display = rows;
  if (filter === 'found') display = rows.filter(r => r._found);
  else if (filter === 'not_found') display = rows.filter(r => r._status === 'not_found');
  else if (filter === 'error') display = rows.filter(r => r._status === 'error');

  const downloadTemplate = () => {
    const cols = { mobile_number: '' };
    const ws = XLSX.utils.json_to_sheet([cols]);
    ws['!cols'] = [{ wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delete Template');
    XLSX.writeFile(wb, 'Delete_Numbers_Template.xlsx');
  };

  const handleDelete = async () => {
    // Capture state locally before any async ops (avoids stale closure bug)
    const destination = deleteDestination;
    const operatorSnapshot = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
    const fileSnapshot = fileRef.current;
    const toDelete = rows.filter(r => r._found && r._dbId);

    setShowConfirmModal(false);
    setIsDeleting(true);
    let deleted = 0, failed = 0;
    const deletedIds = [];
    const CONCURRENCY = 25;
    const MAX_RETRIES = 2;

    // Reset UI immediately so user can navigate or upload another
    setStep(1);
    setRows([]);
    setDone(false);

    const allResults = [];
    for (let i = 0; i < toDelete.length; i += CONCURRENCY) {
      const chunk = toDelete.slice(i, i + CONCURRENCY);
      const progressMsg = `${destination === 'draft' ? 'Moving' : 'Deleting'} ${i + 1}–${Math.min(i + CONCURRENCY, toDelete.length)} of ${toDelete.length}…`;
      setDeleteProgressState(progressMsg);

      const promises = chunk.map(async (row) => {
        let retries = 0;
        while (retries <= MAX_RETRIES) {
          try {
            if (destination === 'permanent') {
              const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/${row._dbId}`, { method: 'DELETE' });
              if (res && res.ok) return { ok: true, id: row._dbId };
            } else {
              // Move to drafts: hide from store but keep in DB
              const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/${row._dbId}`, {
                method: 'PUT',
                body: JSON.stringify({ visibility_status: '0', number_status: 'deleted' })
              });
              if (res && res.ok) return { ok: true, id: row._dbId };
            }
            retries++;
          } catch (err) {
            retries++;
            if (retries > MAX_RETRIES) return { ok: false, id: row._dbId };
          }
          if (retries <= MAX_RETRIES) await new Promise(r => setTimeout(r, 500 * retries));
        }
        return { ok: false, id: row._dbId };
      });

      const chunkResults = await Promise.all(promises);
      allResults.push(...chunkResults);
    }
    
    // Count results
    allResults.forEach((result) => {
      if (result.ok) {
        deleted++;
        deletedIds.push(result.id);
      } else {
        failed++;
      }
    });
    
    console.log(`Excel delete completed: ${deleted} success, ${failed} failed`);

    // Save log
    setDeleteProgressState('Saving log…');
    await writeOperationLog({
      fileName: fileSnapshot || 'Excel Deletion',
      operationType: destination === 'draft' ? 'Excel Delete (Draft)' : 'Excel Delete',
      operationData: destination === 'draft'
        ? `Numbers moved to drafts: ${deleted}, Failed: ${failed}`
        : `Numbers permanently deleted: ${deleted}, Failed: ${failed}`,
      totalRecords: toDelete.length,
      tableName: 'wp_fn_numbers',
      recordIds: deletedIds,
      adminName: operatorSnapshot,
      uploadedBy: operatorSnapshot,
    });

    setSummary({
      deleted,
      failed,
      total: toDelete.length,
      file: fileSnapshot,
      destination,
      time: new Date().toLocaleString(),
    });

    setDeleteProgressState('');
    setIsDeleting(false);
    setDone(true);
  };

  return (
    <div style={{animation:'fadeIn 0.3s ease-out'}}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* Step bar */}
      <div style={s.stepBar}>
        {['Upload Delete Sheet', 'Preview Numbers', 'Confirm & Delete'].map((l, i) => (
          <div key={i} style={{ ...s.step, ...(step === i + 1 ? s.stepActive : {}), ...(step > i + 1 ? { opacity: 0.6 } : {}) }}>
            <div style={s.stepCircle}>{step > i + 1 ? <Check size={12} /> : i + 1}</div>
            <span style={s.stepLabel}>{l}</span>
            {i < 2 && <div style={{ ...s.stepLine, ...(step > i + 1 ? { background: '#ef4444' } : {}) }} />}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Upload ─── */}
      {step === 1 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h2 style={s.cardTitle}><Trash2 size={22} style={{ color: '#ef4444', marginRight: '8px' }} />Bulk Delete Numbers via Excel</h2>
              <p style={s.cardSubtitle}>Upload an Excel sheet with mobile numbers to delete them from the inventory.</p>
            </div>
            <button onClick={downloadTemplate} style={s.outlineBtn}><Download size={16} /> Download Template</button>
          </div>

          <div style={s.infoBanner}>
            <CircleAlert size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
            <div style={{ fontSize: '0.85rem' }}>
              <b>How it works:</b> Upload a file with a <code style={s.code}>mobile_number</code> column.
              The system will match each number against the database and permanently delete all found entries.
            </div>
          </div>

          <div {...getRootProps()} style={{ ...s.dropzone, ...(isDragActive ? s.dropActive : {}), borderColor: '#fca5a5' }}>
            <input {...getInputProps()} />
            <Trash2 size={48} style={{ color: isDragActive ? '#ef4444' : '#94a3b8', marginBottom: '14px' }} />
            <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '6px' }}>
              {isDragActive ? 'Drop here to upload' : 'Drag & Drop or Click to Upload'}
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Supported formats: .xlsx, .xls, .csv</p>
          </div>
          {isParsing && (
            <div style={s.parsingBox}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: '#ef4444' }} />
              <div>
                <p style={{ fontWeight: 800, marginBottom: '4px', fontSize: '1.05rem', color: 'var(--text-main)' }}>Processing File</p>
                <p style={{ fontSize: '0.9rem', color: '#ef4444', fontWeight: 600 }}>{parseProgress}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── STEP 2: Preview ─── */}
      {step === 2 && !done && (
        <div>
          <div style={s.statsRow}>
            {[
              { key: 'all', label: 'Total', count: stats.total, color: '#64748b' },
              { key: 'found', label: '🗑 To Delete', count: stats.found, color: '#ef4444' },
              { key: 'not_found', label: '⚠ Not Found', count: stats.notFound, color: '#f59e0b' },
              { key: 'error', label: '❌ Errors', count: stats.error, color: '#94a3b8' },
            ].map(f => (
              <div 
                key={f.key} 
                onClick={() => setFilter(f.key)}
                style={{
                  ...s.statPill, 
                  cursor: 'pointer',
                  borderColor: filter === f.key ? f.color : 'var(--border-color)',
                  background: filter === f.key ? f.color + '10' : 'var(--bg-card)',
                  transition: 'all 0.2s'
                }}
              >
                <span style={{ color: filter === f.key ? f.color : '#64748b', fontWeight: filter === f.key ? 700 : 500 }}>{f.label}</span>
                <b style={{ color: filter === f.key ? f.color : 'inherit' }}>{f.count}</b>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={() => { setStep(1); setRows([]); setDisplayLimit(500); setFilter('all'); }} style={{ ...s.outlineBtn, color: '#64748b' }}>Cancel</button>
              <button onClick={() => setStep(3)} style={{ ...s.primaryBtn, background: '#ef4444' }} disabled={stats.found === 0}>
                Next Step →
              </button>
            </div>
          </div>

          {display.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              No {filter === 'error' ? 'error ' : filter === 'not_found' ? 'not found ' : filter === 'found' ? 'deleted ' : ''}numbers found.
            </div>
          ) : (
            <>
              <div style={s.gridWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Row', 'Status', 'Mobile Number', 'DB Match'].map(h =>
                        <th key={h} style={s.th}>{h}</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {display.slice(0, displayLimit).map((row, i) => (
                      <tr key={i} style={{ background: row._found ? '#fef2f2' : row._status === 'not_found' ? '#fffbeb' : 'transparent' }}>
                        <td style={s.td}><small style={{ color: 'var(--text-muted)' }}>{row._rowId}</small></td>
                        <td style={s.td}>
                          <span style={{
                            ...s.badge,
                            background: row._found ? '#fee2e2' : row._status === 'not_found' ? '#fef3c7' : '#f1f5f9',
                            color: row._found ? '#dc2626' : row._status === 'not_found' ? '#d97706' : '#94a3b8'
                          }}>
                            {row._found ? '🗑 DELETE' : row._status === 'not_found' ? '⚠ NOT FOUND' : '❌ ERROR'}
                          </span>
                        </td>
                        <td style={s.td}><b>{row.mobile_number}</b></td>
                        <td style={s.td}>{row._found ? `ID #${row._dbId}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#f8fafc', borderBottomLeftRadius: 'var(--radius-md)', borderBottomRightRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', borderTop: 'none' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
                  Showing {Math.min(displayLimit, display.length).toLocaleString()} of {display.length.toLocaleString()} rows
                </span>
                {display.length > displayLimit && (
                  <button onClick={() => setDisplayLimit(p => p + 500)} style={s.outlineBtn}>
                    Load Next 500 Rows
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── STEP 3: Confirm ─── */}
      {step === 3 && !done && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ ...s.cardTitle, color: '#ef4444' }}>⚠ Proceed to Delete {stats.found} Numbers?</h2>
              <p style={s.cardSubtitle}>
                You are about to modify {stats.found} numbers from the exact inventory list. {stats.notFound} numbers were not found and will be skipped.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={() => { setStep(1); setRows([]); setDone(false); setDisplayLimit(500); }} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca'}} disabled={isDeleting}>✕ Cancel</button>
              <button onClick={() => setStep(2)} style={s.outlineBtn} disabled={isDeleting}>← Back</button>
              <button onClick={() => setShowConfirmModal(true)} style={{ ...s.primaryBtn, background: '#ef4444' }} disabled={isDeleting}>
                {isDeleting ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> {deleteProgressState || 'Processing...'}</> : <><Trash2 size={16} /> Choose Destination</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Destination Confirm Modal ─── */}
      {showConfirmModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,backdropFilter:'blur(4px)'}}>
          <div style={{background:'var(--bg-card)',width:'100%',maxWidth:'550px',borderRadius:'var(--radius-lg)',boxShadow:'0 20px 25px -5px rgba(0,0,0,0.1)',overflow:'hidden'}}>
            
            <div style={{padding:'24px',borderBottom:'1px solid var(--border-color)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <h2 style={{fontSize:'1.3rem',fontWeight:800,color:'var(--text-main)',margin:0}}>Deletion Method</h2>
              <button 
                onClick={()=>setShowConfirmModal(false)} 
                style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)'}}>
                  <X size={20}/>
              </button>
            </div>

            <div style={{padding:'24px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'24px'}}>
                {/* Drafts Option */}
                <div 
                  onClick={()=>{setDeleteDestination('draft')}}
                  style={{border:`2px solid ${deleteDestination==='draft'?'#f59e0b':'var(--border-color)'}`,borderRadius:'var(--radius-md)',padding:'16px',cursor:'pointer',background:deleteDestination==='draft'?'#fffbeb':'transparent',transition:'all 0.2s',textAlign:'center'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'50%',background:deleteDestination==='draft'?'#fef3c7':'#f1f5f9',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center',color:deleteDestination==='draft'?'#d97706':'#64748b'}}>
                     <FileText size={20}/>
                  </div>
                  <h4 style={{margin:0,fontWeight:800,color:'var(--text-main)',marginBottom:'4px'}}>Move to Drafts</h4>
                  <p style={{margin:0,fontSize:'0.8rem',color:'var(--text-muted)'}}>Soft-delete. Hidden from store, but can be restored later in drafts.</p>
                </div>

                {/* Permanent Delete Option */}
                <div 
                  onClick={()=>{setDeleteDestination('permanent')}}
                  style={{border:`2px solid ${deleteDestination==='permanent'?'#ef4444':'var(--border-color)'}`,borderRadius:'var(--radius-md)',padding:'16px',cursor:'pointer',background:deleteDestination==='permanent'?'#fef2f2':'transparent',transition:'all 0.2s',textAlign:'center'}}>
                  <div style={{width:'40px',height:'40px',borderRadius:'50%',background:deleteDestination==='permanent'?'#fee2e2':'#f1f5f9',margin:'0 auto 12px',display:'flex',alignItems:'center',justifyContent:'center',color:deleteDestination==='permanent'?'#dc2626':'#64748b'}}>
                    <Trash2 size={20}/>
                  </div>
                  <h4 style={{margin:0,fontWeight:800,color:'var(--text-main)',marginBottom:'4px'}}>Permanent Delete</h4>
                  <p style={{margin:0,fontSize:'0.8rem',color:'var(--text-muted)'}}>Irreversible. Removes these numbers from the database entirely.</p>
                </div>
              </div>

              <div style={{background:'#f8fafc',padding:'16px',borderRadius:'var(--radius-md)',border:'1px solid var(--border-color)'}}>
                <label style={{display:'block',fontSize:'0.85rem',fontWeight:700,marginBottom:'8px',color:'var(--text-main)'}}>👤 Administrator Name</label>
                <input 
                  type="text"
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none',fontSize:'0.9rem',fontWeight:600}}
                />
                <p style={{margin:'8px 0 0 0',fontSize:'0.75rem',color:'var(--text-muted)'}}>This name will be saved in the deletion log.</p>
              </div>
            </div>

            <div style={{padding:'16px 24px',background:'#f8fafc',borderTop:'1px solid var(--border-color)',display:'flex',justifyContent:'flex-end',gap:'12px'}}>
              <button 
                onClick={()=>{setShowConfirmModal(false)}} 
                style={{...s.outlineBtn, cursor:'pointer'}}>Cancel</button>
              <button 
                onClick={handleDelete} 
                style={{...s.primaryBtn, background:'#ef4444', cursor:'pointer', minWidth:'140px', justifyContent:'center'}}>
                <Trash2 size={16}/> {deleteDestination === 'permanent' ? 'Permanently Delete' : 'Move to Drafts'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ─── Done ─── */}
      {done && summary && (
        <div style={{ ...s.card, textAlign: 'center' }}>
          <CircleCheck size={52} style={{ color: summary.destination === 'draft' ? '#f59e0b' : '#ef4444', marginBottom: '16px' }} />
          <h2 style={s.cardTitle}>
            {summary.destination === 'draft' ? '📦 Numbers Moved to Drafts!' : '🗑 Numbers Permanently Deleted!'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
            {summary.destination === 'draft'
              ? 'Numbers are now hidden from the store. You can restore them anytime via Draft Management.'
              : 'Numbers have been permanently removed from the database.'}
          </p>
          <div style={s.statsRow}>
            <div style={s.statPill}><span>{summary.destination === 'draft' ? 'Moved to Drafts' : 'Deleted'}</span><b style={{ color: '#ef4444' }}>{summary.deleted}</b></div>
            <div style={s.statPill}><span>Failed</span><b style={{ color: '#94a3b8' }}>{summary.failed}</b></div>
            <div style={s.statPill}><span>Time</span><b>{summary.time}</b></div>
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
            <button onClick={() => { setStep(1); setRows([]); setDone(false); setDisplayLimit(500); setSummary(null); }} style={{ ...s.outlineBtn, color: '#ef4444', borderColor: '#ef4444' }}>Delete More Numbers</button>
            {summary.destination === 'draft' && (
              <button onClick={() => navigate('/draft-management')} style={{ ...s.primaryBtn, background: '#f59e0b' }}>View in Drafts</button>
            )}
            <button onClick={() => navigate('/inventory')} style={{ ...s.primaryBtn, background: '#ef4444' }}>Return to Inventory</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  stepBar: { display: 'flex', alignItems: 'center', marginBottom: '28px' },
  step: { display: 'flex', alignItems: 'center', gap: '8px', flex: 1, opacity: 0.4, transition: 'opacity 0.3s' },
  stepActive: { opacity: 1 },
  stepCircle: { width: '26px', height: '26px', borderRadius: '50%', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.78rem', flexShrink: 0 },
  stepLabel: { fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' },
  stepLine: { flex: 1, height: '2px', background: '#e2e8f0', margin: '0 8px' },
  card: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', padding: '32px' },
  cardTitle: { fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px', display: 'flex', alignItems: 'center' },
  cardSubtitle: { color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' },
  infoBanner: { display: 'flex', alignItems: 'flex-start', gap: '10px', background: '#fef2f2', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '20px', border: '1px solid #fecaca' },
  code: { background: '#fee2e2', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '0.82rem' },
  dropzone: { border: '2px dashed #fca5a5', borderRadius: 'var(--radius-lg)', padding: '56px 24px', textAlign: 'center', cursor: 'pointer', background: '#fffbfb' },
  dropActive: { borderColor: '#ef4444', background: 'rgba(239,68,68,0.04)' },
  parsingBox: { display: 'flex', alignItems: 'center', gap: '12px', marginTop: '16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '14px 18px' },
  statsRow: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' },
  statPill: { display: 'flex', gap: '8px', alignItems: 'center', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '20px', padding: '6px 14px', fontSize: '0.85rem' },
  gridWrap: { overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.87rem' },
  th: { background: '#fef2f2', padding: '10px 14px', borderBottom: '1px solid var(--border-color)', color: '#ef4444', fontWeight: 700, fontSize: '0.78rem', textTransform: 'uppercase', whiteSpace: 'nowrap', textAlign: 'left' },
  td: { padding: '10px 14px', borderBottom: '1px solid #f1f5f9' },
  badge: { padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700 },
  primaryBtn: { padding: '10px 20px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
  outlineBtn: { padding: '10px 18px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' },
};
