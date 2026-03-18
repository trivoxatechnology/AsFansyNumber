import { Check, Plus } from 'lucide-react';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

const CATEGORY_META = {
  1: { label: 'Diamond',  color: '#0ea5e9', bg: '#e0f2fe', border: '#7dd3fc' },
  2: { label: 'Platinum', color: '#8b5cf6', bg: '#ede9fe', border: '#c4b5fd' },
  3: { label: 'Gold',     color: '#d97706', bg: '#fef3c7', border: '#fcd34d' },
  4: { label: 'Silver',   color: '#64748b', bg: '#f1f5f9', border: '#cbd5e1' },
  5: { label: 'Normal',   color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
};

const getCategoryMeta = (item) => {
  const cat = String(item.number_category || item.category || '5');
  return CATEGORY_META[cat] || CATEGORY_META[5];
};

const formatMobileNumber = (num) => {
  if (!num) return 'N/A';
  const str = num.toString();
  if (str.length === 10) {
    return (
      <>
        {str.slice(0, 5)} <span className="text-neon">{str.slice(5)}</span>
      </>
    );
  }
  return str;
};

export default function NumberCard({ item, onToggleCart, inCart, compact = false }) {
  const basePrice = parseFloat(item.base_price) || 0;
  const offerPrice = parseFloat(item.offer_price) || 0;
  const hasOffer = offerPrice > 0 && offerPrice < basePrice;
  const activePrice = hasOffer ? offerPrice : basePrice;
  const catMeta = getCategoryMeta(item);
  const pattern = item.pattern_name || item.pattern_type || '-';

  if (compact) {
    // Compact card for horizontal scroll rows
    return (
      <div style={compactStyles.card}>
        <div style={{ ...compactStyles.catBadge, background: catMeta.bg, color: catMeta.color, borderColor: catMeta.border }}>
          {catMeta.label}
        </div>
        <div style={compactStyles.number}>
          {formatMobileNumber(item.mobile_number)}
        </div>
        <div style={compactStyles.patternLabel}>{pattern}</div>
        <div style={compactStyles.footer}>
          <div>
            {hasOffer && <span style={compactStyles.oldPrice}>{formatPrice(basePrice)}</span>}
            <div style={compactStyles.price}>{formatPrice(activePrice)}</div>
          </div>
          <button
            style={{ ...compactStyles.cartBtn, ...(inCart ? compactStyles.cartBtnActive : {}) }}
            onClick={() => onToggleCart(item)}
            title={inCart ? 'Remove from Cart' : 'Add to Cart'}
          >
            {inCart ? <Check size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>
    );
  }

  // Full card (grid view)
  return (
    <div className="number-card" style={styles.card}>
      <div style={styles.cardGlow} />
      {hasOffer && (
        <div style={styles.discountBadge}>
          {Math.round(((basePrice - offerPrice) / basePrice) * 100)}% OFF
        </div>
      )}
      <div style={styles.header}>
        <span style={{ ...styles.category, background: catMeta.bg, color: catMeta.color, border: `1px solid ${catMeta.border}` }}>
          {catMeta.label}
        </span>
      </div>
      <div style={styles.number}>
        {formatMobileNumber(item.mobile_number)}
      </div>
      <div style={styles.details}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Total</div>
          <div style={styles.statValue}>{item.digit_sum || '-'}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Pattern</div>
          <div style={{ ...styles.statValue, color: 'var(--text-main)', opacity: 0.8, fontSize: '0.85rem' }}>{pattern}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Score</div>
          <div style={styles.statValue}>{item.vip_score || '-'}</div>
        </div>
      </div>
      <div style={styles.footer}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {hasOffer && <span style={styles.originalPrice}>{formatPrice(basePrice)}</span>}
          <div style={styles.price}>{formatPrice(activePrice)}</div>
        </div>
        <button
          style={{ ...styles.addBtn, ...(inCart ? styles.addBtnActive : {}) }}
          onClick={() => onToggleCart(item)}
          title={inCart ? 'Remove from Cart' : 'Add to Cart'}
        >
          {inCart ? <Check size={20} /> : <Plus size={20} />}
        </button>
      </div>
    </div>
  );
}

// Compact card styles — for horizontal scroll rows
const compactStyles = {
  card: {
    minWidth: '220px',
    maxWidth: '220px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '14px',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    flexShrink: 0,
    boxShadow: 'var(--shadow-sm)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    cursor: 'default',
  },
  catBadge: {
    fontSize: '0.65rem',
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: '12px',
    border: '1px solid',
    alignSelf: 'flex-start',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  number: {
    fontSize: '1.4rem',
    fontWeight: 800,
    letterSpacing: '1.5px',
    textAlign: 'center',
    color: 'var(--text-main)',
    padding: '4px 0',
  },
  patternLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '8px',
    marginTop: '4px',
  },
  oldPrice: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
  },
  price: {
    fontSize: '1.1rem',
    fontWeight: 800,
    color: 'var(--text-main)',
  },
  cartBtn: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '2px solid var(--neon-green)',
    background: 'transparent',
    color: 'var(--neon-green-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  cartBtnActive: {
    background: 'var(--neon-green)',
    color: '#fff',
    border: 'none',
  },
};

// Full card styles
const styles = {
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: '24px',
    transition: 'var(--transition)',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    boxShadow: 'var(--shadow-sm)',
  },
  cardGlow: {
    position: 'absolute',
    top: 0, left: 0, width: '100%', height: '3px',
    background: 'linear-gradient(90deg, transparent, var(--neon-green), transparent)',
    opacity: 0,
    transition: 'var(--transition)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  category: {
    fontSize: '0.75rem',
    padding: '4px 12px',
    borderRadius: '20px',
    fontWeight: 700,
  },
  number: {
    fontSize: '2.2rem',
    fontWeight: 800,
    letterSpacing: '2px',
    marginBottom: '12px',
    textAlign: 'center',
    color: 'var(--text-main)',
  },
  details: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px',
    borderTop: '1px solid var(--border-color)',
    paddingTop: '16px',
  },
  stat: { textAlign: 'center' },
  statLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 700,
  },
  statValue: {
    fontSize: '1.15rem',
    fontWeight: 700,
    color: 'var(--neon-green-dark)',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: '1.5rem',
    fontWeight: 800,
    color: 'var(--text-main)',
  },
  addBtn: {
    background: 'transparent',
    border: '2px solid var(--neon-green)',
    color: 'var(--neon-green-dark)',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'var(--transition)',
    fontWeight: 800,
  },
  addBtnActive: {
    background: 'var(--neon-green)',
    color: '#fff',
    border: 'none',
  },
  discountBadge: {
    position: 'absolute',
    top: '16px',
    right: '-30px',
    background: '#ef4444',
    color: '#fff',
    padding: '4px 30px',
    transform: 'rotate(45deg)',
    fontSize: '0.75rem',
    fontWeight: 800,
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
    zIndex: 2,
    letterSpacing: '1px',
  },
  originalPrice: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
    marginBottom: '-4px',
    fontWeight: 600,
  },
};
