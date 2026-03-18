import React, { useState, useEffect, useMemo } from 'react';
import { 
  Archive, Trash2, Rocket, Search, 
  ChevronDown, ChevronUp, FileText, AlertCircle,
  MoreVertical, Check, X, RefreshCw, Layers
} from 'lucide-react';
import { getWithAuth, postWithAuth, deleteWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';

export default function DraftManagement() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchDrafts();
  }, []);

  const fetchDrafts = async () => {
    setLoading(true);
    const res = await getWithAuth(`${API_BASE}/wp_fn_draft_numbers?limit=10000&order=number_id&dir=desc`);
    const data = await safeJson(res);
    setDrafts(Array.isArray(data) ? data : (data?.data || []));
    setLoading(false);
  };

  const groups = useMemo(() => {
    const map = {};
    drafts.forEach(d => {
      const src = d.inventory_source || 'Manual / No Source';
      if (!map[src]) map[src] = [];
      map[src].push(d);
    });
    return Object.entries(map).map(([name, items]) => ({ name, items }));
  }, [drafts]);

  const filteredGroups = useMemo(() => {
    if (!searchTerm) return groups;
    const s = searchTerm.toLowerCase();
    return groups.map(g => ({
      ...g,
      items: g.items.filter(i => String(i.mobile_number).includes(s))
    })).filter(g => g.items.length > 0);
  }, [groups, searchTerm]);

  const toggleGroup = (name) => {
    setExpandedGroups(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  };

  const handleBulkAction = async (action, ids) => {
    if (!ids.length) return;
    setProcessing(true);
    let endpoint = action === 'push' ? 'bulk-restore' : 'bulk-delete';
    
    const res = await postWithAuth(`${API_BASE}/wp_fn_draft_numbers/${endpoint}`, { ids });
    if (res.ok) {
      fetchDrafts();
      setSelectedIds([]);
    }
    setProcessing(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#999' }} />
          <input 
            type="text" 
            placeholder="Search within drafts..." 
            className="input" 
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-secondary" onClick={fetchDrafts} disabled={loading}>
          <RefreshCw size={18} style={{ animation: loading ? 'spin 2s linear infinite' : 'none' }} /> Refresh
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <RefreshCw size={48} color="var(--primary)" style={{ animation: 'spin 2s linear infinite' }} />
          <p style={{ marginTop: '16px', fontWeight: 600 }}>Loading drafts...</p>
        </div>
      )}

      {!loading && filteredGroups.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
          <Archive size={64} style={{ marginBottom: '20px', opacity: 0.3 }} />
          <h3>No Drafts Found</h3>
          <p>Drafts appear here when you import as draft or hide numbers from inventory.</p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '20px' }}>
        {filteredGroups.map(group => {
          const isExpanded = expandedGroups.includes(group.name);
          const ids = group.items.map(i => i.number_id);
          return (
            <div key={group.name} className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div 
                style={{ 
                  padding: '16px 24px', background: isExpanded ? '#f8f5ff' : 'white', 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  borderBottom: isExpanded ? '1px solid #eee' : 'none', cursor: 'pointer'
                }}
                onClick={() => toggleGroup(group.name)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ color: 'var(--primary)', background: 'var(--primary)10', padding: '8px', borderRadius: '8px' }}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>{group.name}</h3>
                    <span style={{ fontSize: '12px', color: '#666' }}>{group.items.length} numbers in this batch</span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  {!isExpanded && (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleBulkAction('push', ids); }}>
                        <Rocket size={14} /> Push All Live
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={(e) => { e.stopPropagation(); handleBulkAction('delete', ids); }}>
                        <Trash2 size={14} /> Delete All
                      </button>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp size={20} color="#999" /> : <ChevronDown size={20} color="#999" />}
                </div>
              </div>

              {isExpanded && (
                <div style={{ padding: '0 24px 24px' }}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Mobile Number</th>
                        <th>Category</th>
                        <th>Base Price</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map(item => (
                        <tr key={item.number_id}>
                          <td><b>{item.mobile_number}</b></td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 700, background: '#eee', padding: '2px 6px', borderRadius: '4px' }}>
                              {item.category}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700 }}>₹{item.base_price}</td>
                          <td>
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase' }}>
                              Draft
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button className="btn-icon" title="Push Live" style={{ color: 'var(--success)' }} onClick={() => handleBulkAction('push', [item.number_id])}>
                                <Rocket size={16} />
                              </button>
                              <button className="btn-icon" title="Delete Permanent" style={{ color: 'var(--danger)' }} onClick={() => handleBulkAction('delete', [item.number_id])}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
