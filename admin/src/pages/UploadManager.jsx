import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import {
  CloudUpload, ChevronDown, ChevronUp,
  Download, RefreshCw, Check, X, Info, Trash2, FileText, Archive
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
  
  if (!mobile) {
    errors.push({ field: 'mobile_number', msg: 'Mobile number is required' });
  } else if (mobile.length < 9) {
    errors.push({ field: 'mobile_number', msg: 'Must be at least 9 digits' });
  }

  const bp = parseFloat(row.base_price || 0);
  if (!row.base_price) {
    errors.push({ field: 'base_price', msg: 'Base price is required' });
  } else if (isNaN(bp) || bp <= 0) {
    errors.push({ field: 'base_price', msg: 'Must be a positive number' });
  }

  const op = parseFloat(row.offer_price || 0);
  if (row.offer_price && op > bp) {
    errors.push({ field: 'offer_price', msg: 'Offer price cannot exceed base price' });
  }

  const inDbDupe = mobile && existingSet.has(mobile);
  const pattern = classifyNumber(mobile || '0000000000');

  let _status = 'valid';
  if (errors.length > 0) _status = 'error';
  else if (inDbDupe) _status = 'conflict';

  const _operation = getOperation(row, existingSet);

  // Helper: use row value if present (including 0), else use fallback
  const v = (val, fb) => (val !== undefined && val !== null && val !== '') ? val : fb;

  // Auto-inject bundle_type for Couple (7) and Business (8) categories
  // IMPORTANT: ALIAS_MAP maps CSV's 'number_category' to 'category', so check both
  const userCat = row.number_category || row.category;
  const finalCat = v(userCat, pattern.number_category);
  const nc = String(finalCat);
  let bundle_type = v(row.bundle_type, '');
  if (!bundle_type) {
    if (nc === '7') bundle_type = 'couple';
    else if (nc === '8') bundle_type = 'group';
  }

  return {
    _rowId: idx + 2,
    _status,
    _operation,
    _errors: errors,
    _isDbDupe: inDbDupe,
    
    // Type A & B (User Input)
    mobile_number: mobile || '',
    number_type: v(row.number_type, ''),
    category: v(row.category, ''),
    number_category: finalCat,
    base_price: v(row.base_price, ''),
    offer_price: v(row.offer_price, ''),
    offer_start_date: v(row.offer_start_date, ''),
    offer_end_date: v(row.offer_end_date, ''),
    platform_commission: v(row.platform_commission, '0'),
    number_status: v(row.number_status, 'available'),
    visibility_status: row.visibility_status !== undefined ? row.visibility_status : '1',
    inventory_source: v(row.inventory_source, ''),
    dealer_id: row.dealer_id || null,
    couple_id: row.couple_number_id || row.couple_id || null,
    group_id: row.group_number_id || row.group_id || null,
    remarks: v(row.remarks, ''),
    draft_reason: v(row.draft_reason, ''),
    bundle_type,

    // Type C (Auto-Generated) — explicit checks so 0 values are preserved
    pattern_name: v(row.pattern_name, pattern.pattern_name),
    pattern_type: v(row.pattern_type, pattern.pattern_type),
    prefix: v(row.prefix, pattern.prefix),
    suffix: v(row.suffix, pattern.suffix),
    digit_sum: v(row.digit_sum, pattern.digit_sum),
    repeat_count: v(row.repeat_count, pattern.repeat_count),
    vip_score: v(row.vip_score, pattern.vip_score),
    auto_detected: v(row.auto_detected, 1),
    
    // Manual Overrides tracking
    _overrides: {}
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
  const { runBulkImport, runServerUpload, parseSession, updateParseSession, clearParseSession } = useImport();
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
  const [unmatchedCols, setUnmatchedCols] = useState([]);

  // Known columns our system understands
  const KNOWN_COLS = new Set([
    'mobile_number', 'number_type', 'category', 'base_price', 'offer_price',
    'offer_start_date', 'offer_end_date', 'platform_commission', 'number_status',
    'visibility_status', 'inventory_source', 'dealer_id', 'remarks', 'draft_reason',
    'pattern_name', 'pattern_type', 'prefix', 'suffix', 'digit_sum', 'repeat_count',
    'vip_score', 'auto_detected', 'couple_id', 'group_id', 'bundle_type'
  ]);

  // Server-side upload handler — sends file directly to PHP
  const handleServerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'xlsx'].includes(ext)) {
      toast.error('Only .csv and .xlsx files are accepted');
      return;
    }
    toast.info(`Uploading ${file.name} to server...`);
    await runServerUpload({ file, operatorName: operatorName || 'Admin' });
    toast.success('Upload job started! Check progress in the import tracker.');
    if (e.target) e.target.value = '';
  };

  const onDrop = useCallback(async (files) => {
    const file = files[0]; if (!file) return;
    setFileName(file.name);
    setIsParsing(true);
    setParseProgress('Reading file...');
    setUnmatchedCols([]);
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      setParseProgress('Extracting data...');
      await new Promise(r => setTimeout(r, 50));
      const wb = XLSX.read(data, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Column alias mapping — normalise any column header to our standard names
      const ALIAS_MAP = {
        'mobile_no': 'mobile_number', 'phone': 'mobile_number', 'contact': 'mobile_number',
        'number': 'mobile_number', 'mob': 'mobile_number', 'mobile': 'mobile_number',
        'phone_number': 'mobile_number', 'cell': 'mobile_number', 'contact_number': 'mobile_number',
        'price': 'base_price', 'selling_price': 'base_price', 'mrp': 'base_price',
        'amount': 'base_price', 'cost': 'base_price', 'rate': 'base_price',
        'offer': 'offer_price', 'discount_price': 'offer_price', 'sale_price': 'offer_price',
        'number_category': 'category', 'cat': 'category',
        'inventory': 'inventory_source', 'source': 'inventory_source', 'file': 'inventory_source',
        'couple_number_id': 'couple_id', 'couple_no': 'couple_id', 'couple': 'couple_id',
        'group_number_id': 'group_id', 'group_no': 'group_id', 'group': 'group_id',
        'dealer': 'dealer_id', 'status': 'number_status', 'type': 'number_type',
        'remark': 'remarks', 'note': 'remarks', 'notes': 'remarks',
        'commission': 'platform_commission', 'visibility': 'visibility_status',
        'pattern': 'pattern_type', 'score': 'vip_score',
      };

      const _unmatched = new Set();
      const json = rawJson.map(row => {
        const norm = {};
        for (let key in row) {
          let safeKey = key.trim().toLowerCase().replace(/[\s-.]+/g, '_');
          // Try alias mapping first
          if (ALIAS_MAP[safeKey]) safeKey = ALIAS_MAP[safeKey];
          // Track unmatched columns (unknown to our system)
          if (!KNOWN_COLS.has(safeKey)) _unmatched.add(key.trim());
          norm[safeKey] = row[key];
        }
        return norm;
      });

      if (_unmatched.size > 0) setUnmatchedCols([..._unmatched]);
      console.log('[Extract] Raw Rows:', rawJson.length, rawJson.slice(0, 3));
      console.log('[Extract] Mapped Rows:', json.length, json.slice(0, 3));
      if (_unmatched.size > 0) console.warn('[Extract] Unmatched columns:', [..._unmatched]);

      setParseProgress('Checking database for updates...');
      // Accept rows that have at least a mobile_number OR base_price
      const validRows = json.filter(r => r.mobile_number || r.base_price);
      
      let existingSet = new Set();
      try {
        const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/bulk-lookup`, {
          method: 'POST',
          body: JSON.stringify({ mobile_numbers: validRows.map(r => String(r.mobile_number || '')) })
        });
        if (res && res.ok) {
          const d = await res.json();
          if (d.matched) d.matched.forEach(r => existingSet.add(String(r.mobile_number)));
        }
      } catch (lookupErr) {
        console.warn('[Extract] Bulk lookup failed (importing as inserts):', lookupErr.message);
      }

      setParseProgress('Validating rows...');
      const parsed = validRows.map((r, i) => validateRow(r, i, existingSet));
      setRows(parsed); 
      setStep(2); // Go to Step 2: User Data Review
    } catch (e) { 
      const isNetworkError = e.message === 'Failed to fetch' || e.name === 'TypeError';
      const msg = isNetworkError ? 'Network Error: Could not connect to API (Check VPN/CORS)' : e.message;
      toast.error('Parse failed: ' + msg); 
      console.error(e);
    }
    finally { setIsParsing(false); setParseProgress(''); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
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
    conflicts: rows.filter(r => r._status === 'conflict').length,
    errors: rows.filter(r => r._status === 'error').length,
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
    const headers = [
      'mobile_number', 'number_type', 'number_category', 'base_price', 'offer_price',
      'offer_start_date', 'offer_end_date', 'platform_commission', 'number_status',
      'visibility_status', 'inventory_source', 'dealer_id', 'remarks', 'draft_reason',
      'pattern_name', 'pattern_type', 'prefix', 'suffix', 'digit_sum', 'repeat_count',
      'vip_score', 'auto_detected'
    ];

    const hints = [
      'REQUIRED — 10 digits, starts 6-9', 'Optional — 1=Prepaid 2=Postpaid 3=Special',
      'Auto — 1=Diamond 2=Platinum 3=Gold 4=Silver 5=Normal', 'REQUIRED — selling price > 0',
      'Optional — discount price < base', 'Optional — YYYY-MM-DD HH:MM:SS',
      'Optional — must be after start', 'Optional — commission in rupees',
      'Optional — defaults to available', 'Optional — 1=Show 0=Hide',
      'Optional — e.g. Direct, Agent', 'REQUIRED — dealer ID number',
      'Optional — any notes', 'Optional — draft only',
      'Auto if blank', 'Auto-detected if blank',
      'Auto — first 4 digits', 'Auto — last 4 digits',
      'Auto — sum of digits', 'Auto — most repeated digit count',
      'Auto — quality 0-100', 'Auto — 1 if any field auto-generated'
    ];

    const wb = XLSX.utils.book_new();

    // Sheet 1: fn_numbers Import
    const ws = XLSX.utils.aoa_to_sheet([headers, hints]);
    const wchs = [22, 16, 20, 16, 16, 24, 24, 22, 17, 18, 22, 14, 32, 32, 24, 20, 13, 13, 14, 16, 14, 16];
    ws['!cols'] = wchs.map(w => ({ wch: w }));
    XLSX.utils.book_append_sheet(wb, ws, 'fn_numbers Import');

    // Sheet 2: Category & Pattern Guide
    const guideData = [
      ['Pattern Type', 'Category Name', 'Category ID', 'Description'],
      ['Mirror',      'Diamond',  1, 'Rarest — first half mirrors reverse of second half'],
      ['Palindrome',  'Diamond',  1, 'Reads same forwards and backwards'],
      ['Ladder Up',   'Platinum', 2, 'Every digit 1 more than previous'],
      ['Ladder Down', 'Platinum', 2, 'Every digit 1 less than previous'],
      ['Repeating',   'Platinum', 2, '3+ consecutive same digits'],
      ['Double Pair', 'Gold',     3, 'Two or more pairs of repeated digits'],
      ['Triple',      'Gold',     3, 'Three same digits in sequence'],
      ['Sequential',  'Silver',   4, 'Run of 4+ ascending or descending digits'],
      ['Normal',      'Normal',   5, 'No significant pattern detected'],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(guideData);
    ws2['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 50 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Category & Pattern Guide');

    XLSX.writeFile(wb, 'fansy_import_template.xlsx');
    toast.success('Template generated successfully');
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
    
    // Validate that we have some rows to import
    const validCount = rows.filter(r => r._status === 'valid' || r._status === 'conflict').length;
    if (validCount === 0) {
      toast.error('No valid rows or conflicts to import. Please check for errors in Step 1.');
      return;
    }

    runBulkImport({
      rows: rows.filter(r => r._status === 'valid' || r._status === 'conflict'),
      fileName,
      importDestination: dest,
      operatorName: operatorName.trim() || localStorage.getItem('ag_admin_username') || 'Admin',
      cleanRow,
    });
    setShowConfirmModal(false);
    // Don't clear parse session — runBulkImport is async fire-and-forget.
    // Clearing here wipes rows before they finish sending.
    // ImportContext will handle state via job tracking.
    setStep(1);
  };

  const COLS_STEP1 = [
    'mobile_number', 'number_type', 'category', 'base_price', 'offer_price',
    'offer_start_date', 'offer_end_date', 'platform_commission', 'number_status',
    'visibility_status', 'inventory_source', 'dealer_id', 'couple_id',
    'group_id', 'remarks', 'draft_reason'
  ];

  const COLS_STEP2 = [
    'pattern_name', 'pattern_type', 'prefix', 'suffix', 'digit_sum', 'repeat_count',
    'vip_score', 'auto_detected'
  ];

  return (
    <div>
      <style>{`
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .fn-scroll-table::-webkit-scrollbar { width: 8px; height: 8px; }
        .fn-scroll-table::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 4px; }
        .fn-scroll-table::-webkit-scrollbar-thumb { background: var(--neon-green-dark, #16a34a); border-radius: 4px; }
        .fn-scroll-table::-webkit-scrollbar-thumb:hover { background: var(--neon-green, #22c55e); }
        .fn-scroll-table { scrollbar-color: var(--neon-green-dark, #16a34a) #f1f5f9; scrollbar-width: thin; }
      `}</style>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h2 style={{ margin: 0 }}>Inventory Upload</h2>
            <button onClick={downloadTemplate} className="btn btn-secondary"><Download size={16} /> Download Template</button>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '18px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>— or —</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 24px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', border: 'none', transition: 'opacity 0.2s' }}>
              <Archive size={18} />
              Quick Server Upload (skip preview)
              <input type="file" accept=".csv,.xlsx" style={{ display: 'none' }} onChange={handleServerUpload} />
            </label>
          </div>
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.75rem', marginTop: '8px' }}>Server processes the file directly — validates, deduplicates, and inserts in one step</p>
        </div>
      )}

      {step === 2 && (
        <div style={s.card}>
          {/* Unmatched columns warning */}
          {unmatchedCols.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <Info size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: '#92400e', fontSize: '0.85rem' }}>Unmatched columns (ignored):</p>
                <p style={{ margin: '4px 0 0 0', color: '#a16207', fontSize: '0.8rem' }}>{unmatchedCols.join(', ')}</p>
              </div>
            </div>
          )}

          {/* Static stats + nav bar */}
          <div style={s.opStrip}>
            <div style={s.opCard}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>VALID ROWS</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{stats.valid}</p>
            </div>
            <div style={s.opCard}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>CONFLICTS</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#7c3aed' }}>{stats.conflicts}</p>
            </div>
            <div style={s.opCard}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>ERRORS</p>
              <p style={{ fontSize: '1.5rem', fontWeight: 800, color: '#dc2626' }}>{stats.errors}</p>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <button className="btn btn-secondary" onClick={clearParseSession}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setStep(3)} disabled={stats.valid === 0 && stats.conflicts === 0}>
                Next: Verify Auto-Fields <ChevronDown size={16} />
              </button>
            </div>
          </div>

          {/* Static filter tabs */}
          <div style={s.statsTabs}>
            {[{ k: 'all', l: 'All' }, { k: 'valid', l: '✅ Valid' }, { k: 'conflict', l: '🔄 Conflict' }, { k: 'error', l: '❌ Error' }].map(t => (
              <button key={t.k} onClick={() => setFilter(t.k)} style={{ ...s.tabBtn, ...(filter === t.k ? { borderBottom: `3px solid #3b82f6`, color: '#3b82f6' } : {}) }}>{t.l}</button>
            ))}
          </div>

          {/* Scrollable data table */}
          <div className="fn-scroll-table" style={s.scrollBox}>
            <table style={s.table}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={s.th}>Row</th>
                  <th style={s.th}>Status</th>
                  <th style={{ ...s.th, minWidth: '150px' }}>Error Details</th>
                  {COLS_STEP1.map(c => <th key={c} style={s.th}>{c.replace(/_/g, ' ')}</th>)}
                </tr>
              </thead>
              <tbody>{display.slice(0, displayLimit).map((row, vi) => {
                const ri = rows.indexOf(row);
                const errorStr = (row._errors || []).map(e => e.msg).join('; ');
                return (
                  <tr key={vi}>
                    <td style={s.td}><small>{row._rowId}</small></td>
                    <td style={s.td}>
                      <span style={{ 
                        ...s.badge, 
                        background: row._status === 'valid' ? '#dcfce7' : row._status === 'conflict' ? '#ede9fe' : '#fee2e2',
                        color: row._status === 'valid' ? '#16a34a' : row._status === 'conflict' ? '#7c3aed' : '#dc2626'
                      }}>
                        {row._status.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ ...s.td, color: '#dc2626', fontSize: '0.8rem', fontWeight: 500 }}>
                      {errorStr}
                    </td>
                    {COLS_STEP1.map(c => (
                      <td key={c} style={{ ...s.td, padding: 0, minWidth: '140px' }}>
                        <EditableCell 
                          value={row[c]} 
                          field={c} 
                          rowStatus={row._status} 
                          errors={row._errors}
                          options={c === 'number_status' ? ['available', 'reserved', 'sold'] : c === 'category' ? ['1', '2', '3', '4'] : c === 'visibility_status' ? ['1', '0'] : null}
                          onChange={(f, v) => updateCell(ri, f, v)} 
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}</tbody>
            </table>
          </div>

          {/* Static bottom info */}
          {display.length > displayLimit && (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Showing {displayLimit} of {display.length} rows.
              <button onClick={() => setDisplayLimit(p => p + 500)} style={{ marginLeft: '8px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Load more</button>
            </div>
          )}
        </div>
      )}

      {step === 3 && (
        <div style={s.card}>
          {/* Static header + nav */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fffbeb', padding: '16px', borderRadius: '12px', border: '1px solid #fde68a', marginBottom: '20px' }}>
            <div>
              <h2 style={{ margin: 0, color: '#854d0e', fontSize: '1.1rem' }}>Step 3: Review Auto-Generated Fields</h2>
              <p style={{ color: '#92400e', fontSize: '0.85rem', margin: '4px 0 0 0' }}>Verify patterns, scoring, and categories. Grayed columns are locked from Step 2.</p>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back to Preview</button>
              <button className="btn btn-primary" onClick={() => setStep(4)}>Next: Final Summary →</button>
            </div>
          </div>

          {/* Scrollable data table */}
          <div className="fn-scroll-table" style={s.scrollBox}>
            <table style={s.table}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                <tr>
                  <th style={s.th}>Mobile</th>
                  {COLS_STEP1.slice(1, 4).map(c => <th key={c} style={{ ...s.th, opacity: 0.5 }}>{c.replace(/_/g, ' ')}</th>)}
                  {COLS_STEP2.map(c => <th key={c} style={{ ...s.th, background: '#fff7ed', color: '#c2410c' }}>{c.replace(/_/g, ' ')}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => r._status === 'valid' || r._status === 'conflict').slice(0, displayLimit3).map((row, i) => {
                  const ri = rows.indexOf(row);
                  return (
                    <tr key={i}>
                      <td style={{ ...s.td, fontWeight: 700 }}>{row.mobile_number}</td>
                      {COLS_STEP1.slice(1, 4).map(c => (
                        <td key={c} style={{ ...s.td, opacity: 0.5, background: '#f8fafc' }}>
                          <span title="Go to Step 2 to edit this field">{String(row[c] ?? '')}</span>
                        </td>
                      ))}
                      {COLS_STEP2.map(c => (
                        <td key={c} style={{ ...s.td, padding: 0 }}>
                          <EditableCell 
                            value={String(row[c] ?? '')} 
                            field={c} 
                            rowStatus={row._status}
                            options={c === 'pattern_type' ? PATTERN_TYPES : c === 'auto_detected' ? ['1', '0'] : null}
                            onChange={(f, v) => {
                               updateCell(ri, f, v);
                               if (['pattern_type', 'vip_score'].includes(f)) {
                                 setRows(prev => {
                                   const updated = [...prev];
                                   updated[ri].auto_detected = 0;
                                   return updated;
                                 });
                               }
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {rows.filter(r => r._status === 'valid' || r._status === 'conflict').length > displayLimit3 && (
            <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
              Showing {displayLimit3} of {rows.filter(r => r._status === 'valid' || r._status === 'conflict').length} rows.
              <button onClick={() => setDisplayLimit3(p => p + 500)} style={{ marginLeft: '8px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Load more</button>
            </div>
          )}
        </div>
      )}

      {step === 4 && (() => {
        const importable = rows.filter(r => r._status === 'valid' || r._status === 'conflict');
        const cpls = importable.filter(r => r.couple_id || String(r.number_category) === '7');
        const grps = importable.filter(r => r.group_id || String(r.number_category) === '8');
        const cCount = cpls.length;
        const gCount = grps.length;
        
        // Count unique explicit IDs, or fallback to math approximation if categories were forced manually
        const cUnique = new Set(cpls.map(r => r.couple_id).filter(Boolean)).size || (cCount > 0 ? Math.ceil(cCount/2) : 0);
        const gUnique = new Set(grps.map(r => r.group_id).filter(Boolean)).size || (gCount > 0 ? Math.ceil(gCount/5) : 0);

        return (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
            <h2>Confirm Import</h2>
            <div style={{ display: 'flex', gap: '12px' }}><button onClick={clearParseSession} style={s.outlineBtn}>Cancel</button><button onClick={() => { if (!operatorName) setOperatorName(localStorage.getItem('ag_admin_username') || ''); setShowConfirmModal(true); }} style={s.primaryBtn}>Proceed →</button></div>
          </div>
          <div style={{...s.summaryGrid, gridTemplateColumns: '1fr 1fr 1fr 1fr'}}>
            <div style={s.summaryCard}><p>Total Valid Rows</p><h3>{stats.valid}</h3></div>
            <div style={s.summaryCard}><p>Conflicts (Overwrite)</p><h3>{stats.conflicts}</h3></div>
            <div style={s.summaryCard}><p>Couple Numbers</p><h3>{cCount} <span style={{fontSize:'0.6em', opacity:0.8}}>({cUnique} couples)</span></h3></div>
            <div style={s.summaryCard}><p>Group Numbers</p><h3>{gCount} <span style={{fontSize:'0.6em', opacity:0.8}}>({gUnique} groups)</span></h3></div>
          </div>
        </div>
        );
      })()}

      {showConfirmModal && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ width: '450px', padding: '32px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
              <h2 style={{ margin: '0 0 8px 0' }}>Ready to Import</h2>
              <p style={{ color: 'var(--text-secondary)' }}>Choose where you want to push these numbers.</p>
            </div>
            
            <div style={{ display: 'flex', gap: '16px', marginBottom: '32px' }}>
              <div 
                onClick={() => setImportDestination('store')}
                style={{ 
                  flex: 1, padding: '20px', borderRadius: '12px', border: '2px solid', 
                  borderColor: importDestination === 'store' ? 'var(--primary)' : 'var(--border)',
                  background: importDestination === 'store' ? 'var(--primary-light)' : 'transparent',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                }}
              >
                <Check size={24} style={{ color: importDestination === 'store' ? 'var(--primary)' : '#ccc', marginBottom: '8px' }} />
                <div style={{ fontWeight: 700 }}>Live Store</div>
              </div>
              
              <div 
                onClick={() => setImportDestination('draft')}
                style={{ 
                  flex: 1, padding: '20px', borderRadius: '12px', border: '2px solid', 
                  borderColor: importDestination === 'draft' ? 'var(--warning)' : 'var(--border)',
                  background: importDestination === 'draft' ? 'rgba(186, 117, 23, 0.1)' : 'transparent',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                }}
              >
                <Archive size={24} style={{ color: importDestination === 'draft' ? 'var(--warning)' : '#ccc', marginBottom: '8px' }} />
                <div style={{ fontWeight: 700 }}>Draft Numbers</div>
              </div>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#374151', display: 'block', marginBottom: '6px' }}>
                Operator Name *
              </label>
              <input
                type="text"
                className="input"
                placeholder="Enter your name..."
                value={operatorName}
                onChange={(e) => setOperatorName(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirmModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport} disabled={!operatorName.trim()}>Confirm & Start</button>
            </div>
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
  scrollBox: { overflow: 'auto', maxHeight: '60vh', border: '1px solid #e2e8f0', borderRadius: '12px', background: '#fff' },
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
