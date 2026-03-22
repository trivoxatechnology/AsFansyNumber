import { useState, useEffect } from 'react';
import { X, Zap, Clock, ArrowRight } from 'lucide-react';
import { getFeatured } from '../api/client';

export default function AdPopup() {
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    getFeatured().then(res => {
      if (res.success && res.data && res.data.length > 0) {
        // Pick a random number from the featured list
        const randomItem = res.data[Math.floor(Math.random() * res.data.length)];
        setFeatured(randomItem);
        
        // Show after 4 seconds
        const timer = setTimeout(() => setIsVisible(true), 4000);
        return () => clearTimeout(timer);
      }
    }).catch(err => console.error('AdPopup data load failed:', err));
  }, []);

  const close = () => {
    setIsClosing(true);
    setTimeout(() => setIsVisible(false), 400);
  };

  if (!isVisible || !featured) return null;

  // Calculate remaining time for the offer
  const remainingTimeStr = featured.offer_end_date 
    ? "Ends: Soon" // Simple placeholder or calculate diff
    : "Flash Sale";

  return (
    <div 
      className="ad-popup-wrapper"
      style={{
        ...styles.wrapper,
        transform: isClosing ? 'translateX(120%)' : 'translateX(0)',
        opacity: isClosing ? 0 : 1
      }}
    >
      <button style={styles.closeBtn} onClick={close}><X size={16} /></button>
      
      <div style={styles.header}>
        <div style={styles.badge}><Zap size={12} fill="currentColor" /> EXCLUSIVE</div>
        <div style={styles.timer}><Clock size={12} /> {remainingTimeStr}</div>
      </div>

      <h3 style={styles.title}>Diamond Flash Sale</h3>
      <p style={styles.desc}>Unlock premium numbers at up to 40% off. Limited quantities available for immediate transfer.</p>

      <div style={styles.offerBox}>
        <div style={styles.number}>
          {featured.mobile_number.slice(0, 5)} <span style={{ color: 'var(--primary)' }}>{featured.mobile_number.slice(5)}</span>
        </div>
        <div style={styles.price}>
           <span style={styles.oldPrice}>₹{parseInt(featured.base_price).toLocaleString('en-IN')}</span>
           <span style={styles.newPrice}>₹{parseInt(featured.offer_price).toLocaleString('en-IN')}</span>
        </div>
      </div>

      <button style={styles.cta} onClick={close}>
        View Flash Offers <ArrowRight size={16} />
      </button>
    </div>
  );
}

const styles = {
  wrapper: {
    position: 'fixed',
    bottom: '40px',
    right: '40px',
    width: '340px',
    background: 'rgba(13, 13, 18, 0.95)',
    backdropFilter: 'blur(20px)',
    border: '1px solid var(--border)',
    borderRadius: '24px',
    padding: '24px',
    zIndex: 1000,
    boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
    transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
    display: 'flex', flexDirection: 'column',
    // Responsiveness handled in index.css (.ad-popup-wrapper)
  },
  closeBtn: {
    position: 'absolute', top: '16px', right: '16px',
    background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer',
    padding: '4px',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px',
  },
  badge: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontFamily: "var(--font-display)", fontSize: '10px', 
    fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
    color: 'var(--primary)',
    background: 'rgba(255,215,0,0.1)', padding: '4px 10px', borderRadius: '100px',
  },
  timer: {
    display: 'flex', alignItems: 'center', gap: '6px',
    fontFamily: "var(--font-body)", fontSize: '11px', 
    color: 'var(--danger)', fontWeight: 500,
  },
  title: {
    fontSize: '26px', fontWeight: 600, color: '#fff', marginBottom: '12px',
    fontFamily: "var(--font-heading)"
  },
  desc: {
    fontFamily: "var(--font-body)",
    fontSize: '13px', fontWeight: 300, color: 'var(--muted)', 
    lineHeight: 1.5, marginBottom: '20px',
  },
  offerBox: {
    background: 'rgba(255,255,255,0.03)', borderRadius: '16px', padding: '16px',
    marginBottom: '20px', border: '1px solid var(--border)',
  },
  number: {
    fontSize: '20px', fontWeight: 500, color: '#fff', letterSpacing: '0.08em',
    fontFamily: "var(--font-number)", marginBottom: '8px',
  },
  price: {
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  oldPrice: {
    fontFamily: "var(--font-number)",
    fontSize: '13px', fontWeight: 300, color: 'var(--muted)', textDecoration: 'line-through',
  },
  newPrice: {
    fontSize: '28px', fontWeight: 700, color: 'var(--success)',
    fontFamily: "var(--font-heading)",
  },
  cta: {
    background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '12px',
    padding: '14px', fontFamily: "var(--font-body)", 
    fontWeight: 700, fontSize: '14px', letterSpacing: '0.02em', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
    transition: 'transform 0.2s',
  }
};
