import { useState, useEffect, useRef } from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import NumberCard from './components/NumberCard';
import CoupleCard from './components/CoupleCard';
import GroupCard from './components/GroupCard';
import CartModal from './components/CartModal';
import Loader from './components/Loader';
import AdPopup from './components/AdPopup';
import CouplesSection from './components/CouplesSection';
import GroupsSection from './components/GroupsSection';
import { useFancyNumbers } from './hooks/useFancyNumbers';
import { Ghost, Loader2, ChevronLeft, ChevronRight, LayoutGrid, List } from 'lucide-react';
import './index.css';

// ── Category / Pattern config ────────────────────────────────────────────────
const CATEGORIES = [
  { id: '1', label: 'Diamond', emoji: '💎', cls: 'diamond', sub: 'Mirror · Palindrome · Full Symmetry · Hexa · Single Digit Repeating' },
  { id: '2', label: 'Platinum', emoji: '💍', cls: 'platinum', sub: 'Penta · XYXYXY · Tetra · xyzxyz' },
  { id: '3', label: 'Gold', emoji: '⭐', cls: 'gold', sub: '786 · Doubling · ABAB-XYXY · Numerology' },
  { id: '4', label: 'Silver', emoji: '🥈', cls: 'silver', sub: 'Sequential · 000 Series · 13 Special · xyxy Pattern' },
  { id: '5', label: 'Bronze', emoji: '🥉', cls: 'bronze', sub: 'Minimum Digit · Special Characters' },
  { id: '7', label: 'Couple', emoji: '👫', cls: 'couple', sub: 'Matching Pairs · Consecutive Pairs · Special Sets' },
  { id: '8', label: 'Business', emoji: '💼', cls: 'business', sub: 'Corporate Sets · Team Bundles · Sequential Groups' },
  { id: '6', label: 'Normal', emoji: '📱', cls: 'normal', sub: 'Daily Use · Budget Friendly · Clean Numbers' },
];

const PATTERNS = [
  { type: 'Mirror', label: 'Mirror Numbers' },
  { type: '786', label: '🕌 786 Lucky' },
  { type: 'Numerology', label: '🔢 Numerology' },
  { type: 'Repeating', label: 'Repeating' },
  { type: 'XYXYXY', label: 'XYXYXY' },
];

// ── Renders a single card (number, couple, or group) ─────────────────────────
function RenderCard({ item, isItemInCart, onToggleCart, compact }) {
  if (item.is_bundle) {
    if (item.bundle_type === 'couple') {
      return (
        <CoupleCard
          key={`couple-${item.couple_id}`}
          item={item}
          isItemInCart={isItemInCart}
          onToggleCart={onToggleCart}
        />
      );
    }
    if (item.bundle_type === 'group') {
      return (
        <GroupCard
          key={`group-${item.group_id}`}
          item={item}
          selectedIds={[]}
          onToggleCheck={() => {}}
          calculatedPrice={item.group_offer_price ? parseFloat(item.group_offer_price) : parseFloat(item.group_price || 0)}
          isItemInCart={isItemInCart}
          onToggleCart={onToggleCart}
        />
      );
    }
  }
  return (
    <NumberCard
      key={item.number_id || item.id}
      item={item}
      compact={compact}
      inCart={isItemInCart(item.number_id || item.id)}
      onToggleCart={onToggleCart}
    />
  );
}

// ── Two-row horizontal scroll row per category ───────────────────────────────
function ScrollRow({ cat, items, isItemInCart, onToggleCart, onSeeAll }) {
  const scrollRef1 = useRef(null);
  const scrollRef2 = useRef(null);

  const scroll1 = (dir) => {
    if (!scrollRef1.current) return;
    scrollRef1.current.scrollBy({ left: dir * 460, behavior: 'smooth' });
  };

  const scroll2 = (dir) => {
    if (!scrollRef2.current) return;
    scrollRef2.current.scrollBy({ left: dir * 460, behavior: 'smooth' });
  };

  const VISIBLE = 48; // 24 per row × 2 rows
  const visibleItems = items.slice(0, VISIBLE);
  const row1 = visibleItems.filter((_, i) => i % 2 === 0);
  const row2 = visibleItems.filter((_, i) => i % 2 === 1);

  const isCouple = cat.id === '7';
  const isGroup = cat.id === '8';
  const colWidth = isCouple ? '400px' : isGroup ? '360px' : '320px';

  return (
    <div id={`section-${cat.cls}`} className="section-row">
      <div className="section-header">
        <div className="section-icon" style={{ background: `var(--${cat.cls})`, color: '#000' }}>{cat.emoji}</div>
        <div>
          <div className="section-title" style={{ fontFamily: "var(--font-display)", fontSize: '28px', fontWeight: 600, letterSpacing: '0.06em' }}>{cat.label} Numbers</div>
          <div className="section-sub" style={{ fontFamily: "var(--font-body)", fontSize: '13px', fontWeight: 300 }}>{cat.sub}</div>
        </div>
        <span className="section-count" style={{ fontFamily: "var(--font-body)", fontSize: '12px', fontWeight: 500 }}>{items.length.toLocaleString('en-IN')} numbers</span>
        <button className="see-all" onClick={() => onSeeAll(cat.id)} style={{ fontFamily: "var(--font-heading)", fontStyle: 'italic', fontWeight: 400, fontSize: '14px', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>Explore All →</button>
      </div>

      {/* First Row Scroll Container */}
      <div style={rowStyles.scrollWrapper}>
        <button style={rowStyles.arrowBtnLeft} onClick={() => scroll1(-1)}><ChevronLeft size={18} /></button>

        <div ref={scrollRef1} style={rowStyles.scrollContainer}>
          {row1.map((item, idx) => (
            <div key={`r1-${item.number_id || item.id || idx}`} style={{ flexShrink: 0, width: colWidth }}>
              <RenderCard item={item} isItemInCart={isItemInCart} onToggleCart={onToggleCart} compact />
            </div>
          ))}
          {/* If there's no row 2 but more items, explore badge goes here */}
          {items.length > VISIBLE && row2.length === 0 && (
            <div style={{...rowStyles.moreBadge, width: colWidth }} onClick={() => onSeeAll(cat.id)}>
              Explore All {items.length} <br /> {cat.label} Numbers
            </div>
          )}
        </div>

        <button style={rowStyles.arrowBtnRight} onClick={() => scroll1(1)}><ChevronRight size={18} /></button>
      </div>

      {/* Second Row Scroll Container */}
      {row2.length > 0 && (
        <div style={{...rowStyles.scrollWrapper, marginTop: '30px'}}>
          <button style={rowStyles.arrowBtnLeft} onClick={() => scroll2(-1)}><ChevronLeft size={18} /></button>

          <div ref={scrollRef2} style={rowStyles.scrollContainer}>
            {row2.map((item, idx) => (
              <div key={`r2-${item.number_id || item.id || idx}`} style={{ flexShrink: 0, width: colWidth }}>
                <RenderCard item={item} isItemInCart={isItemInCart} onToggleCart={onToggleCart} compact />
              </div>
            ))}
            {items.length > VISIBLE && (
              <div style={{...rowStyles.moreBadge, width: colWidth }} onClick={() => onSeeAll(cat.id)}>
                Explore All {items.length} <br /> {cat.label} Numbers
              </div>
            )}
          </div>

          <button style={rowStyles.arrowBtnRight} onClick={() => scroll2(1)}><ChevronRight size={18} /></button>
        </div>
      )}
    </div>
  );
}

import { getHomepageRows } from './api/client';
import { classifyNumber } from './utils/PatternEngine';

// ── Home showcase: categories + patterns ─────────────────────────────────────
// FIX: allNumbers is now correctly passed as a prop and used for categorisation
function HomeShowcase({ allNumbers, loading, isItemInCart, onToggleCart, onSeeAll }) {
  const [rowItems, setRowItems] = useState({});

  useEffect(() => {
    if (loading || !allNumbers || !allNumbers.length) return;

    const newRowItems = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [], 8: [] };

    allNumbers.forEach(n => {
      const cat = String(n.number_category || n.category || '6');
      if (newRowItems[cat]) newRowItems[cat].push(n);
      else newRowItems['6'].push(n);
    });

    setRowItems(newRowItems);
  }, [allNumbers, loading]);

  if (loading && !Object.keys(rowItems).length) return null;

  return (
    <div>
      {CATEGORIES.map(cat => {
        const items = rowItems[cat.id] || [];
        if (items.length === 0) return null;
        return (
          <ScrollRow
            key={cat.id}
            cat={cat}
            items={items}
            isItemInCart={isItemInCart}
            onToggleCart={onToggleCart}
            onSeeAll={onSeeAll}
          />
        );
      })}
    </div>
  );
}

// ── Grid view (when filters are active) ──────────────────────────────────────
function FilteredGrid({ numbers, isItemInCart, onToggleCart }) {
  const [selectedIds, setSelectedIds] = useState({});

  const handleToggleCheck = (groupId, numberId) => {
    if (!groupId) return;
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

  const getPrice = (group) => {
    if (!group) return 0;
    const gid = group.group_id || group.id;
    const ids = selectedIds[gid] || [];
    if (ids.length === 0) return parseFloat(group.group_price || 0);
    const selected = (group.numbers || []).filter(n => ids.includes(n.number_id));
    const total = selected.reduce((sum, n) => sum + parseFloat(n.base_price || 0), 0);
    const allSelected = ids.length > 0 && ids.length === (group.numbers || []).length;
    return (allSelected && group.group_offer_price) ? parseFloat(group.group_offer_price) : total;
  };

  if (!Array.isArray(numbers)) return null;

  return (
    <div className="cards-grid" style={{ marginTop: '20px' }}>
      {numbers.map(item => {
        const itemId = item.group_id || item.number_id || item.id;
        if (!itemId) return null;

        if (item.is_bundle) {
          if (item.bundle_type === 'couple') {
            return (
              <CoupleCard
                key={`couple-${itemId}`}
                item={item}
                isItemInCart={isItemInCart}
                onToggleCart={onToggleCart}
              />
            );
          }
          if (item.bundle_type === 'group') {
            return (
              <GroupCard
                key={`group-${itemId}`}
                item={item}
                selectedIds={selectedIds[itemId] || []}
                onToggleCheck={(numId) => handleToggleCheck(itemId, numId)}
                calculatedPrice={getPrice(item)}
                isItemInCart={isItemInCart}
                onToggleCart={onToggleCart}
              />
            );
          }
        }
        return (
          <NumberCard
            key={itemId}
            item={item}
            inCart={isItemInCart(itemId)}
            onToggleCart={onToggleCart}
          />
        );
      })}
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
  const [showLoader, setShowLoader] = useState(() => {
    let isReload = false;
    if (typeof window !== 'undefined' && window.performance) {
      const navEntries = window.performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        isReload = navEntries[0].type === 'reload';
      } else if (window.performance.navigation) {
        isReload = window.performance.navigation.type === 1;
      }
    }
    if (isReload) return true;
    if (!sessionStorage.getItem('fn_visited')) {
      sessionStorage.setItem('fn_visited', 'true');
      return true;
    }
    return false;
  });
  
  const [animDone, setAnimDone] = useState(!showLoader);
  const loaderTimerRef = useRef(null);

  const hasActiveFilters = filters.query || filters.category || filters.pattern_name || filters.digitSum || filters.maxPrice < 10000000;

  useEffect(() => {
    if (showLoader) {
      loaderTimerRef.current = setTimeout(() => setAnimDone(true), 3500);
    }
    return () => clearTimeout(loaderTimerRef.current);
  }, [showLoader]);

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
      <Navbar
        cartCount={cart.length}
        onCartClick={() => setIsCartOpen(true)}
        filters={filters}
        onFilterChange={updateFilter}
        allNumbers={allNumbers || numbers}
      />
      <Hero
        filters={filters}
        onFilterChange={updateFilter}
        onReset={resetFilters}
        allNumbers={allNumbers || numbers}
      />

      <main className="container" style={appStyles.mainLayout}>
        <section style={appStyles.resultsSection}>
          {loading && !showLoader ? (
            <div style={appStyles.centerState}>
              <Loader2 className="spinner" size={48} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
              <p>Fetching premium collection...</p>
            </div>
          ) : error ? (
            <div style={appStyles.centerState}>
              <p style={{ color: 'var(--danger)' }}>{error}</p>
            </div>
          ) : hasActiveFilters ? (
            <>
              <div className="results-header" style={appStyles.sectionHeader}>
                <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 600 }}>
                  {filters.query ? `Results for "${filters.query}"` : 'Refined Selection'}
                  <span style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 500, marginLeft: '12px' }}>
                    ({numbers.length.toLocaleString()} found)
                  </span>
                </h2>
                <div className="sort-container-mobile" style={{ display: 'flex', gap: '12px' }}>
                  <select
                    style={appStyles.sortSelect}
                    value={filters.sortOrder}
                    onChange={(e) => updateFilter('sortOrder', e.target.value)}
                  >
                    <option value="default">Default Sort</option>
                    <option value="price_asc">Price: Low to High</option>
                    <option value="price_desc">Price: High to Low</option>
                  </select>
                </div>
              </div>

              {numbers.length === 0 ? (
                <div style={appStyles.centerState}>
                  <Ghost size={48} style={{ color: 'var(--muted)', marginBottom: '16px' }} />
                  <h3 style={{ marginBottom: '8px', fontSize: '1.2rem' }}>No matches found</h3>
                  <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Try adjusting your filters or search query.</p>
                </div>
              ) : (
                <FilteredGrid numbers={numbers} isItemInCart={isItemInCart} onToggleCart={toggleCartItem} />
              )}
            </>
          ) : (
            // FIX: allNumbers correctly passed into HomeShowcase
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <HomeShowcase
                allNumbers={allNumbers || numbers}
                loading={loading}
                isItemInCart={isItemInCart}
                onToggleCart={toggleCartItem}
                onSeeAll={(catId) => {
                  updateFilter('category', catId);
                  window.scrollTo({ top: 500, behavior: 'smooth' });
                }}
              />
            </div>
          )}
        </section>
      </main>

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onToggleCart={toggleCartItem}
      />

      <AdPopup />

      <footer style={appStyles.footer}>
        <div className="container" style={appStyles.footerContent}>
          <div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: '20px', fontWeight: 700, color: '#fff', letterSpacing: '0.10em', textTransform: 'uppercase' }}>
              As<span style={{ color: 'var(--primary)' }}>FancyNumber</span>
            </h2>
            <p style={{ fontFamily: "var(--font-body)", color: 'var(--muted)', marginTop: '12px', fontSize: '13px', fontWeight: 300, maxWidth: '300px', lineHeight: 1.7 }}>
              India's premier marketplace for high-value VIP mobile numbers. Elevating digital identities since 2026.
            </p>
          </div>
          <div style={appStyles.footerLinks}>
            <div style={footerGroupStyles}>
              <h4 style={footerTitleStyles}>Navigation</h4>
              <a href="#" style={{ fontFamily: "var(--font-ui)", fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>VIP Collection</a>
              <a href="#" style={{ fontFamily: "var(--font-ui)", fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Flash Offers</a>
              <a href="#" style={{ fontFamily: "var(--font-ui)", fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Special Pairs</a>
            </div>
            <div style={footerGroupStyles}>
              <h4 style={footerTitleStyles}>Support</h4>
              <a href="#" style={{ fontFamily: "var(--font-ui)", fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Contact Support</a>
              <a href="#" style={{ fontFamily: "var(--font-ui)", fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>How it Works</a>
              <a href="#" style={{ fontFamily: "var(--font-ui)", fontSize: '13px', color: 'var(--muted)', textDecoration: 'none' }}>Terms of Service</a>
            </div>
          </div>
        </div>
        <div className="container">
          <div style={appStyles.footerBottom}>
            <p>&copy; 2026 AsFancyNumber Premium. Handcrafted for Distinction.</p>
          </div>
        </div>
      </footer>
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const footerGroupStyles = {
  display: 'flex', flexDirection: 'column', gap: '12px'
};
const footerTitleStyles = {
  fontFamily: "var(--font-ui)", fontSize: '12px', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px'
};

const rowStyles = {
  scrollWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    margin: '0 -20px',
    padding: '0 20px',
  },
  arrowBtnLeft: {
    position: 'absolute', left: '-20px', zIndex: 10,
    background: 'rgba(13,13,18,0.8)', border: '1px solid var(--border)',
    borderRadius: '50%', width: '40px', height: '40px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', cursor: 'pointer', backdropFilter: 'blur(10px)',
  },
  arrowBtnRight: {
    position: 'absolute', right: '-20px', zIndex: 10,
    background: 'rgba(13,13,18,0.8)', border: '1px solid var(--border)',
    borderRadius: '50%', width: '40px', height: '40px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', cursor: 'pointer', backdropFilter: 'blur(10px)',
  },
  // FIX: Scrollable container now holds columns (each column = 2 stacked cards)
  scrollContainer: {
    display: 'flex',
    flexDirection: 'row',
    gap: '24px',
    overflowX: 'auto',
    padding: '20px 4px 30px 4px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    WebkitOverflowScrolling: 'touch',
    flex: 1,
  },
  // Each column stacks 2 cards vertically
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    flexShrink: 0,
    alignItems: 'stretch',
  },
  // Each card slot keeps cards from stretching
  cardSlot: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  moreBadge: {
    minWidth: '220px',
    minHeight: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--muted)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
    textAlign: 'center',
    lineHeight: 1.5,
    alignSelf: 'center',
  },
};

const appStyles = {
  mainLayout: {
    paddingBottom: '80px', position: 'relative',
    display: 'flex', flexDirection: 'column', gap: '32px'
  },
  resultsSection: { width: '100%', minWidth: 0 },
  sectionHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '32px', padding: '16px 0', borderBottom: '1px solid var(--border)',
  },
  sortSelect: {
    background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)',
    padding: '10px 16px', borderRadius: '10px', outline: 'none',
    fontWeight: 600, cursor: 'pointer', fontSize: '13px'
  },
  centerState: {
    textAlign: 'center', padding: '100px 0', display: 'flex', flexDirection: 'column',
    alignItems: 'center', background: 'var(--bg2)', borderRadius: 'var(--radius)',
    border: '1px solid var(--border)', color: 'var(--muted)'
  },
  footer: {
    background: 'var(--bg)', borderTop: '1px solid var(--border)',
    padding: '100px 0 40px', marginTop: '80px',
  },
  footerContent: {
    display: 'flex', justifyContent: 'space-between', marginBottom: '80px', flexWrap: 'wrap', gap: '60px',
  },
  footerLinks: { display: 'flex', gap: '80px', flexWrap: 'wrap' },
  footerBottom: {
    textAlign: 'center', paddingTop: '40px', borderTop: '1px solid var(--border)',
    color: 'var(--muted)', fontSize: '12px', fontWeight: 400, fontFamily: "var(--font-ui)"
  },
};

export default App;