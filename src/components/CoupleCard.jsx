import { useEffect, useState } from 'react';
import { ShoppingCart, Zap, Clock, Star, Link as LinkIcon, Plus } from 'lucide-react';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

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

export default function CoupleCard({ item, onToggleCart, isItemInCart }) {
  const [timeRemaining, setTimeRemaining] = useState(() => timeLeft(item.updated_at)); // Use updated_at as fallback for logic

  const basePrice = parseFloat(item.couple_price) || 0;
  const offerPrice = parseFloat(item.couple_offer_price) || 0;
  const hasOffer = offerPrice > 0 && offerPrice < basePrice;
  const activePrice = hasOffer ? offerPrice : basePrice;
  const disc = hasOffer ? Math.round((1 - offerPrice / basePrice) * 100) : 0;

  const inCart1 = isItemInCart(item.number_id_1);
  const inCart2 = isItemInCart(item.number_id_2);
  const inCartBoth = inCart1 && inCart2;

  const fmtMobile = (num) => {
    const s = String(num);
    return s.length === 10 ? (
      <span style={{ fontFamily: "var(--font-number)", letterSpacing: '0.05em' }}>
        <span style={{ opacity: 0.5 }}>{s.slice(0, 5)}</span>{s.slice(5)}
      </span>
    ) : <span>{s}</span>;
  };

  const handleBuyBoth = () => {
    if (!inCart1) onToggleCart({ number_id: item.number_id_1, mobile_number: item.number_1, base_price: item.price_1 });
    if (!inCart2) onToggleCart({ number_id: item.number_id_2, mobile_number: item.number_2, base_price: item.price_2 });
  };

  return (
    <div 
      className="num-card cat-couple"
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        borderTop: `3px solid var(--couple)`,
        position: 'relative',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        gap: '20px',
        gridColumn: 'span 2', // Take double width in grid if possible
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
          ★ {disc}% SAVINGS
        </div>
      )}
      {hasOffer && item.updated_at && timeRemaining !== 'Expired' && (
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          fontSize: '10px', fontFamily: "var(--font-display)", fontWeight: 700, 
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--couple)'
        }}>
          👫 Couple Pair · {item.couple_label}
        </div>
      </div>

      {/* Numbers Side by Side */}
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        {/* Number 1 */}
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: "var(--font-number)", marginBottom: '8px' }}>
                {fmtMobile(item.number_1)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{formatPrice(item.price_1)}</span>
                <button 
                  onClick={() => onToggleCart({ number_id: item.number_id_1, mobile_number: item.number_1, base_price: item.price_1 })}
                  className={`add-btn ${inCart1 ? 'added' : ''}`}
                  style={{ 
                    background: inCart1 ? 'var(--success)' : 'var(--bg3)', 
                    border: 'none', borderRadius: '6px', padding: '4px 8px', 
                    color: '#fff', cursor: 'pointer', fontSize: '10px' 
                  }}
                >
                  {inCart1 ? 'In Cart' : 'Add to Cart'}
                </button>
            </div>
        </div>

        <LinkIcon size={20} style={{ color: 'var(--couple)', opacity: 0.5 }} />

        {/* Number 2 */}
        <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', padding: '15px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '18px', fontWeight: 600, fontFamily: "var(--font-number)", marginBottom: '8px' }}>
                {fmtMobile(item.number_2)}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{formatPrice(item.price_2)}</span>
                <button 
                  onClick={() => onToggleCart({ number_id: item.number_id_2, mobile_number: item.number_2, base_price: item.price_2 })}
                  className={`add-btn ${inCart2 ? 'added' : ''}`}
                  style={{ 
                    background: inCart2 ? 'var(--success)' : 'var(--bg3)', 
                    border: 'none', borderRadius: '6px', padding: '4px 8px', 
                    color: '#fff', cursor: 'pointer', fontSize: '10px' 
                  }}
                >
                  {inCart2 ? 'In Cart' : 'Add to Cart'}
                </button>
            </div>
        </div>
      </div>

      {/* Footer / Bundle Action */}
      <div style={{ 
        marginTop: 'auto', paddingTop: '20px', borderTop: '1px dashed var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase' }}>Bundle Price</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--couple)' }}>{formatPrice(activePrice)}</span>
                {hasOffer && (
                    <span style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>{formatPrice(basePrice)}</span>
                )}
            </div>
        </div>

        <button 
          onClick={handleBuyBoth}
          disabled={inCartBoth}
          className={`add-btn ${inCartBoth ? 'added' : ''}`}
          style={{
            background: inCartBoth ? 'var(--success)' : 'linear-gradient(135deg, var(--couple), #fff)',
            color: inCartBoth ? '#fff' : '#000',
            border: 'none', borderRadius: '10px', padding: '12px 25px',
            fontFamily: "var(--font-body)", fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            boxShadow: '0 4px 15px rgba(212,175,55,0.2)'
          }}
        >
          {inCartBoth ? (
            <>✓ Bundle in Cart</>
          ) : (
            <>
              <Zap size={16} fill="currentColor" />
              Get Both Numbers
            </>
          )}
        </button>
      </div>
    </div>
  );
}
