import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { UploadCloud, Download, RefreshCw, Check, AlertCircle, CheckCircle } from 'lucide-react';

const REQUIRED = ['mobile_number','offer_price'];

function validateOfferRow(row, idx) {
  const errors = [];
  const mobile = String(row.mobile_number||'').replace(/\D/g,'');
  const offerPrice = parseFloat(row.offer_price||0);
  const offerStart = row.offer_start_date ? new Date(row.offer_start_date) : null;
  const offerEnd   = row.offer_end_date   ? new Date(row.offer_end_date)   : null;

  if (!mobile || mobile.length!==10) errors.push('Invalid mobile number');
  if (isNaN(offerPrice)||offerPrice<=0) errors.push('Invalid offer price');
  if (offerStart&&offerEnd&&offerEnd<offerStart) errors.push('End date before start date');

  return {
    _rowId: idx+2,
    _errors: errors,
    _status: errors.length ? 'error' : 'valid',
    mobile_number: mobile || String(row.mobile_number||''),
    offer_price: row.offer_price||'',
    offer_start_date: row.offer_start_date||'',
    offer_end_date: row.offer_end_date||'',
  };
}

export default function OfferUpload() {
  const [rows, setRows] = useState([]);
  const [step, setStep] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [operatorName, setOperatorName] = useState(localStorage.getItem('adminUsername') || '');
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState(null);
  const [displayLimit, setDisplayLimit] = useState(500);
  const fileRef = useRef('');

  const [parseProgress, setParseProgress] = useState('');

  const onDrop = useCallback(async (files) => {
    const file = files[0]; if(!file) return;
    fileRef.current = file.name;
    setIsParsing(true);
    setParseProgress('Reading file...');
    try {
      const buf = await file.arrayBuffer();
      const data = new Uint8Array(buf);
      setParseProgress('Extracting spreadsheet data...');
      await new Promise(r=>setTimeout(r,50));
      const wb = XLSX.read(data, {type:'array', cellDates:true});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json(ws, {defval:''});
      
      const json = rawJson.map(row => {
        const norm = {};
        for (let key in row) {
          let safeKey = key.trim().toLowerCase().replace(/[\s\-\.]+/g, '_');
          if (['mobile_no','phone','contact','number'].includes(safeKey)) safeKey = 'mobile_number';
          if (['price','selling_price','new_price'].includes(safeKey)) safeKey = 'offer_price';
          norm[safeKey] = row[key];
        }
        return norm;
      });
      
      const validRows = json.filter(r=>r.mobile_number);
      setParseProgress(`Validating ${validRows.length.toLocaleString()} rows...`);
      await new Promise(r=>setTimeout(r,50));

      const parsed = [];
      const CHUNK = 5000;
      for (let i = 0; i < validRows.length; i += CHUNK) {
        setParseProgress(`Validating rows ${i.toLocaleString()} to ${Math.min(i+CHUNK, validRows.length).toLocaleString()}...`);
        await new Promise(r=>setTimeout(r,0));
        
        const chunk = validRows.slice(i, i+CHUNK);
        for (let j = 0; j < chunk.length; j++) {
          parsed.push(validateOfferRow(chunk[j], i + j));
        }
      }

      setParseProgress('Finalising...');
      await new Promise(r=>setTimeout(r,50));
      setRows(parsed);
      setStep(2);
    } catch(e) { alert('Parse error: ' + e.message); }
    finally { setIsParsing(false); setParseProgress(''); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, 
    multiple:false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'text/csv': ['.csv']
    }
  });

  const stats = { total:rows.length, valid:rows.filter(r=>r._status==='valid').length, error:rows.filter(r=>r._status==='error').length };

  const downloadTemplate = () => {
    const cols = { mobile_number:'', offer_price:'', offer_start_date:'', offer_end_date:'' };
    const ws = XLSX.utils.json_to_sheet([cols]);
    ws['!cols'] = Object.keys(cols).map(k=>({wch:k.length+4}));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Offer Template');
    XLSX.writeFile(wb,'Offer_Update_Template.xlsx');
  };

  const downloadErrors = () => {
    const errRows = rows.filter(r=>r._status==='error').map(r=>({Row:r._rowId, Mobile:r.mobile_number, Errors:r._errors.join('; ')}));
    const ws=XLSX.utils.json_to_sheet(errRows); const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Errors');
    XLSX.writeFile(wb,'Offer_Errors.xlsx');
  };

  const API = 'https://asfancynumber.com/fancy_number/api.php';
  const [importProgress, setImportProgress] = useState('');

  const applyOffers = async () => {
    setIsApplying(true);
    const validRows = rows.filter(r => r._status === 'valid');
    let updated = 0, added = 0, failed = 0;

    setImportProgress(`Fetching database to match existing numbers...`);
    let existingMap = {};
    try {
      const res = await fetch(`${API}/wp_fn_numbers?limit=600000&fields=number_id,mobile_number`);
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d)) d.forEach(r => { existingMap[String(r.mobile_number)] = r.number_id; });
      }
    } catch {}

    setImportProgress(`Processing ${validRows.length} offers...`);
    
    // Send in chunks of 5 to avoid rate limiting
    const CHUNK = 5;
    for (let i = 0; i < validRows.length; i += CHUNK) {
      const chunk = validRows.slice(i, i + CHUNK);
      setImportProgress(`Processing ${i+1}–${Math.min(i+CHUNK, validRows.length)} of ${validRows.length}…`);
      
      const promises = chunk.map(async row => {
        try {
          const mob = String(row.mobile_number);
          if (existingMap[mob]) {
            // EXISTS -> UPDATE (PUT)
            const payload = { offer_price: row.offer_price };
            if (row.offer_start_date) payload.offer_start_date = row.offer_start_date;
            if (row.offer_end_date) payload.offer_end_date = row.offer_end_date;
            const numId = existingMap[mob];
            const res = await fetch(`${API}/wp_fn_numbers/${numId}`, {
              method: 'PUT',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
            });
            return res.ok ? 'updated' : 'failed';
          } else {
            // NOT EXISTS -> ADD (POST)
            const payload = { 
              mobile_number: mob,
              base_price: row.offer_price, // fallback if new
              offer_price: row.offer_price,
              number_status: 'available',
              number_category: 'general',
              number_type: '1',
              inventory_source: fileRef.current || 'Offer Upload'
            };
            if (row.offer_start_date) payload.offer_start_date = row.offer_start_date;
            if (row.offer_end_date) payload.offer_end_date = row.offer_end_date;
            const res = await fetch(`${API}/wp_fn_numbers`, {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify(payload)
            });
            return res.ok ? 'added' : 'failed';
          }
        } catch { return 'failed'; }
      });

      const results = await Promise.all(promises);
      results.forEach(res => {
         if (res === 'updated') updated++;
         else if (res === 'added') added++;
         else failed++;
      });
    }

    setImportProgress('Saving upload log…');
    const finalOperator = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
    const logEntry = {
      file_name:        `${fileRef.current}|||${finalOperator}|||Offers Updated: ${updated}, New Added: ${added}`,
      uploaded_by:      finalOperator,
      total_records:    validRows.length
    };
    try {
      await fetch(`${API}/wp_fn_upload_batches`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(logEntry),
      });
    } catch {}

    setSummary({ updated, added, failed: failed + stats.error, total: validRows.length, file: fileRef.current, time: new Date().toLocaleString() });
    setImportProgress('');
    setIsApplying(false);
    setDone(true);
  };

  return (
    <div>
      {/* Step bar */}
      <div style={s.stepBar}>
        {['Upload Offer Sheet','Preview & Validate','Apply Offers'].map((l,i)=>(
          <div key={i} style={{...s.step,...(step===i+1?s.stepActive:{})}}>
            <div style={s.stepCircle}>{step>i+1?<Check size={12}/>:i+1}</div>
            <span style={s.stepLabel}>{l}</span>
            {i<2&&<div style={{...s.stepLine,...(step>i+1?{background:'var(--neon-green-dark)'}:{})}}/>}
          </div>
        ))}
      </div>

      {step===1 && (
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
            <div>
              <h2 style={s.cardTitle}>Bulk Offer Update via Excel</h2>
              <p style={s.cardSubtitle}>Upload a sheet with mobile numbers and new offer prices. Only existing numbers will be updated.</p>
            </div>
            <button onClick={downloadTemplate} style={s.outlineBtn}><Download size={16}/> Download Template</button>
          </div>
          <div {...getRootProps()} style={{...s.dropzone,...(isDragActive?s.dropActive:{})}}>
            <input {...getInputProps()}/>
            <UploadCloud size={44} style={{color:isDragActive?'var(--neon-green-dark)':'var(--text-muted)',marginBottom:'14px'}}/>
            <p style={{fontWeight:700,marginBottom:'6px'}}>{isDragActive?'Drop file here...':'Drag & Drop or Click to Upload'}</p>
            <p style={{color:'var(--text-muted)',fontSize:'0.85rem'}}>Supported formats: .xlsx, .xls, .csv</p>
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
          <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {step===2 && (
        <div>
          {/* Stats & Nav */}
          <div style={s.statsRow}>
            <div style={s.statPill}><span style={{color:'#64748b'}}>Total</span><b>{stats.total}</b></div>
            <div style={s.statPill}><span style={{color:'#22c55e'}}>✅ Valid</span><b style={{color:'#22c55e'}}>{stats.valid}</b></div>
            <div style={s.statPill}><span style={{color:'#ef4444'}}>❌ Errors</span><b style={{color:'#ef4444'}}>{stats.error}</b></div>
            <div style={{marginLeft:'auto',display:'flex',gap:'12px',alignItems:'center'}}>
              <button onClick={()=>{setStep(1);setRows([]);setDisplayLimit(500);}} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca'}}>Cancel</button>
              {stats.error>0&&<button onClick={downloadErrors} style={s.smBtn}><Download size={14}/> Errors</button>}
              <button onClick={()=>setStep(3)} style={s.primaryBtn} disabled={stats.valid===0}>Next Step →</button>
            </div>
          </div>

          <div style={s.gridWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Row','Status','Mobile Number','Offer Price','Start Date','End Date','Issues'].map(h=><th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, displayLimit).map((row,i)=>(
                  <tr key={i} style={{background:row._status==='error'?'#fff5f5':'transparent'}}>
                    <td style={s.td}><small style={{color:'var(--text-muted)'}}>{row._rowId}</small></td>
                    <td style={s.td}>
                      <span style={{...s.badge,background:row._status==='valid'?'#dcfce7':'#fee2e2',color:row._status==='valid'?'#16a34a':'#dc2626'}}>
                        {row._status}
                      </span>
                    </td>
                    <td style={s.td}><b>{row.mobile_number}</b></td>
                    <td style={s.td}>₹{row.offer_price}</td>
                    <td style={s.td}>{row.offer_start_date||'—'}</td>
                    <td style={s.td}>{row.offer_end_date||'—'}</td>
                    <td style={s.td}>{row._errors.length>0?<span style={{color:'#ef4444',fontSize:'0.8rem'}}>{row._errors.join('; ')}</span>:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', padding:'16px', background:'#f8fafc', borderBottomLeftRadius:'var(--radius-md)', borderBottomRightRadius:'var(--radius-md)', border:'1px solid var(--border-color)', borderTop:'none'}}>
            <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight:600}}>
              Showing {Math.min(displayLimit, rows.length).toLocaleString()} of {rows.length.toLocaleString()} rows
            </span>
            {rows.length > displayLimit && (
              <button onClick={()=>setDisplayLimit(p=>p+500)} style={s.outlineBtn}>
                Load Next 500 Rows
              </button>
            )}
          </div>
        </div>
      )}

      {step===3 && !done && (
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'24px'}}>
            <div>
              <h2 style={s.cardTitle}>Apply {stats.valid} Offer Updates?</h2>
              <p style={s.cardSubtitle}>This will update offer prices for all {stats.valid} valid numbers. {stats.error} rows with errors will be skipped.</p>
              <div style={{marginTop:'16px'}}>
                <label style={{display:'block',fontSize:'0.85rem',fontWeight:700,marginBottom:'6px',color:'var(--text-main)'}}>👤 Admin Name (editable)</label>
                <input 
                  type="text"
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',maxWidth:'300px',outline:'none',fontSize:'0.9rem',fontWeight:600}}
                />
              </div>
            </div>
            <div style={{display:'flex',gap:'12px',alignItems:'center'}}>
              <button onClick={()=>{setStep(1);setRows([]);setDone(false);setDisplayLimit(500);}} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca'}} disabled={isApplying}>✕ Cancel</button>
              <button onClick={()=>setStep(2)} style={s.outlineBtn} disabled={isApplying}>← Back</button>
              <button onClick={applyOffers} style={s.primaryBtn} disabled={isApplying}>
                {isApplying?<><RefreshCw size={16} style={{animation:'spin 1s linear infinite'}}/> {importProgress || 'Applying...'}</>:<><Check size={16}/> Confirm & Apply</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {done && summary && (
        <div style={{...s.card,textAlign:'center'}}>
          <CheckCircle size={52} style={{color:'var(--neon-green-dark)',marginBottom:'16px'}}/>
          <h2 style={s.cardTitle}>Offers Applied Successfully!</h2>
          <div style={s.statsRow}>
            <div style={s.statPill}><span>Updated</span><b style={{color:'#22c55e'}}>{summary.updated}</b></div>
            <div style={s.statPill}><span>Failed</span><b style={{color:'#ef4444'}}>{summary.failed}</b></div>
            <div style={s.statPill}><span>Time</span><b>{summary.time}</b></div>
          </div>
          <button onClick={()=>{setStep(1);setRows([]);setDone(false);setDisplayLimit(500);}} style={{...s.primaryBtn,margin:'20px auto 0'}}>Upload Another</button>
        </div>
      )}
    </div>
  );
}

const s = {
  stepBar:{display:'flex',alignItems:'center',marginBottom:'28px'},
  step:{display:'flex',alignItems:'center',gap:'8px',flex:1,opacity:0.4,transition:'opacity 0.3s'},
  stepActive:{opacity:1},
  stepCircle:{width:'26px',height:'26px',borderRadius:'50%',background:'var(--neon-green-dark)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:'0.78rem',flexShrink:0},
  stepLabel:{fontSize:'0.82rem',fontWeight:700,whiteSpace:'nowrap'},
  stepLine:{flex:1,height:'2px',background:'#e2e8f0',margin:'0 8px'},
  card:{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-color)',padding:'32px'},
  cardTitle:{fontSize:'1.2rem',fontWeight:800,color:'var(--text-main)',marginBottom:'4px'},
  cardSubtitle:{color:'var(--text-muted)',fontSize:'0.88rem',marginBottom:'20px'},
  dropzone:{border:'2px dashed var(--border-color)',borderRadius:'var(--radius-lg)',padding:'56px 24px',textAlign:'center',cursor:'pointer',background:'#fafafa'},
  dropActive:{borderColor:'var(--neon-green-dark)',background:'rgba(122,194,0,0.04)'},
  parsingBox:{display:'flex',alignItems:'center',gap:'12px',marginTop:'16px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'var(--radius-md)',padding:'14px 18px'},
  statsRow:{display:'flex',alignItems:'center',gap:'12px',marginBottom:'14px',flexWrap:'wrap'},
  statPill:{display:'flex',gap:'8px',alignItems:'center',background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'20px',padding:'6px 14px',fontSize:'0.85rem'},
  gridWrap:{overflowX:'auto',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:'0.87rem'},
  th:{background:'#f8fafc',padding:'10px 14px',borderBottom:'1px solid var(--border-color)',color:'var(--text-muted)',fontWeight:700,fontSize:'0.78rem',textTransform:'uppercase',whiteSpace:'nowrap',textAlign:'left'},
  td:{padding:'10px 14px',borderBottom:'1px solid #f1f5f9'},
  badge:{padding:'3px 10px',borderRadius:'20px',fontSize:'0.75rem',fontWeight:700},
  primaryBtn:{padding:'10px 20px',background:'var(--neon-green-dark)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:'8px'},
  outlineBtn:{padding:'10px 18px',background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:'8px'},
  smBtn:{padding:'8px 12px',background:'#f1f5f9',color:'var(--text-muted)',border:'1px solid var(--border-color)',borderRadius:'6px',cursor:'pointer',fontWeight:600,fontSize:'0.8rem',display:'flex',alignItems:'center',gap:'6px'},
};
