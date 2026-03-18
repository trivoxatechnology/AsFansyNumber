<<<<<<< HEAD
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search, Filter, 
  Trash2, Archive, Edit3, Copy, Check, X,
  ChevronDown, ChevronUp, MoreHorizontal, 
  Tag, DollarSign, Calendar, Eye, AlertCircle
} from 'lucide-react';
import { getWithAuth, putWithAuth, postWithAuth, deleteWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';
import { CATEGORIES, PATTERN_TYPES } from '../utils/PatternEngine';

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
=======
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';
import { usePageData } from '../utils/usePageData';
import { BannerView } from '../utils/BannerView';
import { Cache } from '../utils/cache';
import { useImport } from '../context/ImportContext';
import { writeOperationLog } from '../utils/operationLog';
import { API_BASE } from '../config/api';
import { CATEGORIES, PATTERN_TYPES, identifyCouples } from '../utils/PatternEngine';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmModal';

const styles = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)' },
  searchBar: { position: 'relative', width: '300px' },
  searchIcon: { position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' },
  searchInput: { width: '100%', padding: '10px 10px 10px 40px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)' },
  fileSelect: { padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-card)', color: 'var(--text-main)', fontWeight: 600 },
  dashboardGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px', marginBottom: '24px' },
  kpiCard: { background: 'var(--bg-card)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', textAlign: 'center' },
  kpiLabel: { fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '4px' },
  kpiValue: { fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)' },
  bulkActionBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#e0f2fe', padding: '12px 20px', borderRadius: 'var(--radius-md)', marginBottom: '16px', border: '1px solid #bae6fd' },
  bulkCount: { fontWeight: 700, color: '#0369a1', fontSize: '0.9rem' },
  bulkActions: { display: 'flex', gap: '12px' },
  bulkSelect: { padding: '8px 12px', borderRadius: '4px', border: '1px solid #7dd3fc', background: '#fff', outline: 'none', fontWeight: 600, color: 'var(--text-main)' },
  tableCard: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)', padding: '20px' },
  tableWrapper: { overflowX: 'auto', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left' },
  th: { background: '#f8fafc', padding: '12px 16px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase' },
  td: { padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '0.95rem' },
  editingRow: { background: '#f1f5f9' },
  editInput: { width: '100%', padding: '6px', border: '1px solid var(--border-color)', borderRadius: '4px', outline: 'none' },
  statusGreen: { background: 'rgba(122, 194, 0, 0.1)', color: 'var(--neon-green-dark)', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 },
  statusRed: { background: '#fee2e2', color: '#ef4444', padding: '4px 8px', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 700 },
  editBtn: { background: 'transparent', border: '1px solid var(--border-color)', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 },
  filterBtn: { padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' },
  actionBtns: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  saveBtn: { background: 'var(--neon-green-dark)', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' },
  waShareBtn: { background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 },
  waRemoveBtn: { background: '#f59e0b', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 },
  cancelBtn: { background: '#ef4444', color: '#fff', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer' }
};

export default function Inventory() {
  const toast = useToast();
  const confirm = useConfirm();
  const [inventory, setInventory] = useState(() => Cache.get('fn_inv') || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [selectedIds, setSelectedIds] = useState([]);
  const [displayLimit, setDisplayLimit] = useState(500);
  const [fileFilter, setFileFilter] = useState('');
  const [bulkModal, setBulkModal] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkUser, setBulkUser] = useState(localStorage.getItem('adminUsername') || '');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [patternFilter, setPatternFilter] = useState('');
  const [showCouplesOnly, setShowCouplesOnly] = useState(false);
  const [showBusinessOnly, setShowBusinessOnly] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const { hasActiveJobs } = useImport();

  const fetchInventory = useCallback(async () => {
    const res = await fetchWithAuth(
      `${API_BASE}/wp_fn_numbers?limit=20000&visibility_status=1&order=number_id&dir=desc`
    );
    if (!res || !res.ok) return null;
    const json = await res.json();
    // Handle both old format (array) and new v4.0 format ({data, total})
    if (Array.isArray(json)) return json;
    if (json?.data && Array.isArray(json.data)) return json.data;
    return null;
  }, []);

  const { data: invData, loading, showBanner, refresh }
    = usePageData(fetchInventory, 'fn_inv', 60000);

  useEffect(() => {
    if (invData) setInventory(invData);
  }, [invData]);

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
    const { _rowId, _status, _errors, _isDbDupe, _operation, pattern_value: _pv, auto_category: _ac, category_name: _cn, pattern_name: _pn, vip_score: _vs, subcategory: _sc, auto_detected: _ad, number_type: _nt, ...cleanForm } = editForm;
    const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/${editingId}`, {
      method: 'PUT',
      body: JSON.stringify(cleanForm)
    });
    if (!res || !res.ok) { toast.error('Update failed'); return; }

    const updated = inventory.map(item => item.number_id === editingId ? { ...item, ...cleanForm } : item);
    setInventory(updated);
    Cache.set('fn_inv', updated);

    await writeOperationLog({
      fileName: 'Inventory Edit',
      operationType: 'Single Update',
      operationData: `Inventory row updated: ${editingId}`,
      totalRecords: 1,
      tableName: 'wp_fn_numbers',
      adminName: localStorage.getItem('adminUsername') || 'Admin',
    });
    setEditingId(null);
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Delete Number', 'Permanently delete this number? This cannot be undone.', 'danger');
    if (!ok) return;
    const res = await fetchWithAuth(`${API_BASE}/wp_fn_numbers/${id}`, { method: 'DELETE' });
    if (!res || !res.ok) { toast.error('Delete failed'); return; }

    const updated = inventory.filter(item => item.number_id !== id);
    setInventory(updated);
    Cache.set('fn_inv', updated);

    await writeOperationLog({
      fileName: 'Inventory Delete',
      operationType: 'Single Delete',
      operationData: `Inventory row deleted: ${id}`,
      totalRecords: 1,
      tableName: 'wp_fn_numbers',
      adminName: localStorage.getItem('adminUsername') || 'Admin',
    });
  };

  const availableFiles = useMemo(() => [...new Set(inventory.map(i => i.inventory_source).filter(Boolean))], [inventory]);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const matchSearch = String(item.mobile_number||'').includes(searchTerm);
      const matchFile = fileFilter ? item.inventory_source === fileFilter : true;
      const matchCategory = categoryFilter ? item.category === categoryFilter : true;
      const matchPattern = patternFilter ? item.pattern_type === patternFilter : true;
      const matchBusiness = showBusinessOnly ? (item.pattern_type||'').toLowerCase().includes('business') : true;
      return matchSearch && matchFile && matchCategory && matchPattern && matchBusiness;
    });
  }, [inventory, searchTerm, fileFilter, categoryFilter, patternFilter, showBusinessOnly]);

  const coupleGroups = useMemo(() => showCouplesOnly ? identifyCouples(filteredInventory) : [], [showCouplesOnly, filteredInventory]);
  const coupleFlatList = useMemo(() => showCouplesOnly ? coupleGroups.flat().map(n => n.number_id) : [], [showCouplesOnly, coupleGroups]);
  
  const finalDisplay = useMemo(() => showCouplesOnly 
    ? filteredInventory.filter(n => coupleFlatList.includes(n.number_id))
    : filteredInventory, [showCouplesOnly, filteredInventory, coupleFlatList]);
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f

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

      if (filters.category && item.category !== filters.category) return false;
      if (filters.pattern && item.pattern_type !== filters.pattern) return false;
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

<<<<<<< HEAD
  const renderCategoryBadge = (cat) => {
    const colorMap = {
      Diamond: { bg: 'var(--diamond-bg)', text: 'var(--diamond-text)' },
      Platinum: { bg: 'var(--platinum-bg)', text: 'var(--platinum-text)' },
      Gold: { bg: 'var(--gold-bg)', text: 'var(--gold-text)' },
      Silver: { bg: 'var(--silver-bg)', text: 'var(--silver-text)' },
      Normal: { bg: 'var(--normal-bg)', text: 'var(--normal-text)' }
    };
    const style = colorMap[cat] || { bg: '#eee', text: '#666' };
    return (
      <span style={{ 
        padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
        background: style.bg, color: style.text,
        border: `1px solid rgba(0,0,0,0.05)`
      }}>
        {cat}
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
=======
  const handleBulkAction = (action) => {
    if (selectedIds.length === 0) return toast.warn('Select numbers first!');
    setBulkModal(action);
    setBulkValue('');
  };

  const executeBulkAction = async () => {
    if (!bulkModal) return;
    const ids = [...selectedIds];
    const actionToRun = bulkModal;
    const valueToRun = bulkValue;
    const finalUser = bulkUser.trim() || localStorage.getItem('adminUsername') || 'Admin';

    setBulkModal(null);
    setSelectedIds([]);
    setBulkProgress('Processing...');

    let endpoint = '';
    let body = { ids };
    let actionLabel = '';

    if (actionToRun === 'delete_numbers') {
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-delete`;
      actionLabel = 'deleted';
    } else if (actionToRun === 'hide_numbers') {
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-move-to-draft`;
      actionLabel = 'moved to draft';
    } else {
      endpoint = `${API_BASE}/wp_fn_numbers/bulk-update`;
      const fieldMap = {
        update_price: { base_price: valueToRun },
        update_category: { category: valueToRun },
        update_status: { number_status: valueToRun },
      };
      const data = fieldMap[actionToRun];
      body = { ids, data };
      actionLabel = 'updated';
    }

    const res = await fetchWithAuth(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    const resp = res && res.ok ? await res.json() : null;
    const count = resp?.deleted ?? resp?.moved ?? resp?.updated ?? resp?.processed ?? 0;

    let updatedInv = inventory;
    if (actionToRun === 'delete_numbers' || actionToRun === 'hide_numbers') {
      updatedInv = inventory.filter(item => !ids.includes(item.number_id));
    } else {
      const fieldMap = {
        update_price: { base_price: valueToRun },
        update_category: { category: valueToRun },
        update_status: { number_status: valueToRun },
      };
      updatedInv = inventory.map(item =>
        ids.includes(item.number_id) ? { ...item, ...fieldMap[actionToRun] } : item
      );
    }
    setInventory(updatedInv);
    Cache.set('fn_inv', updatedInv);

    await writeOperationLog({
      fileName: 'Inventory Bulk Action',
      operationType: actionToRun,
      operationData: `${count} records ${actionLabel}`,
      totalRecords: count,
      tableName: 'wp_fn_numbers',
      adminName: finalUser
    });

    setBulkProgress(`✅ ${count} ${actionLabel}`);
    setTimeout(() => setBulkProgress(''), 3000);
  };

  const availableCount = useMemo(() => finalDisplay.filter(n => n.number_status === 'available').length, [finalDisplay]);
  const soldCount = useMemo(() => finalDisplay.filter(n => n.number_status === 'sold').length, [finalDisplay]);
  const offerCount = useMemo(() => finalDisplay.filter(n => n.offer_price && parseFloat(n.offer_price) > 0).length, [finalDisplay]);
  const premiumCount = useMemo(() => finalDisplay.filter(n => parseFloat(n.base_price) > 50000).length, [finalDisplay]);

  return (
    <div>
      <div style={styles.header}>
        <div style={{display:'flex', flexDirection:'column'}}>
          <h2 style={styles.title}>Inventory Management</h2>
          <BannerView show={showBanner} onRetry={refresh} />
        </div>
        <div style={{display:'flex', gap:'16px', alignItems:'center'}}>
          <button 
            onClick={()=>setShowCouplesOnly(!showCouplesOnly)}
            style={{...styles.filterBtn, background: showCouplesOnly ? '#f0f9ff' : 'white', borderColor: showCouplesOnly ? '#0ea5e9' : 'var(--border-color)'}}
          >
            {showCouplesOnly ? '👥 Showing Couples' : '👥 Find Couples'}
          </button>
          <button 
            onClick={()=>setShowBusinessOnly(!showBusinessOnly)}
            style={{...styles.filterBtn, background: showBusinessOnly ? '#fffcf0' : 'white', borderColor: showBusinessOnly ? '#eab308' : 'var(--border-color)'}}
          >
            {showBusinessOnly ? '💼 Showing Business' : '💼 Business Numbers'}
          </button>
          {availableFiles.length > 0 && (
            <select value={fileFilter} onChange={(e) => setFileFilter(e.target.value)} style={styles.fileSelect}>
              <option value="">All Uploaded Files</option>
              {availableFiles.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          )}
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={styles.fileSelect}>
            <option value="">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={patternFilter} onChange={(e) => setPatternFilter(e.target.value)} style={styles.fileSelect}>
            <option value="">All Pattern Types</option>
            {[...new Set(inventory.map(i => i.pattern_type).filter(Boolean))].sort().map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div style={styles.searchBar}>
            <Search size={20} style={styles.searchIcon} />
            <input type="text" placeholder="Search mobile number..." style={styles.searchInput} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
          </div>
        </div>
      )}

<<<<<<< HEAD
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
=======
      <div style={styles.dashboardGrid}>
         <div style={styles.kpiCard}>
            <p style={styles.kpiLabel}>Total Numbers</p>
            <h3 style={styles.kpiValue}>{finalDisplay.length}</h3>
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
        {selectedIds.length > 0 && (
          <div style={styles.bulkActionBar}>
             <span style={styles.bulkCount}>{selectedIds.length} numbers selected</span>
             <div style={styles.bulkActions}>
                <select onChange={(e) => { if (e.target.value) { handleBulkAction(e.target.value); e.target.value = ""; } }} style={styles.bulkSelect}>
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

        {bulkProgress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: bulkProgress.startsWith('✅') ? '#dcfce7' : '#e0f2fe', border: `1px solid ${bulkProgress.startsWith('✅') ? '#86efac' : '#7dd3fc'}`, color: bulkProgress.startsWith('✅') ? '#15803d' : '#0369a1', padding: '10px 16px', borderRadius: '8px', marginBottom: '12px', fontWeight: 700, fontSize: '0.88rem' }}>
            {!bulkProgress.startsWith('✅') && <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />}
            {bulkProgress}
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
          </div>
        </div>
      )}

      {/* Main Table Container */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ tableLayout: 'auto', whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
<<<<<<< HEAD
                <th style={{ width: '40px' }}>
                  <input type="checkbox" checked={selectedIds.length === filteredItems.length && filteredItems.length > 0} onChange={toggleSelectAll} />
=======
                <th style={{...styles.th, width: '40px', textAlign: 'center'}}>
                  <input type="checkbox" onChange={handleSelectAll} checked={filteredInventory.length > 0 && selectedIds.length === filteredInventory.length} />
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
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
<<<<<<< HEAD
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
                    <td>{renderCategoryBadge(item.category)}</td>
                    <td>
                      <span style={{ fontSize: '11px', color: '#888', fontWeight: 600 }}>{item.pattern_type || '-'}</span>
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
=======
              {loading && inventory.length === 0 ? (
                <tr><td colSpan="11" style={{...styles.td, textAlign:'center', padding:'30px', color:'var(--text-muted)'}}>
                  <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:'10px'}}>
                    <style>{`@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`}</style>
                    <RefreshCw size={20} style={{animation:'spin 1s linear infinite',color:'var(--neon-green-dark)'}}/> 
                    Fetching full inventory...
                  </div>
                </td></tr>
              ) : filteredInventory.length === 0 ? (
                <tr><td colSpan="11" style={{...styles.td, textAlign:'center', padding:'30px', color:'var(--text-muted)'}}>
                  No numbers found in inventory.
                </td></tr>
              ) : filteredInventory.slice(0, displayLimit).map(item => {
                const isEditing = editingId === item.number_id;
                const isSelected = selectedIds.includes(item.number_id);
                return (
                  <tr key={item.number_id} style={isEditing || isSelected ? styles.editingRow : {}}>
                    <td style={{...styles.td, textAlign: 'center'}}>
                      <input type="checkbox" checked={isSelected} onChange={() => handleSelectRow(item.number_id)} />
                    </td>
                    <td style={styles.td}>{isEditing ? <input name="mobile_number" value={editForm.mobile_number} onChange={handleChange} style={styles.editInput} /> : <b>{item.mobile_number}</b>}</td>
                    <td style={styles.td}>{isEditing ? <><input list="inv-patterns" name="pattern_type" value={editForm.pattern_type || ''} onChange={handleChange} style={styles.editInput} /><datalist id="inv-patterns">{PATTERN_TYPES.map(p => <option key={p} value={p} />)}</datalist></> : item.pattern_type || '-'}</td>
                    <td style={styles.td}>{isEditing ? <select name="category" value={editForm.category || ''} onChange={handleChange} style={styles.editInput}><option value="">-- Rank --</option>{CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}</select> : <span style={{padding:'2px 8px', borderRadius:'6px', fontSize:'0.75rem', fontWeight:'bold', background:(item.category||'Bronze')==='Bronze'?'#f1f5f9':'#fef08a', color:(item.category||'Bronze')==='Bronze'?'#64748b':'#854d0e'}}>{item.category || 'Bronze'}</span>}</td>
                    <td style={{...styles.td, fontSize:'0.8rem', color:'var(--text-muted)'}}>{item.inventory_source || '—'}</td>
                    <td style={styles.td}>{isEditing ? <input type="number" name="base_price" value={editForm.base_price} onChange={handleChange} style={styles.editInput} /> : item.base_price}</td>
                    <td style={styles.td}>{isEditing ? <input type="number" name="offer_price" value={editForm.offer_price || ''} onChange={handleChange} style={styles.editInput} /> : item.offer_price || '-'}</td>
                    <td style={styles.td}>{isEditing ? <input name="primary_incharge_name" value={editForm.primary_incharge_name} onChange={handleChange} style={styles.editInput} /> : item.primary_incharge_name || '-'}</td>
                    <td style={styles.td}>{isEditing ? <input name="whatsapp_group_name" value={editForm.whatsapp_group_name} onChange={handleChange} style={styles.editInput} /> : item.whatsapp_group_name || '-'}</td>
                    <td style={styles.td}>{isEditing ? <select name="number_status" value={editForm.number_status} onChange={handleChange} style={styles.editInput}><option value="available">Available</option><option value="booked">Booked</option><option value="sold">Sold</option></select> : <span style={(item.number_status||'') === 'available' ? styles.statusGreen : styles.statusRed}>{(item.number_status||'unknown').toUpperCase()}</span>}</td>
                    <td style={styles.td}>
                      {isEditing ? (
                        <div style={styles.actionBtns}>
                          <button onClick={handleSave} style={styles.saveBtn}><Check size={16} /></button>
                          <button onClick={handleCancel} style={styles.cancelBtn}><X size={16} /></button>
                        </div>
                      ) : (
                        <div style={{display:'flex', gap:'8px'}}>
                          <button onClick={() => handleEditClick(item)} style={styles.editBtn}><Edit2 size={16} /> Edit</button>
                          <button onClick={() => handleDelete(item.number_id)} style={{...styles.editBtn, borderColor:'#ef4444', color:'#ef4444'}}>Delete</button>
                        </div>
                      )}
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
<<<<<<< HEAD
        {!loading && filteredItems.length > 0 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Showing {Math.min(filteredItems.length, 100)} of {filteredItems.length} results
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button className="btn btn-secondary btn-sm" disabled>Previous</button>
              <button className="btn btn-secondary btn-sm">Next</button>
            </div>
=======
        {!loading && filteredInventory.length > 0 && (
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center', padding:'16px', background:'#f8fafc', borderBottomLeftRadius:'var(--radius-md)', borderBottomRightRadius:'var(--radius-md)', borderTop:'1px solid var(--border-color)'}}>
            <span style={{color:'var(--text-muted)', fontSize:'0.85rem', fontWeight:600}}>Showing {Math.min(displayLimit, filteredInventory.length).toLocaleString()} of {filteredInventory.length.toLocaleString()} numbers</span>
            {filteredInventory.length > displayLimit && <button onClick={()=>setDisplayLimit(p=>p+500)} style={{padding:'8px 16px',background:'white',border:'1px solid var(--border-color)',borderRadius:'var(--radius-md)',cursor:'pointer',fontWeight:600,color:'var(--text-main)'}}>Load Next 500 Numbers</button>}
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
          </div>
        )}
      </div>

<<<<<<< HEAD
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
=======
      {bulkModal && (
        <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999}}>
          <div style={{background:'#fff',borderRadius:'16px',padding:'32px',width:'420px',maxWidth:'90vw',boxShadow:'0 20px 60px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontSize:'1.15rem',fontWeight:800,marginBottom:'6px',color:'var(--text-main)'}}>{bulkModal === 'delete_numbers' ? '🗑 Delete' : '✏️ Bulk Update'} — {selectedIds.length} Numbers</h3>
            <p style={{color:'var(--text-muted)',fontSize:'0.88rem',marginBottom:'20px'}}>{bulkModal === 'delete_numbers' ? 'This will permanently delete all selected numbers from the database.' : `Enter the new value to apply to all ${selectedIds.length} selected numbers.`}</p>
            {bulkModal !== 'delete_numbers' && bulkModal !== 'hide_numbers' && (
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'0.85rem',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px'}}>{bulkModal === 'update_price' ? 'New Base Price (₹)' : bulkModal === 'update_category' ? 'New Category / Type' : 'New Status'}</label>
                {bulkModal === 'update_status' ? <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none'}}><option value="">Select status</option><option value="available">Available</option><option value="booked">Booked</option><option value="sold">Sold</option></select> : <input type={bulkModal === 'update_price' ? 'number' : 'text'} value={bulkValue} onChange={e => setBulkValue(e.target.value)} style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none'}} />}
              </div>
            )}
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'0.85rem',fontWeight:600,color:'var(--text-muted)',marginBottom:'6px'}}>Your Name</label>
              <input type="text" value={bulkUser} onChange={e => setBulkUser(e.target.value)} style={{padding:'10px 14px',borderRadius:'8px',border:'1px solid var(--border-color)',width:'100%',outline:'none'}} />
            </div>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <button onClick={() => setBulkModal(null)} style={{padding:'10px 16px',background:'transparent',border:'1px solid var(--border-color)',borderRadius:'8px',fontWeight:600,color:'var(--text-muted)',cursor:'pointer'}}>Cancel</button>
              <button onClick={executeBulkAction} disabled={bulkModal !== 'delete_numbers' && bulkModal !== 'hide_numbers' && !bulkValue} style={{padding:'10px 20px',background: bulkModal === 'delete_numbers' ? '#ef4444' : '#3b82f6',border:'none',color:'#fff',borderRadius:'8px',fontWeight:700,cursor:'pointer'}}>{bulkModal === 'delete_numbers' ? '🗑 Confirm Delete' : bulkModal === 'hide_numbers' ? '📦 Move to Drafts' : '✅ Apply Changes'}</button>
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
