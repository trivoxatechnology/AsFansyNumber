import { useEffect, useState } from 'react';

const BRAND = 'ASFANCYNUMBER'.split('');
const DIGITS = ['0','1','2','3','4','5','6','7','8','9'];

function buildReelItems(finalChar) {
  const spins = [...DIGITS, ...DIGITS, ...DIGITS];
  return [...spins, finalChar];
}

const CSS = `
  @keyframes reelSpin {
    from { transform: translateY(0); }
    to   { transform: translateY(var(--reel-offset)); }
  }
  @keyframes brandGlow {
    0%   { text-shadow: 0 0 10px rgba(255,215,0,0.4); color: rgba(255,255,255,0.8); }
    50%  { text-shadow: 0 0 20px rgba(255,215,0,0.8); color: #fff; }
    100% { text-shadow: 0 0 10px rgba(255,215,0,0.4); color: rgba(255,255,255,0.8); }
  }
  @keyframes loaderFadeOut {
    from { opacity: 1; }
    to   { opacity: 0; }
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
    font-weight: 800 !important;
  }
  .loader-root.fade-out {
    animation: loaderFadeOut 0.5s ease forwards;
  }
`;

export default function Loader() {
  const [phase, setPhase] = useState('spinning');
  const ITEM_H = 72;

  useEffect(() => {
    if (!document.getElementById('loader-css-v3')) {
      const s = document.createElement('style');
      s.id = 'loader-css-v3';
      s.textContent = CSS;
      document.head.appendChild(s);
    }

    const t1 = setTimeout(() => setPhase('brand'),   2500);
    const t2 = setTimeout(() => setPhase('fadeout'), 3500);

    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const totalItems = buildReelItems('A').length;
  const offset = -((totalItems - 1) * ITEM_H);

  return (
    <div
      className={`loader-root${phase === 'fadeout' ? ' fade-out' : ''}`}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(6,6,8,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '95vw' }}>
        {BRAND.map((letter, col) => {
          const items = buildReelItems(letter);
          const dur = `${2.0 + col * 0.05}s`;
          const delay = `${col * 50}ms`;

          return (
            <div key={col} style={{
              width: `60px`,
              height: `${ITEM_H}px`,
              overflow: 'hidden',
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '12px',
            }}>
              <div
                className={`reel-col-inner${phase === 'spinning' ? ' is-spinning' : ''}`}
                style={{
                  '--reel-offset': `${offset}px`,
                  '--dur': dur,
                  '--delay': delay,
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
                        fontSize: '32px',
                        fontWeight: 700,
                        fontFamily: "var(--font-display)",
                        color: isFinalLetter && isSettled ? '#fff' : 'rgba(255,255,255,0.1)',
                        transition: 'color 0.4s ease',
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

      <div style={{
        marginTop: '32px',
        opacity: phase === 'brand' ? 1 : 0,
        transform: phase === 'brand' ? 'translateY(0)' : 'translateY(10px)',
        transition: 'all 0.5s ease 0.2s',
        textAlign: 'center',
      }}>
        <p style={{
          fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase',
          color: 'var(--primary)', fontWeight: 700,
        }}>
          ESTABLISHED 2026
        </p>
      </div>
    </div>
  );
}
