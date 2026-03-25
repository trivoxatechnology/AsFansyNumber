import { Search, Sparkles, ShieldCheck, Zap, Filter, RotateCcw, X } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getStats } from '../api/client';

function Counter({ end, duration = 2000 }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [end, duration]);
  return <span>{count.toLocaleString()}</span>;
}

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

export default function Hero({ filters, onFilterChange, onReset, allNumbers = [] }) {
  const parseQueryToDigits = (q) => {
    if (!q) return Array(10).fill('*');
    if (q.length === 10) return q.split('').map(c => (c === '_' || c === '*') ? '*' : c);
    return Array(10).fill('*');
  };

  const [digits, setDigits] = useState(() => parseQueryToDigits(filters?.query));
  const inputRefs = useRef([]);
  const [showFilters, setShowFilters] = useState(false);
  const filterRef = useRef(null);
  const dynamicStats = useMemo(() => {
    if (!allNumbers || allNumbers.length === 0) {
      return { total: 0, diamond: 0, on_offer: 0 };
    }
    
    // Exact count based on current 117-rule assignments
    const diamond = allNumbers.filter(n => String(n.number_category) === '1').length;
    const on_offer = allNumbers.filter(n => {
      const base = parseFloat(n.base_price || 0);
      const offer = parseFloat(n.offer_price || 0);
      return offer > 0 && offer < base;
    }).length;

    return {
      total: allNumbers.length,
      diamond,
      on_offer
    };
  }, [allNumbers]);

  useEffect(() => {
    // Close dropdown on outside click
    const handleClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const uniquePatterns = useMemo(() => {
    return [...new Set(allNumbers.map(n => n.pattern_name).filter(Boolean))].sort();
  }, [allNumbers]);

  useEffect(() => {
    setDigits(parseQueryToDigits(filters?.query));
  }, [filters?.query]);

  const handleDigitChange = (index, val) => {
    const cleaned = val.replace(/\D/g, '');

    const newDigits = [...digits];

    // Handle paste
    if (cleaned.length > 1) {
      for (let i = 0; i < cleaned.length; i++) {
        if (index + i < 10) newDigits[index + i] = cleaned[i];
      }
      setDigits(newDigits);
      const nextIdx = Math.min(index + cleaned.length, 9);
      if (inputRefs.current[nextIdx]) {
        inputRefs.current[nextIdx].focus();
      }
      return;
    }

    newDigits[index] = cleaned;
    setDigits(newDigits);

    if (cleaned && index < 9) {
      if (inputRefs.current[index + 1]) {
        inputRefs.current[index + 1].focus();
      }
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && digits[index] === '' && index > 0) {
      if (inputRefs.current[index - 1]) {
        inputRefs.current[index - 1].focus();
      }
    } else if (e.key === 'Enter') {
      executeSearch();
    }
  };

  const handleDigitFocus = (index, e) => {
    e.target.style.borderBottomColor = 'var(--primary)';
    if (digits[index] === '*') {
      const newDigits = [...digits];
      newDigits[index] = '';
      setDigits(newDigits);
    } else {
      e.target.select();
    }
  };

  const handleDigitBlur = (index, e) => {
    e.target.style.borderBottomColor = 'var(--border)';
    if (digits[index] === '') {
      const newDigits = [...digits];
      newDigits[index] = '*';
      setDigits(newDigits);
    }
  };

  const executeSearch = () => {
    if (digits.every(d => d === '*')) {
      if (onFilterChange) onFilterChange('query', '');
    } else {
      const q = digits.join('');
      if (onFilterChange) onFilterChange('query', q);
    }
    const results = document.querySelector('main');
    if (results) results.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header style={styles.hero}>
      {/* Background Glow */}
      <div style={styles.glow} />

      <div className="container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={styles.badge}>
          <Sparkles size={12} style={{ color: 'var(--primary)' }} />
          <span>ESTABLISHED 2026 · PREMIUM SELECTION</span>
        </div>

        <h1 style={styles.title}>
          Own a Number That  <br />
          <span style={styles.titleSerif}>Defines You</span>
        </h1>

        <p style={styles.subtitle}>
          Discover India's most exclusive collection of VIP mobile numbers.
          Expertly curated patterns for those who demand distinction.
        </p>

        <div style={{ marginBottom: '12px', color: 'var(--muted)', fontSize: '13px', letterSpacing: '0.04em' }}>
          Enter digits in specific positions to find exact matches:
        </div>
        <div style={styles.searchContainer} ref={filterRef}>
          <div className="search-box-container" style={{ ...styles.searchBox, padding: '12px', gap: '16px', alignItems: 'center' }}>
            <div className="digit-inputs-container" style={{ display: 'flex', gap: '6px', flex: 1, justifyContent: 'center' }}>
              {digits.map((digit, i) => (
                <input 
                  key={i}
                  ref={el => inputRefs.current[i] = el}
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={digit}
                  onChange={e => handleDigitChange(i, e.target.value)}
                  onKeyDown={e => handleDigitKeyDown(i, e)}
                  className="digit-box"
                  style={{
                    width: '40px', height: '52px',
                    textAlign: 'center', fontSize: '24px', fontFamily: "var(--font-number)", fontWeight: 600,
                    background: 'transparent', border: 'none', borderBottom: '2px solid var(--border)',
                    borderRadius: '0', color: '#fff', outline: 'none', transition: 'border-color 0.2s, color 0.2s',
                    padding: '0 0 4px 0'
                  }}
                  onFocus={(e) => handleDigitFocus(i, e)}
                  onBlur={(e) => handleDigitBlur(i, e)}
                />
              ))}
            </div>
            
            <button style={{...styles.filterBtn, padding: '0 16px', height: '52px'}} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={16} /> Filters
            </button>
            <button style={{...styles.searchBtn, padding: '0 24px', height: '52px'}} onClick={executeSearch}>
              Search
            </button>
          </div>

          {/* Filter Dropdown Panel */}
          {showFilters && (
            <div style={styles.filterPanel}>
              <div style={styles.filterHeader}>
                <h3 style={styles.filterTitle}><Filter size={14}/> Refine Collection</h3>
                <button style={styles.closeBtn} onClick={() => setShowFilters(false)}><X size={16}/></button>
              </div>
              
              <div className="filter-grid-mobile" style={styles.filterGrid}>
                <div style={styles.group}>
                  <label style={styles.label}>Tier / Ranking</label>
                  <select style={styles.select} value={filters?.category || ''} onChange={(e) => onFilterChange('category', e.target.value)}>
                    {CATEGORY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>

                <div style={styles.group}>
                  <label style={styles.label}>Pattern Strategy</label>
                  <select style={styles.select} value={filters?.pattern_name || ''} onChange={(e) => onFilterChange('pattern_name', e.target.value)}>
                    <option value="">All Strategies</option>
                    {uniquePatterns.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div style={styles.group}>
                  <label style={styles.label}>Sum of Digits</label>
                  <input type="number" placeholder="e.g. 9" style={styles.select} value={filters?.digitSum || ''} onChange={(e) => onFilterChange('digitSum', e.target.value)} />
                </div>
                
                <div style={styles.group}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={styles.label}>Price Ceiling</label>
                    <span style={{ fontSize: '12px', fontFamily: "var(--font-number)", fontWeight: 600, color: '#fff' }}>
                      ₹{Number(filters?.maxPrice || 10000000).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <input type="range" min="1000" max="10000000" step="1000" style={styles.rangeInput} value={filters?.maxPrice || 10000000} onChange={(e) => onFilterChange('maxPrice', e.target.value)} />
                </div>
              </div>

              <div style={styles.filterFooter}>
                <button style={styles.resetBtn} onClick={onReset}>
                  <RotateCcw size={14} /> Reset Configuration
                </button>
                <button style={styles.applyBtn} onClick={() => setShowFilters(false)}>Apply Filters</button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.statsRow}>
          <div style={styles.statItem}>
            <div style={styles.statVal}><Counter end={dynamicStats.total} />+</div>
            <div style={styles.statLabel}>Total Numbers</div>
          </div>
          <div className="stat-divider" style={styles.statDivider}></div>
          <div style={styles.statItem}>
            <div style={styles.statVal}><Counter end={dynamicStats.diamond} />+</div>
            <div style={styles.statLabel}>Diamond Grade</div>
          </div>
          <div className="stat-divider" style={styles.statDivider}></div>
          <div style={styles.statItem}>
            <div style={styles.statVal}><Counter end={dynamicStats.on_offer} />+</div>
            <div style={styles.statLabel}>Live Offers</div>
          </div>
        </div>

        <div style={styles.features}>
          <div style={styles.featureItem}><ShieldCheck size={14} /> Instant Transfer</div>
          <div style={styles.featureItem}><Zap size={14} /> 24/7 Support</div>
          <div style={styles.featureItem}>PAN-India Delivery</div>
        </div>
      </div>
    </header>
  );
}

const styles = {
  hero: {
    padding: '160px 0 100px',
    textAlign: 'center',
    position: 'relative',
    background: 'var(--bg)',
  },
  glow: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '800px',
    height: '600px',
    background: 'radial-gradient(circle, rgba(0,204,102,0.08) 0%, rgba(6,6,8,0) 70%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border)',
    borderRadius: '100px',
    padding: '6px 16px',
    fontFamily: "var(--font-body)",
    fontSize: 'var(--text-xxs)',
    fontWeight: 500,
    letterSpacing: '0.05em',
    color: 'var(--muted)',
    marginBottom: '32px',
  },
  title: {
    fontFamily: "var(--font-heading)",
    fontSize: 'var(--text-hero)',
    fontWeight: 400,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    color: '#fff',
    marginBottom: '24px',
  },
  titleSerif: {
    fontFamily: "var(--font-heading)",
    fontStyle: 'italic',
    fontWeight: 400,
    color: 'var(--primary)',
  },
  subtitle: {
    fontFamily: "var(--font-body)",
    fontSize: '16px',
    fontWeight: 300,
    color: 'var(--muted)',
    maxWidth: '600px',
    margin: '0 auto 48px',
    lineHeight: 1.7,
  },
  searchContainer: {
    position: 'relative',
    maxWidth: '720px',
    margin: '0 auto 64px',
    zIndex: 10,
  },
  searchBox: {
    display: 'flex',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '6px',
    position: 'relative',
    boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
    gap: '6px',
  },
  searchIcon: {
    position: 'absolute',
    left: '20px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--muted)',
    zIndex: 2,
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: '#fff',
    padding: '14px 20px 14px 50px',
    fontSize: '15px',
    fontFamily: "var(--font-number)",
    letterSpacing: '0.06em',
    outline: 'none',
  },
  filterBtn: {
    background: 'rgba(255,255,255,0.05)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '0 20px',
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: '13px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'all 0.2s',
  },
  searchBtn: {
    background: 'var(--primary)',
    color: '#000',
    border: 'none',
    borderRadius: '12px',
    padding: '0 28px',
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    fontSize: '14px',
    letterSpacing: '0.02em',
    cursor: 'pointer',
    transition: 'transform 0.2s',
  },
  filterPanel: {
    position: 'absolute',
    top: 'calc(100% + 12px)',
    left: 0,
    right: 0,
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    textAlign: 'left',
    animation: 'slideIn 0.2s ease-out',
  },
  filterHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: '1px solid var(--border)',
  },
  filterTitle: {
    margin: 0,
    fontFamily: "var(--font-ui)",
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', padding: '4px',
  },
  filterGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '24px',
    marginBottom: '24px',
  },
  group: { },
  label: {
    display: 'block',
    marginBottom: '8px',
    color: 'var(--muted)',
    fontFamily: "var(--font-ui)",
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  select: {
    width: '100%',
    background: 'var(--bg3)',
    border: '1px solid var(--border)',
    color: '#fff',
    padding: '10px 14px',
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
  filterFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border)',
  },
  resetBtn: {
    background: 'rgba(255,255,255,0.03)', color: 'var(--muted)', border: '1px solid var(--border)',
    padding: '10px 16px', borderRadius: '10px', cursor: 'pointer', fontFamily: "var(--font-body)", fontWeight: 600,
    fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
  },
  applyBtn: {
    background: 'var(--primary)', color: '#000', border: 'none',
    padding: '10px 24px', borderRadius: '10px', cursor: 'pointer', fontFamily: "var(--font-body)", fontWeight: 700,
    fontSize: '13px',
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '48px',
    marginBottom: '64px',
    flexWrap: 'wrap',
  },
  statItem: {
    textAlign: 'center',
  },
  statVal: {
    fontFamily: "var(--font-heading)",
    fontSize: '38px',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '4px',
  },
  statLabel: {
    fontFamily: "var(--font-body)",
    fontSize: 'var(--text-xs)',
    fontWeight: 500,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  statDivider: {
    width: '1px',
    height: '40px',
    background: 'var(--border)',
    // Responsiveness handled in index.css (.stat-divider)
  },
  features: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    flexWrap: 'wrap',
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--muted)',
  }
};
