/**
 * Pattern Family: Symmetry
 * Covers: Mirror, Semi-Mirror, Ulta-Pulta, Symmetry (10/9/8 digits)
 */

export const symmetryRules = [
  // 1. Full 10-Digit Mirror (12345 54321)
  {
    name: 'Mirror',
    priority: 85,
    category_id: 1,
    test: (s) => {
      const first5 = s.slice(0, 5);
      const last5 = s.slice(5);
      if (first5 === last5.split('').reverse().join('')) {
        return { sub: 'Mirror', label: '10 Digits Symmetry' };
      }
      return null;
    }
  },
  // 2. 8-Digit Mirror (xx 1234 4321 xx)
  {
    name: 'Mirror',
    priority: 84,
    category_id: 1,
    test: (s) => {
      const mid8 = s.slice(1, 9);
      const f4 = mid8.slice(0, 4);
      const l4 = mid8.slice(4);
      if (f4 === l4.split('').reverse().join('')) {
        return { sub: '8 9 Digits symmetry', label: '8 Digits Symmetry' };
      }
      return null;
    }
  },
  // 3. Semi-Mirror (Last 4 digits mirror)
  {
    name: 'Semi Mirror',
    priority: 70,
    category_id: 2,
    test: (s) => {
      const last4 = s.slice(-4);
      if (last4[0] === last4[3] && last4[1] === last4[2]) {
        return { sub: 'Semi Mirror', label: 'Semi Mirror (Last 4)' };
      }
      return null;
    }
  },
  // 4. Ulta-Pulta (e.g., 1234 4321 anywhere)
  {
    name: 'Ulta-Pulta',
    priority: 65,
    category_id: 3,
    test: (s) => {
      // Check for any 4-digit block and its reverse immediately after
      for (let i = 0; i <= s.length - 8; i++) {
        const block = s.slice(i, i + 4);
        const nextBlock = s.slice(i + 4, i + 8);
        if (block === nextBlock.split('').reverse().join('')) {
          return { sub: 'Ulta-Pulta', label: 'Ulta-Pulta Pattern' };
        }
      }
      return null;
    }
  }
];
