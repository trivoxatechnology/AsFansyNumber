import { detectPattern, getRootSum } from './patternDetector';

/**
 * SALES FRONT-END — PATTERN ENGINE BRIDGE
 * Synchronized with Admin Panel 30+ rule engine.
 * Categories: Diamond(1), Platinum(2), Gold(3), Silver(4), Bronze(5), Normal(6), Couple(7), Business(8)
 */

const TIER_TO_ID = {
  'Diamond': 1,
  'Platinum': 2,
  'Gold': 3,
  'Silver': 4,
  'Bronze': 5
};

export const CATEGORY_LABELS = {
  1: 'Diamond',
  2: 'Platinum',
  3: 'Gold',
  4: 'Silver',
  5: 'Bronze',
  6: 'Normal',
  7: 'Couple',
  8: 'Business',
};

export function classifyNumber(num) {
  const s = String(num).replace(/\D/g, '');
  const d = detectPattern(s);
  const cid = TIER_TO_ID[d.pattern_category] || 6;
  const digitSum = s.split('').reduce((a, b) => a + parseInt(b, 10), 0);

  return {
    pattern_name: d.pattern_name || 'Regular Number',
    prefix: s.slice(0, 4),
    suffix: s.slice(-4),
    digit_sum: digitSum,
    number_category: cid,
    numerology_root: d.numerology_root || (digitSum % 9 || 9),
  };
}

// ── Compatibility Exports ──
export const CATEGORIES = [1, 2, 3, 4, 5, 6, 7, 8];
export const PATTERN_TYPES = ['Mirror', 'Hexa', 'Penta', 'Tetra', 'Triple', '786', 'Ladder', 'XYZ-XYZ', 'ABCD-ABCD'];
