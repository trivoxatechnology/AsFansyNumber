import { useEffect, useState } from 'react';

const BRAND = 'ASFANCYNUMBER'.split('');
const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];

function buildReelItems(finalChar) {
  // More rotations = longer spin time visually (30 digit items before settling)
  const spins = [...DIGITS, ...DIGITS, ...DIGITS];
  return [...spins, finalChar];
}

const CSS = `
  @keyframes reelSpin {
    from { transform: translateY(0); }
    to   { transform: translateY(var(--reel-offset)); }
  }
  @keyframes brandGlow {
    0%   { text-shadow: 0 0 6px rgba(122,194,0,0.6), 0 0 20px rgba(122,194,0,0.3); color: #4a7c00; }
    50%  { text-shadow: 0 0 12px rgba(122,194,0,0.9), 0 0 40px rgba(122,194,0,0.5); color: #5a9400; }
    100% { text-shadow: 0 0 6px rgba(122,194,0,0.6), 0 0 20px rgba(122,194,0,0.3); color: #4a7c00; }
  }
  @keyframes loaderFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
  }
  @keyframes slideUp {
    from { transform: translateY(0); opacity: 1; }
    to   { transform: translateY(-20px); opacity: 0; }
  }
  .reel-col-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    will-change: transform;
  }
  .reel-col-inner.is-spinning {
    animation: reelSpin var(--dur) cubic-bezier(0.15, 0.85, 0.35, 1) forwards;
    animation-delay: var(--delay);
  }
  .brand-letter {
    animation: brandGlow 2s ease-in-out infinite;
    font-weight: 900 !important;
  }
  .loader-root.fade-out {
    animation: loaderFadeOut 0.5s ease forwards;
  }
  .brand-tagline {
    animation: slideUp 0.5s ease forwards;
  }
`;

export default function Loader() {
  // phases: spinning → brand → fadeout
  const [phase, setPhase] = useState('spinning');
  const ITEM_H = 72; // larger for desktop punch

  useEffect(() => {
    if (!document.getElementById('loader-css-v2')) {
      const s = document.createElement('style');
      s.id = 'loader-css-v2';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    const t1 = setTimeout(() => setPhase('brand'),   3000);
    const t2 = setTimeout(() => setPhase('fadeout'), 4200);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const totalItems = buildReelItems('A').length;
  const offset = -((totalItems - 1) * ITEM_H); // scroll to last item (brand letter)

  return (
    <div
      className={`loader-root${phase === 'fadeout' ? ' fade-out' : ''}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        // Blur + white-tinted overlay to match light website theme
        background: 'rgba(255,255,255,0.75)',
        backdropFilter: 'blur(8px) saturate(1.3)',
        WebkitBackdropFilter: 'blur(8px) saturate(1.3)',
      }}
    >
      {/* Top brand hint */}
      <p style={{
        fontSize: '0.7rem', letterSpacing: '6px', textTransform: 'uppercase',
        color: 'var(--text-muted, #888)', fontWeight: 600, marginBottom: '28px',
        opacity: phase === 'spinning' ? 0.6 : 0,
        transition: 'opacity 0.5s ease',
      }}>
        Premium VIP Number Marketplace
      </p>

      {/* Reel container — individual boxes per character, no overall border */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '95vw' }}>

        {BRAND.map((letter, col) => {
          const items = buildReelItems(letter);
          // Stagger each column 80ms, and slow ones at end spin a bit longer
          const dur = `${3.0 + col * 0.05}s`;
          const delay = `${col * 80}ms`;

          return (
            <div key={col} style={{
              width: `${ITEM_H + 4}px`,
              height: `${ITEM_H}px`,
              overflow: 'hidden',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.05)',
              border: '1px solid rgba(0,0,0,0.09)',
            }}>
              <div
                className={`reel-col-inner${phase === 'spinning' ? ' is-spinning' : ''}`}
                style={{
                  '--reel-offset': `${offset}px`,
                  '--dur': dur,
                  '--delay': delay,
                  // When settled, jump to last position instantly
                  transform: phase !== 'spinning' ? `translateY(${offset}px)` : 'translateY(0)',
                }}
              >
                {items.map((char, i) => {
                  const isFinalLetter = i === items.length - 1;
                  const isSettled = phase !== 'spinning';
                  return (
                    <div
                      key={i}
                      className={isFinalLetter && isSettled ? 'brand-letter' : ''}
                      style={{
                        width: '100%',
                        height: `${ITEM_H}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: isFinalLetter ? 'clamp(1.8rem, 4.5vw, 2.8rem)' : 'clamp(1.5rem, 3.5vw, 2.2rem)',
                        fontWeight: 900,
                        fontFamily: "'Courier New', monospace",
                        color: isFinalLetter && isSettled
                          ? '#4a7c00'
                          : `rgba(30,30,30,${0.15 + (i / items.length) * 0.65})`,
                        transition: 'color 0.4s ease',
                        userSelect: 'none',
                        letterSpacing: '1px',
                      }}
                    >
                      {isSettled ? (isFinalLetter ? char : null) : char}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Brand tagline shown after reels settle */}
      <div style={{
        marginTop: '24px',
        opacity: phase === 'brand' ? 1 : 0,
        transform: phase === 'brand' ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '0.75rem', letterSpacing: '4px', textTransform: 'uppercase',
          color: 'var(--neon-green-dark, #4a7c00)', fontWeight: 700, marginBottom: '4px',
        }}>
          AS Fancy Number
        </p>
        <p style={{
          fontSize: '0.7rem', color: 'var(--text-muted, #888)', letterSpacing: '2px',
          fontWeight: 500,
        }}>
          India's Most Exclusive VIP Numbers
        </p>
      </div>

      {/* Progress dots */}
      <div style={{
        display: 'flex', gap: '8px', marginTop: '32px',
        opacity: phase === 'spinning' ? 1 : 0,
        transition: 'opacity 0.4s ease',
      }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--neon-green, #7ac200)',
            opacity: 0.4,
            animation: `pulse-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
          }} />
        ))}
      </div>

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 0.3; transform: scale(1); }
          50%       { opacity: 1;   transform: scale(1.4); }
        }
      `}</style>
    </div>
  );
}
