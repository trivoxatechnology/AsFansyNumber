import React, { useState, useEffect, useMemo } from 'react';
import { 
  CheckCircle, Search, Calendar, DollarSign, 
  TrendingUp, Download, Eye, ExternalLink,
  ChevronLeft, ChevronRight, Filter, ShoppingBag
} from 'lucide-react';
import { getWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';

export default function SoldNumbers() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  useEffect(() => {
    fetchSoldItems();
  }, []);

  const fetchSoldItems = async () => {
    setLoading(true);
    // Fetch numbers with status = sold
    const res = await getWithAuth(`${API_BASE}/wp_fn_numbers?number_status=sold&limit=1000&order=updated_at&dir=desc`);
    const data = await safeJson(res);
    setItems(Array.isArray(data) ? data : (data?.data || []));
    setLoading(false);
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const s = searchTerm.toLowerCase();
      const num = String(item.mobile_number).toLowerCase();
      if (s && !num.includes(s)) return false;

      if (monthFilter) {
        const itemDate = new Date(item.updated_at).toISOString().slice(0, 7); // YYYY-MM
        if (itemDate !== monthFilter) return false;
      }

      return true;
    });
  }, [items, searchTerm, monthFilter]);

  const stats = useMemo(() => {
    const total = filteredItems.length;
    const revenue = filteredItems.reduce((acc, curr) => acc + (parseFloat(curr.base_price) || 0), 0);
    return { total, revenue };
  }, [filteredItems]);

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'var(--danger)10', color: 'var(--danger)', padding: '16px', borderRadius: '16px' }}>
            <ShoppingBag size={32} />
          </div>
          <div>
            <span style={{ fontSize: '14px', color: '#666', fontWeight: 600 }}>Total Numbers Sold</span>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{stats.total.toLocaleString()}</h2>
          </div>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ background: 'var(--success)10', color: 'var(--success)', padding: '16px', borderRadius: '16px' }}>
            <DollarSign size={32} />
          </div>
          <div>
            <span style={{ fontSize: '14px', color: '#666', fontWeight: 600 }}>Total Sales Revenue</span>
            <h2 style={{ margin: 0, fontSize: '2rem', fontWeight: 800 }}>{formatCurrency(stats.revenue)}</h2>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="card" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#999' }} />
          <input 
            type="text" 
            placeholder="Search sold numbers..." 
            className="input" 
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={18} color="#666" />
          <input 
            type="month" 
            className="input" 
            value={monthFilter} 
            onChange={(e) => setMonthFilter(e.target.value)} 
          />
        </div>

        <button className="btn btn-secondary" onClick={fetchSoldItems} disabled={loading}>
          <RefreshCw size={18} style={{ animation: loading ? 'spin 2s linear infinite' : 'none' }} />
        </button>
        
        <button className="btn btn-primary">
          <Download size={18} /> Export Sales
        </button>
      </div>

      {/* Main Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Mobile Number</th>
                <th>Category</th>
                <th>Sold Price</th>
                <th>Sold Date</th>
                <th>Dealer</th>
                <th>Customer Details</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan="7"><div className="skeleton" style={{ height: '50px' }} /></td></tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <AlertCircle size={48} />
                      <p>No sales records found for this period.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.number_id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 800 }}>{item.mobile_number}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ 
                        fontSize: '11px', fontWeight: 700, padding: '2px 8px', 
                        borderRadius: '4px', background: '#f1f5f9', color: '#64748b' 
                      }}>
                        {item.category || 'Normal'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--success)' }}>
                        {formatCurrency(item.base_price)}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px', color: '#666' }}>
                      {new Date(item.updated_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600 }}>{item.dealer_name || 'Direct / Master'}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {item.remarks || 'No remarks provided'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-icon" title="View Details">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {!loading && filteredItems.length > 0 && (
          <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f9f9f9', borderTop: '1px solid #eee' }}>
            <span style={{ fontSize: '13px', color: '#666' }}>
              Showing {filteredItems.length} sales records
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" disabled><ChevronLeft size={16} /></button>
              <button className="btn btn-secondary btn-sm" disabled><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
