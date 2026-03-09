import { Search } from 'lucide-react';
import { useState } from 'react';

export default function Hero({ onSearch }) {
  const [searchInput, setSearchInput] = useState('');

  const handleSearch = () => {
    onSearch(searchInput);
  };

  return (
    <header style={styles.hero}>
      <div style={{...styles.orb, ...styles.orb1}}></div>
      <div style={{...styles.orb, ...styles.orb2}}></div>
      
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h1 style={styles.title}>
          Visual Pattern Search<br/>
          <span className="text-neon" style={{fontSize: '0.6em'}}>Find Your Perfect VIP Number</span>
        </h1>
        <p style={styles.subtitle}>
          Use wildcards (*) to find exact patterns. Example: ****9999, *786*, 1212**
        </p>
        
        <div style={styles.searchContainer}>
          <div style={styles.searchBar}>
            <input 
              type="text" 
              placeholder="Search fancy numbers (example: 9999, *786*, ****0000)" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={styles.input}
            />
            <button style={styles.searchBtn} onClick={handleSearch}>
              <Search size={18} style={{ marginRight: '8px' }}/> Search
            </button>
          </div>
          
          <div style={styles.quickFilters}>
            <span style={styles.quickFiltersLabel}>Quick Patterns:</span>
            <button onClick={() => {setSearchInput('****9999'); onSearch('****9999')}} style={styles.chip}>Ending 9999</button>
            <button onClick={() => {setSearchInput('****0000'); onSearch('****0000')}} style={styles.chip}>Ending 0000</button>
            <button onClick={() => {setSearchInput('*786*'); onSearch('*786*')}} style={styles.chip}>Contains 786</button>
            {/* These below are pseudo-patterns that the App.jsx backend logic will detect based on repeat_count / pattern_value */}
            <button onClick={() => onSearch('PATTERN:MIRROR')} style={styles.chip}>Mirror Numbers</button>
            <button onClick={() => onSearch('PATTERN:REPEATING')} style={styles.chip}>Repeating Numbers</button>
            <button onClick={() => onSearch('PATTERN:SEQUENTIAL')} style={styles.chip}>Sequential Numbers</button>
          </div>
        </div>
      </div>
    </header>
  );
}

const styles = {
  hero: {
    marginTop: '80px',
    padding: '80px 20px',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    background: 'linear-gradient(to bottom, #ffffff, #f8fafc)',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  orb: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(80px)',
    zIndex: 0,
  },
  orb1: {
    width: '400px', height: '400px',
    background: 'rgba(122, 194, 0, 0.15)',
    top: '-100px', left: '10%',
  },
  orb2: {
    width: '300px', height: '300px',
    background: 'rgba(122, 194, 0, 0.1)',
    bottom: '-50px', right: '10%',
  },
  title: {
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: '20px',
    color: 'var(--text-main)',
  },
  subtitle: {
    fontSize: '1.2rem',
    color: 'var(--text-muted)',
    maxWidth: '600px',
    margin: '0 auto 40px',
  },
  searchBar: {
    display: 'flex',
    maxWidth: '600px',
    margin: '0 auto',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '50px',
    padding: '6px',
    boxShadow: 'var(--shadow-md)',
    flexWrap: 'wrap',
    gap: '10px'
  },
  input: {
    flex: 1,
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    padding: '0 20px',
    fontSize: '1.1rem',
    outline: 'none',
    minWidth: '200px'
  },
  searchBtn: {
    background: 'var(--neon-green)',
    color: '#fff',
    border: 'none',
    borderRadius: '40px',
    padding: '12px 30px',
    fontWeight: 600,
    fontSize: '1rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 10px rgba(122, 194, 0, 0.3)'
  },
  searchContainer: {
    maxWidth: '700px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  quickFilters: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    justifyContent: 'center',
    alignItems: 'center'
  },
  quickFiltersLabel: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    marginRight: '8px'
  },
  chip: {
    background: '#fff',
    border: '1px solid var(--border-color)',
    padding: '6px 14px',
    borderRadius: '30px',
    fontSize: '0.85rem',
    fontWeight: 600,
    color: 'var(--text-main)',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
  }
};
