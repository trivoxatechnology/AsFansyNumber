import { X, Trash2 } from 'lucide-react';

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
  if (!isOpen) return null;

  const total = cartItems.reduce((acc, item) => acc + getItemPrice(item), 0);

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert("Your cart is empty!");
      return;
    }
    alert(`Proceeding to checkout with ${cartItems.length} VIP number(s).`);
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={{margin: 0}}>Your Cart</h2>
          <button style={styles.closeBtn} onClick={onClose}>
            <X size={24} />
          </button>
        </div>
        
        <div style={styles.cartItems}>
          {cartItems.length === 0 ? (
            <p style={{textAlign: 'center', color: '#a0a0a0', padding: '20px'}}>
              Your cart is empty.
            </p>
          ) : (
            cartItems.map((item) => (
              <div key={item.number_id || item.id} style={styles.cartItem}>
                <div>
                  <h4 style={styles.itemNumber}>{item.mobile_number}</h4>
                  <div style={styles.itemPrice}>{formatPrice(getItemPrice(item))}</div>
                </div>
                <button 
                  style={styles.removeBtn} 
                  onClick={() => onToggleCart(item)}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ))
          )}
        </div>
        
        <div style={styles.footer}>
          <div style={styles.totalRow}>
            <span>Total:</span>
            <strong style={styles.totalAmount}>{formatPrice(total)}</strong>
          </div>
          <button className="primary-btn" style={{width: '100%'}} onClick={handleCheckout}>
            Proceed to Checkout
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, width: '100%', height: '100%',
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(5px)',
    zIndex: 2000,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    background: '#ffffff',
    width: '100%',
    maxWidth: '500px',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border-color)',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    animation: 'slideUp 0.3s ease-out'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f8fafc',
  },
  closeBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-main)',
    cursor: 'pointer',
    display: 'flex',
    transition: 'color 0.2s'
  },
  cartItems: {
    padding: '24px',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  cartItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px',
    background: '#f8fafc',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    marginBottom: '12px',
  },
  itemNumber: {
    fontSize: '1.2rem',
    letterSpacing: '1px',
    color: 'var(--neon-green-dark)',
    marginBottom: '4px',
    fontWeight: 700,
  },
  itemPrice: {
    fontWeight: 600,
    color: 'var(--text-main)'
  },
  removeBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '8px',
    transition: 'opacity 0.2s'
  },
  footer: {
    padding: '20px 24px',
    borderTop: '1px solid var(--border-color)',
    background: '#f8fafc',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1.2rem',
    marginBottom: '20px',
    color: 'var(--text-main)',
    fontWeight: 600,
  },
  totalAmount: {
    color: 'var(--neon-green-dark)',
    fontSize: '1.5rem',
    fontWeight: 800,
  }
};
