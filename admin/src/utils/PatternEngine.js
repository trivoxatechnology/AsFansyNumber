/**
 * ADMIN PANEL - PATTERN DETECTION ENGINE
 * Strictly follows the logic provided in the rebuild prompt.
 */

export function classifyNumber(num) {
  const s = String(num).replace(/\D/g, '');
  if (s.length !== 10) return { category: 'Normal', pattern_type: 'normal' };

  const digits = s.split('').map(Number);
  let maxRepeat = 1, cur = 1;
  for (let i = 1; i < digits.length; i++) {
    cur = digits[i] === digits[i-1] ? cur + 1 : 1;
    maxRepeat = Math.max(maxRepeat, cur);
  }

  const digitSum = digits.reduce((a, b) => a + b, 0);

  let pattern_type = 'normal';
  let category = 'Normal';

  const allSame = new Set(digits).size === 1;
  const allDigitsSeq = s === '0123456789' || s === '9876543210';
  const has8Consec = maxRepeat >= 8;

  if (allSame || allDigitsSeq || has8Consec) {
    category = 'Diamond';
    pattern_type = allSame ? 'all-same' : allDigitsSeq ? 'full-sequence' : '8-consecutive';
  } else if (maxRepeat >= 6 || /(\d)\1{2}(\d)\1{2}/.test(s)) {
    category = 'Platinum';
    pattern_type = maxRepeat >= 6 ? '6-consecutive' : 'triple-double';
  } else if (maxRepeat >= 4 || /(\d{4})\1/.test(s) || /0000$|5555$/.test(s)) {
    category = 'Gold';
    pattern_type = maxRepeat >= 4 ? '4-consecutive' : 'double-pair';
  } else if (maxRepeat >= 3 || digitSum % 9 === 0 || /786|108|999/.test(s.slice(-4))) {
    category = 'Silver';
    pattern_type = maxRepeat >= 3 ? '3-consecutive' : digitSum % 9 === 0 ? 'lucky-sum' : 'vip-suffix';
  }

  return {
    category,
    pattern_type
  };
}

export const CATEGORIES = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Normal'];
export const PATTERN_TYPES = [
  'all-same', 'full-sequence', '8-consecutive', '6-consecutive', 'triple-double',
  '4-consecutive', 'double-pair', '3-consecutive', 'lucky-sum', 'vip-suffix', 'normal'
];


