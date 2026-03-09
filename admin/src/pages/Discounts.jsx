import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import { Gift, CheckCircle, AlertCircle, Database, Download } from 'lucide-react';

export default function Discounts() {
  const [validData, setValidData] = useState([]);
  const [errorData, setErrorData] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [operatorName, setOperatorName] = useState(localStorage.getItem('adminUsername') || '');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  const validateRow = (row, index) => {
    const errors = [];
    const mobile = String(row['mobile_number'] || row['Number'] || '').replace(/\D/g, '');
    const discount = Number(row['discount_percentage'] || row['Discount %'] || 0);
    const startDate = row['offer_start_date'] || row['Offer Start'];
    const endDate = row['offer_end_date'] || row['Offer End'];
    
    if (!mobile) errors.push('Missing mobile_number');
    else if (mobile.length < 10) errors.push('Invalid mobile_number format');
    
    if (isNaN(discount) || discount < 0 || discount > 100) errors.push('Invalid discount_percentage (must be 0-100)');
    
    if (startDate && isNaN(Date.parse(startDate))) errors.push('Invalid offer_start_date format');
    if (endDate && isNaN(Date.parse(endDate))) errors.push('Invalid offer_end_date format');
    if (discount > 0 && (!startDate || !endDate)) errors.push('Missing offer_start_date or offer_end_date for active discount');
    
    return {
      rowId: index + 2,
      isValid: errors.length === 0,
      errors: errors.join(', '),
      original: row,
      parsed: {
        mobile_number: mobile,
        discount_percentage: discount,
        offer_start_date: startDate ? new Date(startDate).toISOString().slice(0, 19).replace('T', ' ') : null,
        offer_end_date: endDate ? new Date(endDate).toISOString().slice(0, 19).replace('T', ' ') : null,
      }
    };
  };

  const onDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadStatus(null);
    setErrorMessage('');
    setValidData([]);
    setErrorData([]);
    setShowPreview(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buffer = e.target.result;
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        
        // Normalize headers
        const json = rawJson.map(row => {
          const norm = {};
          for (let key in row) {
            let safeKey = key.trim().toLowerCase().replace(/[\s\-\.]+/g, '_');
            if (['mobile_no','phone','contact','number'].includes(safeKey)) safeKey = 'mobile_number';
            if (['discount','discount_%'].includes(safeKey)) safeKey = 'discount_percentage';
            norm[safeKey] = row[key];
          }
          return norm;
        });
        
        let valids = [];
        let invalids = [];

        json.forEach((row, idx) => {
          if (!row['mobile_number']) return;

          const validation = validateRow(row, idx);
          if (validation.isValid) {
            valids.push(validation.parsed);
          } else {
            invalids.push({
              Row: validation.rowId,
              'Mobile Number': validation.parsed.mobile_number,
              Error: validation.errors
            });
          }
        });

        setValidData(valids);
        setErrorData(invalids);
        if (valids.length > 0) setShowPreview(true);

      } catch (error) {
        setUploadStatus('error');
        setErrorMessage('Failed to parse Excel file. Ensure it is a valid format.');
      }
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'] }, multiple: false
  });

  const downloadTemplate = () => {
    const templateData = [{
      "mobile_number": "",
      "discount_percentage": "",
      "offer_start_date": "",
      "offer_end_date": ""
    }];
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Auto-fit columns based on header text length
    const colWidths = Object.keys(templateData[0]).map(key => ({ wch: key.length + 2 }));
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "Discount_Upload_Template.xlsx");
  };

  const handleImportConfirm = async () => {
    setIsUploading(true);
    setShowPreview(false);
    
    try {
      const API = 'https://asfancynumber.com/fancy_number/api.php';
      let updated = 0, failed = 0;

      // Send updates in chunks of 5
      const CHUNK = 5;
      for (let i = 0; i < validData.length; i += CHUNK) {
        const chunk = validData.slice(i, i + CHUNK);
        const promises = chunk.map(row => {
          const payload = { discount_percentage: row.discount_percentage };
          if (row.offer_start_date) payload.offer_start_date = row.offer_start_date;
          if (row.offer_end_date) payload.offer_end_date = row.offer_end_date;
          return fetch(`${API}/wp_fn_numbers?mobile_number=${row.mobile_number}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
          }).then(res => res.ok ? 1 : 0).catch(() => 0);
        });
        const results = await Promise.all(promises);
        updated += results.reduce((s,v) => s + v, 0);
        failed += results.reduce((s,v) => s + (1 - v), 0);
      }

      if (failed > 0) {
        setUploadStatus('success');
        setErrorMessage(`Updated ${updated}, failed ${failed}`);
      } else {
        setUploadStatus('success');
      }

      // Save upload log
      const finalOperator = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
      try {
        await fetch(`${API}/wp_fn_upload_batches`, {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({
            file_name: `Discount Upload|||${finalOperator}|||Discounts Updated: ${updated}`,
            uploaded_by: finalOperator,
            total_records: validData.length
          }),
        });
      } catch {}

      setValidData([]);
    } catch (err) {
      setUploadStatus('error');
      setErrorMessage('Failed to push discount updates to the database.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.headerTitle}>
               <Gift size={28} style={{color: 'var(--neon-green-dark)'}} />
               <h2 style={styles.title}>Discount Management</h2>
            </div>
            <p style={styles.subtitle}>Upload an Excel sheet containing only: <b>mobile_number</b>, <b>discount_percentage</b>, <b>offer_start_date</b>, and <b>offer_end_date</b>.</p>
          </div>
          <button onClick={downloadTemplate} style={styles.templateBtn}>
            <Download size={16} /> Download Discount Template
          </button>
        </div>

        <div {...getRootProps()} style={{...styles.dropzone, ...(isDragActive ? styles.dropzoneActive : {})}}>
          <input {...getInputProps()} />
          {isDragActive ? (
            <p style={styles.dropText}>Release to parse discount sheet...</p>
          ) : (
             <p style={styles.dropText}>Drop your Discount Excel sheet here...</p>
          )}
        </div>

        {isUploading && (
           <div style={styles.uploadingBox}>
              <div className="loader" style={styles.loader}></div>
              <p>Syncing discount updates to database...</p>
           </div>
        )}

        {uploadStatus === 'error' && (
          <div style={styles.errorAlert}><AlertCircle size={20} /> {errorMessage}</div>
        )}

        {uploadStatus === 'success' && (
          <div style={styles.successAlert}><CheckCircle size={20} /> Successfully updated active discounts! Frontend reflects these changes instantly.</div>
        )}

        {showPreview && !isUploading && (
          <div style={styles.previewSection}>
             <h3 style={styles.previewTitle}><Database size={20} /> Discount Update Preview</h3>
             <div style={styles.previewStats}>
                <div style={styles.statBox}>
                   <div style={styles.statNum}>{validData.length + errorData.length}</div>
                   <div style={styles.statLabel}>Total Parsed</div>
                </div>
                <div style={styles.statBox}>
                   <div style={{...styles.statNum, color: 'var(--neon-green-dark)'}}>{validData.length}</div>
                   <div style={styles.statLabel}>Valid (Will Update)</div>
                </div>
                <div style={styles.statBox}>
                   <div style={{...styles.statNum, color: '#ef4444'}}>{errorData.length}</div>
                   <div style={styles.statLabel}>Format Errors</div>
                </div>
             </div>
             
             {errorData.length > 0 && (
                 <p style={{color: '#ef4444', marginBottom: '16px', fontWeight: 600}}>Warning: {errorData.length} rows have format errors and will be skipped.</p>
             )}

             <div style={{ marginTop: '20px', marginBottom: '20px' }}>
                <label style={{display: 'block', fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px'}}>👤 Admin Name (editable)</label>
                <input 
                  type="text" 
                  value={operatorName}
                  onChange={e => setOperatorName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: '#fff', width: '100%', maxWidth: '300px'}}
                />
             </div>

             <div style={styles.previewActions}>
                <button onClick={() => setShowPreview(false)} style={styles.cancelBtn}>Cancel Update</button>
                <button onClick={handleImportConfirm} style={styles.confirmBtn}>Apply {validData.length} Discounts</button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: { background: 'var(--bg-card)', padding: '30px', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', marginBottom: '30px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' },
  headerTitle: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  title: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' },
  subtitle: { color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '24px' },
  templateBtn: { background: '#f8fafc', color: 'var(--text-main)', border: '1px solid var(--border-color)', padding: '10px 16px', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: 'var(--shadow-sm)' },
  dropzone: { border: '2px dashed var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '60px 20px', textAlign: 'center', cursor: 'pointer', background: '#f8fafc', transition: 'all 0.2s' },
  dropzoneActive: { borderColor: 'var(--neon-green-dark)', background: 'rgba(122, 194, 0, 0.05)' },
  dropText: { fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-main)' },
  uploadingBox: { marginTop: '20px', padding: '30px', textAlign: 'center', background: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', color: 'var(--text-main)', fontWeight: 600, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' },
  loader: { width: '40px', height: '40px', border: '4px solid rgba(122, 194, 0, 0.2)', borderTopColor: 'var(--neon-green-dark)', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  errorAlert: { marginTop: '20px', padding: '16px', background: '#fee2e2', color: '#ef4444', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 },
  successAlert: { marginTop: '20px', padding: '16px', background: 'rgba(122, 194, 0, 0.1)', color: 'var(--neon-green-dark)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 },
  previewSection: { marginTop: '30px', background: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '30px' },
  previewTitle: { fontSize: '1.2rem', fontWeight: 800, marginBottom: '20px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' },
  previewStats: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '30px' },
  statBox: { background: '#fff', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' },
  statNum: { fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '4px' },
  statLabel: { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' },
  previewActions: { display: 'flex', justifyContent: 'flex-end', gap: '16px' },
  cancelBtn: { background: '#fff', border: '1px solid var(--border-color)', color: 'var(--text-main)', padding: '12px 24px', borderRadius: 'var(--radius-md)', fontWeight: 600, cursor: 'pointer' },
  confirmBtn: { background: 'var(--neon-green-dark)', border: 'none', color: '#fff', padding: '12px 24px', borderRadius: 'var(--radius-md)', fontWeight: 700, cursor: 'pointer' }
};
