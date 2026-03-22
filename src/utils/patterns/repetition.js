/**
 * Pattern Family: Repetition
 * Covers: Tetra (4), Penta (5), Hexa (6), Septa (7), Octa (8)
 * Sub-categories: Last, Start, Middle, Special
 */

export const repetitionRules = [
  // 1. Octa (8 digits) - Extremely rare/Diamond
  {
    name: 'Octa',
    priority: 100,
    category_id: 1,
    test: (s) => {
      const match = s.match(/(.)\1{7}/);
      if (match) {
        if (s.endsWith(match[0])) return { sub: 'Octa Last', label: '8 Digits Same (Last)' };
        if (s.startsWith(match[0])) return { sub: 'Octa Start', label: '8 Digits Same (Start)' };
        return { sub: 'Octa', label: '8 Digits Same' };
      }
      return null;
    }
  },
  // 2. Septa (7 digits)
  {
    name: 'Septa',
    priority: 99,
    category_id: 1,
    test: (s) => {
      const match = s.match(/(.)\1{6}/);
      if (match) {
        if (s.endsWith(match[0])) return { sub: 'Septa Last', label: '7 Digits Same (Last)' };
        return { sub: 'Septa', label: '7 Digits Same' };
      }
      return null;
    }
  },
  // 3. Hexa (6 digits)
  {
    name: 'Hexa',
    priority: 98,
    category_id: 1,
    test: (s) => {
      const match = s.match(/(.)\1{5}/);
      if (match) {
        if (s.endsWith(match[0])) return { sub: 'Hexa Last', label: 'Hexa Last' };
        if (match[0] === '000000') return { sub: 'Hexa Zeros', label: 'Hexa Zeros' };
        return { sub: 'Hexa', label: 'Hexa Number' };
      }
      return null;
    }
  },
  // 4. Penta (5 digits)
  {
    name: 'Penta',
    priority: 95,
    category_id: 2,
    test: (s) => {
      const match = s.match(/(.)\1{4}/);
      if (match) {
        if (s.endsWith(match[0])) {
           if (match[0] === '00000') return { sub: '00000 Last', label: '5 Zeros Last' };
           return { sub: 'Penta Last', label: 'Penta Last' };
        }
        if (s.startsWith(match[0])) {
           // xxxxxABC / ABCD
           const rest = s.slice(5);
           if (rest.length >= 4) return { sub: 'xxxxxABCD', label: 'Penta Start (ABCD)' };
           if (rest.length >= 3) return { sub: 'xxxxxABC', label: 'Penta Start (ABC)' };
           return { sub: 'Penta Start', label: 'Penta Start' };
        }
        return { sub: 'Penta', label: 'Penta Number' };
      }
      return null;
    }
  },
  // 5. Penta with Zeros (Special)
  {
    name: 'Penta Zeros',
    priority: 96,
    category_id: 1,
    test: (s) => {
      if (s.startsWith('00000')) {
        const rest = s.slice(5);
        if (/^\d{4}/.test(rest)) return { sub: '00000abcd', label: '00000 + ABCD' };
        if (/^\d{3}/.test(rest)) return { sub: '00000abc', label: '00000 + ABC' };
        if (/^\d{2}/.test(rest)) return { sub: '00000xy', label: '00000 + XY' };
        if (rest === '1') return { sub: '000001', label: '00000 + 1' };
        return { sub: '00000X', label: '00000 + X' };
      }
      return null;
    }
  },
  // 6. Tetra (4 digits)
  {
    name: 'Tetra',
    priority: 90,
    category_id: 3,
    test: (s) => {
      const match = s.match(/(.)\1{3}/);
      if (match) {
        if (s.endsWith(match[0])) {
           if (match[0] === '0000') return { sub: '0000 Last', label: '4 Zeros Last' };
           return { sub: 'Tetra Last', label: 'Tetra Last' };
        }
        if (s.startsWith(match[0])) return { sub: 'Start Tetra', label: 'Start Tetra' };
        return { sub: 'Tetra', label: 'Tetra Number' };
      }
      return null;
    }
  },
  // 6. Triple (3 digits)
  {
    name: 'Triple',
    priority: 80,
    category_id: 4,
    test: (s) => {
      const match = s.match(/(.)\1{2}/);
      if (match) {
        if (s.endsWith(match[0])) return { sub: 'End xxx', label: 'Triple Last' };
        if (match[0] === '000') return { sub: '000 Middle', label: 'Triple Zero' };
        return { sub: 'Triple', label: 'Triple Number' };
      }
      return null;
    }
  }
];
