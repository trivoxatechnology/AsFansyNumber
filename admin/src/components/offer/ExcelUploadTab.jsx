import { useState, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { CloudUpload, Download, RefreshCw, Check, CircleCheck } from 'lucide-react';
import { API_BASE } from '../../config/api';
import { classifyNumber as detectPattern, CATEGORIES, PATTERN_TYPES } from '../../utils/PatternEngine';
import { useImport } from '../../context/ImportContext';
import { useToast } from '../../components/Toast';
import { fetchWithAuth } from '../../utils/api';

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
    is_featured: row.is_featured||'0'
  };
}

export default function ExcelUploadTab() {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [step, setStep] = useState(1);
  const [isParsing, setIsParsing] = useState(false);
  const [operatorName, setOperatorName] = useState(localStorage.getItem('adminUsername') || '');
  const [done, setDone] = useState(false);
  const [summary, setSummary] = useState(null);
  const [parseProgress, setParseProgress] = useState('');
  const [fetchError, setFetchError] = useState(false);
  const { runBulkImport } = useImport();
  
  const fileRef = useRef('');

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
          let safeKey = key.trim().toLowerCase().replace(/[\s-.]+/g, '_');
          if (['mobile_no','phone','contact','number'].includes(safeKey)) safeKey = 'mobile_number';
          if (['price','selling_price','new_price'].includes(safeKey)) safeKey = 'offer_price';
          norm[safeKey] = row[key];
        }
        return norm;
      });
      
      const validRows = json.filter(r=>r.mobile_number);

      setParseProgress('Looking up numbers in database...');
      let existingMap = {};
      try {
        setFetchError(false);
        const lookupRes = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/bulk-lookup`, {
          method: 'POST',
          body: JSON.stringify({ mobile_numbers: validRows.map(r => String(r.mobile_number)) })
        });
        if (lookupRes && lookupRes.ok) {
          const lookupData = await lookupRes.json();
          if (lookupData.matched) {
            lookupData.matched.forEach(r => {
              existingMap[String(r.mobile_number)] = { id: r.number_id, price: r.offer_price };
            });
          }
        } else {
          setFetchError(true);
        }
      } catch (e) {
        console.error('API fetch error: ', e);
        setFetchError(true);
      }

      setParseProgress(`Validating ${validRows.length.toLocaleString()} rows...`);
      await new Promise(r=>setTimeout(r,50));

      const parsed = [];
      const CHUNK = 5000;
      for (let i = 0; i < validRows.length; i += CHUNK) {
        const chunk = validRows.slice(i, i+CHUNK);
        for (let j = 0; j < chunk.length; j++) {
          const v = validateOfferRow(chunk[j], i + j);
          if (v._status === 'valid') {
            const m = String(v.mobile_number);
            if (Object.prototype.hasOwnProperty.call(existingMap, m)) {
               v._isNew = false;
               v._numId = existingMap[m].id;
               v._dbId = existingMap[m].id;
               v._operation = 'update';
               v._oldPrice = parseFloat(existingMap[m].price || 0);
               v._diff = parseFloat(v.offer_price || 0) - v._oldPrice;
            } else {
               v._isNew = true;
               v._operation = 'insert';
               v._oldPrice = 0;
               v._diff = parseFloat(v.offer_price || 0);
            }
          }
          parsed.push(v);
        }
      }

      setRows(parsed);
      setStep(2);
    } catch(e) { toast.error('Parse error: ' + e.message); }
    finally { setIsParsing(false); setParseProgress(''); }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop, multiple:false,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'], 'text/csv': ['.csv'] }
  });

  const downloadTemplate = () => {
    const cols = { mobile_number:'', offer_price:'', offer_start_date:'', offer_end_date:'', is_featured:'' };
    const ws = XLSX.utils.json_to_sheet([cols]);
    ws['!cols'] = Object.keys(cols).map(k=>({wch:k.length+4}));
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,'Offer Template');
    XLSX.writeFile(wb,'Offer_Update_Template.xlsx');
  };

  const executeQueue = (mode) => {
    const operatorSnapshot = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
    let targetRows = [];
    if (mode === 'all') targetRows = rows.filter(r => r._status === 'valid');
    if (mode === 'existing') targetRows = rows.filter(r => r._status === 'valid' && !r._isNew);
    if (mode === 'new') targetRows = rows.filter(r => r._status === 'valid' && r._isNew);

    if (targetRows.length === 0) return;
    const srcFile = fileRef.current || 'Offer Upload';

    runBulkImport({
      rows: targetRows,
      fileName: srcFile,
      importDestination: 'store',
      operatorName: operatorSnapshot,
      cleanRow: (r) => {
        if (r._isNew) {
          const pattern = classifyNumber(r.mobile_number);
          const payload = {
            mobile_number: r.mobile_number,
            base_price: r.offer_price,
            offer_price: r.offer_price,
            number_status: 'available',
            visibility_status: '1',
            category: pattern.category,
            pattern_type: pattern.pattern_type,
            inventory_source: srcFile,
          };
          if (r.offer_start_date) payload.offer_start_date = r.offer_start_date;
          if (r.offer_end_date) payload.offer_end_date = r.offer_end_date;
          if (r.is_featured) payload.is_featured = r.is_featured;
          return payload;
        } else {
          const payload = { offer_price: r.offer_price };
          if (r.offer_start_date) payload.offer_start_date = r.offer_start_date;
          if (r.offer_end_date) payload.offer_end_date = r.offer_end_date;
          if (r.is_featured) payload.is_featured = r.is_featured;
          if (r._numId) payload.number_id = r._numId;
          return payload;
        }
      }
    });

    setStep(1);
    setRows([]);
    setDone(false);
  };

  const existingRows = rows.filter(r => r._status === 'valid' && !r._isNew);
  const newRows = rows.filter(r => r._status === 'valid' && r._isNew);
  const errorRows = rows.filter(r => r._status === 'error');

  return (
    <div style={{animation:'fadeIn 0.3s ease-out'}}>
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
      
      {fetchError && (
        <div style={{background:'#fee2e2', color:'#dc2626', padding:'8px 16px', borderRadius:'8px', fontSize:'0.85rem', fontWeight:700, border:'1px solid #fecaca', display:'flex', alignItems:'center', gap:'8px', marginBottom:'20px'}}>
          <RefreshCw size={14}/> ⚠️ Server busy. Showing stale validation data.
        </div>
      )}
      
      {step===1 && (
        <div style={s.card}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
            <div>
              <h2 style={s.cardTitle}>Upload Offer Sheet</h2>
              <p style={s.cardSubtitle}>Excel sheet with mobile_number, offer_price, offer_start_date, offer_end_date, is_featured.</p>
            </div>
            <button onClick={downloadTemplate} style={s.outlineBtn}><Download size={16}/> Template</button>
          </div>
          <div {...getRootProps()} style={{...s.dropzone,...(isDragActive?s.dropActive:{})}}>
            <input {...getInputProps()}/>
            <CloudUpload size={44} style={{color:isDragActive?'var(--neon-green-dark)':'var(--text-muted)',marginBottom:'14px'}}/>
            <p style={{fontWeight:700,marginBottom:'6px'}}>{isDragActive?'Drop here...':'Drag & Drop or Click to Upload'}</p>
          </div>
          {isParsing && (
            <div style={s.parsingBox}>
              <RefreshCw size={20} style={{animation:'spin 1s linear infinite',color:'var(--neon-green-dark)'}}/>
              <span style={{fontWeight:600}}>{parseProgress}</span>
            </div>
          )}
        </div>
      )}

      {step===2 && !done && (
        <div>
           <div style={{marginBottom:'24px', display:'flex', gap:'12px', flexWrap:'wrap'}}>
             <div style={s.statPill}><span>Existing DB Numbers to Update:</span><b style={{color:'#16a34a'}}>{existingRows.length}</b></div>
             <div style={s.statPill}><span>Not Present Numbers:</span><b style={{color:'#3b82f6'}}>{newRows.length}</b></div>
             <div style={s.statPill}><span>Validation Errors:</span><b style={{color:'#ef4444'}}>{errorRows.length}</b></div>
             <div style={{...s.statPill, marginLeft:'8px', background:'#fff'}}>
               <span style={{color:'var(--text-muted)'}}>Operator:</span>
               <input type="text" value={operatorName} onChange={e=>setOperatorName(e.target.value)} placeholder="Name" style={{border:'none', outline:'none', fontSize:'0.85rem', width:'100px', fontWeight:700}} />
             </div>
             <button onClick={()=>setStep(1)} style={{...s.outlineBtn, color:'#ef4444', borderColor:'#fecaca', marginLeft:'auto'}}>Cancel</button>
             <button onClick={()=>executeQueue('all')} style={s.primaryBtn}>
               {`Apply All (${existingRows.length + newRows.length})`}
             </button>
           </div>
           
           {/* Section 1: Existing Numbers */}
           <div style={s.card}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                <h3 style={{fontSize:'1.1rem', fontWeight:800, color:'#16a34a'}}>Section 1 — Existing Numbers ({existingRows.length})</h3>
                {existingRows.length > 0 && <button onClick={()=>executeQueue('existing')} style={{...s.primaryBtn, padding:'8px 16px', fontSize:'0.85rem'}}>Update Only Existing Offers</button>}
             </div>
             {existingRows.length === 0 ? <p style={{color:'var(--text-muted)'}}>No existing numbers found in this sheet.</p> : (
                <div style={s.gridWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Mobile Number</th>
                        <th style={s.th}>Old Offer</th>
                        <th style={s.th}>New Offer</th>
                        <th style={s.th}>Difference</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingRows.slice(0, 100).map((r,i)=>(
                        <tr key={i}>
                          <td style={s.td}><b>{r.mobile_number}</b></td>
                          <td style={{...s.td, color:'var(--text-muted)'}}>₹{r._oldPrice}</td>
                          <td style={s.td}><b>₹{r.offer_price}</b></td>
                          <td style={s.td}>
                            <span style={{color:r._diff > 0 ? '#16a34a' : '#ef4444', fontWeight:700}}>
                              {r._diff > 0 ? '+' : ''}₹{r._diff}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {existingRows.length > 100 && <div style={{padding:'10px', textAlign:'center', background:'#f8fafc', fontSize:'0.8rem', color:'var(--text-muted)'}}>Showing first 100. Apply bulk to update all.</div>}
                </div>
             )}
           </div>

           {/* Section 2: Not Present Numbers */}
           <div style={{...s.card, marginTop:'24px', borderColor:'#bfdbfe'}}>
             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                <h3 style={{fontSize:'1.1rem', fontWeight:800, color:'#3b82f6'}}>Section 2 — Not Present Numbers ({newRows.length})</h3>
                {newRows.length > 0 && <button onClick={()=>executeQueue('new')} style={{...s.primaryBtn, background:'#3b82f6', padding:'8px 16px', fontSize:'0.85rem'}}>Add New Numbers With Offers</button>}
             </div>
             {newRows.length === 0 ? <p style={{color:'var(--text-muted)'}}>All numbers in this sheet are already in the DB.</p> : (
                <div style={s.gridWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        <th style={s.th}>Mobile Number</th>
                        <th style={s.th}>Offer Price</th>
                        <th style={s.th}>Start Date</th>
                        <th style={s.th}>End Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {newRows.slice(0, 100).map((r,i)=>(
                        <tr key={i}>
                          <td style={s.td}><b>{r.mobile_number}</b></td>
                          <td style={s.td}><b>₹{r.offer_price}</b></td>
                          <td style={s.td}>{r.offer_start_date||'—'}</td>
                          <td style={s.td}>{r.offer_end_date||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {newRows.length > 100 && <div style={{padding:'10px', textAlign:'center', background:'#f8fafc', fontSize:'0.8rem', color:'var(--text-muted)'}}>Showing first 100. Apply bulk to inject all.</div>}
                </div>
             )}
           </div>

        </div>
      )}

      {done && summary && (
        <div style={{...s.card,textAlign:'center'}}>
          <CircleCheck size={52} style={{color:'var(--neon-green-dark)',marginBottom:'16px'}}/>
          <h2 style={s.cardTitle}>Offers Applied Successfully!</h2>
          <p style={{marginBottom:'20px'}}>Updated existing offers: <b>{summary.updated}</b> | Newly injected: <b>{summary.added}</b></p>
          <button onClick={()=>{setStep(1);setRows([]);setDone(false);}} style={{...s.primaryBtn,margin:'0 auto'}}>Upload Another File</button>
        </div>
      )}
    </div>
  );
}

const s = {
  card:{background:'var(--bg-card)',borderRadius:'var(--radius-lg)',border:'1px solid var(--border-color)',padding:'24px'},
  cardTitle:{fontSize:'1.2rem',fontWeight:800,color:'var(--text-main)',marginBottom:'4px'},
  cardSubtitle:{color:'var(--text-muted)',fontSize:'0.88rem',marginBottom:'20px'},
  dropzone:{border:'2px dashed var(--border-color)',borderRadius:'var(--radius-lg)',padding:'56px 24px',textAlign:'center',cursor:'pointer',background:'#fafafa'},
  dropActive:{borderColor:'var(--neon-green-dark)',background:'rgba(122,194,0,0.04)'},
  parsingBox:{display:'flex',alignItems:'center',gap:'12px',marginTop:'16px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:'var(--radius-md)',padding:'14px 18px'},
  statPill:{display:'flex',gap:'8px',alignItems:'center',background:'var(--bg-card)',border:'1px solid var(--border-color)',borderRadius:'20px',padding:'6px 14px',fontSize:'0.85rem'},
  gridWrap:{overflowX:'auto',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)'},
  table:{width:'100%',borderCollapse:'collapse',fontSize:'0.87rem'},
  th:{background:'#f8fafc',padding:'10px 14px',borderBottom:'1px solid var(--border-color)',color:'var(--text-muted)',fontWeight:700,fontSize:'0.78rem',textTransform:'uppercase',whiteSpace:'nowrap',textAlign:'left'},
  td:{padding:'10px 14px',borderBottom:'1px solid #f1f5f9'},
  primaryBtn:{padding:'10px 20px',background:'var(--neon-green-dark)',color:'#fff',border:'none',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:'8px'},
  outlineBtn:{padding:'10px 18px',background:'transparent',color:'var(--text-muted)',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:600,display:'flex',alignItems:'center',gap:'8px'},
};
