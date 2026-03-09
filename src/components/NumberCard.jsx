import { Check, Plus } from 'lucide-react';

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(price);
};

const formatMobileNumber = (num) => {
  if (!num) return "N/A";
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

export default function NumberCard({ item, onToggleCart, inCart }) {
  const basePrice = parseFloat(item.base_price) || 0;
  const offerPrice = parseFloat(item.offer_price) || 0;
  const discountPct = parseInt(item.discount_percentage) || 0;
  
  const hasOffer = offerPrice > 0 && discountPct > 0;
  const activePrice = hasOffer ? offerPrice : basePrice;

  const categoryName = item.category_name || "Premium";
  const sum = item.digit_sum || sumDigits(item.mobile_number);
  const pattern = item.pattern_type || "-";

  return (
    <div className="number-card" style={styles.card}>
      <div style={styles.cardGlow}></div>
      
      {/* Discount Badge */}
      {hasOffer && (
        <div style={styles.discountBadge}>
          {discountPct}% OFF
        </div>
      )}

      <div style={styles.header}>
        <span style={styles.category}>{categoryName}</span>
      </div>
      
      <div style={styles.number}>
        {formatMobileNumber(item.mobile_number)}
      </div>
      
      <div style={styles.details}>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Total</div>
          <div style={styles.statValue}>{sum}</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statLabel}>Pattern</div>
          <div style={{...styles.statValue, color: 'var(--text-main)', opacity: 0.8}}>{pattern}</div>
        </div>
      </div>
      
      <div style={styles.footer}>
        <div style={{display: 'flex', flexDirection: 'column'}}>
          {hasOffer && (
            <span style={styles.originalPrice}>{formatPrice(basePrice)}</span>
          )}
          <div style={styles.price}>{formatPrice(activePrice)}</div>
        </div>
        <button 
          style={{
            ...styles.addBtn, 
            ...(inCart ? styles.addBtnActive : {})
          }} 
          onClick={() => onToggleCart(item)}
          title={inCart ? "Remove from Cart" : "Add to Cart"}
        >
          {inCart ? <Check size={20} /> : <Plus size={20} />}
        </button>
      </div>
    </div>
  );
}

function sumDigits(numStr) {
  if (!numStr) return 0;
  return numStr.toString().split('').reduce((acc, digit) => acc + parseInt(digit || 0), 0);
}

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
    fontSize: '0.8rem',
    background: '#f1f5f9',
    padding: '4px 10px',
    borderRadius: '20px',
    color: 'var(--text-muted)',
    fontWeight: 600,
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
  stat: {
    textAlign: 'center',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    fontWeight: 700,
  },
  statValue: {
    fontSize: '1.2rem',
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
    color: 'var(--text-main)'
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
    fontWeight: 800
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
    letterSpacing: '1px'
  },
  originalPrice: {
    fontSize: '0.85rem',
    color: 'var(--text-muted)',
    textDecoration: 'line-through',
    marginBottom: '-4px',
    fontWeight: 600,
  }
};
