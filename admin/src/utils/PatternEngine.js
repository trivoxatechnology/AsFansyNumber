/**
 * ADMIN PANEL — PATTERN DETECTION ENGINE (v3)
 * 5-Category system: Diamond, Platinum, Gold, Silver, Normal
 * Category derived from pattern_type ONLY (not vip_score).
 */

// ── Helpers ──────────────────────────────────────────────────

export function getPrefix(num) {
  return String(num).replace(/\D/g, '').slice(0, 4);
}

export function getSuffix(num) {
  return String(num).replace(/\D/g, '').slice(-4);
}

export function getDigitSum(num) {
  return String(num).replace(/\D/g, '').split('').reduce((sum, d) => sum + parseInt(d, 10), 0);
}

export function getRepeatCount(num) {
  const s = String(num).replace(/\D/g, '');
  const counts = {};
  for (const d of s) counts[d] = (counts[d] || 0) + 1;
  return Math.max(...Object.values(counts), 0);
}

// ── Pattern Detection (priority order — first match wins) ────

export function detectPattern(num) {
  const s = String(num).replace(/\D/g, '');
  if (s.length !== 10) return 'Normal';

  // 1. Mirror: first_half === reverse(second_half)
  const first5 = s.slice(0, 5);
  const last5 = s.slice(5);
  if (first5 === last5.split('').reverse().join('')) return 'Mirror';

  // 2. Palindrome: reads same forwards and backwards (AND not Mirror)
  if (s === s.split('').reverse().join('')) return 'Palindrome';

  // 3. Ladder Up: every digit is exactly +1 from previous
  let isUp = true, isDn = true;
  for (let i = 1; i < 10; i++) {
    if (parseInt(s[i]) !== parseInt(s[i - 1]) + 1) isUp = false;
    if (parseInt(s[i]) !== parseInt(s[i - 1]) - 1) isDn = false;
  }
  if (isUp) return 'Ladder Up';

  // 4. Ladder Down: every digit is exactly -1 from previous
  if (isDn) return 'Ladder Down';

  // 5. Repeating: 3+ consecutive same digits
  if (/(.)\1{2,}/.test(s)) return 'Repeating';

  // 6. Double Pair: two or more pairs of consecutively repeated digits
  if (/(.)\1(.)\2/.test(s)) return 'Double Pair';

  // 7. Triple: exactly three same digits in sequence (4+ caught by Repeating above)
  if (/(.)\1\1/.test(s)) return 'Triple';

  // 8. Sequential: run of 4+ ascending or descending digits anywhere
  let up = 0, dn = 0;
  for (let i = 1; i < s.length; i++) {
    up = (parseInt(s[i]) === parseInt(s[i - 1]) + 1) ? up + 1 : 0;
    dn = (parseInt(s[i]) === parseInt(s[i - 1]) - 1) ? dn + 1 : 0;
    if (up >= 3 || dn >= 3) return 'Sequential';
  }

  // 9. Normal
  return 'Normal';
}

// ── Pattern → Category mapping (strict) ──────────────────────

export const PATTERN_CATEGORY = {
  'Mirror': 1, 'Palindrome': 1,
  'Ladder Up': 2, 'Ladder Down': 2, 'Repeating': 2,
  'Double Pair': 3, 'Triple': 3,
  'Sequential': 4,
  'Normal': 5,
};

export function getCategoryFromPattern(patternType) {
  return PATTERN_CATEGORY[patternType] || 5;
}

// ── Category labels ──────────────────────────────────────────

export const CATEGORY_LABELS = {
  1: 'Diamond',
  2: 'Platinum',
  3: 'Gold',
  4: 'Silver',
  5: 'Normal',
};

export const CATEGORIES = [1, 2, 3, 4, 5];

// ── Pattern display names ────────────────────────────────────

export const PATTERN_NAME_MAP = {
  'Mirror': 'Mirror Number',
  'Palindrome': 'Palindrome Number',
  'Ladder Up': 'Ladder Series',
  'Ladder Down': 'Descending Ladder',
  'Repeating': 'Repeating Fancy',
  'Double Pair': 'Double Pair Fancy',
  'Triple': 'Triple Digit',
  'Sequential': 'Sequential Number',
  'Normal': 'Regular Number',
};

export const PATTERN_TYPES = Object.keys(PATTERN_NAME_MAP);

// ── VIP Score (0-100, cumulative) ────────────────────────────

export function calculateVIPScore(num, patternType, repeatCount, suffix, digitSum) {
  let score = 10;

  // Pattern bonus (only one applies)
  const bonuses = {
    'Mirror': 35, 'Palindrome': 35,
    'Ladder Up': 25, 'Ladder Down': 25, 'Repeating': 25,
    'Double Pair': 15, 'Triple': 15,
    'Sequential': 10,
    'Normal': 0,
  };
  score += bonuses[patternType] || 0;

  // Repeat digit bonus
  if (repeatCount >= 4) score += 10;

  // Numerology bonuses (can stack)
  if (digitSum >= 1 && digitSum <= 9) score += 5;
  if (digitSum === 7 || digitSum === 9) score += 5;

  // Suffix bonuses (can stack)
  if (/^(.)\1+$/.test(suffix)) score += 5;
  const seqSuffixes = [
    '0123', '1234', '2345', '3456', '4567', '5678', '6789',
    '9876', '8765', '7654', '6543', '5432', '4321', '3210',
  ];
  if (seqSuffixes.includes(suffix)) score += 5;

  return Math.min(score, 100);
}

// ── Full classification ──────────────────────────────────────

export function classifyNumber(num) {
  const patternType = detectPattern(num);
  const patternName = PATTERN_NAME_MAP[patternType];
  const repeatCount = getRepeatCount(num);
  const suffix = getSuffix(num);
  const digitSum = getDigitSum(num);
  const score = calculateVIPScore(num, patternType, repeatCount, suffix, digitSum);
  const categoryId = getCategoryFromPattern(patternType);

  return {
    pattern_type: patternType,
    pattern_name: patternName,
    repeat_count: repeatCount,
    suffix,
    prefix: getPrefix(num),
    digit_sum: digitSum,
    vip_score: score,
    number_category: categoryId,
    category_label: CATEGORY_LABELS[categoryId],
  };
}
