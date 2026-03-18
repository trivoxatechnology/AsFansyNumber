import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, UserPlus, Phone, MapPin, 
  Trash2, Edit3, Search, RefreshCw, 
  ChevronRight, ExternalLink, Mail,
  CheckCircle, AlertCircle, Package, TrendingUp
} from 'lucide-react';
import { getWithAuth, postWithAuth, putWithAuth, deleteWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';

export default function Dealers() {
  const [dealers, setDealers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({ dealer_name: '', dealer_phone: '', dealer_email: '', dealer_address: '', status: 'active' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dealerRes, statsRes] = await Promise.all([
        getWithAuth(`${API_BASE}/wp_fn_dealers?limit=500&order=dealer_name&dir=asc`),
        getWithAuth(`${API_BASE}/wp_fn_numbers/stats?group_by=dealer_id`)
      ]);
      
      const dealerList = await safeJson(dealerRes);
      const statData = await safeJson(statsRes);
      
      setDealers(dealerList || []);
      
      // Convert stats array to map for easy lookup
      const statMap = {};
      (statData?.data || []).forEach(s => {
        statMap[s.dealer_id] = s;
      });
      setStats(statMap);
    } catch (err) {
      console.error('Failed to fetch dealer data:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredDealers = useMemo(() => {
    const s = searchTerm.toLowerCase();
    return dealers.filter(d => 
      d.dealer_name.toLowerCase().includes(s) || 
      d.dealer_phone.toLowerCase().includes(s)
    );
  }, [dealers, searchTerm]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (editingId) {
      const res = await putWithAuth(`${API_BASE}/wp_fn_dealers/${editingId}`, formData);
      if (res.ok) {
        setEditingId(null);
        fetchData();
      }
    } else {
      const res = await postWithAuth(`${API_BASE}/wp_fn_dealers`, formData);
      if (res.ok) {
        setShowAddModal(false);
        fetchData();
      }
    }
    setFormData({ dealer_name: '', dealer_phone: '', dealer_email: '', dealer_address: '', status: 'active' });
  };

  const startEdit = (d) => {
    setEditingId(d.dealer_id);
    setFormData({ 
      dealer_name: d.dealer_name, 
      dealer_phone: d.dealer_phone, 
      dealer_email: d.dealer_email || '', 
      dealer_address: d.dealer_address || '',
      status: d.status || 'active'
    });
    setShowAddModal(true);
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this dealer?')) {
      const res = await deleteWithAuth(`${API_BASE}/wp_fn_dealers/${id}`);
      if (res.ok) fetchData();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#999' }} />
          <input 
            type="text" 
            placeholder="Search dealers by name or phone..." 
            className="input" 
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => { setEditingId(null); setFormData({ dealer_name: '', dealer_phone: '', dealer_email: '', dealer_address: '', status: 'active' }); setShowAddModal(true); }}>
          <UserPlus size={18} /> Add Dealer
        </button>
        <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
          <RefreshCw size={18} style={{ animation: loading ? 'spin 2s linear infinite' : 'none' }} />
        </button>
      </div>

      {loading && dealers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '100px' }}>
          <RefreshCw size={48} color="var(--primary)" style={{ animation: 'spin 2s linear infinite' }} />
          <p style={{ marginTop: '16px', fontWeight: 600 }}>Loading dealers...</p>
        </div>
      ) : filteredDealers.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
          <Users size={64} style={{ marginBottom: '20px', opacity: 0.3 }} />
          <h3>No Dealers Found</h3>
          <p>Click "Add Dealer" to create your first dealer profile.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '24px' }}>
          {filteredDealers.map(d => {
            const dealerStats = stats[d.dealer_id] || { total: 0, available: 0, sold: 0 };
            return (
              <div key={d.dealer_id} className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '12px', background: 'var(--primary)10', 
                      color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '1.2rem'
                    }}>
                      {d.dealer_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{d.dealer_name}</h3>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#666' }}>
                        <span style={{ 
                          width: '8px', height: '8px', borderRadius: '50%', 
                          background: d.status === 'active' ? 'var(--success)' : '#ccc' 
                        }} />
                        {d.status || 'Active'}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button className="btn-icon" onClick={() => startEdit(d)}><Edit3 size={16} /></button>
                    <button className="btn-icon" style={{ color: 'var(--danger)' }} onClick={() => handleDelete(d.dealer_id)}><Trash2 size={16} /></button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#444' }}>
                    <Phone size={14} color="#999" /> {d.dealer_phone}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#444' }}>
                    <Mail size={14} color="#999" /> {d.dealer_email || 'No email provided'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#444' }}>
                    <MapPin size={14} color="#999" /> {d.dealer_address || 'No address provided'}
                  </div>
                </div>

                <div style={{ 
                  display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', 
                  padding: '16px', background: '#f8fafc', borderRadius: '12px' 
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, marginBottom: '4px' }}>Total</div>
                    <div style={{ fontSize: '16px', fontWeight: 800 }}>{dealerStats.total}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, marginBottom: '4px' }}>Avail</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--success)' }}>{dealerStats.available}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '11px', color: '#666', fontWeight: 600, marginBottom: '4px' }}>Sold</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--danger)' }}>{dealerStats.sold}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div style={{ 
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', 
          justifyContent: 'center', zIndex: 1000 
        }}>
          <form className="card" style={{ width: '450px', maxWidth: '95vw', padding: '32px' }} onSubmit={handleSave}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
              <h3 style={{ margin: 0 }}>{editingId ? 'Edit Dealer' : 'Add New Dealer'}</h3>
              <X style={{ cursor: 'pointer' }} onClick={() => setShowAddModal(false)} />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="form-group">
                <label>Dealer Name <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" required className="input" placeholder="e.g. John Doe"
                  value={formData.dealer_name} onChange={e => setFormData({...formData, dealer_name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Phone Number <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input 
                  type="text" required className="input" placeholder="e.g. 9876543210"
                  value={formData.dealer_phone} onChange={e => setFormData({...formData, dealer_phone: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input 
                  type="email" className="input" placeholder="e.g. john@example.com"
                  value={formData.dealer_email || ''} onChange={e => setFormData({...formData, dealer_email: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea 
                  className="input" placeholder="Dealer location/office..." rows={3} style={{ resize: 'none' }}
                  value={formData.dealer_address || ''} onChange={e => setFormData({...formData, dealer_address: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="input" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!formData.dealer_name || !formData.dealer_phone}>
                {editingId ? 'Update Dealer' : 'Save Dealer'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
