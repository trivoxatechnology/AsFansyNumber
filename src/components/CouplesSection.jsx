import { useState, useEffect } from 'react';
import CoupleCard from './CoupleCard';

const API = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api\.php$/, '') : 'https://asfancynumber.com';

const fetchCouples = async () => {
  try {
    const res = await fetch(`${API}/api.php/couples`);
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
    throw new Error("couples endpoint failed");
  } catch {
    try {
      const res = await fetch(
        `${API}/api.php/wp_fn_couple_numbers?visibility_status=1&couple_status=available&limit=100`
      );
      const couplesData = await res.json();
      const couples = couplesData.data || couplesData; // Handle generic get response format
      if (!Array.isArray(couples) || couples.length === 0) return [];
      
      return await Promise.all(
        couples.map(async (c) => {
          // Use our new couple_id filter! Both numbers fetched in one call.
          let n1 = null, n2 = null;
          try {
             const mRes = await fetch(`${API}/api.php/numbers?couple_id=${c.couple_id}`);
             const mData = await mRes.json();
             const pair = mData.data || [];
             n1 = pair[0] || null;
             n2 = pair[1] || null;
          } catch(e) {}
          
          return {
            couple_id:          c.couple_id,
            couple_label:       c.couple_label || `Couple ${c.couple_id}`,
            couple_price:       parseFloat(c.couple_price || 0),
            couple_offer_price: c.couple_offer_price
                                ? parseFloat(c.couple_offer_price) : null,
            couple_status:      c.couple_status,
            number_1:           n1?.mobile_number || '',
            price_1:            parseFloat(n1?.base_price || 0),
            offer_price_1:      n1?.offer_price
                                ? parseFloat(n1.offer_price) : null,
            category_1:         n1?.pattern_name || '',
            number_id_1:        c.number_id_1,
            number_2:           n2?.mobile_number || '',
            price_2:            parseFloat(n2?.base_price || 0),
            offer_price_2:      n2?.offer_price
                                ? parseFloat(n2.offer_price) : null,
            category_2:         n2?.pattern_name || '',
            number_id_2:        c.number_id_2,
          };
        })
      );
    } catch { return []; }
  }
};

export default function CouplesSection({ isItemInCart, onToggleCart }) {
  const [couples, setCouples] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCouples().then(data => {
      // Data might already be joined by the endpoint, mapping it to item structure expected by CoupleCard
      const mapped = data.map(c => ({
        ...c,
        is_bundle: true,
        bundle_type: 'couple',
        couple_price: c.couple_price,
        couple_offer_price: c.couple_offer_price,
      }));
      setCouples(mapped);
      setLoading(false);
    }).catch(err => {
      setError(err.message);
      setLoading(false);
    });
  }, []);

  return (
    <div className="section-row" style={{ marginTop: '40px' }}>
      <div className="section-header">
        <div className="section-icon" style={{ background: `var(--couple)`, color: '#000' }}>👫</div>
        <div>
          <div className="section-title" style={{ fontFamily: "var(--font-display)", fontSize: '28px', fontWeight: 600, letterSpacing: '0.06em' }}>Couple Packs</div>
          <div className="section-sub" style={{ fontFamily: "var(--font-body)", fontSize: '13px', fontWeight: 300 }}>Matching Pairs · Consecutive Sequence Pairs</div>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '20px' }}>
           <div style={{ height: '220px', background: 'var(--bg2)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
           <div style={{ height: '220px', background: 'var(--bg2)', borderRadius: '16px', animation: 'pulse 1.5s infinite' }} />
        </div>
      ) : error ? (
        <div style={{ color: 'var(--danger)', padding: '20px' }}>Error loading couples: {error}</div>
      ) : couples.length === 0 ? (
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center', background: 'var(--bg2)', borderRadius: '16px', border: '1px dashed var(--border)', color: 'var(--muted)', fontFamily: "var(--font-body)" }}>
          No couple packs available at the moment.<br/>
          Check back soon or contact us.
        </div>
      ) : (
        <div className="cards-grid">
          {couples.map(item => (
            <CoupleCard
              key={item.couple_id || item.id}
              item={item}
              isItemInCart={isItemInCart}
              onToggleCart={onToggleCart}
            />
          ))}
        </div>
      )}
    </div>
  );
}
