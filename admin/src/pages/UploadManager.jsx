import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import {
  CloudUpload, ChevronDown, ChevronUp,
  Download, RefreshCw, Check, X, Info, Trash2, FileText
} from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { API_BASE } from '../config/api';
import { classifyNumber, CATEGORIES, PATTERN_TYPES } from '../utils/PatternEngine';
import { useImport } from '../context/ImportContext';
import { useToast } from '../components/Toast';

const STATUSES = ['available', 'reserved', 'sold', 'deleted'];

function getOperation(row, existingSet) {
  const status = String(row.number_status || '').toLowerCase().trim();
  if (status === 'deleted') return 'delete';
  const mobile = String(row.mobile_number || '').replace(/\D/g, '');
  return existingSet.has(mobile) ? 'update' : 'insert';
}

function validateRow(row, idx, existingSet) {
  const errors = [];
  const mobile = String(row.mobile_number || '').replace(/\D/g, '');
  const status = String(row.number_status || 'available').toLowerCase().trim();
  const isDelete = status === 'deleted';

  if (!mobile) errors.push({ field: 'mobile_number', msg: 'Mobile number is required' });
  else if (mobile.length !== 10) errors.push({ field: 'mobile_number', msg: 'Must be exactly 10 digits' });

  if (!isDelete) {
    const bp = parseFloat(row.base_price || 0);
    if (!row.base_price) errors.push({ field: 'base_price', msg: 'Base price is required' });
    else if (isNaN(bp) || bp <= 0) errors.push({ field: 'base_price', msg: 'Must be a positive number' });
    const op = parseFloat(row.offer_price || 0);
    if (op && op > bp) errors.push({ field: 'offer_price', msg: 'Offer price cannot exceed base price' });
  }

  const inDbDupe = mobile && existingSet.has(mobile);
  const operation = getOperation(row, existingSet);
  const pattern = classifyNumber(mobile);

  let _status = 'valid';
  if (errors.length > 0) _status = 'error';
  else if (!mobile || (!isDelete && !row.base_price)) _status = 'missing';

  return {
    _rowId: idx + 2, _status, _errors: errors, _isDbDupe: inDbDupe,
    _operation: operation,
    mobile_number: mobile || '',
    base_price: row.base_price || '',
    offer_price: row.offer_price || '',
    number_status: status || 'available',
    remarks: row.remarks || '',
    pattern_type: row.pattern_type || pattern.pattern_type,
    category: row.category || pattern.category,
    prefix: mobile ? mobile.slice(0, 5) : '',
    suffix: mobile ? mobile.slice(5) : '',
    digit_sum: mobile ? mobile.split('').reduce((s, c) => s + parseInt(c), 0) : 0,
    repeat_count: (() => {
      let maxRun = 1, run = 1;
      if (!mobile) return 0;
      for (let i = 1; i < mobile.length; i++) { if (mobile[i] === mobile[i - 1]) run++; else run = 1; maxRun = Math.max(maxRun, run); }
      return maxRun;
    })(),
  };
}

function EditableCell({ value, field, rowStatus, errors = [], onChange, options = null }) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const hasErr = errors.some(e => e.field === field);
  const border = hasErr ? '#ef4444' : rowStatus === 'missing' && !value ? '#f59e0b' : rowStatus === 'valid' ? '#22c55e' : '#e2e8f0';
  const commit = () => { setEditing(false); onChange(field, local); };
  if (editing && options) {
    if (field === 'pattern_type') {
      return (
        <label>
          <input autoFocus value={local} onChange={e => setLocal(e.target.value)} onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            list={`opts-${field}`}
            style={{ ...cs.input, border: `1.5px solid ${border}` }} />
          <datalist id={`opts-${field}`}>{options.map(o => <option key={o} value={o} />)}</datalist>
        </label>
      );
    }
    return (
      <select autoFocus value={local} onChange={e => setLocal(e.target.value)} onBlur={commit}
        style={{ ...cs.input, border: `1.5px solid ${border}` }}>
        <option value={local} style={{ display: 'none' }}>{local}</option>
        {options.map(o => <option key={o}>{o}</option>)}
      </select>
    );
  }
  if (editing) return (
    <input autoFocus value={local} onChange={e => setLocal(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      style={{ ...cs.input, border: `1.5px solid ${border}` }} />
  );
  return (
    <div onClick={() => { setLocal(value); setEditing(true); }}
      style={{
        ...cs.cell, borderLeft: `3px solid ${border}`,
        background: hasErr ? '#fff5f5' : rowStatus === 'missing' && !value ? '#fffbeb' : 'transparent', cursor: 'cell'
      }}>
      {value || <span style={{ color: '#ccc', fontSize: '0.73rem' }}>click to edit</span>}
    </div>
  );
}

const OP_STYLES = {
  insert: { bg: '#dcfce7', color: '#16a34a', label: '➕ INSERT' },
  update: { bg: '#dbeafe', color: '#1d4ed8', label: '✏️ UPDATE' },
  delete: { bg: '#fee2e2', color: '#dc2626', label: '🗑 DELETE' },
};

const STATUS_STYLES = {
  valid: { bg: '#dcfce7', color: '#16a34a' },
  missing: { bg: '#fef9c3', color: '#a16207' },
  error: { bg: '#fee2e2', color: '#dc2626' },
  duplicate: { bg: '#ede9fe', color: '#7c3aed' },
};

export default function ImportWorkspace() {
  const toast = useToast();
  const { runBulkImport, parseSession, updateParseSession, clearParseSession } = useImport();
  const { rows, step, fileName, isParsing, parseProgress, operatorName } = parseSession;

  const setRows = (val) => updateParseSession({ rows: typeof val === 'function' ? val(parseSession.rows) : val });
  const setStep = (val) => updateParseSession({ step: val });
  const setIsParsing = (val) => updateParseSession({ isParsing: val });
  const setParseProgress = (val) => updateParseSession({ parseProgress: val });
  const setOperatorName = (val) => updateParseSession({ operatorName: val });
  const setFileName = (val) => updateParseSession({ fileName: val });

  const [filter, setFilter] = useState('all');
  const [opFilter, setOpFilter] = useState('all');
  const [displayLimit, setDisplayLimit] = useState(500);
  const [displayLimit3, setDisplayLimit3] = useState(500);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [importDestination, setImportDestination] = useState('store');
  const [selected, setSelected] = useState([]);
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [bulkField, setBulkField] = useState('');
  const [bulkValue, setBulkValue] = useState('');

  const onDrop = useCallback(async (files) => {
    const file = files[0]; if (!file) return;
    setFileName(file.name);
    setIsParsing(true);
    setParseProgress('Reading file...');
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      setParseProgress('Extracting data...');
      await new Promise(r => setTimeout(r, 50));
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

      const json = rawJson.map(row => {
        const norm = {};
        for (let key in row) {
          let safeKey = key.trim().toLowerCase().replace(/[\s-.]+/g, '_');
          if (['mobile_no', 'phone', 'contact', 'number'].includes(safeKey)) safeKey = 'mobile_number';
          if (['price', 'selling_price'].includes(safeKey)) safeKey = 'base_price';
          if (['inventory', 'source', 'file'].includes(safeKey)) safeKey = 'inventory_source';
          norm[safeKey] = row[key];
        }
        return norm;
      });

      setParseProgress('Checking database for updates...');
      const validRows = json.filter(r => r.mobile_number || r.base_price);
      const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/bulk-lookup`, {
        method: 'POST',
        body: JSON.stringify({ mobile_numbers: validRows.map(r => String(r.mobile_number)) })
      });

      let existingSet = new Set();
      if (res && res.ok) {
        const d = await res.json();
        if (d.matched) d.matched.forEach(r => existingSet.add(String(r.mobile_number)));
      }

      setParseProgress('Validating rows...');
      const parsed = validRows.map((r, i) => validateRow(r, i, existingSet));
      setRows(parsed); setStep(2);
    } catch (e) { toast.error('Parse failed: ' + e.message); }
    finally { setIsParsing(false); setParseProgress(''); }
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

  const updateCell = (ri, field, value) => {
    setRows(prev => {
      const updated = [...prev];
      const row = { ...updated[ri], [field]: value };
      updated[ri] = row;
      return updated;
    });
  };

  const toggleSort = col => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const stats = {
    total: rows.length,
    valid: rows.filter(r => r._status === 'valid').length,
    missing: rows.filter(r => r._status === 'missing').length,
    error: rows.filter(r => r._status === 'error').length,
    inserts: rows.filter(r => r._status === 'valid' && r._operation === 'insert').length,
    updates: rows.filter(r => r._status === 'valid' && r._operation === 'update').length,
    deletes: rows.filter(r => r._status === 'valid' && r._operation === 'delete').length,
  };

  let display = [...rows];
  if (filter !== 'all') display = display.filter(r => r._status === filter);
  if (opFilter !== 'all') display = display.filter(r => r._operation === opFilter);
  if (sortCol) display.sort((a, b) => {
    const av = String(a[sortCol] || ''), bv = String(b[sortCol] || '');
    return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
  });

  const applyBulk = () => {
    if (!bulkField || !bulkValue || selected.length === 0) return;
    setRows(prev => { const u = [...prev]; selected.forEach(i => { u[i] = { ...u[i], [bulkField]: bulkValue }; }); return u; });
    setSelected([]); setBulkField(''); setBulkValue('');
  };

  const downloadErrors = () => {
    const data = rows.filter(r => r._status !== 'valid').map(r => ({ Row: r._rowId, Mobile: r.mobile_number, Status: r._status, Errors: r._errors.map(e => e.msg).join('; ') }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Errors');
    XLSX.writeFile(wb, 'Errors.xlsx');
  };

  const downloadTemplate = () => {
    const cols = { mobile_number: '', base_price: '', number_status: 'available', remarks: '' };
    const ws = XLSX.utils.json_to_sheet([cols]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, 'Template.xlsx');
  };

  const handleImport = () => {
    const dest = importDestination;
    const cleanRow = r => {
      const payload = {
        ...r,
        inventory_source: fileName,
        visibility_status: dest === 'draft' ? '0' : '1',
      };
      // Strip all internal UI tracking properties before sending to API
      Object.keys(payload).forEach(k => {
        if (k.startsWith('_')) delete payload[k];
      });
      return payload;
    };
    runBulkImport({
      rows,
      fileName,
      importDestination: dest,
      operatorName: operatorName.trim() || localStorage.getItem('ag_admin_username') || 'Admin',
      cleanRow,
    });
    setShowConfirmModal(false);
    clearParseSession();
  };

  const COLS = [
    'mobile_number', 'base_price', 'offer_price', 'number_status', 'category', 'pattern_type', 'remarks'
  ];

  return (
    <div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      <div style={s.stepBar}>
        {['Upload File', 'Preview & Edit', 'Auto-Fields', 'Confirm'].map((l, i) => (
          <div key={i} style={{ ...s.step, ...(step === i + 1 ? s.stepActive : {}), ...(step > i + 1 ? s.stepDone : {}) }}>
            <div style={s.stepCircle}>{step > i + 1 ? <Check size={12} /> : i + 1}</div>
            <span style={s.stepLabel}>{l}</span>
            {i < 3 && <div style={{ ...s.stepLine, ...(step > i + 1 ? { background: 'var(--neon-green-dark)' } : {}) }} />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={s.cardTitle}>Inventory Upload</h2>
            <button onClick={downloadTemplate} style={s.outlineBtn}><Download size={16} /> Template</button>
          </div>
          <div {...getRootProps()} style={{ ...s.dropzone, ...(isDragActive ? s.dropActive : {}) }}>
            <input {...getInputProps()} />
            <CloudUpload size={48} style={{ color: isDragActive ? 'var(--neon-green-dark)' : '#94a3b8', marginBottom: '14px' }} />
            <p>{isDragActive ? 'Drop here' : 'Drag & Drop or Click to Upload'}</p>
          </div>
          {isParsing && (
            <div style={s.parsingBox}>
              <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--neon-green-dark)' }} />
              <p>{parseProgress}</p>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div>
          <div style={s.opStrip}>
            {[{ l: '➕ Insert', v: stats.inserts, c: '#16a34a', k: 'insert' }, { l: '✏️ Update', v: stats.updates, c: '#1d4ed8', k: 'update' }, { l: '🗑 Delete', v: stats.deletes, c: '#dc2626', k: 'delete' }].map(it => (
              <div key={it.l} style={{ ...s.opCard, ...(opFilter === it.k ? { outline: '2px solid ' + it.c } : {}) }} onClick={() => setOpFilter(p => p === it.k ? 'all' : it.k)}>
                <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{it.l}</p>
                <p style={{ fontSize: '1.5rem', fontWeight: 900, color: it.c }}>{it.v}</p>
              </div>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
              <button onClick={clearParseSession} style={{ ...s.outlineBtn, color: '#ef4444' }}>Cancel</button>
              <button onClick={() => setStep(3)} style={s.primaryBtn} disabled={stats.inserts + stats.updates + stats.deletes === 0}>Next Step →</button>
            </div>
          </div>

          <div style={s.statsTabs}>
            {[{ k: 'all', l: 'All' }, { k: 'valid', l: '✅ Valid' }, { k: 'missing', l: '⚠️ Missing' }, { k: 'error', l: '❌ Error' }].map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)} style={{ ...s.tabBtn, ...(filter === t.k ? { borderBottom: `3px solid #3b82f6`, color: '#3b82f6' } : {}) }}>{t.l}</button>
            ))}
          </div>

          {selected.length > 0 && (
            <div style={s.bulkBar}>
              <span style={{ fontWeight: 700 }}>{selected.length} selected</span>
              <select value={bulkField} onChange={e => setBulkField(e.target.value)} style={s.smSel}>
                <option value=''>-- Field --</option>
                <option value='category'>Category</option>
                <option value='number_status'>Status</option>
              </select>
              <input value={bulkValue} onChange={e => setBulkValue(e.target.value)} placeholder='Value…' style={s.smInp} />
              <button onClick={applyBulk} style={s.primaryBtn}>Apply</button>
            </div>
          )}

          <div style={s.gridWrap}>
            <table style={s.table}>
              <thead><tr><th style={s.th}><input type='checkbox' onChange={e => setSelected(e.target.checked ? display.map((_, i) => rows.indexOf(display[i])) : [])} /></th><th style={s.th}>Row</th><th style={s.th}>Operation</th>{COLS.map(c => <th key={c} style={s.th} onClick={() => toggleSort(c)}>{c}</th>)}</tr></thead>
              <tbody>{display.slice(0, displayLimit).map((row, vi) => {
                const ri = rows.indexOf(row);
                return (
                  <tr key={vi} style={{ background: selected.includes(ri) ? '#f0fdf4' : 'transparent' }}>
                    <td style={s.td}><input type='checkbox' checked={selected.includes(ri)} onChange={e => setSelected(p => e.target.checked ? [...p, ri] : p.filter(x => x !== ri))} /></td>
                    <td style={s.td}><small>{row._rowId}</small></td>
                    <td style={s.td}><span style={{ ...s.badge, ...OP_STYLES[row._operation] }}>{row._operation}</span></td>
                    {COLS.map(c => <td key={c} style={{ ...s.td, padding: 0, minWidth: '140px' }}><EditableCell value={row[c]} field={c} rowStatus={row._status} onChange={(f, v) => updateCell(ri, f, v)} /></td>)}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        </div>
      )}

      {step === 3 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>Auto-Fields Preview</h2>
            <div style={{ display: 'flex', gap: '12px' }}><button onClick={() => setStep(2)} style={s.outlineBtn}>← Back</button><button onClick={() => setStep(4)} style={s.primaryBtn}>Next Step →</button></div>
          </div>
          <div style={s.gridWrap}>
            <table style={s.table}>
              <thead><tr><th>Mobile</th><th>Pattern</th><th>Category</th></tr></thead>
              <tbody>{rows.filter(r => r._status === 'valid').slice(0, displayLimit3).map((r, i) => (
                <tr key={i}>
                  <td>{r.mobile_number}</td>
                  <td>{r.pattern_type}</td>
                  <td>{r.category}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {step === 4 && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>Confirm Import</h2>
            <div style={{ display: 'flex', gap: '12px' }}><button onClick={clearParseSession} style={s.outlineBtn}>Cancel</button><button onClick={() => setShowConfirmModal(true)} style={s.primaryBtn}>Proceed →</button></div>
          </div>
          <div style={s.summaryGrid}>
            <div style={s.summaryCard}><p>Inserts</p><h3>{stats.inserts}</h3></div>
            <div style={s.summaryCard}><p>Updates</p><h3>{stats.updates}</h3></div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', width: '440px' }}>
            <h3>Select Destination</h3>
            <div style={{ display: 'flex', gap: '12px', margin: '20px 0' }}>
              <button onClick={() => setImportDestination('store')} style={{ flex: 1, padding: '16px', border: importDestination === 'store' ? '2px solid green' : '1px solid #ddd' }}>Store</button>
              <button onClick={() => setImportDestination('draft')} style={{ flex: 1, padding: '16px', border: importDestination === 'draft' ? '2px solid orange' : '1px solid #ddd' }}>Drafts</button>
            </div>
            <button onClick={handleImport} style={{ ...s.primaryBtn, width: '100%', justifyContent: 'center' }}>Start Import</button>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  stepBar: { display: 'flex', gap: '20px', marginBottom: '30px' },
  step: { flex: 1, opacity: 0.4, display: 'flex', alignItems: 'center', gap: '8px' },
  stepActive: { opacity: 1 },
  stepCircle: { width: '24px', height: '24px', borderRadius: '50%', background: '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  stepLine: { flex: 1, height: '2px', background: '#ddd' },
  card: { background: '#fff', padding: '30px', borderRadius: '16px', border: '1px solid #eee' },
  dropzone: { border: '2px dashed #ddd', padding: '50px', textAlign: 'center', cursor: 'pointer', borderRadius: '8px', transition: 'all 0.2s' },
  dropActive: { borderColor: 'var(--neon-green-dark)', background: '#f0fdf4' },
  parsingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '8px' },
  gridWrap: { overflowX: 'auto', border: '1px solid #eee', borderRadius: '8px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { background: '#f9fafb', padding: '10px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700 },
  td: { padding: '10px', borderBottom: '1px solid #eee', fontSize: '0.85rem' },
  badge: { padding: '4px 8px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 700 },
  primaryBtn: { background: '#3b82f6', color: '#fff', padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' },
  outlineBtn: { background: 'transparent', border: '1px solid #ddd', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer' },
  opStrip: { display: 'flex', gap: '12px', marginBottom: '20px' },
  opCard: { background: '#fff', padding: '12px 20px', borderRadius: '8px', border: '1px solid #eee', cursor: 'pointer', minWidth: '100px' },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '30px' },
  summaryCard: { padding: '24px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' },
  statsTabs: { display: 'flex', gap: '20px', borderBottom: '2px solid #eee', marginBottom: '20px' },
  tabBtn: { background: 'transparent', border: 'none', padding: '10px 0', cursor: 'pointer', fontWeight: 600 },
  bulkBar: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', background: '#f0f9ff', padding: '10px', borderRadius: '8px' },
  smSel: { padding: '6px', borderRadius: '4px' },
  smInp: { padding: '6px', borderRadius: '4px', border: '1px solid #ddd' },
};

const cs = {
  cell: { padding: '10px', minHeight: '38px', display: 'flex', alignItems: 'center' },
  input: { width: '100%', padding: '8px', border: 'none', outline: 'none' }
};
