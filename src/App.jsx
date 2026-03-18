import { useState, useEffect, useRef, useMemo } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Sidebar from './components/Sidebar';
import NumberCard from './components/NumberCard';
import CartModal from './components/CartModal';
import Loader from './components/Loader';
import { useFancyNumbers } from './hooks/useFancyNumbers';
import { Ghost, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import './index.css';

// ── Category / Pattern config ────────────────────────────────────────────────
const CATEGORIES = [
  { id: '1', label: '💎 Diamond',  color: '#0ea5e9', bg: 'linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%)', accent: '#0284c7' },
  { id: '2', label: '💍 Platinum', color: '#8b5cf6', bg: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)', accent: '#7c3aed' },
  { id: '3', label: '⭐ Gold',     color: '#d97706', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', accent: '#b45309' },
  { id: '4', label: '🥈 Silver',   color: '#64748b', bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', accent: '#475569' },
  { id: '5', label: '📱 Normal',   color: '#6b7280', bg: 'linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%)', accent: '#4b5563' },
];

const PATTERNS = [
  { type: 'Mirror',      label: '🪞 Mirror Numbers',      accent: '#0ea5e9' },
  { type: 'Palindrome',  label: '🔄 Palindrome Numbers',  accent: '#8b5cf6' },
  { type: 'Ladder Up',   label: '📈 Ladder Up',            accent: '#10b981' },
  { type: 'Ladder Down', label: '📉 Ladder Down',          accent: '#f59e0b' },
  { type: 'Repeating',   label: '🔁 Repeating Numbers',   accent: '#ef4444' },
  { type: 'Double Pair', label: '👯 Double Pair',          accent: '#ec4899' },
  { type: 'Triple',      label: '3️⃣ Triple Digit',        accent: '#14b8a6' },
  { type: 'Sequential',  label: '🔢 Sequential',          accent: '#6366f1' },
];

// ── Horizontal scroll row ────────────────────────────────────────────────────
function ScrollRow({ title, items, accent, isItemInCart, onToggleCart }) {
  const scrollRef = useRef(null);
  if (!items || items.length === 0) return null;

  const scroll = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * 460, behavior: 'smooth' });
  };

  return (
    <div style={{ marginBottom: '36px' }}>
      <div style={rowStyles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ ...rowStyles.accent, background: accent || 'var(--neon-green)' }} />
          <h3 style={rowStyles.title}>{title}</h3>
          <span style={rowStyles.count}>{items.length}</span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={rowStyles.arrowBtn} onClick={() => scroll(-1)}><ChevronLeft size={18} /></button>
          <button style={rowStyles.arrowBtn} onClick={() => scroll(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div ref={scrollRef} style={rowStyles.scrollContainer}>
        {items.slice(0, 50).map(item => (
          <NumberCard
            key={item.number_id || item.id}
            item={item}
            compact
            inCart={isItemInCart(item.number_id || item.id)}
            onToggleCart={onToggleCart}
          />
        ))}
        {items.length > 50 && (
          <div style={rowStyles.moreBadge}>
            +{items.length - 50} more
          </div>
        )}
      </div>
    </div>
  );
}

// ── Home showcase: categories + patterns ─────────────────────────────────────
function HomeShowcase({ allNumbers, isItemInCart, onToggleCart }) {
  const getCat = (n) => String(n.number_category || n.category || '5');
  const getPat = (n) => String(n.pattern_type || '');

  return (
    <div>
      {/* Section: By Category */}
      <div style={sectionStyles.sectionTitle}>
        <h2 style={sectionStyles.heading}>Browse by Category</h2>
        <p style={sectionStyles.sub}>Premium numbers organized by rarity</p>
      </div>
      {CATEGORIES.map(cat => {
        const items = allNumbers.filter(n => getCat(n) === cat.id);
        return (
          <ScrollRow
            key={cat.id}
            title={cat.label}
            items={items}
            accent={cat.accent}
            isItemInCart={isItemInCart}
            onToggleCart={onToggleCart}
          />
        );
      })}

      {/* Section: By Pattern */}
      <div style={{ ...sectionStyles.sectionTitle, marginTop: '24px' }}>
        <h2 style={sectionStyles.heading}>Browse by Pattern</h2>
        <p style={sectionStyles.sub}>Discover unique number patterns</p>
      </div>
      {PATTERNS.map(pat => {
        const items = allNumbers.filter(n => getPat(n) === pat.type);
        return (
          <ScrollRow
            key={pat.type}
            title={pat.label}
            items={items}
            accent={pat.accent}
            isItemInCart={isItemInCart}
            onToggleCart={onToggleCart}
          />
        );
      })}
    </div>
  );
}

// ── Grid view (when filters are active) ──────────────────────────────────────
function FilteredGrid({ numbers, isItemInCart, onToggleCart }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
      {numbers.map(item => (
        <NumberCard
          key={item.number_id || item.id}
          item={item}
          inCart={isItemInCart(item.number_id || item.id)}
          onToggleCart={onToggleCart}
        />
      ))}
    </div>
  );
}

function App() {
  const { numbers, allNumbers, loading, error, filters, updateFilter, resetFilters } = useFancyNumbers();
  const [cart, setCart] = useState(() => {
    const saved = localStorage.getItem('fn_cart');
    return saved ? JSON.parse(saved) : [];
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showLoader, setShowLoader] = useState(true);
  const [animDone, setAnimDone] = useState(false);
  const loaderTimerRef = useRef(null);

  const hasActiveFilters = filters.query || filters.category || filters.pattern_type || filters.digitSum || filters.maxPrice < 500000;

  useEffect(() => {
    loaderTimerRef.current = setTimeout(() => setAnimDone(true), 4200);
    return () => clearTimeout(loaderTimerRef.current);
  }, []);

  useEffect(() => {
    if (animDone && !loading) setShowLoader(false);
  }, [animDone, loading]);

  useEffect(() => {
    localStorage.setItem('fn_cart', JSON.stringify(cart));
  }, [cart]);

  const toggleCartItem = (numObj) => {
    const id = numObj.number_id || numObj.id;
    setCart(prev => {
      const exists = prev.find(item => (item.number_id || item.id) === id);
      return exists
        ? prev.filter(item => (item.number_id || item.id) !== id)
        : [...prev, numObj];
    });
  };

  const isItemInCart = (id) => cart.some(item => (item.number_id || item.id) === id);

  return (
    <>
      {showLoader && <Loader />}
      <Navbar cartCount={cart.length} onCartClick={() => setIsCartOpen(true)} />
      <Hero onSearch={(query) => updateFilter('query', query)} />

      <main className="container" style={appStyles.mainLayout}>
        <Sidebar
          numbers={allNumbers || numbers}
          filters={filters}
          onFilterChange={updateFilter}
          onReset={resetFilters}
        />

        <section style={appStyles.resultsSection}>
          {loading ? (
            <div style={appStyles.centerState}>
              <Loader2 className="spinner" size={48} style={{ color: 'var(--neon-green)', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
              <p>Loading premium numbers...</p>
            </div>
          ) : error ? (
            <div style={appStyles.centerState}>
              <p style={{ color: '#ff4d4d' }}>{error}</p>
            </div>
          ) : hasActiveFilters ? (
            <>
              <div style={appStyles.sectionHeader}>
                <h2 style={{ margin: 0 }}>
                  {filters.query ? 'Search Results' : 'Filtered Numbers'}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '12px' }}>
                    ({numbers.length} found)
                  </span>
                </h2>
                <div>
                  <select
                    style={appStyles.sortSelect}
                    value={filters.sortOrder}
                    onChange={(e) => updateFilter('sortOrder', e.target.value)}
                  >
                    <option value="default">Sort By</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>
              </div>
              {numbers.length === 0 ? (
                <div style={appStyles.centerState}>
                  <Ghost size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                  <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>No numbers found</h3>
                  <p style={{ color: 'var(--text-muted)' }}>Try a different search or filter.</p>
                </div>
              ) : (
                <FilteredGrid numbers={numbers} isItemInCart={isItemInCart} onToggleCart={toggleCartItem} />
              )}
            </>
          ) : (
            <HomeShowcase
              allNumbers={allNumbers || numbers}
              isItemInCart={isItemInCart}
              onToggleCart={toggleCartItem}
            />
          )}
        </section>
      </main>

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onToggleCart={toggleCartItem}
      />

      <footer style={appStyles.footer}>
        <div className="container" style={appStyles.footerContent}>
          <div>
            <h2>As<span className="text-neon">FancyNumber</span></h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '10px' }}>Your premium destination for VIP mobile numbers.</p>
          </div>
          <div style={appStyles.footerLinks}>
            <a href="#">Terms & Conditions</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Contact Support</a>
          </div>
        </div>
        <div style={appStyles.footerBottom}>
          <p>&copy; 2026 AsFancyNumber. All rights reserved.</p>
        </div>
      </footer>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const rowStyles = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '14px',
  },
  accent: {
    width: '4px',
    height: '22px',
    borderRadius: '2px',
    display: 'inline-block',
  },
  title: {
    margin: 0,
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text-main)',
  },
  count: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 700,
    background: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '10px',
  },
  arrowBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid var(--border-color)',
    background: 'var(--bg-card)',
    color: 'var(--text-main)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  scrollContainer: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto',
    paddingBottom: '8px',
    scrollbarWidth: 'thin',
    scrollSnapType: 'x mandatory',
  },
  moreBadge: {
    minWidth: '120px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    border: '2px dashed var(--border-color)',
    borderRadius: '14px',
    color: 'var(--text-muted)',
    fontSize: '0.85rem',
    fontWeight: 700,
    flexShrink: 0,
  },
};

const sectionStyles = {
  sectionTitle: {
    marginBottom: '28px',
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-main)',
    margin: '0 0 4px 0',
  },
  sub: {
    fontSize: '0.9rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
    margin: 0,
  },
};

const appStyles = {
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '280px 1fr',
    gap: '40px',
    paddingBottom: '80px',
    marginTop: '40px',
  },
  resultsSection: {
    width: '100%',
    minWidth: 0,
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
    cursor: 'pointer',
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
  },
};

export default App;
