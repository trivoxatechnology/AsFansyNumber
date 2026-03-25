import { X, Trash2, ShoppingBag, ArrowRight, ShieldCheck } from 'lucide-react';

const formatPrice = (price) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(price);
};

const getItemPrice = (item) => {
  const offerPrice = parseFloat(item.offer_price) || 0;
  const basePrice = parseFloat(item.base_price) || 0;
  return offerPrice > 0 ? offerPrice : basePrice;
};

export default function CartModal({ isOpen, onClose, cartItems, onToggleCart }) {
  const total = cartItems.reduce((acc, item) => acc + getItemPrice(item), 0);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.sidebar} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={styles.iconBox}><ShoppingBag size={18} /></div>
            <h2 style={styles.title}>Review Selection</h2>
          </div>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <div style={styles.content}>
          <div style={styles.itemCount}>
            {cartItems.length} {cartItems.length === 1 ? 'Premium Number' : 'Premium Numbers'} in your selection
          </div>
          
          <div style={styles.itemList}>
            {cartItems.length === 0 ? (
              <div style={styles.emptyState}>
                <ShoppingBag size={48} style={{ opacity: 0.1, marginBottom: '16px' }} />
                <p>Your selection is currently empty.</p>
                <button style={styles.browseBtn} onClick={onClose}>Browse Collection</button>
              </div>
            ) : (
              cartItems.map((item) => (
                <div key={item.number_id || item.id} style={styles.cartItem}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.itemNumber}>{item.mobile_number}</div>
                     <div style={styles.cartItemDesc}>
                       {item.pattern_name || 'VIP Pattern'}
                     </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={styles.itemPrice}>{formatPrice(getItemPrice(item))}</div>
                    <button 
                      style={styles.removeBtn} 
                      onClick={() => onToggleCart(item)}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        {cartItems.length > 0 && (
          <div style={styles.footer}>
            <div style={styles.totalRow}>
              <span style={{ color: 'var(--muted)', fontSize: '13px' }}>Subtotal Value</span>
              <span style={styles.totalAmount}>{formatPrice(total)}</span>
            </div>
            
            <div style={styles.guarantee}>
              <ShieldCheck size={14} style={{ color: 'var(--success)' }} />
              <span>Secure Transaction · Instant Ownership Transfer</span>
            </div>

            <button style={styles.checkoutBtn} onClick={() => alert("Proceeding to secure checkout...")}>
              Proceed to Checkout <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)',
    zIndex: 2000,
    display: 'flex',
    justifyContent: 'flex-end',
  },
  sidebar: {
    background: 'rgba(13, 13, 18, 0.98)',
    width: '100%',
    maxWidth: '440px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '-20px 0 50px rgba(0,0,0,0.5)',
    borderLeft: '1px solid var(--border)',
    animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  header: {
    padding: '32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid var(--border)',
  },
  iconBox: {
    width: '36px', height: '36px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '10px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: 'var(--primary)',
  },
  title: {
    margin: 0,
    fontFamily: "var(--font-heading)",
    fontSize: '26px',
    fontWeight: 600,
    color: '#fff',
  },
  closeBtn: {
    background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
    padding: '8px', borderRadius: '50%', transition: 'all 0.2s',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px',
  },
  itemCount: {
    fontFamily: "var(--font-ui)",
    fontSize: '11px',
    fontWeight: 300,
    color: 'var(--muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    marginBottom: '24px',
  },
  itemList: {
    display: 'flex', flexDirection: 'column', gap: '16px',
  },
  cartItem: {
    display: 'flex', gap: '16px',
    padding: '20px',
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
  },
  itemNumber: {
    fontSize: '16px', fontWeight: 400, color: '#fff',
    fontFamily: "var(--font-number)",
    letterSpacing: '0.08em',
    marginBottom: '4px',
  },
  itemMeta: {
    fontSize: '11px', color: 'var(--muted)', fontWeight: 500,
  },
  itemPrice: {
    fontSize: '22px', fontWeight: 700, color: '#fff',
    fontFamily: "var(--font-heading)",
    marginBottom: '8px',
  },
  removeBtn: {
    border: 'none', color: 'var(--danger)',
    fontFamily: "var(--font-body)",
    fontSize: '11px', fontWeight: 500, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: '5px',
    padding: '4px 8px', borderRadius: '6px',
    background: 'rgba(255,68,68,0.05)'
  },
  emptyState: {
    padding: '80px 0', textAlign: 'center', color: 'var(--muted)',
  },
  browseBtn: {
    background: '#fff', color: '#000', border: 'none',
    padding: '12px 24px', borderRadius: '10px', fontSize: '12px',
    fontFamily: "var(--font-body)", fontWeight: 700, 
    letterSpacing: '0.02em', cursor: 'pointer', marginTop: '24px',
  },
  footer: {
    padding: '32px',
    background: 'var(--bg2)',
    borderTop: '1px solid var(--border)',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: '20px',
  },
  totalAmount: {
    fontSize: '26px', fontWeight: 700, color: '#fff',
    fontFamily: "var(--font-heading)",
  },
  guarantee: {
    display: 'flex', alignItems: 'center', gap: '8px',
    fontSize: '11px', color: 'var(--muted)', marginBottom: '24px',
    justifyContent: 'center',
  },
  checkoutBtn: {
    width: '100%',
    background: '#fff', color: '#000', border: 'none',
    padding: '16px', borderRadius: '12px',
    fontFamily: "var(--font-body)",
    fontSize: '15px', fontWeight: 700, letterSpacing: '0.02em', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
    transition: 'transform 0.2s',
  }
};
