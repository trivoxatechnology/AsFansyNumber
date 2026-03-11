import { useMemo } from 'react';

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(price);
};

export default function Sidebar({ numbers, filters, onFilterChange, onReset }) {
  const CATEGORIES = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];
  
  const uniquePatterns = useMemo(() => {
    return [...new Set(numbers.map(n => n.pattern_type).filter(Boolean))].sort();
  }, [numbers]);

  return (
    <aside style={styles.sidebar}>
      <div style={styles.filterBox}>
        <h3 style={styles.title}>Filters</h3>
        
        <div style={styles.group}>
          <label style={styles.label}>Category / Rank</label>
          <select 
            style={styles.input} 
            value={filters.category}
            onChange={(e) => onFilterChange('category', e.target.value)}
          >
            <option value="">All Ranks</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Pattern Type</label>
          <select 
            style={styles.input} 
            value={filters.pattern_type}
            onChange={(e) => onFilterChange('pattern_type', e.target.value)}
          >
            <option value="">All Patterns</option>
            {uniquePatterns.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Digit Sum</label>
          <input 
            type="number" 
            placeholder="e.g., 9" 
            style={styles.input}
            value={filters.digitSum}
            onChange={(e) => onFilterChange('digitSum', e.target.value)}
          />
        </div>

        <div style={styles.group}>
          <label style={styles.label}>Max Price</label>
          <input 
            type="range" 
            min="1000" 
            max="500000" 
            step="1000" 
            style={{...styles.input, padding: 0}}
            value={filters.maxPrice}
            onChange={(e) => onFilterChange('maxPrice', e.target.value)}
          />
          <div style={styles.priceLabels}>
            <span>₹1,000</span>
            <span>{formatPrice(filters.maxPrice)}</span>
          </div>
        </div>
        
        <button style={styles.resetBtn} onClick={onReset}>
          Reset Filters
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
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    boxShadow: 'var(--shadow-sm)',
  },
  title: {
    marginBottom: '20px',
    fontSize: '1.2rem',
    color: 'var(--text-main)',
    fontWeight: 700,
  },
  group: {
    marginBottom: '20px',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  input: {
    width: '100%',
    background: '#f8fafc',
    border: '1px solid var(--border-color)',
    color: 'var(--text-main)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  priceLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '8px',
    fontSize: '0.8rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
  },
  resetBtn: {
    width: '100%',
    background: '#f1f5f9',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    padding: '12px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    marginTop: '10px',
    fontWeight: 600,
    transition: 'background 0.2s'
  }
};
