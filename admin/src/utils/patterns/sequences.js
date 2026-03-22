/**
 * Pattern Family: Sequences
 * Covers: Ladder Up/Down, ABCD-ABCD, XYZXYZ, ASCII-like runs
 */

export const sequenceRules = [
  // 1. Full 10-Digit Ladder
  {
    name: 'Ladder',
    priority: 88,
    category_id: 2,
    test: (s) => {
      let isUp = true, isDn = true;
      for (let i = 1; i < 10; i++) {
        if (parseInt(s[i]) !== (parseInt(s[i-1]) + 1) % 10) isUp = false;
        if (parseInt(s[i]) !== (parseInt(s[i-1]) - 1 + 10) % 10) isDn = false;
      }
      if (isUp) return { sub: 'Asending-Desending', label: 'Ascending Ladder (Full)' };
      if (isDn) return { sub: 'Asending-Desending', label: 'Descending Ladder (Full)' };
      return null;
    }
  },
  // 2. ABCD-ABCD (Repeating 4-digit blocks)
  {
    name: 'ABCD-ABCD',
    priority: 82,
    category_id: 2,
    test: (s) => {
      // abcd-abcd
      if (s.slice(0, 4) === s.slice(4, 8)) return { sub: 'abcd-abcd', label: 'Start ABCD-ABCD' };
      if (s.slice(2, 6) === s.slice(6, 10)) return { sub: 'abcd-abcd', label: 'Last ABCD-ABCD' };
      
      // x-abcd-abcd-y
      if (s.slice(1, 5) === s.slice(5, 9)) return { sub: 'X-abcd-abcd-Y', label: 'Middle ABCD-ABCD' };
      return null;
    }
  },
  // 3. AB-CD-AB-CD-AB (Repeating 4-digit block + pair)
  {
    name: 'AB-CD-Block',
    priority: 81,
    category_id: 1,
    test: (s) => {
      const p1 = s.slice(0, 2);
      const p2 = s.slice(2, 4);
      if (s.slice(4, 6) === p1 && s.slice(6, 8) === p2 && s.slice(8, 10) === p1) {
        return { sub: 'AB-CD-AB-CD-AB', label: 'Complex 5-Pair Run' };
      }
      return null;
    }
  },
  // 4. XYZ-XYZ (Repeating 3-digit blocks)
  {
    name: 'XYZ-XYZ',
    priority: 75,
    category_id: 2, // Changed from 3 to 2 (Platinum)
    test: (s) => {
      if (s.slice(0, 3) === s.slice(3, 6)) return { sub: 'xyzxyz Start', label: 'Start XYZ-XYZ' };
      if (s.slice(4, 7) === s.slice(7, 10)) return { sub: 'xyzxyz Last', label: 'Last XYZ-XYZ' };
      if (s.slice(2, 5) === s.slice(5, 8)) return { sub: 'xyzxyz Middle', label: 'Middle XYZ-XYZ' };
      return null;
    }
  },
  // 5. AB-AB-AB (Repeating 2-digit pairs)
  {
    name: 'XY-XY-XY',
    priority: 72,
    category_id: 2, // Changed from 3 to 2 (Platinum)
    test: (s) => {
      if (s.slice(-6).slice(0, 2) === s.slice(-4, -2) && s.slice(-4, -2) === s.slice(-2)) {
        return { sub: 'xyxyxy Last', label: 'Triple Pair Run (End)' };
      }
      if (s.slice(0, 2) === s.slice(2, 4) && s.slice(2, 4) === s.slice(4, 6)) {
        return { sub: 'xyxyxy Start', label: 'Triple Pair Run (Start)' };
      }
      return null;
    }
  },
  // 6. Broken Sequences (x1x2x3x4x5)
  {
    name: 'Broken Sequence',
    priority: 68,
    category_id: 4,
    test: (s) => {
      if (s[1] === s[3] && s[3] === s[5] && s[5] === s[7] && s[7] === s[9]) {
        return { sub: '1x2x3x4x5x', label: 'Alternating Digit Run' };
      }
      return null;
    }
  }
];

