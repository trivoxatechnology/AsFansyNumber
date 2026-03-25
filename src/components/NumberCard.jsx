import { useEffect, useState } from 'react';
import { ShoppingCart, Zap, Clock, Star } from 'lucide-react';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

const CATEGORY_META = {
  1: { label: 'Diamond',  emoji: '💎', cls: 'diamond', color: 'var(--primary)' },
  2: { label: 'Platinum', emoji: '💍', cls: 'platinum', color: 'var(--platinum)' },
  3: { label: 'Gold',     emoji: '⭐', cls: 'gold', color: 'var(--gold)' },
  4: { label: 'Silver',   emoji: '🥈', cls: 'silver', color: 'var(--silver)' },
  5: { label: 'Bronze',   emoji: '🥉', cls: 'bronze', color: 'var(--bronze)' },
  7: { label: 'Couple',   emoji: '👫', cls: 'couple', color: 'var(--couple)' },
  8: { label: 'Business', emoji: '💼', cls: 'business', color: 'var(--business)' },
  6: { label: 'Normal',   emoji: '📱', cls: 'normal', color: 'var(--normal)' },
};

function timeLeft(endDateStr) {
  if (!endDateStr) return null;
  const end = new Date(endDateStr);
  const now = new Date();
  const diff = end - now;
  if (diff <= 0) return 'Expired';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function NumberCard({ item, onToggleCart, inCart, compact = false }) {
  const [timeRemaining, setTimeRemaining] = useState(() => timeLeft(item.offer_end_date));

  useEffect(() => {
    if (!item.offer_end_date) return;
    const timer = setInterval(() => {
      setTimeRemaining(timeLeft(item.offer_end_date));
    }, 60000);
    return () => clearInterval(timer);
  }, [item.offer_end_date]);

  const basePrice = parseFloat(item.base_price) || 0;
  const offerPrice = parseFloat(item.offer_price) || 0;
  const hasOffer = offerPrice > 0 && offerPrice < basePrice;
  const activePrice = hasOffer ? offerPrice : basePrice;
  const cat = String(item.number_category || item.category || '6');
  const meta = CATEGORY_META[cat] || CATEGORY_META[6];
  
  let stars = 0;
  if (cat === '1') stars = 5;
  else if (cat === '2') stars = 4;
  else if (cat === '3') stars = 3;
  else if (cat === '4') stars = 2;
  else if (cat === '5') stars = 1;

  const fmtMobile = (num) => {
    const s = String(num);
    return s.length === 10 ? (
      <span style={{ fontFamily: "var(--font-number)", letterSpacing: '0.10em' }}>
        <span style={{ opacity: 0.5 }}>{s.slice(0, 5)}</span>{s.slice(5)}
      </span>
    ) : <span style={{ fontFamily: "var(--font-number)", letterSpacing: '0.10em' }}>{s}</span>;
  };

  const disc = hasOffer ? Math.round((1 - offerPrice / basePrice) * 100) : 0;

  return (
    <div 
      className={`num-card cat-${meta.cls}`}
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        borderTop: `2px solid ${meta.color}`,
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.2, 0, 0, 1)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        width: '100%'
      }}
    >
      {hasOffer && (
        <div style={{
          position: 'absolute', top: '-14px', left: '16px',
          background: 'linear-gradient(135deg, var(--danger), #ff4d4d)', color: '#fff', 
          padding: '4px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontFamily: "var(--font-body)", fontWeight: 700,
          boxShadow: '0 4px 12px rgba(255,50,50,0.3)', zIndex: 10, whiteSpace: 'nowrap'
        }}>
          ★ {disc}% OFF
        </div>
      )}
      {hasOffer && item.offer_end_date && timeRemaining !== 'Expired' && (
        <div style={{
          position: 'absolute', top: '-14px', right: '16px',
          background: 'linear-gradient(135deg, var(--danger), #ff4d4d)', color: '#fff', 
          padding: '4px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px', 
          fontSize: '11px', fontFamily: "var(--font-body)", fontWeight: 700,
          boxShadow: '0 4px 12px rgba(255,50,50,0.3)', zIndex: 10, whiteSpace: 'nowrap'
        }}>
          <Clock size={12} />
          Ends in: <span style={{ fontFamily: "var(--font-number)" }}>{timeRemaining}</span>
        </div>
      )}

      <div style={{ 
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        fontSize: '9px', fontFamily: "var(--font-display)", fontWeight: 700, 
        letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: '10px', 
        color: meta.color
      }}>
        {meta.emoji} {meta.label} · {item.pattern_name || ''}
      </div>

      <div style={{ 
        fontSize: compact ? '18px' : '22px', fontWeight: 500, letterSpacing: '0.08em', 
        fontFamily: "var(--font-number)", marginBottom: '4px', color: '#fff' 
      }}>
        {fmtMobile(item.mobile_number)}
      </div>

      <div style={{ 
        fontSize: '11px', fontFamily: "var(--font-number)", fontWeight: 300,
        letterSpacing: '0.04em', color: 'var(--muted)', marginBottom: '12px' 
      }}>
        {item.pattern_name || ''}
      </div>

      <div style={{ display: 'flex', gap: '2px', marginBottom: '10px' }}>
        {[1, 2, 3, 4, 5].map(i => {
          if (stars === 0) return null; // 0 stars = Normal numbers don't show empty stars
          return (
            <Star 
              key={i} size={11} 
              fill={i <= stars ? meta.color : 'none'} 
              stroke={meta.color} 
              style={{ opacity: i <= stars ? 0.9 : 0.2 }} 
            />
          );
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ 
          fontFamily: "var(--font-heading)", fontSize: '22px', 
          fontWeight: 700, color: meta.color, letterSpacing: '-0.01em' 
        }}>
          {formatPrice(activePrice)}
        </div>
        {hasOffer && (
          <>
            <div style={{ fontSize: '12px', color: 'var(--muted)', textDecoration: 'line-through', fontFamily: "var(--font-number)", fontWeight: 300 }}>
              {formatPrice(basePrice)}
            </div>
            <div style={{ fontSize: '10px', fontFamily: "var(--font-body)", fontWeight: 600, color: 'var(--success)', background: 'rgba(0,230,118,0.08)', borderRadius: '6px', padding: '2px 7px' }}>
              Save {formatPrice(basePrice - offerPrice)}
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
        <button 
          onClick={() => onToggleCart(item)}
          style={{
            flex: 1, background: inCart ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
            border: '1px solid var(--border)', borderRadius: '9px', padding: '9px 0',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
            fontFamily: "var(--font-body)", fontWeight: 600,
            color: inCart ? 'var(--success)' : 'var(--text)'
          }}
        >
          <ShoppingCart size={13} />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onToggleCart(item); }}
          style={{
            flex: 3, border: 'none', borderRadius: '9px', padding: '9px 0',
            fontFamily: "var(--font-body)", fontWeight: 700, cursor: 'pointer', 
            background: `linear-gradient(135deg, ${meta.color}, #fff)`,
            color: '#000', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.02em'
          }}
        >
          Buy Now
        </button>
      </div>
    </div>
  );
}
