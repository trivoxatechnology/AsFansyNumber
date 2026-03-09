import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import {
  UploadCloud, CheckCircle, ChevronDown, ChevronUp,
  Download, RefreshCw, Check, X, Info, Trash2
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────────
const NUMBER_TYPES = ['1','2','3','4','5'];
const CATEGORIES   = ['vip','premium','lucky','sequential','mirror','repeating','general'];
const STATUSES     = ['available','reserved','sold','deleted'];

// ─── Pattern detection ─────────────────────────────────────────────────────────
function detectPattern(mobile) {
  const m = String(mobile).replace(/\D/g,'');
  if (m.length !== 10) return { prefix:'', suffix:'', digit_sum:0, repeat_count:0, pattern_value:'general', auto_category:'general' };
  const prefix = m.slice(0,5), suffix = m.slice(5);
  const digit_sum = m.split('').reduce((s,c)=>s+parseInt(c),0);
  let maxRun=1,run=1;
  for(let i=1;i<m.length;i++){if(m[i]===m[i-1])run++;else run=1;maxRun=Math.max(maxRun,run);}
  const repeat_count=maxRun;
  let pattern_value='general',auto_category='general';
  if(repeat_count>=4){pattern_value='repeating';auto_category='vip';}
  else if(m===m.split('').reverse().join('')){pattern_value='mirror';auto_category='premium';}
  else if(m.includes('786')||m.includes('108')){pattern_value='lucky';auto_category='lucky';}
  else{
    let asc=true,dsc=true;
    for(let i=1;i<m.length;i++){if(+m[i]!==+m[i-1]+1)asc=false;if(+m[i]!==+m[i-1]-1)dsc=false;}
    if(asc||dsc){pattern_value='sequential';auto_category='premium';}
    else{
      const half=m.slice(0,5);let abab=true;
      for(let i=0;i<10;i++)if(m[i]!==half[i%5]){abab=false;break;}
      if(abab){pattern_value='abab';auto_category='premium';}
    }
  }
  return {prefix,suffix,digit_sum,repeat_count,pattern_value,auto_category};
}

// ─── Determine operation from row ──────────────────────────────────────────────
// Returns: 'delete' | 'insert' | 'update'
function getOperation(row, existingSet) {
  const status = String(row.number_status||'').toLowerCase().trim();
  if (status === 'deleted') return 'delete';
  const mobile = String(row.mobile_number||'').replace(/\D/g,'');
  return existingSet.has(mobile) ? 'update' : 'insert';
}

// ─── Validate row ──────────────────────────────────────────────────────────────
function validateRow(row, idx, existingSet) {
  const errors = [];
  const mobile = String(row.mobile_number||'').replace(/\D/g,'');
  const status = String(row.number_status||'available').toLowerCase().trim();
  const isDelete = status === 'deleted';

  // Mobile always required
  if (!mobile)           errors.push({field:'mobile_number', msg:'Mobile number is required'});
  else if (mobile.length!==10) errors.push({field:'mobile_number', msg:'Must be exactly 10 digits'});

  // For non-delete rows, base_price required
  if (!isDelete) {
    const bp = parseFloat(row.base_price||0);
    if (!row.base_price)      errors.push({field:'base_price', msg:'Base price is required'});
    else if (isNaN(bp)||bp<=0) errors.push({field:'base_price', msg:'Must be a positive number'});
    const op = parseFloat(row.offer_price||0);
    if (op && op > bp) errors.push({field:'offer_price', msg:'Offer price cannot exceed base price'});
    const os = row.offer_start_date ? new Date(row.offer_start_date) : null;
    const oe = row.offer_end_date   ? new Date(row.offer_end_date)   : null;
    if (os&&oe&&oe<os) errors.push({field:'offer_end_date', msg:'End date must be after start date'});
  }

  const inFileDupe = false; // set externally
  const inDbDupe   = mobile && existingSet.has(mobile);
  const operation  = getOperation(row, existingSet);

  const pattern = detectPattern(mobile);

  let _status = 'valid';
  if (errors.length > 0) _status = 'error';
  else if (!mobile || (!isDelete && !row.base_price)) _status = 'missing';

  return {
    _rowId: idx+2, _status, _errors: errors, _isDbDupe: inDbDupe,
    _operation: operation, // 'insert' | 'update' | 'delete'
    mobile_number: mobile || '',
    number_type: String(row.number_type||'1'),
    number_category: row.number_category || pattern.auto_category,
    base_price: row.base_price||'',
    offer_price: row.offer_price||'',
    offer_start_date: row.offer_start_date||'',
    offer_end_date: row.offer_end_date||'',
    primary_incharge_name: row.primary_incharge_name||'',
    primary_incharge_phone: String(row.primary_incharge_phone||''),
    secondary_incharge_name: row.secondary_incharge_name||'',
    secondary_incharge_phone: String(row.secondary_incharge_phone||''),
    whatsapp_group_name: row.whatsapp_group_name||'',
    number_status: status||'available',
    remarks: row.remarks||'',
    ...pattern,
  };
}

// ─── Editable Cell ─────────────────────────────────────────────────────────────
function EditableCell({value, field, rowStatus, errors=[], onChange, options=null}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const hasErr = errors.some(e=>e.field===field);
  const border = hasErr ? '#ef4444' : rowStatus==='missing'&&!value ? '#f59e0b' : rowStatus==='valid' ? '#22c55e' : '#e2e8f0';
  const commit = () => { setEditing(false); onChange(field, local); };
  if (editing && options) return (
    <select autoFocus value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit}
      style={{...cs.input, border:`1.5px solid ${border}`}}>
      {options.map(o=><option key={o}>{o}</option>)}
    </select>
  );
  if (editing) return (
    <input autoFocus value={local} onChange={e=>setLocal(e.target.value)} onBlur={commit}
      onKeyDown={e=>{if(e.key==='Enter')commit();if(e.key==='Escape')setEditing(false);}}
      style={{...cs.input, border:`1.5px solid ${border}`}} />
  );
  return (
    <div onClick={()=>{setLocal(value);setEditing(true);}}
      title={hasErr?errors.find(e=>e.field===field)?.msg:''}
      style={{...cs.cell, borderLeft:`3px solid ${border}`,
        background:hasErr?'#fff5f5':rowStatus==='missing'&&!value?'#fffbeb':'transparent', cursor:'cell'}}>
      {value||<span style={{color:'#ccc',fontSize:'0.73rem'}}>click to edit</span>}
    </div>
  );
}

// ─── Operation Badge ───────────────────────────────────────────────────────────
const OP_STYLES = {
  insert:  {bg:'#dcfce7', color:'#16a34a', label:'➕ INSERT'},
  update:  {bg:'#dbeafe', color:'#1d4ed8', label:'✏️ UPDATE'},
  delete:  {bg:'#fee2e2', color:'#dc2626', label:'🗑 DELETE'},
};
const STATUS_STYLES = {
  valid:     {bg:'#dcfce7', color:'#16a34a'},
  missing:   {bg:'#fef9c3', color:'#a16207'},
  error:     {bg:'#fee2e2', color:'#dc2626'},
  duplicate: {bg:'#ede9fe', color:'#7c3aed'},
};

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function ImportWorkspace() {
  const [step, setStep]           = useState(1);
  const [rows, setRows]           = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState('');
  const [displayLimit, setDisplayLimit] = useState(500);
  const [filter, setFilter]       = useState('all');
  const [opFilter, setOpFilter]   = useState('all');
  const [sortCol, setSortCol]     = useState(null);
  const [sortDir, setSortDir]     = useState('asc');
  const [selected, setSelected]   = useState([]);
  const [bulkField, setBulkField] = useState('');
  const [bulkValue, setBulkValue] = useState('');
  const [importing, setImporting] = useState(false);
  const [operatorName, setOperatorName] = useState(localStorage.getItem('adminUsername') || '');
  const [done, setDone]           = useState(false);
  const [log, setLog]             = useState(null);
  const fileName = useRef('');

  // ── Parse ────────────────────────────────────────────────────────────────────
  const onDrop = useCallback(async (files) => {
    const file = files[0]; if (!file) return;
    fileName.current = file.name;
    setIsParsing(true);
    setParseProgress('Reading file...');
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      setParseProgress('Extracting spreadsheet data...');
      // Yield to let React render progress
      await new Promise(r=>setTimeout(r,50));
      const wb  = XLSX.read(data, {type:'array', cellDates:true});
      const ws  = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws, {defval:''});
      
      // Normalize human-readable headers to db_keys (e.g., "Mobile Number" -> "mobile_number")
      const json = rawJson.map(row => {
        const norm = {};
        for (let key in row) {
          let safeKey = key.trim().toLowerCase().replace(/[\s\-\.]+/g, '_');
          if (['mobile_no','phone','contact','number'].includes(safeKey)) safeKey = 'mobile_number';
          if (['price','selling_price'].includes(safeKey)) safeKey = 'base_price';
          norm[safeKey] = row[key];
        }
        return norm;
      });

      setParseProgress('Fetching existing inventory from database...');
      // Fetch existing mobiles from DB
      let existingSet = new Set();
      try {
        const res = await fetch('https://asfancynumber.com/fancy_number/api.php/wp_fn_numbers?limit=600000&fields=mobile_number');
        if (res.ok) { const d=await res.json(); if(Array.isArray(d)) d.forEach(r=>existingSet.add(String(r.mobile_number))); }
      } catch {}

      setParseProgress('Checking for duplicates in file...');
      await new Promise(r=>setTimeout(r,50));
      // Detect in-file dupes
      const seen = {};
      const validRows = json.filter(r=>r.mobile_number||r.base_price);
      validRows.forEach((r,i)=>{const m=String(r.mobile_number||'').replace(/\D/g,'');if(m){seen[m]=seen[m]||[];seen[m].push(i);}});

      setParseProgress(`Validating ${validRows.length.toLocaleString()} rows...`);
      // Chunk processing to prevent UI freeze
      const parsed = [];
      const CHUNK = 5000;
      for (let i = 0; i < validRows.length; i += CHUNK) {
        setParseProgress(`Validating rows ${i.toLocaleString()} to ${Math.min(i+CHUNK, validRows.length).toLocaleString()}...`);
        await new Promise(r=>setTimeout(r,0)); // yield
        
        const chunk = validRows.slice(i, i+CHUNK);
        for (let j = 0; j < chunk.length; j++) {
          const r = chunk[j];
          const globalIdx = i + j;
          const v = validateRow(r, globalIdx, existingSet);
          const m = String(r.mobile_number||'').replace(/\D/g,'');
          if (m && seen[m]?.length > 1 && seen[m][0] !== globalIdx) v._status = 'duplicate';
          parsed.push(v);
        }
      }

      setParseProgress('Finalising...');
      await new Promise(r=>setTimeout(r,50));
      setRows(parsed); setStep(2);
    } catch(e) { alert('Parse failed: ' + e.message); }
    finally { setIsParsing(false); setParseProgress(''); }
  }, []);

  const {getRootProps, getInputProps, isDragActive} = useDropzone({
    onDrop, 
    multiple:false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    }
  });

  // ── Cell update ──────────────────────────────────────────────────────────────
  const updateCell = (ri, field, value) => {
    setRows(prev => {
      const updated = [...prev];
      const row = {...updated[ri], [field]: value};
      if (field==='mobile_number') Object.assign(row, detectPattern(value));
      // Re-validate
      const errs=[];
      const m=String(row.mobile_number||'').replace(/\D/g,'');
      const isDel=String(row.number_status||'').toLowerCase()==='deleted';
      if(!m) errs.push({field:'mobile_number',msg:'Required'});
      else if(m.length!==10) errs.push({field:'mobile_number',msg:'10 digits required'});
      if(!isDel){
        if(!row.base_price) errs.push({field:'base_price',msg:'Required'});
        if(parseFloat(row.offer_price||0)>parseFloat(row.base_price||0)) errs.push({field:'offer_price',msg:'Offer > base price'});
      }
      row._errors=errs;
      row._status = errs.length>0 ? 'error' : (!m||(!isDel&&!row.base_price)) ? 'missing' : row._isDbDupe ? 'duplicate' : 'valid';
      // Recalculate operation
      const existingSet = new Set(rows.filter(r=>r._isDbDupe).map(r=>r.mobile_number));
      row._operation = getOperation(row, existingSet);
      updated[ri]=row;
      return updated;
    });
  };

  // ── Sort ─────────────────────────────────────────────────────────────────────
  const toggleSort = col => {
    if(sortCol===col) setSortDir(d=>d==='asc'?'desc':'asc');
    else {setSortCol(col);setSortDir('asc');}
  };

  // ── Computed ─────────────────────────────────────────────────────────────────
  const stats = {
    total:     rows.length,
    valid:     rows.filter(r=>r._status==='valid').length,
    missing:   rows.filter(r=>r._status==='missing').length,
    error:     rows.filter(r=>r._status==='error').length,
    duplicate: rows.filter(r=>r._status==='duplicate').length,
    inserts:   rows.filter(r=>r._status==='valid' && r._operation==='insert').length,
    updates:   rows.filter(r=>r._status==='valid' && r._operation==='update').length,
    deletes:   rows.filter(r=>r._status==='valid' && r._operation==='delete').length,
  };

  let display = [...rows];
  if (filter !== 'all')   display = display.filter(r=>r._status===filter);
  if (opFilter !== 'all') display = display.filter(r=>r._operation===opFilter);
  if (sortCol) display.sort((a,b)=>{
    const av=String(a[sortCol]||''),bv=String(b[sortCol]||'');
    return sortDir==='asc'?av.localeCompare(bv):bv.localeCompare(av);
  });

  // ── Bulk edit ────────────────────────────────────────────────────────────────
  const applyBulk = () => {
    if (!bulkField||!bulkValue||selected.length===0) return;
    setRows(prev=>{const u=[...prev];selected.forEach(i=>{u[i]={...u[i],[bulkField]:bulkValue};});return u;});
    setSelected([]);setBulkField('');setBulkValue('');
  };

  // ── Download errors ──────────────────────────────────────────────────────────
  const downloadErrors = () => {
    const data = rows.filter(r=>r._status!=='valid').map(r=>({
      Row:r._rowId, Mobile:r.mobile_number, Status:r._status, Operation:r._operation,
      Errors:r._errors.map(e=>e.msg).join('; ')
    }));
    const ws=XLSX.utils.json_to_sheet(data);
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Errors');
    XLSX.writeFile(wb,'Import_Errors.xlsx');
  };

  // ── Template download ────────────────────────────────────────────────────────
  const downloadTemplate = () => {
    const cols = {mobile_number:'',number_type:'',number_category:'',base_price:'',offer_price:'',offer_start_date:'',offer_end_date:'',primary_incharge_name:'',primary_incharge_phone:'',secondary_incharge_name:'',secondary_incharge_phone:'',whatsapp_group_name:'',number_status:'available',remarks:''};
    const ws=XLSX.utils.json_to_sheet([cols]);
    ws['!cols']=Object.keys(cols).map(k=>({wch:k.length+4}));
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Template');
    XLSX.writeFile(wb,'FancyNumber_Inventory_Template.xlsx');
  };

  // ── Import ───────────────────────────────────────────────────────────────────
  const API = 'https://asfancynumber.com/fancy_number/api.php';
  const [importProgress, setImportProgress] = useState('');

  const handleImport = async () => {
    setImporting(true);
    const validRows = rows.filter(r => r._status === 'valid');
    const toInsert  = validRows.filter(r => r._operation === 'insert');
    const toUpdate  = validRows.filter(r => r._operation === 'update');
    const toDelete  = validRows.filter(r => r._operation === 'delete');

    let inserted=0, updated=0, deleted=0, failed=0;

    // Helper: strip private fields before sending to API
    const cleanRow = r => ({
      mobile_number:          r.mobile_number,
      number_type:            r.number_type,
      number_category:        r.number_category,
      base_price:             r.base_price,
      offer_price:            r.offer_price || null,
      offer_start_date:       r.offer_start_date || null,
      offer_end_date:         r.offer_end_date || null,
      primary_incharge_name:  r.primary_incharge_name,
      primary_incharge_phone: r.primary_incharge_phone,
      secondary_incharge_name:r.secondary_incharge_name,
      secondary_incharge_phone:r.secondary_incharge_phone,
      number_status:          r.number_status,
      remarks:                r.remarks,
      prefix:                 r.prefix,
      suffix:                 r.suffix,
      digit_sum:              r.digit_sum,
      repeat_count:           r.repeat_count,
      inventory_source:       fileName.current || 'Unknown',
    });

    // ── 1. INSERT in chunks of 5 (concurrently) ──────────────────────────────────────────────
    const CHUNK = 5;
    for (let i=0; i<toInsert.length; i+=CHUNK) {
      const chunk = toInsert.slice(i, i+CHUNK);
      setImportProgress(`Inserting rows ${i+1}–${Math.min(i+CHUNK, toInsert.length)} of ${toInsert.length}…`);
      try {
        const promises = chunk.map(row => 
          fetch(`${API}/wp_fn_numbers`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify(cleanRow(row)),
          }).then(res => res.ok ? 1 : 0).catch(() => 0)
        );
        const results = await Promise.all(promises);
        const successCount = results.reduce((sum, val) => sum + val, 0);
        inserted += successCount;
        failed += (chunk.length - successCount);
      } catch { failed += chunk.length; }
    }

    // ── 2. UPDATE one-by-one (or patch endpoint) ───────────────────────────────
    setImportProgress(`Updating ${toUpdate.length} existing numbers…`);
    for (const row of toUpdate) {
      try {
        const res = await fetch(`${API}/wp_fn_numbers?mobile_number=${row.mobile_number}`, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(cleanRow(row)),
        });
        if (res.ok) updated++; else failed++;
      } catch { failed++; }
    }

    // ── 3. SOFT DELETE ─────────────────────────────────────────────────────────
    setImportProgress(`Soft-deleting ${toDelete.length} numbers…`);
    for (const row of toDelete) {
      try {
        const res = await fetch(`${API}/wp_fn_numbers?mobile_number=${row.mobile_number}`, {
          method: 'PUT',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({number_status:'deleted'}),
        });
        if (res.ok) deleted++; else failed++;
      } catch { failed++; }
    }

    // ── 4. Write upload log to DB ──────────────────────────────────────────────
    setImportProgress('Saving upload log…');
    const finalOperator = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
    const dbLogEntry = {
      file_name:     `${fileName.current}|||${finalOperator}|||Inserted: ${inserted}, Updated: ${updated}, Deleted: ${deleted}`,
      uploaded_by:   finalOperator,
      total_records: validRows.length
    };
    try {
      await fetch(`${API}/wp_fn_upload_batches`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(dbLogEntry),
      });
    } catch {}

    setLog({
      file_name:        fileName.current,
      uploaded_by:      finalOperator,
      upload_time:      new Date().toLocaleString(),
      total_records:    validRows.length,
      records_inserted: inserted,
      records_updated:  updated,
      records_deleted:  deleted,
      records_failed:   failed,
      browser_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    setImportProgress('');
    setImporting(false);
    setDone(true);
  };


  // ── Grid columns ─────────────────────────────────────────────────────────────
  const COLS = ['mobile_number','number_type','number_category','base_price','offer_price','number_status','primary_incharge_name','whatsapp_group_name','remarks'];

  return (
    <div>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>

      {/* ─── Step indicator ─── */}
      <div style={s.stepBar}>
        {['Upload File','Preview & Edit','Review Auto-Fields','Confirm & Import'].map((l,i)=>(
          <div key={i} style={{...s.step,...(step===i+1?s.stepActive:{}),...(step>i+1?s.stepDone:{})}}>
            <div style={s.stepCircle}>{step>i+1?<Check size={12}/>:i+1}</div>
            <span style={s.stepLabel}>{l}</span>
            {i<3&&<div style={{...s.stepLine,...(step>i+1?{background:'var(--neon-green-dark)'}:{})}}/>}
          </div>
        ))}
      </div>

      {/* ─── STEP 1: Upload ─── */}
      {step===1 && (
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'20px'}}>
            <div>
              <h2 style={s.cardTitle}>Inventory Excel Upload</h2>
              <p style={s.cardSubtitle}>One template handles everything — add, update, and delete numbers via the same file</p>
            </div>
            <button onClick={downloadTemplate} style={s.outlineBtn}><Download size={16}/> Download Template</button>
          </div>

          {/* How it works banner */}
          <div style={s.infoBanner}>
            <Info size={16} style={{flexShrink:0,color:'#3b82f6'}}/>
            <div style={{fontSize:'0.85rem'}}>
              <b>How operations work:</b> The <code style={s.code}>number_status</code> column controls the operation.
              Set it to <code style={s.code}>available / reserved / sold</code> → insert or update.
              Set it to <code style={s.code}>deleted</code> → soft-delete the number.
            </div>
          </div>

          <div {...getRootProps()} style={{...s.dropzone,...(isDragActive?s.dropActive:{})}}>
            <input {...getInputProps()}/>
            <UploadCloud size={48} style={{color:isDragActive?'var(--neon-green-dark)':'#94a3b8',marginBottom:'14px'}}/>
            <p style={{fontWeight:700,fontSize:'1.1rem',marginBottom:'6px'}}>
              {isDragActive?'Drop here to upload':'Drag & Drop or Click to Upload'}
            </p>
            <p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Supported formats: .xlsx, .xls, .csv · up to 500,000 rows</p>
          </div>

          {isParsing && (
            <div style={s.parsingBox}>
              <RefreshCw size={24} style={{animation:'spin 1s linear infinite',color:'var(--neon-green-dark)'}}/>
              <div>
                <p style={{fontWeight:800,marginBottom:'4px',fontSize:'1.05rem',color:'var(--text-main)'}}>Processing File</p>
                <p style={{fontSize:'0.9rem',color:'#0369a1',fontWeight:600}}>{parseProgress}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── STEP 2: Grid ─── */}
      {step===2 && (
        <div>
          {/* Operation summary strip with Top Navigation & Cancel */}
          <div style={s.opStrip}>
            {[
              {label:'➕ Insert', val:stats.inserts, color:'#16a34a', key:'insert'},
              {label:'✏️ Update', val:stats.updates, color:'#1d4ed8', key:'update'},
              {label:'🗑 Delete', val:stats.deletes, color:'#dc2626', key:'delete'},
              {label:'❌ Errors', val:stats.error,   color:'#b91c1c', key:null},
            ].map(it=>(
              <div key={it.label} style={{...s.opCard, ...(opFilter===it.key&&it.key?{outline:'2px solid '+it.color}:{})}}
                onClick={()=>it.key&&setOpFilter(p=>p===it.key?'all':it.key)}>
                <p style={{fontSize:'0.78rem',fontWeight:700,color:'var(--text-muted)'}}>{it.label}</p>
                <p style={{fontSize:'1.8rem',fontWeight:900,color:it.color,margin:'2px 0'}}>{it.val}</p>
              </div>
            ))}
            <div style={{marginLeft:'auto',display:'flex',gap:'12px',alignItems:'center'}}>
              <button onClick={()=>{setStep(1);setRows([]);setDisplayLimit(500);}} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca'}}>
                <X size={16}/> Cancel
              </button>
              {stats.error+stats.missing>0&&<button onClick={downloadErrors} style={s.smBtn}><Download size={14}/> Errors</button>}
              <button onClick={()=>setStep(3)} style={s.primaryBtn} disabled={stats.inserts+stats.updates+stats.deletes===0}>
                Next Step →
              </button>
            </div>
          </div>

          {/* Validation filter tabs */}
          <div style={s.statsTabs}>
            {[
              {key:'all',    label:`All (${stats.total})`,          color:'#64748b'},
              {key:'valid',  label:`✅ Valid (${stats.valid})`,      color:'#22c55e'},
              {key:'missing',label:`⚠️ Missing (${stats.missing})`, color:'#f59e0b'},
              {key:'error',  label:`❌ Error (${stats.error})`,      color:'#ef4444'},
              {key:'duplicate',label:`🔁 Dupe (${stats.duplicate})`,color:'#8b5cf6'},
            ].map(t=>(
              <button key={t.key} onClick={()=>setFilter(t.key)}
                style={{...s.tabBtn,...(filter===t.key?{borderBottom:`3px solid ${t.color}`,color:t.color,fontWeight:800}:{})}}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Bulk edit bar */}
          {selected.length>0&&(
            <div style={s.bulkBar}>
              <span style={{fontWeight:700,color:'#0369a1'}}>{selected.length} selected</span>
              <select value={bulkField} onChange={e=>setBulkField(e.target.value)} style={s.smSel}>
                <option value=''>-- Field --</option>
                <option value='number_category'>Category</option>
                <option value='number_status'>Status / Operation</option>
                <option value='number_type'>Type</option>
                <option value='whatsapp_group_name'>WhatsApp Group</option>
                <option value='primary_incharge_name'>Incharge Name</option>
              </select>
              {bulkField==='number_category'&&(
                <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)} style={s.smSel}>
                  <option value=''>--</option>{CATEGORIES.map(c=><option key={c}>{c}</option>)}
                </select>
              )}
              {bulkField==='number_status'&&(
                <select value={bulkValue} onChange={e=>setBulkValue(e.target.value)} style={s.smSel}>
                  <option value=''>--</option>{STATUSES.map(c=><option key={c}>{c}</option>)}
                </select>
              )}
              {!['number_category','number_status'].includes(bulkField)&&bulkField&&(
                <input value={bulkValue} onChange={e=>setBulkValue(e.target.value)} placeholder='Value…' style={s.smInp}/>
              )}
              <button onClick={applyBulk} style={s.primaryBtn}>Apply</button>
              <button onClick={()=>setSelected([])} style={s.smBtn}><X size={14}/></button>
            </div>
          )}

          {/* Grid */}
          <div style={s.gridWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>
                    <input type='checkbox' onChange={e=>setSelected(e.target.checked?display.map((_,i)=>rows.indexOf(display[i])):[])}/>
                  </th>
                  <th style={s.th}>Row</th>
                  <th style={s.th}>Operation</th>
                  <th style={s.th}>Valid</th>
                  {COLS.map(col=>(
                    <th key={col} style={{...s.th,cursor:'pointer'}} onClick={()=>toggleSort(col)}>
                      {col.replace(/_/g,' ')}
                      {sortCol===col?(sortDir==='asc'?<ChevronUp size={11}/>:<ChevronDown size={11}/>):null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {display.slice(0, displayLimit).map((row,vi)=>{
                  const ri=rows.indexOf(row);
                  const op=OP_STYLES[row._operation]||OP_STYLES.insert;
                  const vs=STATUS_STYLES[row._status]||STATUS_STYLES.valid;
                  const isDelRow=row._operation==='delete';
                  return (
                    <tr key={vi} style={{
                      background:selected.includes(ri)?'#f0fdf4':isDelRow?'#fff5f5':'transparent',
                      opacity:isDelRow?0.75:1,
                    }}>
                      <td style={s.td}><input type='checkbox' checked={selected.includes(ri)} onChange={e=>setSelected(p=>e.target.checked?[...p,ri]:p.filter(x=>x!==ri))}/></td>
                      <td style={s.td}><small style={{color:'var(--text-muted)'}}>{row._rowId}</small></td>
                      <td style={s.td}>
                        <span style={{...s.badge,background:op.bg,color:op.color}}>{op.label}</span>
                      </td>
                      <td style={s.td}>
                        <span style={{...s.badge,background:vs.bg,color:vs.color}}>{row._status}</span>
                      </td>
                      {COLS.map(col=>{
                        const opts=col==='number_type'?NUMBER_TYPES:col==='number_category'?CATEGORIES:col==='number_status'?STATUSES:null;
                        return (
                          <td key={col} style={{...s.td,padding:0,minWidth:'140px'}}>
                            <EditableCell value={row[col]} field={col} rowStatus={row._status} errors={row._errors}
                              onChange={(f,v)=>updateCell(ri,f,v)} options={opts}/>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', padding:'16px', background:'#f8fafc', borderBottomLeftRadius:'var(--radius-md)', borderBottomRightRadius:'var(--radius-md)', border:'1px solid var(--border-color)', borderTop:'none'}}>
            <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight:600}}>
              Showing {Math.min(displayLimit, display.length).toLocaleString()} of {display.length.toLocaleString()} rows
            </span>
            {display.length > displayLimit && (
              <button onClick={()=>setDisplayLimit(p=>p+500)} style={s.outlineBtn}>
                Load Next 500 Rows
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── STEP 3: Auto-fields review ─── */}
      {step===3&&(
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
            <div>
              <h2 style={s.cardTitle}>Auto-Generated Fields Preview</h2>
              <p style={s.cardSubtitle}>Calculated from each mobile number. Override category below if needed.</p>
            </div>
            <div style={{display:'flex',gap:'12px'}}>
              <button onClick={()=>setStep(2)} style={s.outlineBtn}>← Back</button>
              <button onClick={()=>setStep(4)} style={s.primaryBtn}>Next Step →</button>
            </div>
          </div>
          
          <div style={s.gridWrap}>
            <table style={s.table}>
              <thead>
                <tr>{['Mobile','Op','Prefix','Suffix','Digit Sum','Rept. Count','Pattern','Category (editable)'].map(h=><th key={h} style={s.th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.filter(r=>r._status==='valid'&&r._operation!=='delete').slice(0,200).map((row,i)=>(
                  <tr key={i}>
                    <td style={{...s.td,padding:'8px 14px'}}><b>{row.mobile_number}</b></td>
                    <td style={s.td}><span style={{...s.badge,...(row._operation==='update'?{background:'#dbeafe',color:'#1d4ed8'}:{background:'#dcfce7',color:'#16a34a'})}}>{row._operation}</span></td>
                    <td style={{...s.td,padding:'8px 14px'}}>{row.prefix}</td>
                    <td style={{...s.td,padding:'8px 14px'}}>{row.suffix}</td>
                    <td style={{...s.td,padding:'8px 14px'}}>{row.digit_sum}</td>
                    <td style={{...s.td,padding:'8px 14px'}}>{row.repeat_count}</td>
                    <td style={{...s.td,padding:'8px 14px'}}><span style={s.tag}>{row.pattern_value}</span></td>
                    <td style={{...s.td,padding:0}}>
                      <EditableCell value={row.number_category} field='number_category' rowStatus='valid' errors={[]}
                        onChange={(f,v)=>updateCell(rows.indexOf(row),f,v)} options={CATEGORIES}/>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── STEP 4: Confirm ─── */}
      {step===4&&!done&&(
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'20px'}}>
            <div>
              <h2 style={s.cardTitle}>Confirm Import</h2>
              <p style={s.cardSubtitle}>All operations below will be committed when you click Confirm.</p>
            </div>
            <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
              <button onClick={()=>{setStep(1);setRows([]);setDone(false);setLog(null);setDisplayLimit(500);}} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca'}} disabled={importing}>✕ Cancel</button>
              <button onClick={()=>setStep(3)} style={s.outlineBtn} disabled={importing}>← Back</button>
              <button onClick={handleImport} style={s.primaryBtn} disabled={importing}>
                {importing
                  ? <><RefreshCw size={16} style={{animation:'spin 1s linear infinite'}}/> {importProgress || 'Importing…'}</>
                  : <><Check size={16}/> Confirm &amp; Import</>}
              </button>
            </div>
          </div>

          <div style={s.summaryGrid}>
            {[
              {label:'➕ Rows to Insert', val:stats.inserts, color:'#16a34a'},
              {label:'✏️ Rows to Update', val:stats.updates, color:'#1d4ed8'},
              {label:'🗑 Rows to Delete', val:stats.deletes, color:'#dc2626'},
              {label:'❌ Rows Skipped',   val:stats.error,   color:'#b91c1c'},
            ].map(it=>(
              <div key={it.label} style={s.summaryCard}>
                <p style={{color:'var(--text-muted)',fontSize:'0.78rem',fontWeight:700,textTransform:'uppercase'}}>{it.label}</p>
                <h3 style={{fontSize:'2.2rem',fontWeight:900,color:it.color,margin:'4px 0'}}>{it.val}</h3>
              </div>
            ))}
          </div>

          {stats.deletes>0&&(
            <div style={{...s.infoBanner,background:'#fff5f5',border:'1px solid #fecaca',marginBottom:'16px'}}>
              <Trash2 size={16} style={{flexShrink:0,color:'#dc2626'}}/>
              <div style={{fontSize:'0.85rem',color:'#dc2626'}}>
                <b>{stats.deletes} numbers</b> will be soft-deleted (status set to <code style={s.code}>deleted</code>). They will be hidden from the frontend and automation listings.
              </div>
            </div>
          )}

          <div style={s.metaBox}>
            <p style={{fontWeight:700,marginBottom:'10px',fontSize:'0.9rem'}}>Import Details</p>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',fontSize:'0.84rem',color:'var(--text-muted)'}}>  
              <span>📁 <b>{fileName.current}</b></span>
              <span>🕐 Time: <b>{new Date().toLocaleString()}</b></span>
              <span>🌐 Zone: <b>{Intl.DateTimeFormat().resolvedOptions().timeZone}</b></span>
            </div>
            <div style={{marginTop:'16px'}}>
              <label style={{display:'block',fontSize:'0.85rem',fontWeight:700,marginBottom:'6px',color:'var(--text-main)'}}>👤 Admin Name (editable)</label>
              <input 
                type="text"
                value={operatorName}
                onChange={e => setOperatorName(e.target.value)}
                placeholder="e.g. John Doe"
                style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',maxWidth:'350px',outline:'none',fontSize:'0.9rem',fontWeight:600}}
              />
            </div>
          </div>
        </div>
      )}

      {/* ─── Done ─── */}
      {done&&log&&(
        <div style={{...s.card,textAlign:'center'}}>
          <CheckCircle size={54} style={{color:'var(--neon-green-dark)',marginBottom:'14px'}}/>
          <h2 style={{...s.cardTitle,marginBottom:'6px'}}>Import Complete!</h2>
          <p style={s.cardSubtitle}>{log.uploaded_by} · {log.upload_time}</p>
          <div style={s.summaryGrid}>
            <div style={s.summaryCard}><p style={{color:'var(--text-muted)',fontSize:'0.78rem',fontWeight:700}}>INSERTED</p><h3 style={{fontSize:'2rem',color:'#16a34a',fontWeight:900}}>{log.records_inserted}</h3></div>
            <div style={s.summaryCard}><p style={{color:'var(--text-muted)',fontSize:'0.78rem',fontWeight:700}}>UPDATED</p><h3 style={{fontSize:'2rem',color:'#1d4ed8',fontWeight:900}}>{log.records_updated}</h3></div>
            <div style={s.summaryCard}><p style={{color:'var(--text-muted)',fontSize:'0.78rem',fontWeight:700}}>DELETED</p><h3 style={{fontSize:'2rem',color:'#dc2626',fontWeight:900}}>{log.records_deleted}</h3></div>
            <div style={s.summaryCard}><p style={{color:'var(--text-muted)',fontSize:'0.78rem',fontWeight:700}}>FAILED</p><h3 style={{fontSize:'2rem',color:'#b91c1c',fontWeight:900}}>{log.records_failed}</h3></div>
          </div>
          <button onClick={()=>{setStep(1);setRows([]);setDone(false);setLog(null);setFilter('all');setOpFilter('all');setDisplayLimit(500);}}
            style={{...s.primaryBtn,margin:'20px auto 0'}}>
            Upload Another File
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const s = {
  stepBar:{display:'flex',alignItems:'center',marginBottom:'28px'},
  step:{display:'flex',alignItems:'center',gap:'8px',flex:1,opacity:0.4,transition:'opacity 0.3s'},
  stepActive:{opacity:1},stepDone:{opacity:0.7},
  stepCircle:{width:'27px',height:'27px',borderRadius:'50%',background:'var(--neon-green-dark)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'0.78rem',flexShrink:0},
  stepLabel:{fontSize:'0.82rem',fontWeight:700,color:'var(--text-main)',whiteSpace:'nowrap'},
  stepLine:{flex:1,height:'2px',background:'#e2e8f0',margin:'0 8px'},
  card:{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-color)',padding:'28px'},
  cardTitle:{fontSize:'1.2rem',fontWeight:800,color:'var(--text-main)',marginBottom:'4px'},
  cardSubtitle:{color:'var(--text-muted)',fontSize:'0.88rem',marginBottom:'20px'},
  infoBanner:{display:'flex',gap:'10px',alignItems:'flex-start',background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'var(--radius-md)',padding:'12px 16px',marginBottom:'20px'},
  code:{background:'rgba(0,0,0,0.06)',borderRadius:'4px',padding:'1px 5px',fontFamily:'monospace',fontSize:'0.82rem'},
  dropzone:{border:'2px dashed var(--border-color)',borderRadius:'var(--radius-lg)',padding:'54px 24px',textAlign:'center',cursor:'pointer',background:'#fafafa',transition:'all 0.2s'},
  dropActive:{borderColor:'var(--neon-green-dark)',background:'rgba(122,194,0,0.04)'},
  parsingBox:{display:'flex',alignItems:'center',gap:'14px',marginTop:'18px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'var(--radius-md)',padding:'14px 18px'},
  opStrip:{display:'flex',alignItems:'center',gap:'12px',marginBottom:'12px',flexWrap:'wrap'},
  opCard:{background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',padding:'12px 20px',cursor:'pointer',minWidth:'110px',transition:'outline 0.15s'},
  statsTabs:{display:'flex',alignItems:'center',borderBottom:'1px solid var(--border-color)',marginBottom:'14px',overflowX:'auto'},
  tabBtn:{padding:'9px 16px',background:'none',border:'none',cursor:'pointer',fontWeight:600,fontSize:'0.84rem',color:'var(--text-muted)',borderBottom:'3px solid transparent',transition:'all 0.2s',whiteSpace:'nowrap'},
  bulkBar:{display:'flex',alignItems:'center',gap:'10px',background:'#e0f2fe',padding:'10px 16px',borderRadius:'var(--radius-md)',marginBottom:'10px',flexWrap:'wrap'},
  gridWrap:{overflowX:'auto',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:'0.86rem'},
  th:{background:'#f8fafc',padding:'9px 13px',borderBottom:'1px solid var(--border-color)',color:'var(--text-muted)',fontWeight:700,fontSize:'0.76rem',textTransform:'uppercase',whiteSpace:'nowrap',textAlign:'left'},
  td:{padding:'0',borderBottom:'1px solid #f1f5f9',verticalAlign:'middle'},
  badge:{padding:'2px 9px',borderRadius:'20px',fontSize:'0.74rem',fontWeight:700},
  tag:{padding:'2px 7px',borderRadius:'4px',fontSize:'0.74rem',background:'#f1f5f9',color:'var(--text-muted)',fontWeight:600},
  summaryGrid:{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',margin:'18px 0'},
  summaryCard:{background:'#f8fafc',padding:'18px',borderRadius:'var(--radius-md)',border:'1px solid var(--border-color)',textAlign:'center'},
  metaBox:{background:'#f8fafc',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',padding:'18px'},
  primaryBtn:{padding:'9px 18px',background:'var(--neon-green-dark)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:'8px',whiteSpace:'nowrap'},
  outlineBtn:{padding:'9px 16px',background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:'8px'},
  smBtn:{padding:'7px 11px',background:'#f1f5f9',color:'var(--text-muted)',border:'1px solid var(--border-color)',borderRadius:'6px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem',display:'flex',alignItems:'center',gap:'6px'},
  smSel:{padding:'6px 9px',border:'1px solid var(--border-color)',borderRadius:'6px',fontSize:'0.84rem',outline:'none',background:'#fff'},
  smInp:{padding:'6px 9px',border:'1px solid var(--border-color)',borderRadius:'6px',fontSize:'0.84rem',outline:'none',width:'130px'},
};
const cs = {
  cell:{padding:'8px 11px',minHeight:'36px',fontSize:'0.84rem',display:'flex',alignItems:'center'},
  input:{width:'100%',padding:'7px 9px',outline:'none',border:'1.5px solid #e2e8f0',borderRadius:'4px',fontSize:'0.84rem',background:'#fff'},
};
