import { useState } from 'react';
import { ShoppingCart, Zap, Users, Briefcase, Info } from 'lucide-react';

const formatPrice = (price) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

export default function GroupCard({ item, selectedIds, onToggleCheck, calculatedPrice, isItemInCart, onToggleCart }) {
  const basePrice = parseFloat(item.group_price) || 0;
  const offerPrice = parseFloat(item.group_offer_price) || 0;
  const hasOffer = offerPrice > 0 && offerPrice < basePrice;

  const bundleMembers = item.numbers || [];
  const inCartAll = bundleMembers.length > 0 && bundleMembers.every(n => isItemInCart(n.number_id));

  const allSelected = bundleMembers.length > 0 && selectedIds.length === bundleMembers.length;

  const fmtMobile = (num) => {
    const s = String(num);
    return s.length === 10 ? (
      <span style={{ fontFamily: "var(--font-number)", letterSpacing: '0.05em' }}>
        <span style={{ opacity: 0.5 }}>{s.slice(0, 5)}</span>{s.slice(5)}
      </span>
    ) : <span>{s}</span>;
  };

  const handleBuySelected = () => {
    const toAdd = selectedIds.length > 0
      ? bundleMembers.filter(n => selectedIds.includes(n.number_id))
      : bundleMembers; // If none selected, buy all? The specs say calculated price, if 0 selected price is group_price, implies buying all.

    toAdd.forEach(n => {
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
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        gap: '14px',
        gridColumn: 'span 2',
        minWidth: '300px'
      }}
    >
      {allSelected && hasOffer && (
        <div style={{
          position: 'absolute', top: '-14px', left: '16px',
          background: 'linear-gradient(135deg, var(--danger), #ff4d4d)', color: '#fff', 
          padding: '4px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px',
          fontSize: '11px', fontFamily: "var(--font-body)", fontWeight: 700,
          boxShadow: '0 4px 12px rgba(255,50,50,0.3)', zIndex: 10, whiteSpace: 'nowrap'
        }}>
          ★ BUNDLE DEAL
        </div>
      )}
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
      </div>

      {/* Group Description */}
      <div style={{ fontSize: '12px', color: 'var(--muted)', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Info size={14} style={{ color: 'var(--business)', opacity: 0.7 }} />
        <span>Complete set of {bundleMembers.length} matching numbers for your team or family.</span>
      </div>

      {/* Members List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {bundleMembers.map((n, idx) => {
          const isSelected = selectedIds.includes(n.number_id);
          return (
            <div key={n.number_id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.03)', padding: '8px 12px',
              borderRadius: '10px', border: isSelected ? '1px solid var(--business)' : '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: "var(--font-number)" }}>
                  {fmtMobile(n.mobile_number)}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--muted)', marginTop: '2px' }}>
                  {n.pattern_name || 'Premium'} Number
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '13px', fontWeight: 500 }}>{formatPrice(n.base_price)}</span>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleCheck(n.number_id)}
                  style={{ transform: 'scale(1.2)', cursor: 'pointer', accentColor: 'var(--business)' }}
                />
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
          <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', marginBottom: '4px' }}>
            {selectedIds.length === 0 ? 'Starting Price' : allSelected ? 'Bundle Price' : 'Selection Total'}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--business)' }}>{formatPrice(calculatedPrice)}</span>
            {allSelected && hasOffer && (
              <span style={{ fontSize: '14px', color: 'var(--muted)', textDecoration: 'line-through' }}>{formatPrice(basePrice)}</span>
            )}
          </div>
        </div>

        <button
          onClick={handleBuySelected}
          style={{
            background: 'linear-gradient(135deg, var(--business), #e6c200)',
            color: '#000',
            border: 'none', borderRadius: '12px', padding: '14px 28px',
            fontFamily: "var(--font-body)", fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '10px',
            boxShadow: '0 4px 20px rgba(212,175,55,0.3)',
            transition: 'transform 0.2s',
          }}
        >
          <ShoppingCart size={18} fill="currentColor" />
          Add to Cart
        </button>
      </div>
    </div>
  );
}
