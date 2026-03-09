import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Sidebar from './components/Sidebar';
import NumberCard from './components/NumberCard';
import CartModal from './components/CartModal';
import Loader from './components/Loader';
import { useFancyNumbers } from './hooks/useFancyNumbers';
import { Ghost, Loader2 } from 'lucide-react';
import './index.css';

// Helper: renders a titled section if it has results
function SectionGrid({ title, items, isItemInCart, onToggleCart, accentColor }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{marginBottom: '40px'}}>
      <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'18px'}}>
        <span style={{width:'4px', height:'24px', background: accentColor || 'var(--neon-green)', borderRadius:'2px', display:'inline-block'}}/>
        <h3 style={{margin:0, fontSize:'1.15rem', fontWeight:800, color:'var(--text-main)'}}>{title}</h3>
        <span style={{fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:600}}>({items.length})</span>
      </div>
      <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:'20px'}}>
        {items.map(item => (
          <NumberCard
            key={item.number_id || item.id}
            item={item}
            inCart={isItemInCart(item.number_id || item.id)}
            onToggleCart={onToggleCart}
          />
        ))}
      </div>
    </div>
  );
}

// Auto-categorises numbers using price/pattern rules instead of is_featured flag
function NumberSections({ numbers, isItemInCart, onToggleCart }) {
  const isLucky = (n) => {
    const m = String(n.mobile_number);
    return m.includes('786') || m.includes('108');
  };
  const isVIP = (n) => Number(n.repeat_count) >= 4;
  const isPremium = (n) => parseFloat(n.base_price || 0) > 50000;

  const vip       = numbers.filter(n => isVIP(n));
  const premium   = numbers.filter(n => isPremium(n) && !isVIP(n));
  const lucky     = numbers.filter(n => isLucky(n) && !isVIP(n) && !isPremium(n));
  const latest    = numbers.filter(n => !isVIP(n) && !isPremium(n) && !isLucky(n)).slice(0, 12);
  const rest      = numbers.filter(n => !isVIP(n) && !isPremium(n) && !isLucky(n)).slice(12);

  return (
    <div>
      <SectionGrid title="⭐ VIP Numbers" items={vip} isItemInCart={isItemInCart} onToggleCart={onToggleCart} accentColor="#f59e0b" />
      <SectionGrid title="💎 Premium Numbers" items={premium} isItemInCart={isItemInCart} onToggleCart={onToggleCart} accentColor="#8b5cf6" />
      <SectionGrid title="🍀 Lucky Numbers" items={lucky} isItemInCart={isItemInCart} onToggleCart={onToggleCart} accentColor="#10b981" />
      <SectionGrid title="🆕 Latest Numbers" items={latest} isItemInCart={isItemInCart} onToggleCart={onToggleCart} accentColor="#3b82f6" />
      <SectionGrid title="📋 Available Numbers" items={rest} isItemInCart={isItemInCart} onToggleCart={onToggleCart} accentColor="var(--neon-green)" />
    </div>
  );
}

function App() {
  const { numbers, categories, loading, error, filters, updateFilter, resetFilters } = useFancyNumbers();
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('fn_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Loader: always show on mount, hide only when BOTH animation is done AND data is loaded
  const [showLoader, setShowLoader] = useState(true);
  const [animDone, setAnimDone] = useState(false);
  const loaderTimerRef = useRef(null);

  useEffect(() => {
    // Minimum anim time — matches Loader.jsx: 3s spin + 2.5s brand + 0.3s buffer
    loaderTimerRef.current = setTimeout(() => setAnimDone(true), 4200);
    return () => clearTimeout(loaderTimerRef.current);
  }, []);

  useEffect(() => {
    // Hide loader only when animation ran AND data is no longer loading
    if (animDone && !loading) {
      setShowLoader(false);
    }
  }, [animDone, loading]);

  useEffect(() => {
    localStorage.setItem('fn_cart', JSON.stringify(cart));
  }, [cart]);

  const toggleCartItem = (numObj) => {
    const id = numObj.number_id || numObj.id;
    setCart(prev => {
      const exists = prev.find(item => (item.number_id || item.id) === id);
      if (exists) {
        return prev.filter(item => (item.number_id || item.id) !== id);
      } else {
        return [...prev, numObj];
      }
    });
  };

  const isItemInCart = (id) => {
    return cart.some(item => (item.number_id || item.id) === id);
  };

  return (
    <>
      {showLoader && <Loader />}
      <Navbar cartCount={cart.length} onCartClick={() => setIsCartOpen(true)} />
      
      <Hero onSearch={(query) => updateFilter('query', query)} />

      <main className="container" style={styles.mainLayout}>
        <Sidebar 
          categories={categories}
          filters={filters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
        />

        <section style={styles.resultsSection}>
          <div style={styles.sectionHeader}>
            <h2 style={{margin: 0}}>
              {filters.query ? `Search Results` : 'Browse Numbers'}
            </h2>
            <div style={styles.sortBox}>
              <select 
                style={styles.sortSelect}
                value={filters.sortOrder}
                onChange={(e) => updateFilter('sortOrder', e.target.value)}
              >
                <option value="default">Sort By</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div style={styles.centerState}>
              <Loader2 className="spinner" size={48} style={{color: 'var(--neon-green)', animation: 'spin 1s linear infinite', marginBottom: '20px'}}/>
              <p>Loading premium numbers...</p>
            </div>
          ) : error ? (
            <div style={styles.centerState}>
              <p style={{color: '#ff4d4d'}}>{error}</p>
            </div>
          ) : numbers.length === 0 ? (
            <div style={styles.centerState}>
              <Ghost size={48} style={{color: 'var(--text-muted)', marginBottom: '16px'}} />
              <h3 style={{marginBottom: '8px', fontSize: '1.2rem'}}>No numbers found for this pattern.</h3>
              <p style={{color: 'var(--text-muted)'}}>Try another pattern like 9999 or *786*.</p>
            </div>
          ) : (
            <NumberSections numbers={numbers} isItemInCart={isItemInCart} onToggleCart={toggleCartItem} />
          )}
        </section>
      </main>

      <CartModal 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onToggleCart={toggleCartItem}
      />

      <footer style={styles.footer}>
        <div className="container" style={styles.footerContent}>
          <div>
            <h2>As<span className="text-neon">FancyNumber</span></h2>
            <p style={{color: 'var(--text-muted)', marginTop: '10px'}}>Your premium destination for VIP mobile numbers.</p>
          </div>
          <div style={styles.footerLinks}>
            <a href="#">Terms & Conditions</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Contact Support</a>
          </div>
        </div>
        <div style={styles.footerBottom}>
          <p>&copy; 2026 AsFancyNumber. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

const styles = {
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '40px',
    paddingBottom: '80px',
    marginTop: '40px',
    '@media (max-width: 900px)': {
      gridTemplateColumns: '1fr'
    }
  },
  resultsSection: {
    width: '100%',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '30px',
  },
  sortSelect: {
    background: '#ffffff',
    color: 'var(--text-main)',
    border: '1px solid var(--border-color)',
    padding: '10px 16px',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    boxShadow: 'var(--shadow-sm)',
    fontWeight: 600,
    cursor: 'pointer'
  },
  centerState: {
    textAlign: 'center',
    padding: '60px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    background: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--border-color)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '24px',
  },
  footer: {
    background: '#ffffff',
    borderTop: '1px solid var(--border-color)',
    padding: '60px 0 20px',
    marginTop: '40px',
  },
  footerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '40px',
    flexWrap: 'wrap',
    gap: '40px',
  },
  footerLinks: {
    display: 'flex',
    gap: '24px',
  },
  footerBottom: {
    textAlign: 'center',
    paddingTop: '20px',
    borderTop: '1px solid var(--border-color)',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    fontWeight: 500,
  }
};

export default App;
