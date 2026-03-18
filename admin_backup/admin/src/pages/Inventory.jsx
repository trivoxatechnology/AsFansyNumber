import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Search, Filter, SlidersHorizontal, Download, 
  Trash2, Archive, Edit3, Copy, Check, X,
  ChevronDown, ChevronUp, MoreHorizontal, 
  UserPlus, Tag, DollarSign, Calendar, Eye
} from 'lucide-react';
import { getWithAuth, putWithAuth, postWithAuth, deleteWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';
import { CATEGORIES, PATTERN_TYPES } from '../utils/PatternEngine';

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

  useEffect(() => {
    fetchInventory();
    fetchDealers();
  }, []);

  const fetchInventory = async () => {
    setLoading(true);
    const res = await getWithAuth(`${API_BASE}/wp_fn_numbers?limit=10000&order=number_id&dir=desc`);
    const data = await safeJson(res);
    setItems(Array.isArray(data) ? data : (data?.data || []));
    setLoading(false);
  };

  const fetchDealers = async () => {
    const res = await getWithAuth(`${API_BASE}/wp_fn_dealers`);
    const data = await safeJson(res);
    setDealers(data || []);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const s = debouncedSearch.toLowerCase();
      const num = String(item.mobile_number).toLowerCase();
      if (s && !num.includes(s)) return false;

      if (filters.category && item.category !== filters.category) return false;
      if (filters.pattern && item.pattern_type !== filters.pattern) return false;
      if (filters.status && item.number_status !== filters.status) return false;
      if (filters.dealer && item.dealer_id != filters.dealer) return false;

      const price = parseFloat(item.base_price) || 0;
      if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
      if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;

      if (filters.startDate && new Date(item.created_at) < new Date(filters.startDate)) return false;
      if (filters.endDate && new Date(item.created_at) > new Date(filters.endDate)) return false;

      return true;
    });
  }, [items, debouncedSearch, filters]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map(i => i.number_id));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleQuickUpdate = async (id, field, value) => {
    const res = await putWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, { [field]: value });
    if (res.ok) {
      setItems(prev => prev.map(item => item.number_id === id ? { ...item, [field]: value } : item));
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    // In a real app, I'd show a toast here
  };

  const bulkAction = async (action) => {
    if (!selectedIds.length) return;
    
    let endpoint = `${API_BASE}/wp_fn_numbers/bulk-update`;
    let data = { ids: selectedIds, data: {} };

    if (action === 'delete') {
      if (!confirm(`Are you sure you want to delete ${selectedIds.length} numbers?`)) return;
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-delete`;
      data = { ids: selectedIds };
    } else if (action === 'draft') {
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-move-to-draft`;
      data = { ids: selectedIds };
    }

    const res = await postWithAuth(endpoint, data);
    if (res.ok) {
      fetchInventory();
      setSelectedIds([]);
    }
  };

  const renderStatusBadge = (status) => {
    const colors = {
      available: { bg: '#E6F4EA', text: '#1E8E3E' },
      booked: { bg: '#FEF7E0', text: '#F29900' },
      sold: { bg: '#FCE8E6', text: '#D93025' }
    };
    const style = colors[status] || { bg: '#F1F3F4', text: '#5F6368' };
    return (
      <span style={{ 
        padding: '4px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, 
        textTransform: 'uppercase', background: style.bg, color: style.text 
      }}>
        {status}
      </span>
    );
  };

  const renderCategoryBadge = (cat) => {
    const colorMap = {
      Diamond: '#7000FF',
      Platinum: '#0066FF',
      Gold: '#D4AF37',
      Silver: '#808080',
      Normal: '#666666'
    };
    return (
      <span style={{ 
        padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
        background: `${colorMap[cat] || '#eee'}20`, color: colorMap[cat] || '#666',
        border: `1px solid ${colorMap[cat] || '#eee'}40`
      }}>
        {cat}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar */}
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

        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary"><Download size={18} /> Export</button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="card" style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
          <div className="form-group">
            <label>Category</label>
            <select className="input" value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
          alignItems: 'center', boxShadow: '0 4px 12px rgba(112,0,255,0.3)' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Check size={20} />
            <span style={{ fontWeight: 700 }}>{selectedIds.length} items selected</span>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => bulkAction('draft')}>
              <Archive size={16} /> Hide
            </button>
            <button className="btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }} onClick={() => bulkAction('delete')}>
              <Trash2 size={16} /> Delete
            </button>
            <button className="btn" style={{ background: 'white', color: 'var(--primary)' }} onClick={() => setSelectedIds([])}>Cancel</button>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
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
                    <td colSpan="9"><div className="skeleton" style={{ height: '40px', margin: '4px 0' }} /></td>
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
                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>{item.mobile_number}</span>
                        <Copy 
                          size={14} 
                          style={{ cursor: 'pointer', color: '#999' }} 
                          onClick={() => copyToClipboard(item.mobile_number)} 
                        />
                      </div>
                    </td>
                    <td>{renderCategoryBadge(item.category)}</td>
                    <td>
                      <span style={{ fontSize: '11px', color: '#666', fontWeight: 600 }}>{item.pattern_type || '-'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        ₹{item.base_price}
                        <Edit3 size={12} style={{ color: '#ccc', cursor: 'pointer' }} onClick={() => setEditingItem(item)} />
                      </div>
                    </td>
                    <td>
                      <span style={{ color: item.offer_price ? 'var(--danger)' : '#ccc', fontWeight: 700 }}>
                        {item.offer_price ? `₹${item.offer_price}` : '-'}
                      </span>
                    </td>
                    <td>
                      <select 
                        value={item.number_status} 
                        onChange={(e) => handleQuickUpdate(item.number_id, 'number_status', e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="sold">Sold</option>
                      </select>
                      {/* {renderStatusBadge(item.number_status)} */}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', fontWeight: 600 }}>{item.dealer_name || 'Direct'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn-icon" title="Edit Full" onClick={() => setEditingItem(item)}><Edit3 size={16} /></button>
                        <button className="btn-icon" title="Delete" style={{ color: 'var(--danger)' }} onClick={() => bulkAction('delete')}><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredItems.length > 0 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>
              Showing {Math.min(filteredItems.length, 100)} of {filteredItems.length} results
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary btn-sm" disabled>Previous</button>
              <button className="btn btn-secondary btn-sm">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Basic Edit Modal Placeholder */}
      {editingItem && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 1000 
        }}>
          <div className="card" style={{ width: '500px', maxWidth: '95vw', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>Edit Number: {editingItem.mobile_number}</h3>
              <X style={{ cursor: 'pointer' }} onClick={() => setEditingItem(null)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
               <div className="form-group">
                 <label>Base Price</label>
                 <input type="number" className="input" defaultValue={editingItem.base_price} id="edit-base-price" />
               </div>
               <div className="form-group">
                 <label>Offer Price</label>
                 <input type="number" className="input" defaultValue={editingItem.offer_price} id="edit-offer-price" />
               </div>
               <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                 <label>Remarks</label>
                 <textarea className="input" defaultValue={editingItem.remarks} id="edit-remarks" rows={3} style={{ resize: 'none' }} />
               </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                const base = document.getElementById('edit-base-price').value;
                const offer = document.getElementById('edit-offer-price').value;
                const remarks = document.getElementById('edit-remarks').value;
                const res = await putWithAuth(`${API_BASE}/wp_fn_numbers/${editingItem.number_id}`, {
                  base_price: base,
                  offer_price: offer,
                  remarks: remarks
                });
                if (res.ok) {
                  fetchInventory();
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
