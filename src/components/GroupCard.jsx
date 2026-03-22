import { useState } from 'react';
import { ShoppingCart, Zap, Users, Briefcase, Info } from 'lucide-react';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

export default function GroupCard({ item, onToggleCart, isItemInCart }) {
  const basePrice = parseFloat(item.group_price) || 0;
  const offerPrice = parseFloat(item.group_offer_price) || 0;
  const hasOffer = offerPrice > 0 && offerPrice < basePrice;
  const activePrice = hasOffer ? offerPrice : basePrice;
  const disc = hasOffer ? Math.round((1 - offerPrice / basePrice) * 100) : 0;

  const bundleMembers = item.numbers || [];
  const inCartAll = bundleMembers.every(n => isItemInCart(n.number_id));

  const fmtMobile = (num) => {
    const s = String(num);
    return s.length === 10 ? (
      <span style={{ fontFamily: "var(--font-number)", letterSpacing: '0.05em' }}>
        <span style={{ opacity: 0.5 }}>{s.slice(0, 5)}</span>{s.slice(5)}
      </span>
    ) : <span>{s}</span>;
  };

  const handleBuyBundle = () => {
    bundleMembers.forEach(n => {
      if (!isItemInCart(n.number_id)) {
        onToggleCart({ number_id: n.number_id, mobile_number: n.mobile_number, base_price: n.base_price });
      }
    });
  };

  const isBusiness = item.group_type === 'business';

  return (
    <div 
      className="num-card cat-business"
      style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        borderTop: `3px solid var(--business)`,
        position: 'relative',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        gridColumn: 'span 2',
        minWidth: '400px'
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ 
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          fontSize: '11px', fontFamily: "var(--font-display)", fontWeight: 700, 
          letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--business)'
        }}>
          {isBusiness ? <Briefcase size={14} /> : <Users size={14} />}
          {item.group_type || 'Business'} Bundle · {item.group_name}
        </div>
        {hasOffer && (
          <div style={{
            background: 'rgba(212,175,55,0.1)', border: '1px solid var(--business)',
            borderRadius: '6px', padding: '3px 10px', fontSize: '11px', 
            fontFamily: "var(--font-body)", fontWeight: 700, color: 'var(--business)'
          }}>
            {disc}% COMBO SAVINGS
          </div>
        )}
      </div>

      {/* Group Description */}
      <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'rgba(255,255,255,0.02)', padding: '10px 15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Info size={14} style={{ color: 'var(--business)', opacity: 0.7 }} />
          <span>Complete set of {bundleMembers.length} matching numbers for your team or family.</span>
      </div>

      {/* Members List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {bundleMembers.map((n, idx) => {
          const inCart = isItemInCart(n.number_id);
          return (
            <div key={n.number_id} style={{ 
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.03)', padding: '12px 18px', 
              borderRadius: '10px', border: '1px solid var(--border)' 
            }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, fontFamily: "var(--font-number)" }}>
                  {fmtMobile(n.mobile_number)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                    {n.pattern_type || 'Premium'} Number
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{formatPrice(n.base_price)}</span>
                <button 
                  onClick={() => onToggleCart({ number_id: n.number_id, mobile_number: n.mobile_number, base_price: n.base_price })}
                  style={{ 
                    background: inCart ? 'var(--success)' : 'var(--bg3)', 
                    border: 'none', borderRadius: '6px', padding: '6px 12px', 
                    color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600
                  }}
                >
                  {inCart ? '✓' : <Plus size={14} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer / Bundle Action */}
      <div style={{ 
        marginTop: 'auto', paddingTop: '24px', borderTop: '1px dashed var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>Complete Bundle</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--business)' }}>{formatPrice(activePrice)}</span>
                {hasOffer && (
                    <span style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>{formatPrice(basePrice)}</span>
                )}
            </div>
        </div>

        <button 
          onClick={handleBuyBundle}
          disabled={inCartAll}
          style={{
            background: inCartAll ? 'var(--success)' : 'linear-gradient(135deg, var(--business), #e6c200)',
            color: '#000',
            border: 'none', borderRadius: '12px', padding: '14px 28px',
            fontFamily: "var(--font-body)", fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
            transition: 'transform 0.2s',
            opacity: inCartAll ? 0.9 : 1
          }}
        >
          {inCartAll ? (
            <span style={{ color: '#fff' }}>✓ Bundle Added</span>
          ) : (
            <>
              <Zap size={18} fill="currentColor" />
              Buy Full Set
            </>
          )}
        </button>
      </div>
    </div>
  );
}
