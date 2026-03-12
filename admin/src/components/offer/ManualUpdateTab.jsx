import { useState, useEffect } from 'react';
import { Search, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { writeOperationLog } from '../../utils/operationLog';
import { fetchWithAuth } from '../../utils/api';
import { API_BASE } from '../../config/api';

export default function ManualUpdateTab() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(100);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [vendorFilter, setVendorFilter] = useState('');
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkForm, setBulkForm] = useState({ offer_price:'', offer_start_date:'', offer_end_date:'', is_featured:'' });
  const [operatorName, setOperatorName] = useState(localStorage.getItem('adminUsername') || '');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchData = async (signal) => {
    setLoading(true);
    const opts = signal ? { signal } : {};
    try {
      const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers?limit=600000`, opts);
      if (res && res.ok) {
        const data = await res.json();
        setInventory(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('API Error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const ctrl = new AbortController();
    fetchData(ctrl.signal);
    return () => ctrl.abort();
  }, []);

  const handleEditClick = (item) => {
    setEditingId(item.number_id);
    setEditForm({ 
      offer_price: item.offer_price || '',
      offer_start_date: item.offer_start_date || '',
      offer_end_date: item.offer_end_date || '',
      is_featured: item.is_featured || '0'
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (id) => {
    setIsProcessing(true);
    try {
      const payload = { ...editForm };
      const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      if (res && res.ok) {
        setInventory(prev => prev.map(i => i.number_id === id ? { ...i, ...payload } : i));
        setEditingId(null);
        const finalUser = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
        await writeOperationLog({
          fileName: 'Manual Offer Update',
          operationType: 'Single Update',
          operationData: 'Offers Updated: 1',
          totalRecords: 1,
          tableName: 'wp_fn_numbers',
          adminName: finalUser,
        });
      }
    } catch(err) {
      console.error(err);
      alert('Save failed.');
    }
    setIsProcessing(false);
  };

  const handleBulkSubmit = async () => {
    if (selectedIds.length === 0) return alert('No numbers selected');
    setIsProcessing(true);
    let success = 0;
    
    // Filter out empty fields from bulk form
    const payload = {};
    if (bulkForm.offer_price) payload.offer_price = bulkForm.offer_price;
    if (bulkForm.offer_start_date) payload.offer_start_date = bulkForm.offer_start_date;
    if (bulkForm.offer_end_date) payload.offer_end_date = bulkForm.offer_end_date;
    if (bulkForm.is_featured) payload.is_featured = bulkForm.is_featured;

    const CHUNK = 5;
    for (let i = 0; i < selectedIds.length; i+=CHUNK) {
      const chunk = selectedIds.slice(i, i+CHUNK);
      const results = await Promise.all(
        chunk.map(id => fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        }).then(r=>r&&r.ok?1:0).catch(()=>0))
      );
      success += results.reduce((s,v)=>s+v, 0);
    }

    setInventory(prev => prev.map(item => selectedIds.includes(item.number_id) ? { ...item, ...payload } : item));
    const finalUser = operatorName.trim() || localStorage.getItem('adminUsername') || 'Admin';
    await writeOperationLog({
      fileName: 'Manual Bulk Update',
      operationType: 'Bulk Update',
      operationData: `Offers Updated: ${success}`,
      totalRecords: selectedIds.length,
      tableName: 'wp_fn_numbers',
      adminName: finalUser,
    });

    setSelectedIds([]);
    setBulkModalOpen(false);
    setIsProcessing(false);
    alert(`Successfully updated ${success} numbers.`);
  };

  const categories = [...new Set(inventory.map(i => i.number_category).filter(Boolean))];
  const vendors = [...new Set(inventory.map(i => i.inventory_source || i.primary_incharge_name).filter(Boolean))];

  const filtered = inventory.filter(item => {
    const searchMatch = String(item.mobile_number).includes(searchTerm);
    const catMatch = categoryFilter ? item.number_category === categoryFilter : true;
    const vendorData = String(item.inventory_source || '') + String(item.primary_incharge_name || '');
    const vendorMatch = vendorFilter ? vendorData.includes(vendorFilter) : true;
    return searchMatch && catMatch && vendorMatch;
  });

  return (
    <div style={{animation:'fadeIn 0.3s ease-out'}}>
      {/* Top Bar for Filters */}
      <div style={{display:'flex', gap:'12px', marginBottom:'20px', flexWrap:'wrap'}}>
         <div style={{position:'relative', width:'300px'}}>
           <Search size={18} style={{position:'absolute',left:'12px',top:'10px',color:'var(--text-muted)'}} />
           <input 
             type="text" placeholder="Search by mobile number..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}
             style={{width:'100%', padding:'10px 10px 10px 40px', borderRadius:'8px', border:'1px solid var(--border-color)', outline:'none'}}
           />
         </div>
         <select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)} style={{padding:'10px 14px', borderRadius:'8px', border:'1px solid var(--border-color)', background:'#fff'}}>
           <option value="">All Categories</option>
           {categories.map(c => <option key={c} value={c}>{c}</option>)}
         </select>
         <select value={vendorFilter} onChange={e=>setVendorFilter(e.target.value)} style={{padding:'10px 14px', borderRadius:'8px', border:'1px solid var(--border-color)', background:'#fff'}}>
           <option value="">All Vendors / Sources</option>
           {vendors.map(v => <option key={v} value={v}>{v}</option>)}
         </select>
         <div style={{marginLeft:'auto', display:'flex', alignItems:'center', gap:'8px'}}>
           <span style={{fontSize:'0.8rem', fontWeight:700, color:'var(--text-muted)'}}>Operator:</span>
           <input 
             type="text" 
             placeholder="Your name..." 
             value={operatorName} 
             onChange={e=>setOperatorName(e.target.value)}
             style={{padding:'8px 12px', borderRadius:'8px', border:'1px solid var(--border-color)', width:'150px', outline:'none', fontSize:'0.85rem'}}
           />
         </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', background:'#e0f2fe', padding:'12px 20px', borderRadius:'8px', marginBottom:'16px', border:'1px solid #bae6fd'}}>
           <span style={{fontWeight:700, color:'#0369a1'}}>{selectedIds.length} numbers selected</span>
           <button onClick={()=>setBulkModalOpen(true)} style={{padding:'8px 16px', background:'var(--neon-green-dark)', color:'#fff', border:'none', borderRadius:'6px', fontWeight:600, cursor:'pointer'}}>Bulk Update Offers</button>
         </div>
      )}

      {/* Grid Table */}
      <div style={{background:'#fff', border:'1px solid var(--border-color)', borderRadius:'8px', overflowX:'auto'}}>
        <table style={{width:'100%', borderCollapse:'collapse', textAlign:'left'}}>
          <thead>
            <tr>
              <th style={{...styles.th, width:'40px', textAlign:'center'}}>
                 <input type="checkbox" checked={filtered.length>0 && selectedIds.length===filtered.length} onChange={(e)=>setSelectedIds(e.target.checked ? filtered.map(i=>i.number_id) : [])} />
              </th>
              <th style={styles.th}>Mobile Number</th>
              <th style={styles.th}>Offer Price</th>
              <th style={styles.th}>Start Date</th>
              <th style={styles.th}>End Date</th>
              <th style={styles.th}>Featured</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
               <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'var(--text-muted)'}}><RefreshCw size={20} style={{animation:'spin 1s linear infinite', margin:'0 auto'}}/></td></tr>
            ) : filtered.length === 0 ? (
               <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'var(--text-muted)'}}>No numbers found.</td></tr>
            ) : filtered.slice(0, displayLimit).map(item => {
               const isEditing = editingId === item.number_id;
               const isSelected = selectedIds.includes(item.number_id);
               return (
                 <tr key={item.number_id} style={{background: isEditing||isSelected ? '#f8fafc' : 'transparent', borderBottom:'1px solid var(--border-color)'}}>
                   <td style={{padding:'12px', textAlign:'center'}}>
                     <input type="checkbox" checked={isSelected} onChange={()=>setSelectedIds(prev => prev.includes(item.number_id) ? prev.filter(id=>id!==item.number_id) : [...prev, item.number_id])} />
                   </td>
                   <td style={{padding:'12px', fontWeight:700}}>{item.mobile_number}</td>
                   
                   <td style={{padding:'12px'}}>
                     {isEditing ? <input type="number" name="offer_price" value={editForm.offer_price} onChange={handleChange} style={styles.input} /> : (item.offer_price ? `₹${item.offer_price}` : '—')}
                   </td>
                   <td style={{padding:'12px'}}>
                     {isEditing ? <input type="date" name="offer_start_date" value={editForm.offer_start_date} onChange={handleChange} style={styles.input} /> : (item.offer_start_date || '—')}
                   </td>
                   <td style={{padding:'12px'}}>
                     {isEditing ? <input type="date" name="offer_end_date" value={editForm.offer_end_date} onChange={handleChange} style={styles.input} /> : (item.offer_end_date || '—')}
                   </td>
                   <td style={{padding:'12px'}}>
                     {isEditing ? (
                       <select name="is_featured" value={editForm.is_featured} onChange={handleChange} style={styles.input}>
                         <option value="0">No</option>
                         <option value="1">Yes</option>
                       </select>
                     ) : (
                       <span style={{padding:'4px 8px', borderRadius:'12px', fontSize:'0.75rem', fontWeight:700, background:item.is_featured==='1'?'#dcfce7':'#f1f5f9', color:item.is_featured==='1'?'#16a34a':'#64748b'}}>
                         {item.is_featured==='1' ? 'YES' : 'NO'}
                       </span>
                     )}
                   </td>
                   
                   <td style={{padding:'12px'}}>
                     {isEditing ? (
                       <div style={{display:'flex', gap:'8px'}}>
                         <button onClick={()=>handleSave(item.number_id)} disabled={isProcessing} style={{background:'var(--neon-green-dark)', color:'#fff', border:'none', padding:'6px', borderRadius:'4px', cursor:'pointer'}}><Check size={16}/></button>
                         <button onClick={()=>setEditingId(null)} disabled={isProcessing} style={{background:'#ef4444', color:'#fff', border:'none', padding:'6px', borderRadius:'4px', cursor:'pointer'}}><X size={16}/></button>
                       </div>
                     ) : (
                       <button onClick={()=>handleEditClick(item)} style={{background:'transparent', border:'1px solid var(--border-color)', padding:'6px 12px', borderRadius:'4px', cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', fontWeight:600}}>
                         <Edit2 size={14} /> Edit
                       </button>
                     )}
                   </td>
                 </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > displayLimit && (
         <div style={{textAlign:'center', marginTop:'20px'}}>
           <button onClick={()=>setDisplayLimit(p=>p+100)} style={{padding:'10px 20px', background:'#fff', border:'1px solid var(--border-color)', borderRadius:'8px', cursor:'pointer', fontWeight:600}}>Load More</button>
         </div>
      )}

      {/* Bulk Update Modal */}
      {bulkModalOpen && (
        <div style={{position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:9999}}>
          <div style={{background:'#fff', borderRadius:'12px', padding:'32px', width:'400px', maxWidth:'90vw', boxShadow:'0 20px 40px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontSize:'1.2rem', fontWeight:800, marginBottom:'20px', color:'var(--text-main)'}}>Bulk Offer Update ({selectedIds.length} numbers)</h3>
            
            <div style={{marginBottom:'16px'}}>
               <label style={styles.label}>New Offer Price (₹)</label>
               <input type="number" placeholder="Leave empty to keep current" value={bulkForm.offer_price} onChange={(e)=>setBulkForm({...bulkForm, offer_price:e.target.value})} style={styles.fullInput} />
            </div>
            <div style={{marginBottom:'16px', display:'flex', gap:'16px'}}>
               <div style={{flex:1}}>
                 <label style={styles.label}>Start Date</label>
                 <input type="date" value={bulkForm.offer_start_date} onChange={(e)=>setBulkForm({...bulkForm, offer_start_date:e.target.value})} style={styles.fullInput} />
               </div>
               <div style={{flex:1}}>
                 <label style={styles.label}>End Date</label>
                 <input type="date" value={bulkForm.offer_end_date} onChange={(e)=>setBulkForm({...bulkForm, offer_end_date:e.target.value})} style={styles.fullInput} />
               </div>
            </div>
            <div style={{marginBottom:'24px'}}>
               <label style={styles.label}>Is Featured?</label>
               <select value={bulkForm.is_featured} onChange={(e)=>setBulkForm({...bulkForm, is_featured:e.target.value})} style={styles.fullInput}>
                 <option value="">-- Don't Change --</option>
                 <option value="1">Yes (Featured)</option>
                 <option value="0">No (Standard)</option>
               </select>
            </div>

            <div style={{marginBottom:'24px'}}>
               <label style={styles.label}>Operator Name</label>
               <input 
                 type="text" 
                 placeholder="Your Name (Optional)" 
                 value={operatorName} 
                 onChange={(e)=>setOperatorName(e.target.value)} 
                 style={styles.fullInput} 
               />
            </div>

            <div style={{display:'flex', gap:'12px', justifyContent:'flex-end'}}>
               <button onClick={()=>setBulkModalOpen(false)} style={{padding:'10px 20px', background:'#f8fafc', border:'1px solid var(--border-color)', borderRadius:'8px', fontWeight:600, cursor:'pointer'}}>Cancel</button>
               <button onClick={handleBulkSubmit} disabled={isProcessing} style={{padding:'10px 20px', background:'var(--neon-green-dark)', color:'#fff', border:'none', borderRadius:'8px', fontWeight:700, cursor:'pointer'}}>
                 {isProcessing ? 'Updating...' : 'Apply Bulk Update'}
               </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  th: { background:'#f8fafc', padding:'12px', borderBottom:'1px solid var(--border-color)', color:'var(--text-muted)', fontSize:'0.8rem', textTransform:'uppercase', fontWeight:700 },
  input: { padding:'6px 8px', border:'1px solid var(--border-color)', borderRadius:'4px', outline:'none', width:'100%' },
  fullInput: { padding:'10px 14px', border:'1px solid var(--border-color)', borderRadius:'8px', outline:'none', width:'100%', fontSize:'0.9rem' },
  label: { display:'block', fontSize:'0.8rem', fontWeight:600, color:'var(--text-muted)', marginBottom:'6px' }
};
