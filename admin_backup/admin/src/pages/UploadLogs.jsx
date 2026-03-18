import React, { useState, useEffect } from 'react';
import { 
  History, Search, Filter, ChevronDown, 
  ChevronUp, CheckCircle, AlertCircle, Clock,
  User, FileText, Database, Activity
} from 'lucide-react';
import { getWithAuth, safeJson } from '../utils/api';
import { API_BASE } from '../config/api';

export default function UploadLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const res = await getWithAuth(`${API_BASE}/wp_fn_upload_batches?limit=100&order=batch_id&dir=desc`);
    const data = await safeJson(res);
    setLogs(data || []);
    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    const s = searchTerm.toLowerCase();
    const fileName = (log.file_name || '').toLowerCase();
    const admin = (log.admin_name || '').toLowerCase();
    const matchesSearch = !s || fileName.includes(s) || admin.includes(s);
    const matchesType = typeFilter === 'all' || (log.operation_type || '').includes(typeFilter);
    return matchesSearch && matchesType;
  });

  const getStatusStyle = (status) => {
    switch (status) {
      case 'completed': return { bg: '#E6F4EA', color: '#1E8E3E', icon: <CheckCircle size={14} /> };
      case 'failed': return { bg: '#FCE8E6', color: '#D93025', icon: <AlertCircle size={14} /> };
      default: return { bg: '#FEF7E0', color: '#F29900', icon: <Clock size={14} /> };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: '20px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '10px', color: '#999' }} />
          <input 
            type="text" 
            placeholder="Search by file name or admin..." 
            className="input" 
            style={{ paddingLeft: '40px', width: '100%' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select className="input" value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ width: '200px' }}>
          <option value="all">All Operations</option>
          <option value="Excel Add">Import</option>
          <option value="Delete">Delete</option>
          <option value="Update">Update</option>
        </select>
        <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
          <Activity size={18} /> Refresh
        </button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: '40px' }}></th>
              <th>Batch ID</th>
              <th>Operation / File</th>
              <th>Records</th>
              <th>Status</th>
              <th>Done By</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan="7"><div className="skeleton" style={{ height: '50px' }} /></td></tr>
              ))
            ) : filteredLogs.length === 0 ? (
              <tr><td colSpan="7" style={{ textAlign: 'center', padding: '100px', color: '#999' }}>No logs found.</td></tr>
            ) : filteredLogs.map(log => {
              const status = getStatusStyle(log.status);
              const isExpanded = expandedId === log.batch_id;
              return (
                <React.Fragment key={log.batch_id}>
                  <tr 
                    style={{ cursor: 'pointer', background: isExpanded ? '#f0f7ff' : 'transparent' }} 
                    onClick={() => setExpandedId(isExpanded ? null : log.batch_id)}
                  >
                    <td>{isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>#{log.batch_id}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 700 }}>{log.operation_type}</span>
                        <span style={{ fontSize: '12px', color: '#666', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} /> {log.file_name || 'Manual Action'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                        <Database size={14} color="#999" /> {log.total_records || 0}
                      </div>
                    </td>
                    <td>
                      <div style={{ 
                        display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', 
                        borderRadius: '20px', background: status.bg, color: status.color, 
                        fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', width: 'fit-content'
                      }}>
                        {status.icon} {log.status}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                        <User size={14} color="#999" /> {log.admin_name}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#666' }}>
                      {new Date(log.upload_time || log.operation_time).toLocaleString()}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr style={{ background: '#f8fafc' }}>
                      <td colSpan="7" style={{ padding: '20px' }}>
                        <div style={{ background: 'white', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                           <h4 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                             <Activity size={16} color="var(--primary)" /> Operation Details
                           </h4>
                           <pre style={{ 
                             margin: 0, padding: '12px', background: '#f1f5f9', borderRadius: '6px', 
                             fontSize: '12px', whiteSpace: 'pre-wrap', fontFamily: 'monospace', color: '#334155' 
                           }}>
                             {log.operation_data || 'No data available for this operation.'}
                           </pre>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
