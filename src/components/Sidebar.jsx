import { useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(price);
};

const CATEGORY_OPTIONS = [
  { value: '', label: 'All Tiers' },
  { value: '1', label: '💎 Diamond' },
  { value: '2', label: '💍 Platinum' },
  { value: '3', label: '⭐ Gold' },
  { value: '4', label: '🥈 Silver' },
  { value: '5', label: '🥉 Bronze' },
  { value: '7', label: '👫 Couple' },
  { value: '8', label: '💼 Business' },
  { value: '6', label: '📱 Normal' },
];

export default function Sidebar({ numbers, filters, onFilterChange, onReset }) {
  const uniquePatterns = useMemo(() => {
    return [...new Set(numbers.map(n => n.pattern_type).filter(Boolean))].sort();
  }, [numbers]);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.filterBox}>
        <div style={styles.header}>
          <Filter size={16} />
          <h3 style={styles.title}>Refine</h3>
        </div>
        
        <div style={styles.group}>
          <label style={styles.label}>Tier / Ranking</label>
          <select 
            style={styles.input} 
            value={filters.category}
            onChange={(e) => onFilterChange('category', e.target.value)}
          >
            {CATEGORY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Pattern Strategy</label>
          <select 
            style={styles.input} 
            value={filters.pattern_type}
            onChange={(e) => onFilterChange('pattern_type', e.target.value)}
          >
            <option value="">All Strategies</option>
            {uniquePatterns.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Sum of Digits</label>
          <input 
            type="number" 
            placeholder="e.g. 9" 
            style={styles.input}
            value={filters.digitSum}
            onChange={(e) => onFilterChange('digitSum', e.target.value)}
          />
        </div>

        <div style={styles.group}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <label style={styles.label}>Price Ceiling</label>
            <span style={{ fontSize: '12px', fontFamily: "var(--font-number)", fontWeight: 600, color: '#fff' }}>{formatPrice(filters.maxPrice)}</span>
          </div>
          <input 
            type="range" 
            min="1000" 
            max="500000" 
            step="1000" 
            style={styles.rangeInput}
            value={filters.maxPrice}
            onChange={(e) => onFilterChange('maxPrice', e.target.value)}
          />
          <div style={styles.priceLabels}>
            <span>₹1k</span>
            <span>₹5L</span>
          </div>
        </div>
        
        <button style={styles.resetBtn} onClick={onReset}>
          <RotateCcw size={14} /> Reset Configuration
        </button>
      </div>
    </aside>
  );
}

const styles = {
  sidebar: {
    position: 'sticky',
    top: '100px',
    height: 'max-content',
  },
  filterBox: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '28px',
    color: 'var(--muted)',
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-ui)",
    fontSize: '12px',
    color: '#fff',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  group: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--muted)',
    fontFamily: "var(--font-ui)",
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  input: {
    width: '100%',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    color: '#fff',
    padding: '12px 14px',
    borderRadius: '10px',
    outline: 'none',
    fontFamily: "var(--font-ui)",
    fontSize: '13px',
    cursor: 'pointer',
  },
  rangeInput: {
    width: '100%',
    accentColor: 'var(--primary)',
    cursor: 'pointer',
    marginTop: '4px',
  },
  priceLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '6px',
    fontFamily: "var(--font-number)",
    fontSize: '10px',
    color: 'var(--muted)',
    fontWeight: 600,
  },
  resetBtn: {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    padding: '12px',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '8px',
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    letterSpacing: '0.02em',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s',
  }
};
