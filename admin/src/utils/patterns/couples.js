/**
 * Pattern Family: Couples & Doubling
 * Covers: AABBCC (Doubling), 2/3/4 Couples, AB-AB (XY-XY)
 */

export const coupleRules = [
  // 1. Triple Doubling (AA BB CC)
  {
    name: 'Doublling',
    priority: 77,
    category_id: 3, // Changed from 2 to 3 (Gold)
    test: (s) => {
      const last6 = s.slice(-6);
      if (last6[0] === last6[1] && last6[2] === last6[3] && last6[4] === last6[5]) {
        return { sub: 'Doublling (AABBCC)', label: 'Triple Doubling (AA BB CC)' };
      }
      return null;
    }
  },
  // 2. 5 Couples (AA BB CC DD EE)
  {
    name: '5 Couples',
    priority: 84,
    category_id: 1,
    test: (s) => {
      if (s[0] === s[1] && s[2] === s[3] && s[4] === s[5] && s[6] === s[7] && s[8] === s[9]) {
        return { sub: '5 Couples', label: 'Full 5-Couple Sequence' };
      }
      return null;
    }
  },
  // 3. 4 Couples (XY XY XY XY)
  {
    name: '4 Couples',
    priority: 76,
    category_id: 2,
    test: (s) => {
      const last8 = s.slice(-8);
      const xy = last8.slice(0, 2);
      if (last8.slice(2, 4) === xy && last8.slice(4, 6) === xy && last8.slice(6) === xy) {
        return { sub: '4 Couples', label: 'Quadruple Couple (End)' };
      }
      return null;
    }
  },
  // 4. ABAB-XYXY
  {
    name: 'ABAB-XYXY',
    priority: 75,
    category_id: 2,
    test: (s) => {
      if (s.slice(0, 4) === s.slice(4, 8) && s.slice(2, 4) !== s.slice(0, 2)) {
         return { sub: 'abab-xyxy-**', label: 'Double ABAB Pattern' };
      }
      return null;
    }
  },
  // 5. XY-XY (2 times)
  {
    name: 'XY-XY',
    priority: 71,
    category_id: 5,
    test: (s) => {
      const last4 = s.slice(-4);
      if (last4.slice(0, 2) === last4.slice(2)) {
        return { sub: 'xyxy (2 times)', label: 'Double Couple (End)' };
      }
      return null;
    }
  }
];

