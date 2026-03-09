import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { UploadCloud, Download, RefreshCw, Check, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

const API = 'https://asfancynumber.com/fancy_number/api.php';

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
  const [parseProgress, setParseProgress] = useState('');
  const [deleteProgress, setDeleteProgress] = useState('');

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
          let safeKey = key.trim().toLowerCase().replace(/[\s\-\.]+/g, '_');
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
        const res = await fetch(`${API}/wp_fn_numbers?limit=600000&fields=number_id,mobile_number`);
        if (res.ok) {
          const d = await res.json();
          if (Array.isArray(d)) d.forEach(r => { existingMap[String(r.mobile_number)] = r.number_id; });
        }
      } catch {}

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

  const downloadTemplate = () => {
    const cols = { mobile_number: '' };
    const ws = XLSX.utils.json_to_sheet([cols]);
    ws['!cols'] = [{ wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Delete Template');
    XLSX.writeFile(wb, 'Delete_Numbers_Template.xlsx');
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const toDelete = rows.filter(r => r._found && r._dbId);
    let deleted = 0, failed = 0;

    const CHUNK = 5;
    for (let i = 0; i < toDelete.length; i += CHUNK) {
      const chunk = toDelete.slice(i, i + CHUNK);
      setDeleteProgress(`Deleting ${i + 1}–${Math.min(i + CHUNK, toDelete.length)} of ${toDelete.length}…`);
      const promises = chunk.map(row =>
        fetch(`${API}/wp_fn_numbers/${row._dbId}`, { method: 'DELETE' })
          .then(res => res.ok ? 1 : 0)
          .catch(() => 0)
      );
      const results = await Promise.all(promises);
      deleted += results.reduce((s, v) => s + v, 0);
      failed += results.reduce((s, v) => s + (1 - v), 0);
    }

    // Save upload log
    setDeleteProgress('Saving deletion log…');
    const finalOperator = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
    try {
      await fetch(`${API}/wp_fn_upload_batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_name: `${fileRef.current}|||${finalOperator}|||Numbers Deleted: ${deleted}`,
          uploaded_by: finalOperator,
          total_records: toDelete.length
        }),
      });
    } catch {}

    setSummary({
      deleted,
      failed,
      notFound: stats.notFound,
      total: toDelete.length,
      file: fileRef.current,
      time: new Date().toLocaleString(),
    });
    setDeleteProgress('');
    setIsDeleting(false);
    setDone(true);
  };

  return (
    <div>
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
            <AlertCircle size={16} style={{ flexShrink: 0, color: '#ef4444' }} />
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
            <div style={s.statPill}><span style={{ color: '#64748b' }}>Total</span><b>{stats.total}</b></div>
            <div style={s.statPill}><span style={{ color: '#ef4444' }}>🗑 To Delete</span><b style={{ color: '#ef4444' }}>{stats.found}</b></div>
            <div style={s.statPill}><span style={{ color: '#f59e0b' }}>⚠ Not Found</span><b style={{ color: '#f59e0b' }}>{stats.notFound}</b></div>
            <div style={s.statPill}><span style={{ color: '#94a3b8' }}>❌ Errors</span><b style={{ color: '#94a3b8' }}>{stats.error}</b></div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={() => { setStep(1); setRows([]); setDisplayLimit(500); }} style={{ ...s.outlineBtn, color: '#64748b' }}>Cancel</button>
              <button onClick={() => setStep(3)} style={{ ...s.primaryBtn, background: '#ef4444' }} disabled={stats.found === 0}>
                Next Step →
              </button>
            </div>
          </div>

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
                {rows.slice(0, displayLimit).map((row, i) => (
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
              Showing {Math.min(displayLimit, rows.length).toLocaleString()} of {rows.length.toLocaleString()} rows
            </span>
            {rows.length > displayLimit && (
              <button onClick={() => setDisplayLimit(p => p + 500)} style={s.outlineBtn}>
                Load Next 500 Rows
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 3: Confirm ─── */}
      {step === 3 && !done && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h2 style={{ ...s.cardTitle, color: '#ef4444' }}>⚠ Permanently Delete {stats.found} Numbers?</h2>
              <p style={s.cardSubtitle}>
                This will permanently remove {stats.found} numbers from the database. {stats.notFound} numbers were not found and will be skipped.
                <br /><b style={{ color: '#ef4444' }}>This action cannot be undone.</b>
              </p>
              
              <div style={{ marginTop: '20px' }}>
                <label style={{display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px'}}>👤 Admin Name (editable)</label>
                <input 
                  type="text" 
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: '#fff', width: '100%', maxWidth: '300px'}}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button onClick={() => { setStep(1); setRows([]); setDone(false); setDisplayLimit(500); }} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca'}} disabled={isDeleting}>✕ Cancel</button>
              <button onClick={() => setStep(2)} style={s.outlineBtn} disabled={isDeleting}>← Back</button>
              <button onClick={handleDelete} style={{ ...s.primaryBtn, background: '#ef4444' }} disabled={isDeleting}>
                {isDeleting ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> {deleteProgress || 'Deleting...'}</> : <><Trash2 size={16} /> Confirm Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Done ─── */}
      {done && summary && (
        <div style={{ ...s.card, textAlign: 'center' }}>
          <CheckCircle size={52} style={{ color: '#ef4444', marginBottom: '16px' }} />
          <h2 style={s.cardTitle}>Numbers Deleted Successfully!</h2>
          <div style={s.statsRow}>
            <div style={s.statPill}><span>Deleted</span><b style={{ color: '#ef4444' }}>{summary.deleted}</b></div>
            <div style={s.statPill}><span>Failed</span><b style={{ color: '#94a3b8' }}>{summary.failed}</b></div>
            <div style={s.statPill}><span>Not Found</span><b style={{ color: '#f59e0b' }}>{summary.notFound}</b></div>
            <div style={s.statPill}><span>Time</span><b>{summary.time}</b></div>
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '20px' }}>
            <button onClick={() => { setStep(1); setRows([]); setDone(false); setDisplayLimit(500); }} style={{ ...s.outlineBtn, color: '#ef4444', borderColor: '#ef4444' }}>Delete More Numbers</button>
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
