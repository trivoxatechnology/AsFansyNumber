/**
 * Pattern Family: Sequences
 * Covers: Full Ladder, Partial Ladder, ABCD-ABCD, XYZ-XYZ, XY-XY-XY, Broken Sequence
 */

export const sequenceRules = [
  // 1. Full 10-Digit Ladder — Platinum
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
      if (isUp) return { label: 'Full Ascending Ladder' };
      if (isDn) return { label: 'Full Descending Ladder' };
      return null;
    }
  },
  // 2. AB-CD-AB-CD-AB (5-pair complex run) — Diamond
  {
    name: 'AB-CD-Block',
    priority: 81,
    category_id: 1,
    test: (s) => {
      const p1 = s.slice(0, 2);
      const p2 = s.slice(2, 4);
      if (s.slice(4, 6) === p1 && s.slice(6, 8) === p2 && s.slice(8, 10) === p1) {
        return { label: 'AB-CD-AB-CD-AB Pattern' };
      }
      return null;
    }
  },
  // 3. ABCD-ABCD (Repeating 4-digit blocks) — Platinum
  {
    name: 'ABCD-ABCD',
    priority: 82,
    category_id: 2,
    test: (s) => {
      if (s.slice(0, 4) === s.slice(4, 8)) return { label: 'Start ABCD-ABCD' };
      if (s.slice(2, 6) === s.slice(6, 10)) return { label: 'Last ABCD-ABCD' };
      if (s.slice(1, 5) === s.slice(5, 9)) return { label: 'Middle ABCD-ABCD' };
      return null;
    }
  },
  // 4. XYZ-XYZ (Repeating 3-digit blocks) — Platinum
  {
    name: 'XYZ-XYZ',
    priority: 75,
    category_id: 2,
    test: (s) => {
      if (s.slice(0, 3) === s.slice(3, 6)) return { label: 'Start XYZ-XYZ' };
      if (s.slice(4, 7) === s.slice(7, 10)) return { label: 'Last XYZ-XYZ' };
      if (s.slice(2, 5) === s.slice(5, 8)) return { label: 'Middle XYZ-XYZ' };
      return null;
    }
  },
  // 5. XY-XY-XY (Triple pair run) — Platinum
  {
    name: 'XY-XY-XY',
    priority: 72,
    category_id: 2,
    test: (s) => {
      if (s.slice(-6).slice(0, 2) === s.slice(-4, -2) && s.slice(-4, -2) === s.slice(-2)) {
        return { label: 'Triple Pair Run (End)' };
      }
      if (s.slice(0, 2) === s.slice(2, 4) && s.slice(2, 4) === s.slice(4, 6)) {
        return { label: 'Triple Pair Run (Start)' };
      }
      return null;
    }
  },
  // 6. Partial Ladder (6-8 consecutive digits) — Silver
  {
    name: 'Partial Ladder',
    priority: 67,
    category_id: 4,
    test: (s) => {
      let maxAsc = 1, maxDsc = 1, asc = 1, dsc = 1;
      for (let i = 1; i < 10; i++) {
        if (parseInt(s[i]) === parseInt(s[i-1]) + 1) { asc++; maxAsc = Math.max(maxAsc, asc); } else asc = 1;
        if (parseInt(s[i]) === parseInt(s[i-1]) - 1) { dsc++; maxDsc = Math.max(maxDsc, dsc); } else dsc = 1;
      }
      if (maxAsc >= 6) return { label: `${maxAsc}-Digit Ascending Run` };
      if (maxDsc >= 6) return { label: `${maxDsc}-Digit Descending Run` };
      if (maxAsc >= 4) return { label: `${maxAsc}-Digit Sequential` };
      if (maxDsc >= 4) return { label: `${maxDsc}-Digit Descending` };
      return null;
    }
  },
  // 7. Broken Sequence (alternating digit) — Silver
  {
    name: 'Broken Sequence',
    priority: 68,
    category_id: 4,
    test: (s) => {
      // x1x2x3x4x5
      if (s[1] === s[3] && s[3] === s[5] && s[5] === s[7] && s[7] === s[9]) {
        return { label: 'Alternating Digit Run' };
      }
      // 1x1x1x1x1x
      if (s[0] === s[2] && s[2] === s[4] && s[4] === s[6] && s[6] === s[8]) {
        return { label: 'Alternating Digit Even' };
      }
      return null;
    }
  }
];
