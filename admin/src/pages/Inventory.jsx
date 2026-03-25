import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, 
  Trash2, Archive, Edit3, Copy, Check, X,
  ChevronDown, ChevronUp, MoreHorizontal, 
  Tag, DollarSign, Calendar, Eye, AlertCircle
} from 'lucide-react';
import { getWithAuth, putWithAuth, postWithAuth, deleteWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';
import { CATEGORIES, PATTERN_TYPES, CATEGORY_LABELS } from '../utils/PatternEngine';

import { useToast } from '../components/Toast';
import { useOperator } from '../components/OperatorPrompt';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function Inventory() {
  const toast = useToast();
  const { runWithLog } = useOperator();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 400);

  // Filters
  const [filters, setFilters] = useState({
    category: '',
    pattern: '',
    status: '',
    dealer: '',
    priceMin: '',
    priceMax: '',
    startDate: '',
    endDate: ''
  });

  const [selectedIds, setSelectedIds] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [dealers, setDealers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectCount, setSelectCount] = useState('');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
        const res = await getWithAuth(`${API_BASE}/wp_fn_numbers?limit=10000&order=number_id&dir=desc`);
        const data = await safeJson(res);
        setItems(Array.isArray(data) ? data : (data?.data || []));
    } catch (err) {
        console.error("Failed to fetch inventory", err);
    } finally {
        setLoading(false);
    }
  }, []);

  const fetchDealers = useCallback(async () => {
    try {
        const res = await getWithAuth(`${API_BASE}/wp_fn_dealers`);
        const data = await safeJson(res);
        setDealers(data || []);
    } catch (err) {
        console.error("Failed to fetch dealers", err);
    }
  }, []);

  useEffect(() => {
    fetchInventory();
    fetchDealers();
  }, [fetchInventory, fetchDealers]);

  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter(item => {
      const s = debouncedSearch.toLowerCase();
      const num = String(item.mobile_number).toLowerCase();
      if (s && !num.includes(s)) return false;

      if (filters.category && item.number_category !== filters.category) return false;
      if (filters.pattern && item.pattern_name !== filters.pattern) return false;
      if (filters.status && item.number_status !== filters.status) return false;
      if (filters.dealer && String(item.dealer_id) !== String(filters.dealer)) return false;

      const price = parseFloat(item.base_price) || 0;
      if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
      if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;

      if (filters.startDate && new Date(item.created_at) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(item.created_at) > new Date(filters.endDate)) return false;

      return true;
    });
  }, [items, debouncedSearch, filters]);

  // Unique file sources for select-by-file
  const fileSources = useMemo(() => {
    const sources = new Set();
    items.forEach(i => { if (i.inventory_source) sources.add(i.inventory_source); });
    return [...sources].sort();
  }, [items]);

  // Most common file of selected items (for logging)
  const selectedFileName = useMemo(() => {
    if (!selectedIds.length) return '';
    const counts = {};
    items.filter(i => selectedIds.includes(i.number_id)).forEach(i => {
      const src = i.inventory_source || 'Manual';
      counts[src] = (counts[src] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Admin Operation';
  }, [selectedIds, items]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.number_id));
    }
  };

  const selectByFile = (source) => {
    const ids = items.filter(i => i.inventory_source === source).map(i => i.number_id);
    setSelectedIds(ids);
  };

  const selectByCount = () => {
    const n = parseInt(selectCount) || 0;
    if (n <= 0) return;
    setSelectedIds(filteredItems.slice(0, n).map(i => i.number_id));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleQuickUpdate = async (id, field, value) => {
    const res = await putWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, { [field]: value });
    if (res.ok) {
      setItems(prev => prev.map(item => item.number_id === id ? { ...item, [field]: value } : item));
      toast.success('Number updated successfully');
    } else {
      toast.error('Failed to update number');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const bulkAction = async (action) => {
    if (!selectedIds.length) return;
    
    let endpoint = `${API_BASE}/wp_fn_numbers/bulk-update`;
    let data = { ids: selectedIds, data: {} };
    let opType = 'updated';

    if (action === 'delete') {
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-delete`;
      data = { ids: selectedIds };
      opType = 'deleted';
    } else if (action === 'draft') {
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-move-to-draft`;
      data = { ids: selectedIds };
      opType = 'moved_to_draft';
    }

    await runWithLog({
      operationType: opType,
      tableName: 'wp_fn_numbers',
      fileName: selectedFileName,
      totalRecords: selectedIds.length,
      operationData: `${opType} IDs: ${selectedIds.slice(0, 20).join(',')}${selectedIds.length > 20 ? '...' : ''}`,
      action: async () => {
        const res = await postWithAuth(endpoint, data);
        if (res.ok) {
          fetchInventory();
          setSelectedIds([]);
          return true;
        }
        return false;
      }
    });
  };

  const renderStatusBadge = (status) => {
    const colors = {
      available: { bg: 'var(--success-bg)', text: 'var(--success-text)' },
      booked: { bg: 'var(--warning-bg)', text: 'var(--warning-text)' },
      sold: { bg: 'var(--danger-bg)', text: 'var(--danger-text)' }
    };
    const style = colors[status] || { bg: '#eee', text: '#555' };
    return (
      <span style={{ 
        padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, 
        textTransform: 'uppercase', background: style.bg, color: style.text 
      }}>
        {status}
      </span>
    );
  };

  const renderCategoryBadge = (catId) => {
    const label = CATEGORY_LABELS[catId] || catId;
    const colorMap = {
      Diamond: { bg: 'var(--diamond-bg)', text: 'var(--diamond-text)' },
      Platinum: { bg: 'var(--platinum-bg)', text: 'var(--platinum-text)' },
      Gold: { bg: 'var(--gold-bg)', text: 'var(--gold-text)' },
      Silver: { bg: 'var(--silver-bg)', text: 'var(--silver-text)' },
      Bronze: { bg: 'var(--bronze-bg)', text: 'var(--bronze-text)' },
      Normal: { bg: 'var(--normal-bg)', text: 'var(--normal-text)' },
      Couple: { bg: 'var(--couple-bg)', text: 'var(--couple-text)' },
      Business: { bg: 'var(--business-bg)', text: 'var(--business-text)' }
    };
    const style = colorMap[label] || { bg: '#eee', text: '#666' };
    return (
      <span style={{ 
        padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
        background: style.bg, color: style.text,
        border: `1px solid rgba(0,0,0,0.05)`
      }}>
        {label}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Inventory Manager</h2>
      </div>

      {/* Top Search & Filter Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#999' }} />
          <input 
            type="text" 
            placeholder="Search mobile numbers (e.g. 9999)..." 
            className="input" 
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <button className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(!showFilters)}>
          <Filter size={18} /> {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
      </div>

      {/* Select-by-File / Select-by-Count Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748b' }}>SELECT:</span>
        <button className="btn btn-secondary btn-sm" onClick={toggleSelectAll}>
          {selectedIds.length === filteredItems.length && filteredItems.length > 0 ? 'Deselect All' : `All (${filteredItems.length})`}
        </button>
        <select className="input" style={{ width: '220px', fontSize: '0.82rem' }} value="" onChange={(e) => { if (e.target.value) selectByFile(e.target.value); }}>
          <option value="">Select by File Source...</option>
          {fileSources.map(src => {
            const cnt = items.filter(i => i.inventory_source === src).length;
            return <option key={src} value={src}>{src} ({cnt})</option>;
          })}
        </select>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <input type="number" className="input" placeholder="Count" min="1" value={selectCount} onChange={(e) => setSelectCount(e.target.value)} style={{ width: '80px', fontSize: '0.82rem' }} />
          <button className="btn btn-secondary btn-sm" onClick={selectByCount} disabled={!selectCount}>Select First {selectCount || 'N'}</button>
        </div>
        {selectedIds.length > 0 && <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>✓ {selectedIds.length} selected</span>}
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label>Category</label>
            <select className="input" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
              <option value="">All Categories</option>
              {Object.entries(CATEGORY_LABELS).map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
              <option value="7">Couple</option>
              <option value="8">Business</option>
            </select>
          </div>
          <div className="form-group">
            <label>Pattern Type</label>
            <select className="input" value={filters.pattern} onChange={e => setFilters({...filters, pattern: e.target.value})}>
              <option value="">All Patterns</option>
              {PATTERN_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select className="input" value={filters.status} onChange={e => setFilters({...filters, status: e.target.value})}>
              <option value="">All Statuses</option>
              <option value="available">Available</option>
              <option value="booked">Booked</option>
              <option value="sold">Sold</option>
            </select>
          </div>
          <div className="form-group">
            <label>Dealer</label>
            <select className="input" value={filters.dealer} onChange={e => setFilters({...filters, dealer: e.target.value})}>
              <option value="">All Dealers</option>
              {dealers.map(d => <option key={d.dealer_id} value={d.dealer_id}>{d.dealer_name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Price Min</label>
            <input type="number" className="input" placeholder="0" value={filters.priceMin} onChange={e => setFilters({...filters, priceMin: e.target.value})} />
          </div>
          <div className="form-group">
            <label>Price Max</label>
            <input type="number" className="input" placeholder="Any" value={filters.priceMax} onChange={e => setFilters({...filters, priceMax: e.target.value})} />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button className="btn" style={{ color: 'var(--danger)' }} onClick={() => setFilters({category:'', pattern:'', status:'', dealer:'', priceMin:'', priceMax:'', startDate:'', endDate:''})}>Reset Filters</button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div style={{ 
          position: 'sticky', top: '80px', zIndex: 100, background: 'var(--primary)', color: 'white', 
          padding: '12px 24px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', 
          alignItems: 'center', boxShadow: '0 10px 15px -3px rgba(122, 194, 0, 0.2)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Check size={20} />
            <span style={{ fontWeight: 700 }}>{selectedIds.length} items selected</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" style={{ background: 'rgba(0,0,0,0.1)', color: 'white', border: 'none' }} onClick={() => bulkAction('draft')}>
              <Archive size={16} /> Hide
            </button>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none' }} onClick={() => bulkAction('delete')}>
              <Trash2 size={16} /> Delete
            </button>
            <button className="btn" style={{ background: 'white', color: 'var(--primary)', border: 'none' }} onClick={() => setSelectedIds([])}>Cancel</button>
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ tableLayout: 'auto', whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={selectedIds.length === filteredItems.length && filteredItems.length > 0} onChange={toggleSelectAll} />
                </th>
                <th>Mobile Number</th>
                <th>Category</th>
                <th>Pattern</th>
                <th>Base Price</th>
                <th>Offer Price</th>
                <th>Status</th>
                <th>Dealer</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td colSpan="9"><div className="skeleton" style={{ height: '40px', margin: '8px 0' }} /></td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <AlertCircle size={48} />
                      <p>No numbers found matching your criteria.</p>
                      <button className="btn btn-secondary" onClick={() => setSearchTerm('')}>Clear Search</button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.slice(0, 100).map(item => (
                  <tr key={item.number_id} className={selectedIds.includes(item.number_id) ? 'selected' : ''}>
                    <td>
                      <input type="checkbox" checked={selectedIds.includes(item.number_id)} onChange={() => toggleSelect(item.number_id)} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.mobile_number}</span>
                        <Copy 
                          size={13} 
                          style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} 
                          onClick={() => copyToClipboard(item.mobile_number)} 
                        />
                      </div>
                    </td>
                    <td>{renderCategoryBadge(item.number_category)}</td>
                    <td>
                      <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{item.pattern_name || '-'}</span>
                    </td>
                    <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          ₹{item.base_price}
                          <Edit3 size={12} style={{ color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setEditingItem(item)} />
                        </div>
                    </td>
                    <td>
                      <span style={{ color: item.offer_price ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 700 }}>
                        {item.offer_price ? `₹${item.offer_price}` : '-'}
                      </span>
                    </td>
                    <td>
                      <select 
                        value={item.number_status} 
                        className="input-select-inline"
                        onChange={(e) => handleQuickUpdate(item.number_id, 'number_status', e.target.value)}
                      >
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="sold">Sold</option>
                      </select>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#aaa' }}>{item.dealer_name || 'Direct'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button className="btn-icon" title="Edit Full" onClick={() => setEditingItem(item)}><Edit3 size={15} /></button>
                        <button className="btn-icon" title="Delete" style={{ color: 'var(--danger)' }} onClick={() => bulkAction('delete')}><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredItems.length > 0 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing {Math.min(filteredItems.length, 100)} of {filteredItems.length} results
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary btn-sm" disabled>Previous</button>
              <button className="btn btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingItem && (
        <div className="modal-overlay">
          <div className="card modal-content" style={{ width: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Edit Number: {editingItem.mobile_number}</h3>
              <X style={{ cursor: 'pointer', color: '#888' }} onClick={() => setEditingItem(null)} />
            </div>
            
            <div key={editingItem.number_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
               <div className="form-group">
                 <label>Base Price</label>
                 <input type="number" className="input" defaultValue={editingItem.base_price || ''} id="edit-base-price" />
               </div>
               <div className="form-group">
                 <label>Offer Price</label>
                 <input type="number" className="input" defaultValue={editingItem.offer_price || ''} id="edit-offer-price" />
               </div>
               <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                 <label>Remarks</label>
                 <textarea className="input" defaultValue={editingItem.remarks || ''} id="edit-remarks" rows={2} style={{ resize: 'none' }} />
               </div>
               <div className="form-group">
                 <label>Couple Number ID</label>
                 <input type="number" className="input" defaultValue={editingItem.couple_number_id || ''} id="edit-couple-id" />
               </div>
               <div className="form-group">
                 <label>Group Number ID</label>
                 <input type="number" className="input" defaultValue={editingItem.group_number_id || ''} id="edit-group-id" />
               </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                const base = document.getElementById('edit-base-price').value;
                const offer = document.getElementById('edit-offer-price').value;
                const remarks = document.getElementById('edit-remarks').value;
                const couple = document.getElementById('edit-couple-id').value;
                const group = document.getElementById('edit-group-id').value;
                const res = await putWithAuth(`${API_BASE}/wp_fn_numbers/${editingItem.number_id}`, {
                  base_price: base,
                  offer_price: offer,
                  remarks: remarks,
                  couple_number_id: couple,
                  group_number_id: group
                });
                if (res.ok) {
                  fetchInventory();
                  toast.success('Number updated successfully');
                  setEditingItem(null);
                }
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
