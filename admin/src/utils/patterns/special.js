/**
 * Pattern Family: Special
 * Covers: 786 (all variants), 13, 000 (Triple Zero), Numerology (108/1008)
 * Updated: Diamond-tier for 000786, Platinum for Double 786
 */

export const specialRules = [
  // 1. 000786 — Diamond tier (extremely rare, holy + zeros)
  {
    name: '000786',
    priority: 97,
    category_id: 1,
    test: (s) => {
      if (s === '0000000786' || s.endsWith('000786')) return { label: '000786 Sacred (Diamond)' };
      if (s.startsWith('786') && s.endsWith('786')) return { label: 'Double 786 Bookend' };
      return null;
    }
  },
  // 2. Double 786 — Platinum
  {
    name: 'Double 786',
    priority: 93,
    category_id: 2,
    test: (s) => {
      if (s.includes('786786')) return { label: 'Double 786 (Platinum)' };
      // 786 appears in 2 separate places
      const first = s.indexOf('786');
      if (first >= 0) {
        const second = s.indexOf('786', first + 3);
        if (second >= 0) return { label: '786 Twin (Platinum)' };
      }
      return null;
    }
  },
  // 3. 786 variants — Gold
  {
    name: '786',
    priority: 86,
    category_id: 3,
    test: (s) => {
      if (s.endsWith('00786')) return { label: '00786 Sacred' };
      if (s.endsWith('0786')) return { label: '0786 Sacred' };
      if (s.endsWith('786')) return { label: '786 Ending' };
      if (s.startsWith('786')) return { label: '786 Starting' };
      if (s.includes('786') && s.includes('13')) return { label: '786 + 13 Combo' };
      if (s.includes('786')) return { label: '786 Middle' };
      return null;
    }
  },
  // 4. Lucky/Unlucky 13 — Silver
  {
    name: '13',
    priority: 79,
    category_id: 4,
    test: (s) => {
      if (s.endsWith('0000013')) return { label: '5 Zeros + 13' };
      if (s.endsWith('000013') || s.endsWith('00013')) return { label: 'Zeros + 13' };
      if (s.includes('131313')) return { label: '13 Triple' };
      if (s.endsWith('1313')) return { label: '13 Double (End)' };
      if (s.startsWith('13000')) return { label: '13 + 3 Zeros' };
      return null;
    }
  },
  // 5. Triple Zero (000) — Silver
  {
    name: '000',
    priority: 81,
    category_id: 4,
    test: (s) => {
      if (s.endsWith('000')) return { label: 'Triple Zero (Last)' };
      if (s.includes('000')) return { label: 'Triple Zero (Mid)' };
      return null;
    }
  },
  // 6. Numerology / Devotional — Bronze
  {
    name: 'Numerology',
    priority: 60,
    category_id: 5,
    test: (s) => {
      if (s.endsWith('108')) return { label: '108 Devotional' };
      if (s.endsWith('1008')) return { label: '1008 Devotional' };
      if (s.includes('420')) return { label: '420 Special' };
      return null;
    }
  }
];
