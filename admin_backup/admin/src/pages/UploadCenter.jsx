import React, { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import * as XLSX from 'xlsx';
import {
  Upload, FileSpreadsheet, ArrowRight, Check, AlertCircle,
  Settings, Table as TableIcon, Trash2, Database, ShieldCheck,
  RefreshCw, Download
} from 'lucide-react';
import { postWithAuth, getWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';
import { detectPattern } from '../utils/PatternEngine';

const REQUIRED_FIELDS = [
  { key: 'mobile_number', label: 'Mobile Number', required: true },
  { key: 'base_price', label: 'Base Price', required: true },
  { key: 'offer_price', label: 'Offer Price', required: false },
  { key: 'dealer_id', label: 'Dealer ID', required: false },
  { key: 'remarks', label: 'Remarks', required: false },
];

export default function UploadCenter() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [excelData, setExcelData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState(null);

  const onDrop = useCallback((acceptedFiles) => {
    const reader = new FileReader();
    const f = acceptedFiles[0];
    setFile(f);
    reader.onload = (e) => {
      const bstr = e.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const cols = data[0] || [];
      const rows = data.slice(1).filter(r => r.length > 0);

      setHeaders(cols);
      setExcelData(rows);

      // Auto-map based on common names
      const autoMap = {};
      cols.forEach((col, idx) => {
        const c = String(col).toLowerCase().replace(/[^a-z]/g, '');
        if (c.includes('number') || c.includes('mobile')) autoMap.mobile_number = idx;
        if (c.includes('price') && !c.includes('offer')) autoMap.base_price = idx;
        if (c.includes('offer')) autoMap.offer_price = idx;
        if (c.includes('remark')) autoMap.remarks = idx;
        if (c.includes('dealer')) autoMap.dealer_id = idx;
      });
      setMapping(autoMap);
      setStep(2);
    };
    reader.readAsBinaryString(f);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'application/vnd.ms-excel': ['.xls'] },
    multiple: false
  });

  const handleStartUpload = async (mode) => {
    setUploading(true);
    setResults(null);
    const rowsToProcess = excelData.map(row => {
      const obj = {};
      Object.entries(mapping).forEach(([sysKey, excelIdx]) => {
        obj[sysKey] = row[excelIdx];
      });

      // Apply Pattern Engine for new additions
      if (mode === 'add' || mode === 'draft') {
        const p = detectPattern(String(obj.mobile_number));
        obj.category = p.category;
        obj.pattern_type = p.type;
        obj.visibility_status = mode === 'add' ? 1 : 0;
        obj.number_status = 'available';
      }
      return obj;
    });

    setProgress({ current: 0, total: rowsToProcess.length });

    // Processing in batches of 500
    const batchSize = 500;
    let successCount = 0;
    let failCount = 0;

    const endpoint = mode === 'delete' ? 'bulk-delete' : 'bulk-insert';
    const targetTable = 'wp_fn_numbers';

    for (let i = 0; i < rowsToProcess.length; i += batchSize) {
      const batch = rowsToProcess.slice(i, i + batchSize);
      let payload = { records: batch };

      if (mode === 'delete') {
        // Step 1: Lookup IDs for deletion
        const nums = batch.map(b => b.mobile_number);
        const lookupRes = await postWithAuth(`${API_BASE}/${targetTable}/bulk-lookup`, { mobile_numbers: nums });
        const lookupData = await safeJson(lookupRes);
        const ids = (lookupData?.matched || []).map(m => m.number_id);
        if (ids.length) {
          payload = { ids };
        } else {
          continue;
        }
      }

      const res = await postWithAuth(`${API_BASE}/${targetTable}/${endpoint}`, payload);
      if (res.ok) {
        const resp = await res.json();
        successCount += (resp.inserted || resp.deleted || resp.processed || 0);
      } else {
        failCount += batch.length;
      }
      setProgress(prev => ({ ...prev, current: i + batch.length }));
    }

    // Write Log
    await postWithAuth(`${API_BASE}/wp_fn_upload_batches`, {
      file_name: file.name,
      operation_type: mode === 'delete' ? 'Delete by Excel' : (mode === 'add' ? 'Excel Add (Live)' : 'Excel Add (Draft)'),
      admin_name: localStorage.getItem('ag_admin_username') || 'Admin',
      total_records: rowsToProcess.length,
      status: 'completed',
      operation_data: `Processed: ${successCount}, Failed: ${failCount}`,
      table_name: targetTable
    });

    setResults({ success: successCount, fail: failCount });
    setUploading(false);
    setStep(3);
  };

  const downloadTemplate = (e) => {
    e.preventDefault();
    const headers = ["Mobile Number", "Base Price", "Offer Price", "Dealer ID", "Remarks"];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "FancyNumbers_Template.xlsx");
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Wizard Header */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '32px' }}>
        {[
          { icon: <Upload size={20} />, label: 'Upload Excel' },
          { icon: <Settings size={20} />, label: 'Mapping & Validation' },
          { icon: <ShieldCheck size={20} />, label: 'Finish' }
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
            opacity: step === i + 1 ? 1 : 0.4, transition: '0.3s'
          }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', background: step > i + 1 ? 'var(--success)' : (step === i + 1 ? 'var(--primary)' : '#eee'),
              color: step >= i + 1 ? 'white' : '#666', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              {step > i + 1 ? <Check size={20} /> : s.icon}
            </div>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <div {...getRootProps()} style={{
            border: `2px dashed ${isDragActive ? 'var(--primary)' : '#ddd'}`,
            borderRadius: '20px', padding: '40px', background: isDragActive ? 'var(--primary)05' : 'transparent',
            cursor: 'pointer', transition: 'all 0.2s'
          }}>
            <input {...getInputProps()} />
            <div style={{ background: 'var(--primary)10', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
              <FileSpreadsheet size={40} color="var(--primary)" />
            </div>
            <h2 style={{ margin: '0 0 8px' }}>Drag & Drop Excel File</h2>
            <p style={{ color: '#666', marginBottom: '24px' }}>Support .xlsx and .xls formats</p>
            <button className="btn btn-primary btn-lg">Browse Files</button>
          </div>
          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '40px', borderTop: '1px solid #eee', paddingTop: '32px' }}>
            <div style={{ textAlign: 'left' }}>
              <h4 style={{ margin: '0 0 10px' }}>Quick Start</h4>
              <p style={{ fontSize: '13px', color: '#666', margin: 0 }}>Don't have a file? Download our template</p>
              <a href="#" onClick={downloadTemplate} style={{ fontSize: '13px', color: 'var(--primary)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                <Download size={14} /> Download Sample XLSX
              </a>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings size={20} color="var(--primary)" /> Map Excel Columns
              </h3>
              <div style={{ fontSize: '13px', color: '#666' }}>File: <b>{file?.name}</b> ({excelData.length} rows)</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {REQUIRED_FIELDS.map(field => (
                <div key={field.key} className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{field.label} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}</span>
                    <span style={{ fontSize: '11px', color: '#999' }}>System ID: {field.key}</span>
                  </label>
                  <select
                    className="input"
                    value={mapping[field.key] ?? ''}
                    onChange={e => setMapping({ ...mapping, [field.key]: e.target.value === '' ? null : parseInt(e.target.value) })}
                  >
                    <option value="">-- Don't Map --</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px', borderBottom: '1px solid #eee' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TableIcon size={20} color="var(--primary)" /> Preview & Validation
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    {REQUIRED_FIELDS.map(pf => <th key={pf.key}>{pf.label}</th>)}
                    <th>Detection</th>
                  </tr>
                </thead>
                <tbody>
                  {excelData.slice(0, 5).map((row, i) => {
                    const num = mapping.mobile_number != null ? String(row[mapping.mobile_number]) : '';
                    const pattern = num ? detectPattern(num) : null;
                    return (
                      <tr key={i}>
                        {REQUIRED_FIELDS.map(pf => (
                          <td key={pf.key}>
                            {mapping[pf.key] != null ? (
                              row[mapping[pf.key]] || <span style={{ color: '#ccc' }}>—</span>
                            ) : <span style={{ color: '#ccc' }}>—</span>}
                          </td>
                        ))}
                        <td>
                          {pattern ? (
                            <div style={{ display: 'flex', gap: '4px' }}>
                              <span style={{ fontSize: '10px', background: '#e0e7ff', padding: '2px 6px', borderRadius: '4px' }}>{pattern.category}</span>
                              <span style={{ fontSize: '10px', background: '#fef3c7', padding: '2px 6px', borderRadius: '4px' }}>{pattern.type}</span>
                            </div>
                          ) : 'No data'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-danger" disabled={uploading} onClick={() => handleStartUpload('delete')}>
                  <Trash2 size={18} /> Delete Mode
                </button>
                <button className="btn btn-secondary" disabled={uploading} onClick={() => handleStartUpload('draft')}>
                  <Archive size={18} /> Add as Draft
                </button>
                <button className="btn btn-primary" disabled={uploading} onClick={() => handleStartUpload('add')}>
                  <Database size={18} /> Start Import
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          {uploading ? (
            <div>
              <RefreshCw size={48} color="var(--primary)" style={{ animation: 'spin 2s linear infinite', marginBottom: '24px' }} />
              <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
              <h2>Importing Data...</h2>
              <p style={{ color: '#666' }}>Processed {progress.current} of {progress.total} rows</p>
              <div style={{ width: '100%', maxWidth: '400px', height: '10px', background: '#eee', borderRadius: '5px', margin: '20px auto', overflow: 'hidden' }}>
                <div style={{ width: `${(progress.current / progress.total) * 100}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.3s' }} />
              </div>
            </div>
          ) : (
            <div>
              <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--success)10', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
                <Check size={40} color="var(--success)" />
              </div>
              <h2>Import Complete!</h2>
              <p style={{ color: '#666', marginBottom: '32px' }}>Successfully processed {results?.success} records.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '400px', margin: '0 auto 32px' }}>
                <div className="card" style={{ padding: '16px', background: 'var(--success)05', borderColor: 'var(--success)20' }}>
                  <h3 style={{ margin: 0, color: 'var(--success)' }}>{results?.success}</h3>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Success</span>
                </div>
                <div className="card" style={{ padding: '16px', background: 'var(--danger)05', borderColor: 'var(--danger)20' }}>
                  <h3 style={{ margin: 0, color: 'var(--danger)' }}>{results?.fail}</h3>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>Failed</span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setStep(1)}>Upload Another</button>
                <button className="btn btn-primary" onClick={() => window.location.href = '/admin/inventory'}>View Inventory</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
