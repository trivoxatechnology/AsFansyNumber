import { useState, useEffect } from 'react';
import { Search, Edit2, Check, X, Filter, RefreshCw } from 'lucide-react';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(500);
  const [fileFilter, setFileFilter] = useState('');
  const [bulkModal, setBulkModal] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkUser, setBulkUser] = useState(localStorage.getItem('adminUsername') || '');
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');

  useEffect(() => {
    async function fetchInventory() {
      setLoading(true);
      try {
        const res = await fetch('https://asfancynumber.com/fancy_number/api.php/wp_fn_numbers?limit=600000');
        if (res.ok) {
          const data = await res.json();
          setInventory(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error('Failed to fetch inventory', err);
        setInventory([]);
      } finally {
        setLoading(false);
      }
    }
    fetchInventory();
  }, []);

  const handleEditClick = (item) => {
    setEditingId(item.number_id);
    setEditForm({ ...item });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    // Strip internal React fields before sending to API
    const { _rowId, _status, _errors, _isDbDupe, _operation, pattern_value, auto_category, ...cleanForm } = editForm;
    try {
      const res = await fetch(`https://asfancynumber.com/fancy_number/api.php/wp_fn_numbers/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cleanForm)
      });
      if (res.ok) {
        setInventory(prev => prev.map(item => item.number_id === editingId ? { ...item, ...cleanForm } : item));
      } else {
        alert("Failed to update database.");
      }
    } catch(err) {
      console.error(err);
      alert("Error saving record.");
    }
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to permanently delete this number?")) return;
    try {
      const res = await fetch(`https://asfancynumber.com/fancy_number/api.php/wp_fn_numbers/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setInventory(prev => prev.filter(item => item.number_id !== id));
      } else {
        alert("Failed to delete record.");
      }
    } catch(err) {
      console.error(err);
      alert("Error deleting record.");
    }
  };

  const availableFiles = [...new Set(inventory.map(i => i.inventory_source).filter(Boolean))];

  const filteredInventory = inventory.filter(item => {
    const matchSearch = String(item.mobile_number||'').includes(searchTerm);
    const matchFile = fileFilter ? item.inventory_source === fileFilter : true;
    return matchSearch && matchFile;
  });

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(filteredInventory.map(item => item.number_id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkAction = (action) => {
    if (selectedIds.length === 0) return alert('Select numbers first!');
    setBulkModal(action);
    setBulkValue('');
  };

  const API = 'https://asfancynumber.com/fancy_number/api.php';

  const executeBulkAction = async () => {
    if (!bulkModal) return;
    setBulkProcessing(true);
    const ids = [...selectedIds];
    let success = 0, failed = 0;
    const CHUNK = 5;

    if (bulkModal === 'delete_numbers') {
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        setBulkProgress(`Deleting ${i+1}–${Math.min(i+CHUNK, ids.length)} of ${ids.length}…`);
        const results = await Promise.all(
          chunk.map(id => fetch(`${API}/wp_fn_numbers/${id}`, {method:'DELETE'}).then(r=>r.ok?1:0).catch(()=>0))
        );
        success += results.reduce((s,v)=>s+v,0);
        failed += results.reduce((s,v)=>s+(1-v),0);
      }
      setInventory(prev => prev.filter(item => !ids.includes(item.number_id)));
    } else {
      // Build the update payload based on action
      let payload = {};
      if (bulkModal === 'update_price') payload = { base_price: bulkValue };
      else if (bulkModal === 'update_category') payload = { number_category: bulkValue };
      else if (bulkModal === 'update_status') payload = { number_status: bulkValue };
      else if (bulkModal === 'hide_numbers') payload = { visibility_status: '0' };

      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        setBulkProgress(`Updating ${i+1}–${Math.min(i+CHUNK, ids.length)} of ${ids.length}…`);
        const results = await Promise.all(
          chunk.map(id => fetch(`${API}/wp_fn_numbers/${id}`, {
            method:'PUT',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(payload)
          }).then(r=>r.ok?1:0).catch(()=>0))
        );
        success += results.reduce((s,v)=>s+v,0);
        failed += results.reduce((s,v)=>s+(1-v),0);
      }
      // Update local state
      setInventory(prev => prev.map(item => ids.includes(item.number_id) ? {...item, ...payload} : item));
    }

    // Log the bulk action
    const opName = bulkModal.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    const finalUser = bulkUser.trim() || 'Unknown';
    const now = new Date();
    try {
      await fetch(`${API}/wp_fn_upload_batches`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          file_name: `Bulk Action|||${finalUser}|||${opName}: ${success}`,
          uploaded_by: finalUser,
          total_records: ids.length
        })
      });
    } catch {}

    setBulkProcessing(false);
    setBulkProgress('');
    setBulkModal(null);
    setSelectedIds([]);
    alert(`Bulk ${opName} complete!\nSuccess: ${success}  |  Failed: ${failed}\nBy: ${finalUser}  |  At: ${now.toLocaleString()}`);
  };

  // Calculate Dashboard KPI using filtered data (no is_featured - auto-ranking instead)
  const totalNumbers = filteredInventory.length;
  const availableCount = filteredInventory.filter(n => n.number_status === 'available').length;
  const soldCount = filteredInventory.filter(n => n.number_status === 'sold').length;
  const offerCount = filteredInventory.filter(n => n.offer_price && parseFloat(n.offer_price) > 0).length;
  const premiumCount = filteredInventory.filter(n => parseFloat(n.base_price) > 50000).length;

  return (
    <div>
      <div style={styles.header}>
        <h2 style={styles.title}>Inventory Management</h2>
        <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
          {availableFiles.length > 0 && (
            <select 
              value={fileFilter} 
              onChange={(e) => setFileFilter(e.target.value)}
              style={styles.fileSelect}
            >
              <option value="">All Uploaded Files</option>
              {availableFiles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <div style={styles.searchBar}>
            <Search size={20} style={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search mobile number..." 
              style={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* DASHBOARD KPI CARDS */}
      <div style={styles.dashboardGrid}>
         <div style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Total Numbers</p>
            <h3 style={styles.kpiValue}>{totalNumbers}</h3>
         </div>
         <div style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Available</p>
            <h3 style={{...styles.kpiValue, color: 'var(--neon-green-dark)'}}>{availableCount}</h3>
         </div>
         <div style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Sold</p>
            <h3 style={{...styles.kpiValue, color: '#ef4444'}}>{soldCount}</h3>
         </div>
         <div style={styles.kpiCard}>
            <p style={styles.kpiLabel}>On Offer</p>
            <h3 style={{...styles.kpiValue, color: '#3b82f6'}}>{offerCount}</h3>
         </div>
         <div style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Premium (&gt;₹50k)</p>
            <h3 style={{...styles.kpiValue, color: '#f59e0b'}}>{premiumCount}</h3>
         </div>
      </div>

      <div style={styles.tableCard}>
        {/* BULK ACTION BAR */}
        {selectedIds.length > 0 && (
          <div style={styles.bulkActionBar}>
             <span style={styles.bulkCount}>{selectedIds.length} numbers selected</span>
             <div style={styles.bulkActions}>
                <select 
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBulkAction(e.target.value);
                      e.target.value = ""; // reset
                    }
                  }} 
                  style={styles.bulkSelect}
                >
                  <option value="">-- Apply Bulk Action --</option>
                  <option value="update_price">Update Base Price</option>
                  <option value="update_category">Change Category</option>
                  <option value="update_status">Change Status</option>
                  <option value="hide_numbers">Hide Numbers (Draft)</option>
                  <option value="delete_numbers">Delete Selected</option>
                </select>
             </div>
          </div>
        )}

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{...styles.th, width: '40px', textAlign: 'center'}}>
                  <input 
                    type="checkbox" 
                    onChange={handleSelectAll} 
                    checked={filteredInventory.length > 0 && selectedIds.length === filteredInventory.length}
                  />
                </th>
                <th style={styles.th}>Mobile Number</th>
                <th style={styles.th}>Source File</th>
                <th style={styles.th}>Base Price (₹)</th>
                <th style={styles.th}>Offer Price (₹)</th>
                <th style={styles.th}>Category ID</th>
                <th style={styles.th}>Incharge</th>
                <th style={styles.th}>WhatsApp Group</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="10" style={{...styles.td, textAlign:'center', padding:'30px', color:'var(--text-muted)'}}>
                  <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'10px'}}>
                    <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                    <RefreshCw size={20} style={{animation:'spin 1s linear infinite',color:'var(--neon-green-dark)'}}/> 
                    Fetching full inventory...
                  </div>
                </td></tr>
              ) : filteredInventory.length === 0 ? (
                <tr><td colSpan="10" style={{...styles.td, textAlign:'center', padding:'30px', color:'var(--text-muted)'}}>No numbers found in inventory.</td></tr>
              ) : filteredInventory.slice(0, displayLimit).map(item => {
                const isEditing = editingId === item.number_id;
                const isSelected = selectedIds.includes(item.number_id);
                
                return (
                  <tr key={item.number_id} style={isEditing || isSelected ? styles.editingRow : {}}>
                    <td style={{...styles.td, textAlign: 'center'}}>
                      <input 
                        type="checkbox" 
                        checked={isSelected} 
                        onChange={() => handleSelectRow(item.number_id)}
                      />
                    </td>
                    <td style={styles.td}>
                      {isEditing ? (
                        <input type="text" name="mobile_number" value={editForm.mobile_number} onChange={handleChange} style={styles.editInput} />
                      ) : (
                        <b>{item.mobile_number}</b>
                      )}
                    </td>

                    <td style={{...styles.td, fontSize:'0.8rem', color:'var(--text-muted)'}}>{item.inventory_source || '—'}</td>
                    
                    <td style={styles.td}>
                      {isEditing ? (
                        <input type="number" name="base_price" value={editForm.base_price} onChange={handleChange} style={styles.editInput} />
                      ) : (
                        item.base_price
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input type="number" name="offer_price" value={editForm.offer_price || ''} onChange={handleChange} style={styles.editInput} />
                      ) : (
                        item.offer_price || '-'
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input type="number" name="number_category" value={editForm.number_category} onChange={handleChange} style={{...styles.editInput, width: '60px'}} />
                      ) : (
                        item.number_category || '-'
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input type="text" name="primary_incharge_name" value={editForm.primary_incharge_name} onChange={handleChange} style={styles.editInput} />
                      ) : (
                        item.primary_incharge_name || '-'
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <input type="text" name="whatsapp_group_name" value={editForm.whatsapp_group_name} onChange={handleChange} style={styles.editInput} />
                      ) : (
                        item.whatsapp_group_name || '-'
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <select name="number_status" value={editForm.number_status} onChange={handleChange} style={styles.editInput}>
                          <option value="available">Available</option>
                          <option value="booked">Booked</option>
                          <option value="sold">Sold</option>
                        </select>
                      ) : (
                        <span style={(item.number_status||'') === 'available' ? styles.statusGreen : styles.statusRed}>
                          {(item.number_status||'unknown').toUpperCase()}
                        </span>
                      )}
                    </td>

                    <td style={styles.td}>
                      {isEditing ? (
                        <div style={styles.actionBtns}>
                          <button onClick={handleSave} style={styles.saveBtn} title="Save Changes"><Check size={16} /></button>
                          <button onClick={() => alert("WhatsApp Share Hook Triggered")} style={styles.waShareBtn} title="Share to Group">W/A Share</button>
                          <button onClick={() => alert("WhatsApp Remove Hook Triggered")} style={styles.waRemoveBtn} title="Remove from Group">W/A Remove</button>
                          <button onClick={handleCancel} style={styles.cancelBtn} title="Cancel"><X size={16} /></button>
                        </div>
                      ) : (
                        <div style={{display:'flex', gap:'8px'}}>
                          <button onClick={() => handleEditClick(item)} style={styles.editBtn}>
                            <Edit2 size={16} /> Edit
                          </button>
                          <button onClick={() => handleDelete(item.number_id)} style={{...styles.editBtn, borderColor:'#ef4444', color:'#ef4444'}}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredInventory.length > 0 && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', padding:'16px', background:'#f8fafc', borderBottomLeftRadius:'var(--radius-md)', borderBottomRightRadius:'var(--radius-md)', borderTop:'1px solid var(--border-color)'}}>
            <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight:600}}>
              Showing {Math.min(displayLimit, filteredInventory.length).toLocaleString()} of {filteredInventory.length.toLocaleString()} numbers
            </span>
            {filteredInventory.length > displayLimit && (
              <button 
                onClick={()=>setDisplayLimit(p=>p+500)} 
                style={{padding:'8px 16px',background:'white',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:600,color:'var(--text-main)'}}
              >
                Load Next 500 Numbers
              </button>
            )}
          </div>
        )}
      </div>

      {/* ─── BULK ACTION MODAL ─── */}
      {bulkModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'#fff',borderRadius:'16px',padding:'32px',width:'420px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontSize:'1.15rem',fontWeight:800,marginBottom:'6px',color:'var(--text-main)'}}>
              {bulkModal === 'delete_numbers' ? '🗑 Delete' : '✏️ Bulk Update'} — {selectedIds.length} Numbers
            </h3>
            <p style={{color:'var(--text-muted)',fontSize:'0.88rem',marginBottom:'20px'}}>
              {bulkModal === 'delete_numbers' 
                ? 'This will permanently delete all selected numbers from the database.' 
                : `Enter the new value to apply to all ${selectedIds.length} selected numbers.`}
            </p>

            {bulkModal !== 'delete_numbers' && bulkModal !== 'hide_numbers' && (
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'0.85rem',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px'}}>
                  {bulkModal === 'update_price' ? 'New Base Price (₹)' : bulkModal === 'update_category' ? 'New Category' : 'New Status'}
                </label>
                {bulkModal === 'update_status' ? (
                  <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none'}}>
                    <option value="">Select status</option>
                    <option value="available">Available</option>
                    <option value="booked">Booked</option>
                    <option value="sold">Sold</option>
                  </select>
                ) : (
                  <input 
                    type={bulkModal === 'update_price' ? 'number' : 'text'}
                    value={bulkValue} 
                    onChange={e => setBulkValue(e.target.value)}
                    placeholder={bulkModal === 'update_price' ? 'e.g. 5000' : 'e.g. Premium'}
                    style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none'}}
                  />
                )}
              </div>
            )}

            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'0.85rem',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px'}}>Your Name</label>
              <input 
                type="text"
                value={bulkUser}
                onChange={e => setBulkUser(e.target.value)}
                placeholder="e.g. John Doe"
                style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none'}}
              />
            </div>

            {bulkProcessing && (
              <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px',color:'#3b82f6',fontWeight:600,fontSize:'0.9rem'}}>
                <RefreshCw size={18} style={{animation:'spin 1s linear infinite'}}/> {bulkProgress}
              </div>
            )}

            <div style={{display:'flex',gap:'12px',justifyContent:'flex-end'}}>
              <button 
                onClick={() => { setBulkModal(null); setBulkProgress(''); }} 
                disabled={bulkProcessing}
                style={{padding:'10px 18px',background:'#f1f5f9',border:'1px solid var(--border-color)',borderRadius:'8px',cursor:'pointer',fontWeight:600,color:'var(--text-muted)'}}
              >Cancel</button>
              <button 
                onClick={executeBulkAction} 
                disabled={bulkProcessing || (bulkModal !== 'delete_numbers' && bulkModal !== 'hide_numbers' && !bulkValue)}
                style={{padding:'10px 18px',background: bulkModal === 'delete_numbers' ? '#ef4444' : 'var(--neon-green-dark)',color:'#fff',border:'none',borderRadius:'8px',cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',gap:'6px'}}
              >
                {bulkProcessing ? 'Processing...' : bulkModal === 'delete_numbers' ? 'Confirm Delete' : 'Apply Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const styles = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px'
  },
  title: {
    fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)'
  },
  searchBar: {
    position: 'relative', width: '300px'
  },
  searchIcon: {
    position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%', padding: '10px 10px 10px 40px', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)'
  },
  fileSelect: {
    padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600
  },
  dashboardGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px'
  },
  kpiCard: {
    background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center'
  },
  kpiLabel: {
    fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px'
  },
  kpiValue: {
    fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)'
  },
  bulkActionBar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e0f2fe',
    padding: '12px 20px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid #bae6fd'
  },
  bulkCount: {
    fontWeight: 700, color: '#0369a1', fontSize: '0.9rem'
  },
  bulkActions: {
    display: 'flex', gap: '12px'
  },
  bulkSelect: {
    padding: '8px 12px', borderRadius: '4px', border: '1px solid #7dd3fc', 
    background: '#fff', outline: 'none', fontWeight: 600, color: 'var(--text-main)'
  },
  tableCard: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)',
    border: '1px solid var(--border-color)', padding: '20px'
  },
  tableWrapper: {
    overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)'
  },
  table: {
    width: '100%', borderCollapse: 'collapse', textAlign: 'left'
  },
  th: {
    background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
    color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase'
  },
  td: {
    padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem'
  },
  editingRow: {
    background: '#f1f5f9'
  },
  editInput: {
    width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none'
  },
  statusGreen: {
    background: 'rgba(122, 194, 0, 0.1)', color: 'var(--neon-green-dark)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700
  },
  statusRed: {
    background: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700
  },
  editBtn: {
    background: 'transparent', border: '1px solid var(--border-color)', padding: '6px 12px',
    borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600
  },
  actionBtns: {
    display: 'flex', gap: '8px', flexWrap: 'wrap'
  },
  saveBtn: {
    background: 'var(--neon-green-dark)', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer'
  },
  waShareBtn: {
    background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
  },
  waRemoveBtn: {
    background: '#f59e0b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700
  },
  cancelBtn: {
    background: '#ef4444', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer'
  }
};
