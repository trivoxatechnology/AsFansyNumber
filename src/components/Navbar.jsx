import { ShoppingCart, Menu, X, ChevronDown, User, Gift, Phone } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getCategories } from '../api/client';

export default function Navbar({ cartCount, onCartClick, filters, onFilterChange, allNumbers = [] }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [dbCategories, setDbCategories] = useState([]);

  useEffect(() => {
    getCategories().then(res => {
      if (res.success) setDbCategories(res.data || []);
    }).catch(() => {});
  }, []);

  const dbPatterns = useMemo(() => {
    const mockPatterns = {
      "1": [{category_type: "Hexa", total: 12}, {category_type: "Palindrome", total: 8}],
      "2": [{category_type: "Ladder Up", total: 15}, {category_type: "Repeating", total: 20}],
      "3": [{category_type: "786", total: 10}, {category_type: "Double Pair", total: 25}],
      "7": [{category_type: "Couple Pack", total: 5}],
      "8": [{category_type: "Business Group", total: 18}]
    };

    if (!allNumbers || allNumbers.length === 0) return mockPatterns;

    const patterns = {};
    let hasData = false;

    allNumbers.forEach(n => {
      const cat = String(n.number_category || n.category);
      const type = n.pattern_name || n.pattern_type || n.category_type;
      
      if (!type || type === 'Regular Number' || type === 'Normal' || type === 'Normal Fancy Numbers') return;
      
      hasData = true;
      if (!patterns[cat]) patterns[cat] = {};
      patterns[cat][type] = (patterns[cat][type] || 0) + 1;
    });

    if (!hasData) return mockPatterns;

    const res = {};
    Object.entries(patterns).forEach(([catId, typeMap]) => {
      res[catId] = Object.entries(typeMap)
        .map(([category_type, total]) => ({ category_type, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);
    });
    
    return res;
  }, [allNumbers]);

  const staticCategories = [
    { name: 'Diamond', icon: '💎', id: '1', cls: 'diamond' },
    { name: 'Platinum', icon: '💍', id: '2', cls: 'platinum' },
    { name: 'Gold', icon: '⭐', id: '3', cls: 'gold' },
    { name: 'Silver', icon: '🥈', id: '4', cls: 'silver' },
    { name: 'Bronze', icon: '🥉', id: '5', cls: 'bronze' },
    { name: 'Couple', icon: '👫', id: '7', cls: 'couple' },
    { name: 'Business', icon: '💼', id: '8', cls: 'business' },
    { name: 'Normal', icon: '📱', id: '6', cls: 'normal' },
  ];

  const categories = dbCategories.length > 0 
    ? (() => {
        const mapped = dbCategories.map(c => ({
          ...c,
          name: c.category_name,
          icon: staticCategories.find(s => s.id == c.category_id)?.icon || '📱',
          cls: staticCategories.find(s => s.id == c.category_id)?.cls || 'normal',
          id: String(c.category_id)
        }));
        // Always ensure Couple(7) and Business(8) are present
        const ids = new Set(mapped.map(c => c.id));
        staticCategories.forEach(sc => {
          if ((sc.id === '7' || sc.id === '8') && !ids.has(sc.id)) {
            mapped.push(sc);
          }
        });
        return mapped;
      })()
    : staticCategories;

  const patternExamples = {
    'Mirror': '1234 4321',
    'Mirror Number': '1234 4321',
    'Palindrome': '1234 5 4321',
    'Palindrome Number': '1234 5 4321',
    'Ladder Up': '0123456789',
    'Ladder Down': '9876543210',
    'Ladder Series': '0123456789',
    'Descending Ladder': '9876543210',
    'Repeating': '999999',
    'Repeating Fancy': 'XXXXXX',
    'Double Pair': 'XX YY ZZ',
    'Double Pair Fancy': 'AABB CC',
    'Triple': 'AAA BBB',
    'Triple Digit': 'XXX YYY',
    'Sequential': '123 456',
    'Sequential Number': '123 456',
    '786 Holy': '**786**',
    '786': '**786**',
    'Hexa': 'X×6 digits',
    'Hexa Number': 'X×6 digits',
    'Penta': 'X×5 digits',
    'Penta Number': 'X×5 digits',
    'Tetra': 'X×4 digits',
    'Tetra Number': 'X×4 digits',
    'Couple Pack': '2 matching SIMs',
    'Business Group': '3+ grouped SIMs',
    'Premium Bundle': 'Group package',
    'Normal': '9845X XXXXX'
  };

  const handlePatternClick = (catId, pattern) => {
    if (onFilterChange) {
      onFilterChange('category', catId);
      onFilterChange('pattern_type', pattern);
      window.scrollTo({ top: 500, behavior: 'smooth' });
    }
  };

  const handleCategoryClick = (catId) => {
    if (onFilterChange) {
      onFilterChange('category', catId);
      onFilterChange('pattern_type', '');
      window.scrollTo({ top: 500, behavior: 'smooth' });
    }
  };

  return (
    <>
      <nav style={styles.nav}>
        <div className="container" style={styles.container}>
          <div style={styles.leftSection}>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
            
            <a href="/" style={styles.logo}>
              <img 
                src="/logo.png" 
                alt="Logo" 
                style={styles.logoImg} 
                onError={(e) => e.target.style.display='none'} 
              />
              <span style={styles.logoText}>
                <span style={{ color: 'var(--primary)' }}>As</span><span style={{ color: 'var(--secondary)' }}>FancyNumber</span>
              </span>
            </a>
          </div>

          <div className="desktop-nav">
            {categories.filter(c => c.id !== '6').map(cat => {
              const patterns = dbPatterns[cat.id] || [];
              const isHovered = activeDropdown === cat.id;

              return (
                <div 
                  key={cat.id} 
                  style={styles.dropdownContainer}
                  onMouseEnter={() => setActiveDropdown(cat.id)}
                  onMouseLeave={() => setActiveDropdown(null)}
                >
                  <button 
                    onClick={() => handleCategoryClick(cat.id)}
                    style={{
                      ...styles.navLink,
                      color: filters?.category === cat.id ? 'var(--primary)' : 'var(--text)',
                      opacity: filters?.category === cat.id ? 1 : 0.7
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{cat.icon}</span>
                    <span style={{ marginLeft: '6px' }}>{cat.name}</span>
                    {patterns.length > 0 && <ChevronDown size={12} style={{ opacity: 0.5, marginLeft: '4px' }} />}
                  </button>

                  {isHovered && patterns.length > 0 && (
                    <div style={styles.dropdownMenu}>
                      <div style={styles.dropdownHeader}>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Types of {cat.name}</span>
                      </div>
                      {patterns.map((p, idx) => (
                        <button 
                          key={idx} 
                          style={styles.dropdownItem}
                          onClick={() => handlePatternClick(cat.id, p.category_type)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600 }}>{p.category_type}</span>
                              <span style={{ fontSize: '10px', opacity: 0.5 }}>{p.total}</span>
                            </div>
                            <span style={{ fontSize: '11px', opacity: 0.4, marginTop: '2px' }}>
                              Ex: {patternExamples[p.category_type] || 'XXXX'}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          <div style={styles.rightActions}>
            <button style={styles.cartBtn} onClick={onCartClick}>
              <ShoppingCart size={18} />
              {cartCount > 0 && <span style={styles.cartCount}>{cartCount}</span>}
            </button>

            <button style={styles.loginBtn}>
              Login
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div style={styles.mobileMenu}>
          <div style={{ padding: '20px' }}>
            <div style={{ color: 'var(--muted)', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', marginBottom: '15px', letterSpacing: '0.1em' }}>
              Select Category
            </div>
            {categories.map(cat => (
              <div key={cat.id} style={{ marginBottom: '15px' }}>
                <button 
                  style={{...styles.mobileLink, width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', paddingBottom: '10px'}}
                  onClick={() => { handleCategoryClick(cat.id); setIsMobileMenuOpen(false); }}
                >
                  <span style={{ width: '28px', fontSize: '18px' }}>{cat.icon}</span> 
                  <span style={{ fontWeight: 600 }}>{cat.name}</span>
                </button>
                <div style={{ paddingLeft: '28px', display: 'flex', flexDirection: 'column' }}>
                  {dbPatterns[cat.id]?.map((p, idx) => (
                    <button 
                      key={idx}
                      style={{...styles.mobileLink, padding: '12px 0', fontSize: '13px', width: '100%', justifyContent: 'flex-start', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.03)'}}
                      onClick={() => { handlePatternClick(cat.id, p.category_type); setIsMobileMenuOpen(false); }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', textAlign: 'left' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ opacity: 0.9 }}>{p.category_type}</span>
                          <span style={{ fontSize: '10px', opacity: 0.4 }}>{p.total}</span>
                        </div>
                        <span style={{ fontSize: '11px', opacity: 0.3, marginTop: '2px' }}>
                          Ex: {patternExamples[p.category_type] || 'XXXX'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div style={{ height: '1px', background: 'var(--border)', margin: '20px 0' }} />
            <a href="#" style={styles.mobileLink}><Gift size={16} /> VIP Offers</a>
          </div>
        </div>
      )}
    </>
  );
}

const styles = {
  nav: {
    position: 'fixed',
    top: 0, left: 0, right: 0,
    height: '72px',
    background: 'rgba(6, 6, 8, 0.7)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderBottom: '1px solid var(--border)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
  },
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  leftSection: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    textDecoration: 'none',
  },
  logoImg: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    objectFit: 'cover',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  logoText: {
    fontFamily: "var(--font-display)",
    fontSize: '22px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
  },
  desktopNav: {
    // Moved to CSS classes
  },
  navLink: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--text)',
    textDecoration: 'none',
    opacity: 0.7,
    transition: 'opacity 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: "var(--font-body)",
    whiteSpace: 'nowrap',
  },
  dropdownContainer: {
    position: 'relative',
    height: '72px',
    display: 'flex',
    alignItems: 'center',
  },
  dropdownMenu: {
    position: 'absolute',
    top: '72px',
    left: '0',
    background: 'rgba(15, 15, 20, 0.95)',
    backdropFilter: 'blur(30px)',
    border: '1px solid var(--border)',
    borderRadius: '0 0 12px 12px',
    padding: '12px',
    minWidth: '220px',
    boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    animation: 'navDropdownFade 0.2s ease-out',
  },
  dropdownHeader: {
    padding: '4px 12px 10px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    marginBottom: '6px',
  },
  dropdownItem: {
    padding: '10px 12px',
    fontSize: '13px',
    color: 'var(--text)',
    textDecoration: 'none',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontFamily: "var(--font-ui)",
    transition: 'all 0.2s',
    background: 'none',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    textAlign: 'left',
    opacity: 0.8,
    '&:hover': {
      background: 'rgba(255,255,255,0.05)',
      opacity: 1,
    }
  },
  rightActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  cartBtn: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid var(--border)',
    color: '#fff',
    width: '40px', height: '40px',
    borderRadius: '10px',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cartCount: {
    position: 'absolute',
    top: '-5px', right: '-5px',
    background: 'var(--primary)',
    color: '#000',
    fontSize: '10px', fontWeight: 800,
    width: '18px', height: '18px',
    borderRadius: '50%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  loginBtn: {
    background: 'var(--primary)',
    color: '#000',
    border: 'none',
    padding: '8px 20px',
    borderRadius: '10px',
    fontSize: '13px',
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    marginLeft: '8px',
  },
  mobileMenuBtn: {
    // Moved to CSS classes
  },
  mobileMenu: {
    position: 'fixed',
    top: '72px', left: 0, right: 0, bottom: 0,
    background: 'var(--bg)',
    zIndex: 999,
    overflowY: 'auto',
  },
  mobileLink: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '15px 0',
    fontSize: '15px', fontWeight: 500,
    color: '#fff', textDecoration: 'none',
    borderBottom: '1px solid var(--border)',
  }
};
