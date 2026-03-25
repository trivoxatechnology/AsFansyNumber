import { useState, useEffect } from 'react';
import GroupCard from './GroupCard';

const API = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\.php$/, '') : 'https://asfancynumber.com';

const fetchGroups = async () => {
  try {
    const res = await fetch(`${API}/api.php/groups`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    throw new Error("groups endpoint failed");
  } catch {
    try {
      const res = await fetch(
        `${API}/api.php/wp_fn_number_groups?visibility_status=1&group_status=available&limit=100`
      );
      const groups = await res.json();
      if (!Array.isArray(groups) || groups.length === 0) return [];
      return await Promise.all(
        groups.map(async (g) => {
          try {
            const mRes = await fetch(
              `${API}/api.php/wp_fn_numbers?group_id=${g.group_id}&number_status=available&limit=10`
            );
            const members = await mRes.json();
            return {
              ...g,
              numbers: Array.isArray(members) ? members : [],
            };
          } catch {
            return { ...g, numbers: [] };
          }
        })
      );
    } catch { return []; }
  }
};

export default function GroupsSection({ isItemInCart, onToggleCart }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState({});

  useEffect(() => {
    const loadData = async () => {
      try {
        const fullGroups = await fetchGroups();

        setGroups(fullGroups);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const calculateGroupPrice = (group, selectedIds) => {
    if (!selectedIds || selectedIds.length === 0) {
      return parseFloat(group.group_price || 0);
    }
    const selected = (group.numbers || []).filter(n =>
      selectedIds.includes(n.number_id)
    );
    const total = selected.reduce(
      (sum, n) => sum + parseFloat(n.base_price || 0), 0
    );
    const allSelected = selectedIds.length === (group.numbers || []).length;
    if (allSelected && group.group_offer_price) {
      return parseFloat(group.group_offer_price);
    }
    return total;
  };

  const handleToggleCheck = (groupId, numberId) => {
    setSelectedIds(prev => {
      const current = prev[groupId] || [];
      const isSelected = current.includes(numberId);
      return {
        ...prev,
        [groupId]: isSelected
          ? current.filter(id => id !== numberId)
          : [...current, numberId]
      };
    });
  };

  const renderSection = (title, type, emptyMessage) => {
    const filtered = groups.filter(g => (g.group_type || '').toLowerCase() === type.toLowerCase());

    return (
      <div className="section-row" style={{ marginTop: '40px' }}>
        <div className="section-header">
          <div className="section-icon" style={{ background: `var(--business)`, color: '#000' }}>💼</div>
          <div>
            <div className="section-title" style={{ fontFamily: "var(--font-display)", fontSize: '28px', fontWeight: 600, letterSpacing: '0.06em' }}>{title}</div>
            <div className="section-sub" style={{ fontFamily: "var(--font-body)", fontSize: '13px', fontWeight: 300 }}>Premium {type} packages</div>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
            <div style={{ height: '300px', background: 'var(--bg2)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
          </div>
        ) : error ? (
          <div style={{ color: 'var(--danger)', padding: '20px' }}>Error loading groups: {error}</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg2)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--muted)', fontFamily: "var(--font-body)" }}>
            {emptyMessage}
          </div>
        ) : (
          <div className="cards-grid">
            {filtered.map(group => (
              <GroupCard
                key={group.group_id}
                item={group}
                selectedIds={selectedIds[group.group_id] || []}
                onToggleCheck={(numId) => handleToggleCheck(group.group_id, numId)}
                calculatedPrice={calculateGroupPrice(group, selectedIds[group.group_id] || [])}
                isItemInCart={isItemInCart}
                onToggleCart={onToggleCart}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {renderSection('Business Packs', 'business', 'No business packs available at the moment.')}
    </>
  );
}
