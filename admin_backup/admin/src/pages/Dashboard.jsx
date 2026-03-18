import React, { useState, useEffect } from 'react';
import { 
  Package, TrendingUp, CheckCircle, Tag, Calendar, 
  DollarSign, BarChart3, Users, UploadCloud, ArrowRight,
  ExternalLink, Copy, AlertCircle
} from 'lucide-react';
import { getWithAuth } from '../utils/api';
import { API_BASE } from '../config/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [patternStats, setPatternStats] = useState([]);
  const [dealerStats, setDealerStats] = useState([]);
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, patternRes, dealerRes, logsRes] = await Promise.all([
        getWithAuth(`${API_BASE}/wp_fn_numbers/stats`),
        getWithAuth(`${API_BASE}/wp_fn_numbers/pattern-stats`),
        getWithAuth(`${API_BASE}/wp_fn_numbers/stats?group_by=dealer_id`),
        getWithAuth(`${API_BASE}/wp_fn_upload_batches?limit=10&order=batch_id&dir=desc`)
      ]);

      const statsData = await statsRes.json();
      const patternData = await patternRes.json();
      const dealerData = await dealerRes.json();
      const logsData = await logsRes.json();

      setStats(statsData.stats || {});
      setPatternStats(patternData.data || []);
      setDealerStats(dealerData.data || []);
      setRecentLogs(logsData || []);
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
      {[1, 2, 3, 4, 5, 6].map(i => (
        <div key={i} className="card" style={{ height: '110px', background: '#f1f1f1', animation: 'pulse 1.5s infinite' }} />
      ))}
      <style>{`@keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }`}</style>
    </div>
  );

  if (error) return (
    <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>
      <AlertCircle size={48} style={{ marginBottom: '16px' }} />
      <h3>{error}</h3>
      <button className="btn btn-primary mt-4" onClick={fetchDashboardData}>Retry</button>
    </div>
  );

  const kpis = [
    { label: 'Total Inventory', val: stats.total, icon: <Package size={20} />, color: 'var(--primary)' },
    { label: 'Available', val: stats.available, icon: <TrendingUp size={20} />, color: 'var(--success)' },
    { label: 'Sold (All Time)', val: stats.sold, icon: <CheckCircle size={20} />, color: 'var(--danger)' },
    { label: 'On Offer', val: stats.on_offer, icon: <Tag size={20} />, color: 'var(--warning)' },
    { label: 'Sold This Month', val: stats.sold_this_month, icon: <Calendar size={20} />, color: 'var(--primary)' },
    { label: 'Revenue (Month)', val: stats.revenue_this_month, icon: <DollarSign size={20} />, color: 'var(--success)', isCurrency: true },
  ];

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
        {kpis.map((k, i) => (
          <div key={i} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>{k.label}</span>
              <div style={{ color: k.color, padding: '8px', background: `${k.color}10`, borderRadius: '8px' }}>{k.icon}</div>
            </div>
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800 }}>
              {k.isCurrency ? formatCurrency(k.val || 0) : (k.val || 0).toLocaleString()}
            </h2>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
        {/* Category Breakdown */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BarChart3 size={18} color="var(--primary)" /> Category Breakdown
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {patternStats.map((p, i) => {
              const max = Math.max(...patternStats.map(x => x.total));
              const width = (p.total / max) * 100;
              const soldWidth = (p.sold / (p.total || 1)) * 100;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1" style={{ fontSize: '12px', fontWeight: 600 }}>
                    <span className={`badge badge-${p.category.toLowerCase()}`}>{p.category}</span>
                    <span>{p.available} Avail / {p.sold} Sold</span>
                  </div>
                  <div style={{ height: '8px', background: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                    <div style={{ width: `${100 - soldWidth}%`, background: 'var(--success)', height: '100%' }} title="Available" />
                    <div style={{ width: `${soldWidth}%`, background: 'var(--danger)', height: '100%' }} title="Sold" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ margin: 0 }}>Quick Actions</h3>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => window.location.href='/admin/upload'}>
            <div className="flex items-center gap-2"><UploadCloud size={18} /> Upload Excel</div>
            <ArrowRight size={16} />
          </button>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }}>
            <div className="flex items-center gap-2"><Package size={18} /> Add Number</div>
            <ArrowRight size={16} />
          </button>
          <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'space-between' }} onClick={() => window.location.href='/admin/drafts'}>
            <div className="flex items-center gap-2"><Archive size={18} /> View Drafts</div>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Per-dealer Inventory */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--primary)" /> Dealer Inventory
            </h3>
          </div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ background: 'transparent' }}>Dealer</th>
                <th style={{ background: 'transparent', textAlign: 'center' }}>Total</th>
                <th style={{ background: 'transparent', textAlign: 'center' }}>Avail</th>
                <th style={{ background: 'transparent', textAlign: 'center' }}>Sold</th>
              </tr>
            </thead>
            <tbody>
              {dealerStats.slice(0, 5).map((d, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{d.dealer_name || 'Direct / Master'}</td>
                  <td style={{ textAlign: 'center' }}>{d.total}</td>
                  <td style={{ textAlign: 'center', color: 'var(--success)', fontWeight: 600 }}>{d.available}</td>
                  <td style={{ textAlign: 'center', color: 'var(--danger)', fontWeight: 600 }}>{d.sold}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button className="btn" style={{ fontSize: '12px', color: 'var(--primary)' }} onClick={() => window.location.href='/admin/dealers'}>
              View All Dealers <ExternalLink size={12} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </div>

        {/* Recent Uploads */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UploadCloud size={18} color="var(--primary)" /> Recent Uploads
            </h3>
          </div>
          <table style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ background: 'transparent' }}>File Name</th>
                <th style={{ background: 'transparent', textAlign: 'center' }}>Date</th>
                <th style={{ background: 'transparent', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.slice(0, 5).map((log, i) => (
                <tr key={i}>
                  <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 600 }}>{log.file_name || 'Manual Action'}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>By {log.admin_name}</div>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '11px' }}>
                    {new Date(log.upload_time).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`badge badge-${log.status === 'completed' ? 'available' : log.status === 'failed' ? 'sold' : 'booked'}`}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '12px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
            <button className="btn" style={{ fontSize: '12px', color: 'var(--primary)' }} onClick={() => window.location.href='/admin/logs'}>
              View All Logs <ExternalLink size={12} style={{ marginLeft: 4 }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
