import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, 
  Trash2, Archive, Edit3, Copy, Check, X,
  ChevronDown, ChevronUp, MoreHorizontal, 
  Tag, DollarSign, Calendar, Eye, AlertCircle, RefreshCw
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
  
  // View types: 'numbers', 'couples', 'groups'
  const [viewType, setViewType] = useState('numbers');
  const [stats, setStats] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await getWithAuth(`${API_BASE}/wp_fn_numbers/stats`);
      const data = await safeJson(res);
      if (data?.success) setStats(data.stats);
    } catch (err) {
      console.error("Failed to fetch stats", err);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
        let endpoint = `${API_BASE}/wp_fn_numbers?limit=10000&order=number_id&dir=desc`;
        if (viewType === 'couples') endpoint = `${API_BASE}/couples`;
        if (viewType === 'groups') endpoint = `${API_BASE}/groups`;

        const res = await getWithAuth(endpoint);
        const data = await safeJson(res);
        
        let fetchedItems = Array.isArray(data) ? data : (data?.data || []);

        // --- FIXED: Exclude bundle members from the solo numbers view ---
        if (viewType === 'numbers') {
            fetchedItems = fetchedItems.filter(item => {
                const hasCouple = item.couple_id && item.couple_id !== '0' && item.couple_id !== 0;
                const hasGroup = item.group_id && item.group_id !== '0' && item.group_id !== 0;
                return !hasCouple && !hasGroup;
            });
        }

        // If groups, we might need to group them by group_id if not already
        if (viewType === 'groups') {
            const grouped = {};
            fetchedItems.forEach(item => {
                if (!grouped[item.group_id]) {
                    grouped[item.group_id] = { ...item, members: [] };
                }
                grouped[item.group_id].members.push(item);
            });
            fetchedItems = Object.values(grouped);
        }

        setItems(fetchedItems);
    } catch (err) {
        console.error("Failed to fetch inventory", err);
    } finally {
        setLoading(false);
    }
  }, [viewType]);

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
    fetchStats();
  }, [fetchInventory, fetchDealers, fetchStats]);

  const filteredItems = useMemo(() => {
    if (!Array.isArray(items)) return [];
    return items.filter(item => {
      const s = debouncedSearch.toLowerCase();
      
      let searchableText = "";
      if (viewType === 'numbers') searchableText = String(item.mobile_number);
      else if (viewType === 'couples') searchableText = `${item.number_1} ${item.number_2} ${item.couple_label}`;
      else if (viewType === 'groups') searchableText = `${item.group_name} ${item.members?.map(m => m.mobile_number).join(' ')}`;

      if (s && !searchableText.toLowerCase().includes(s)) return false;

      if (viewType === 'numbers') {
        if (filters.category && item.number_category !== filters.category) return false;
        if (filters.pattern && item.pattern_name !== filters.pattern) return false;
        if (filters.status && item.number_status !== filters.status) return false;
      } else if (viewType === 'couples') {
        if (filters.status && item.couple_status !== filters.status) return false;
      } else if (viewType === 'groups') {
        if (filters.status && item.group_status !== filters.status) return false;
      }

      if (filters.dealer && String(item.dealer_id) !== String(filters.dealer)) return false;

      const price = parseFloat(viewType === 'numbers' ? item.base_price : (viewType === 'couples' ? item.couple_price : item.group_price)) || 0;
      if (filters.priceMin && price < parseFloat(filters.priceMin)) return false;
      if (filters.priceMax && price > parseFloat(filters.priceMax)) return false;

      return true;
    });
  }, [items, debouncedSearch, filters, viewType]);

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
    const item = items.find(i => (viewType === 'numbers' ? i.number_id : (viewType === 'couples' ? i.couple_id : i.group_id)) === id);
    if (viewType === 'numbers' && item && (item.couple_id || item.group_id)) {
      toast.error('This number is part of a bundle and cannot be selected individually.');
      return;
    }
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };
  const handleQuickUpdate = async (id, field, value) => {
    let endpoint = `${API_BASE}/wp_fn_numbers/${id}`;
    if (viewType === 'couples') endpoint = `${API_BASE}/wp_fn_couple_numbers/${id}`;
    if (viewType === 'groups') endpoint = `${API_BASE}/wp_fn_number_groups/${id}`;

    const res = await putWithAuth(endpoint, { [field]: value });
    if (res.ok) {
      setItems(prev => prev.map(item => {
        const itemId = viewType === 'numbers' ? item.number_id : (viewType === 'couples' ? item.couple_id : item.group_id);
        return itemId === id ? { ...item, [field]: value } : item;
      }));
      toast.success('Updated successfully');
      fetchStats();
    } else {
      toast.error('Failed to update');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleSyncBundles = async () => {
    try {
      const res = await postWithAuth(`${API_BASE}/sync-bundles`, {});
      if (res.ok) {
        const data = await res.json();
        toast.success(`Sync complete: ${data.groups_synced} groups, ${data.couples_synced} couples updated.`);
        fetchInventory();
        fetchStats();
      } else {
        toast.error('Sync failed');
      }
    } catch (e) {
      toast.error('Network error during sync');
    }
  };

  const bulkAction = async (action) => {
    if (!selectedIds.length) return;
    
    let targetTable = 'wp_fn_numbers';
    if (viewType === 'couples') targetTable = 'wp_fn_couple_numbers';
    if (viewType === 'groups') targetTable = 'wp_fn_number_groups';

    let endpoint = `${API_BASE}/${targetTable}/bulk-update`;
    let data = { ids: selectedIds, data: {} };
    let opType = 'updated';

    if (action === 'delete') {
      endpoint = `${API_BASE}/${targetTable}/bulk-delete`;
      data = { ids: selectedIds };
      opType = 'deleted';
    } else if (action === 'draft') {
      endpoint = `${API_BASE}/${targetTable}/bulk-move-to-draft`;
      data = { ids: selectedIds };
      opType = 'moved_to_draft';
    }

    await runWithLog({
      operationType: opType,
      tableName: targetTable,
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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={handleSyncBundles} title="Repair bundle relationships">
            <RefreshCw size={14} style={{ marginRight: '4px' }} /> Repair
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => { fetchStats(); fetchInventory(); }}>
             <Archive size={14} /> Sync
          </button>
          <button 
            className={`btn ${viewType === 'numbers' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewType('numbers')}
            style={{ borderRadius: '12px' }}
          >
            Solo Numbers ({stats?.solo_total ?? stats?.total ?? 0})
          </button>
          <button 
            className={`btn ${viewType === 'couples' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewType('couples')}
            style={{ borderRadius: '12px' }}
          >
            Couple Packs ({stats?.total_couples || 0})
          </button>
          <button 
            className={`btn ${viewType === 'groups' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewType('groups')}
            style={{ borderRadius: '12px' }}
          >
            Business Groups ({stats?.total_groups || 0})
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Individual (Available)</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats?.available || 0}</span>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Sold Numbers</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{stats?.sold || 0}</span>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Premium (₹50k+)</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--gold-text)' }}>{stats?.premium || 0}</span>
        </div>
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Active Offers</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>{stats?.on_offer || 0}</span>
        </div>
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
              {viewType === 'numbers' ? (
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" checked={selectedIds.length === filteredItems.length && filteredItems.length > 0} onChange={toggleSelectAll} />
                  </th>
                  <th>Num ID</th>
                  <th>Number</th>
                  <th>Category</th>
                  <th>Pattern</th>
                  <th>Couple ID</th>
                  <th>Group ID</th>
                  <th>Base Price</th>
                  <th>Offer Price</th>
                  <th>Status</th>
                  <th>Dealer</th>
                  <th>Actions</th>
                </tr>
              ) : viewType === 'couples' ? (
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" />
                  </th>
                  <th>CP-ID</th>
                  <th>Couple Numbers</th>
                  <th>Label</th>
                  <th>Pair Price (₹)</th>
                  <th>Offer Price (₹)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              ) : (
                <tr>
                  <th style={{ width: '40px' }}>
                    <input type="checkbox" />
                  </th>
                  <th>BG-ID</th>
                  <th>Group Name / Members</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Group Price (₹)</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {loading ? (
                Array(10).fill(0).map((_, i) => (
                  <tr key={i}>
                    <td colSpan="10"><div className="skeleton" style={{ height: '40px', margin: '8px 0' }} /></td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <AlertCircle size={48} />
                      <p>No {viewType} found matching your criteria.</p>
                      <button className="btn btn-secondary" onClick={() => setSearchTerm('')}>Clear Search</button>
                    </div>
                  </td>
                </tr>
              ) : viewType === 'numbers' ? (
                filteredItems.slice(0, 100).map(item => (
                  <tr key={item.number_id} className={selectedIds.includes(item.number_id) ? 'selected' : ''}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.number_id)} 
                        onChange={() => toggleSelect(item.number_id)} 
                        disabled={!!item.couple_id || !!item.group_id}
                      />
                    </td>
                    <td><span style={{ fontSize: '11px', color: '#999' }}>#{item.number_id}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.mobile_number}</span>
                        <Copy size={13} style={{ cursor: 'pointer', color: '#999' }} onClick={() => copyToClipboard(item.mobile_number)} />
                      </div>
                    </td>
                     <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {renderCategoryBadge(item.number_category)}
                        {item.couple_id && <span style={{ fontSize: '10px', background: 'var(--primary-bg)', color: 'var(--primary)', padding: '2px 6px', borderRadius: '4px', width: 'fit-content', fontWeight: 700 }}>COUPLE</span>}
                        {item.group_id && <span style={{ fontSize: '10px', background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: '4px', width: 'fit-content', fontWeight: 700 }}>GROUP</span>}
                      </div>
                    </td>
                    <td><span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{item.pattern_name || '-'}</span></td>
                    <td>{item.couple_id ? <span style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 700 }}>#{item.couple_id}</span> : '-'}</td>
                    <td>{item.group_id ? <span style={{ fontSize: '11px', color: '#92400e', fontWeight: 700 }}>#{item.group_id}</span> : '-'}</td>
                    <td style={{ fontWeight: 700 }}>₹{item.base_price}</td>
                    <td>{item.offer_price ? `₹${item.offer_price}` : '-'}</td>
                    <td>
                      <select value={item.number_status} className="input-select-inline" onChange={(e) => handleQuickUpdate(item.number_id, 'number_status', e.target.value)}>
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="sold">Sold</option>
                      </select>
                    </td>
                    <td><span style={{ fontSize: '12px', color: '#aaa' }}>{item.dealer_name || 'Direct'}</span></td>
                    <td>
                      <button className="btn-icon" onClick={() => setEditingItem(item)}><Edit3 size={15} /></button>
                    </td>
                  </tr>
                ))
              ) : viewType === 'couples' ? (
                filteredItems.map(item => (
                  <tr key={item.couple_id || Math.random()} className={selectedIds.includes(item.couple_id) ? 'selected' : ''}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.couple_id)} 
                        onChange={() => toggleSelect(item.couple_id)}
                      />
                    </td>
                    <td><span style={{ fontSize: '11px', color: '#999' }}>#{item.couple_id}</span></td>
                     <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ fontWeight: 800 }}>{item.number_1 || `ID:${item.number_id_1 || '?'}`}</span>
                        <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{item.number_2 || `ID:${item.number_id_2 || '?'}`}</span>
                      </div>
                    </td>
                    <td><span style={{ fontSize: '12px', fontWeight: 600 }}>{item.couple_label || 'Couple Pack'}</span></td>
                    <td style={{ fontWeight: 700 }}>₹{item.couple_price || 0}</td>
                    <td style={{ color: 'var(--danger)', fontWeight: 700 }}>{item.couple_offer_price ? `₹${item.couple_offer_price}` : '-'}</td>
                    <td>
                      <select value={item.couple_status || 'available'} className="input-select-inline" onChange={(e) => handleQuickUpdate(item.couple_id, 'couple_status', e.target.value)}>
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="sold">Sold</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => setEditingItem(item)}><Edit3 size={15} /></button>
                    </td>
                  </tr>
                ))
              ) : (
                filteredItems.map(item => (
                  <tr key={item.group_id} className={selectedIds.includes(item.group_id) ? 'selected' : ''}>
                    <td>
                      <input 
                        type="checkbox" 
                        checked={selectedIds.includes(item.group_id)} 
                        onChange={() => toggleSelect(item.group_id)}
                      />
                    </td>
                    <td><span style={{ fontSize: '11px', color: '#999' }}>#{item.group_id}</span></td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 800 }}>{item.group_name}</span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {item.members?.map(m => (
                            <div key={m.member_number_id} style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                              <span style={{ fontSize: '10px' }}>{m.mobile_number || 'N/A'}</span>
                              {m.member_couple_id && <span style={{ fontSize: '8px', background: 'var(--primary)', color: 'white', padding: '0 3px', borderRadius: '2px', fontWeight: 800 }}>C</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td><span style={{ textTransform: 'capitalize', fontSize: '12px' }}>{item.group_type}</span></td>
                    <td>{item.members?.length} Nos</td>
                    <td style={{ fontWeight: 700 }}>₹{item.group_price}</td>
                    <td>
                      <select value={item.group_status} className="input-select-inline" onChange={(e) => handleQuickUpdate(item.group_id, 'group_status', e.target.value)}>
                        <option value="available">Available</option>
                        <option value="booked">Booked</option>
                        <option value="sold">Sold</option>
                      </select>
                    </td>
                    <td>
                      <button className="btn-icon" onClick={() => setEditingItem(item)}><Edit3 size={15} /></button>
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
          <div className="card modal-content" style={{ width: '560px', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>
                {viewType === 'numbers' ? `Edit Number: ${editingItem.mobile_number}` : 
                 viewType === 'couples' ? `Edit Couple #${editingItem.couple_id}` : 
                 `Edit Group: ${editingItem.group_name}`}
              </h3>
              <X style={{ cursor: 'pointer', color: '#888' }} onClick={() => setEditingItem(null)} />
            </div>

            {/* ── Couple: Show both numbers at top ── */}
            {viewType === 'couples' && (
              <div style={{ background: '#f0f4ff', border: '1px solid #d0d8f0', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '6px', fontWeight: 600 }}>Couple Numbers</div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#999' }}>Number 1</span>
                    <div style={{ fontWeight: 800, fontSize: '1rem' }}>{editingItem.number_1 || 'N/A'}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: '#999' }}>Number 2</span>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary)' }}>{editingItem.number_2 || 'N/A'}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Group: Show all members at top ── */}
            {viewType === 'groups' && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#92400e', marginBottom: '6px', fontWeight: 600 }}>Group Members ({editingItem.members?.length || 0})</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {editingItem.members?.length > 0 ? editingItem.members.map((m, idx) => (
                    <div key={idx} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontWeight: 800, fontSize: '13px' }}>{m.mobile_number || 'N/A'}</span>
                      <span style={{ fontSize: '9px', color: '#888' }}>ID: {m.member_number_id} • {m.member_status || 'unknown'}</span>
                    </div>
                  )) : (
                    <span style={{ fontSize: '12px', color: '#999' }}>No members found. Use "Repair Relationships" to sync data.</span>
                  )}
                </div>
              </div>
            )}
            
            <div key={editingItem.number_id || editingItem.couple_id || editingItem.group_id} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
               {/* ── Price Fields (all views) ── */}
               <div className="form-group">
                 <label>{viewType === 'numbers' ? 'Base Price' : (viewType === 'couples' ? 'Couple Price' : 'Group Price')}</label>
                 <input type="number" className="input" defaultValue={(viewType === 'numbers' ? editingItem.base_price : (viewType === 'couples' ? editingItem.couple_price : editingItem.group_price)) || ''} id="edit-base-price" />
               </div>
               <div className="form-group">
                 <label>Offer Price</label>
                 <input type="number" className="input" defaultValue={(viewType === 'numbers' ? editingItem.offer_price : (viewType === 'couples' ? editingItem.couple_offer_price : editingItem.group_offer_price)) || ''} id="edit-offer-price" />
               </div>

               {/* ── Status (all views) ── */}
               <div className="form-group">
                 <label>Status</label>
                 <select className="input" id="edit-status" defaultValue={
                   viewType === 'numbers' ? (editingItem.number_status || 'available') :
                   viewType === 'couples' ? (editingItem.couple_status || 'available') :
                   (editingItem.group_status || 'available')
                 }>
                   <option value="available">Available</option>
                   <option value="booked">Booked</option>
                   <option value="sold">Sold</option>
                 </select>
               </div>

               {/* ── Numbers-only: Category ── */}
               {viewType === 'numbers' && (
                 <div className="form-group">
                   <label>Category</label>
                   <select className="input" id="edit-category" defaultValue={editingItem.number_category || 6}>
                     <option value={1}>Diamond</option>
                     <option value={2}>Platinum</option>
                     <option value={3}>Gold</option>
                     <option value={4}>Silver</option>
                     <option value={5}>Bronze</option>
                     <option value={6}>Normal</option>
                     <option value={7}>Couple</option>
                     <option value={8}>Business</option>
                   </select>
                 </div>
               )}

               {/* ── Numbers-only: Pattern ── */}
               {viewType === 'numbers' && (
                 <div className="form-group">
                   <label>Pattern Name</label>
                   <input type="text" className="input" defaultValue={editingItem.pattern_name || ''} id="edit-pattern" />
                 </div>
               )}

               {/* ── Numbers-only: Visibility ── */}
               {viewType === 'numbers' && (
                 <div className="form-group">
                   <label>Visibility</label>
                   <select className="input" id="edit-visibility" defaultValue={editingItem.visibility_status ?? 1}>
                     <option value={1}>Visible</option>
                     <option value={0}>Hidden</option>
                   </select>
                 </div>
               )}

               {/* ── Couples: Mobile Number editing ── */}
               {viewType === 'couples' && (
                 <>
                   <div className="form-group">
                      <label>Number 1 (Mobile) <span style={{ fontSize: '10px', color: '#888' }}>{editingItem.number_id_1 ? `ID:${editingItem.number_id_1}` : ''}</span></label>
                      <input type="text" className="input" defaultValue={editingItem.number_1 || ''} placeholder="e.g. 9999999999" id="edit-n1-mobile" style={{ fontWeight: 700 }} />
                   </div>
                   <div className="form-group">
                      <label>Number 2 (Mobile) <span style={{ fontSize: '10px', color: '#888' }}>{editingItem.number_id_2 ? `ID:${editingItem.number_id_2}` : ''}</span></label>
                      <input type="text" className="input" defaultValue={editingItem.number_2 || ''} placeholder="e.g. 8888888888" id="edit-n2-mobile" style={{ fontWeight: 700, color: 'var(--primary)' }} />
                   </div>
                   <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label>Couple Label</label>
                      <input type="text" className="input" defaultValue={editingItem.couple_label || ''} id="edit-couple-label" />
                   </div>
                 </>
               )}

               {/* ── Groups: Name + Member Mobile editing ── */}
               {viewType === 'groups' && (
                 <>
                   <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                     <label>Group Name</label>
                     <input type="text" className="input" defaultValue={editingItem.group_name || ''} id="edit-group-name" />
                   </div>
                   <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                     <label style={{ marginBottom: '8px', display: 'block' }}>Group Members (Mobile Numbers)</label>
                     <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                       {editingItem.members?.map((m, idx) => (
                         <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                           <input type="text" className="input edit-group-member-mobile" defaultValue={m.mobile_number || ''} placeholder="e.g. 9999999999" style={{ height: '30px', fontSize: '13px', flex: 1, fontWeight: 700 }} />
                           <span style={{ fontSize: '9px', color: '#999', minWidth: '40px' }}>ID: {m.member_number_id}</span>
                         </div>
                       ))}
                       {/* Add extra empty slots to allow adding new members safely */}
                       {Array.from({ length: 4 }).map((_, idx) => (
                         <div key={`new-${idx}`} style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#f8fafc', padding: '8px', borderRadius: '6px', border: '1px dashed #cbd5e1' }}>
                           <input type="text" className="input edit-group-member-mobile" placeholder="+ Add mobile number" style={{ height: '30px', fontSize: '12px', flex: 1, border: 'none', background: 'transparent' }} />
                         </div>
                       ))}
                     </div>
                     <span style={{ fontSize: '11px', color: '#666', marginTop: '8px', display: 'block' }}>Leave inputs blank to remove/ignore members.</span>
                   </div>
                 </>
               )}

               {/* ── Numbers-only: Remarks ── */}
               {viewType === 'numbers' && (
                 <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                   <label>Remarks</label>
                   <textarea className="input" defaultValue={editingItem.remarks || ''} id="edit-remarks" rows={2} style={{ resize: 'none' }} />
                 </div>
               )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={async () => {
                let endpoint = `${API_BASE}/wp_fn_numbers/${editingItem.number_id}`;
                let payload = {};
                const status = document.getElementById('edit-status').value;

                if (viewType === 'numbers') {
                  const base = document.getElementById('edit-base-price').value;
                  const offer = document.getElementById('edit-offer-price').value;
                  const remarks = document.getElementById('edit-remarks').value;
                  const category = document.getElementById('edit-category').value;
                  const pattern = document.getElementById('edit-pattern').value;
                  const visibility = document.getElementById('edit-visibility').value;
                  payload = { 
                    base_price: base, offer_price: offer, remarks, 
                    number_status: status, number_category: category, 
                    pattern_name: pattern, visibility_status: visibility 
                  };
                } else if (viewType === 'couples') {
                  endpoint = `${API_BASE}/wp_fn_couple_numbers/${editingItem.couple_id}`;
                  const base = document.getElementById('edit-base-price').value;
                  const offer = document.getElementById('edit-offer-price').value;
                  const n1 = document.getElementById('edit-n1-mobile').value;
                  const n2 = document.getElementById('edit-n2-mobile').value;
                  const label = document.getElementById('edit-couple-label').value;
                  payload = { couple_price: base, couple_offer_price: offer, number_1: n1, number_2: n2, couple_label: label, couple_status: status };
                } else if (viewType === 'groups') {
                  endpoint = `${API_BASE}/wp_fn_number_groups/${editingItem.group_id}`;
                  const base = document.getElementById('edit-base-price').value;
                  const offer = document.getElementById('edit-offer-price').value;
                  const groupName = document.getElementById('edit-group-name').value;
                  
                  // Collect member mobile numbers
                  const memberInputs = document.querySelectorAll('.edit-group-member-mobile');
                  const memberMobiles = Array.from(memberInputs).map(i => i.value.trim()).filter(v => v);
                  
                  payload = { group_price: base, group_offer_price: offer, group_name: groupName, group_status: status, members: memberMobiles };
                }

                const res = await putWithAuth(endpoint, payload);
                if (res.ok) {
                  fetchInventory();
                  fetchStats();
                  toast.success('Updated successfully');
                  setEditingItem(null);
                } else {
                  toast.error('Failed to update. Check console for details.');
                }
              }}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
