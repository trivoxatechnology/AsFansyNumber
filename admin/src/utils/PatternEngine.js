import { repetitionRules } from './patterns/repetition';
import { symmetryRules } from './patterns/symmetry';
import { sequenceRules } from './patterns/sequences';
import { specialRules } from './patterns/special';
import { coupleRules } from './patterns/couples';

/**
 * ADMIN PANEL — MODULAR PATTERN ENGINE (v4)
 * Supports 100+ patterns via prioritized rule modules.
 * Categories: Diamond(1), Platinum(2), Gold(3), Silver(4), Bronze(5), Normal(6)
 */

// Combine all rules and sort by priority (highest first)
const ALL_RULES = [
  ...repetitionRules,
  ...symmetryRules,
  ...sequenceRules,
  ...specialRules,
  ...coupleRules
].sort((a, b) => b.priority - a.priority);

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

// ── Pattern Detection (v4 Modular) ────

export function detectPattern(num) {
  const s = String(num).replace(/\D/g, '');
  if (s.length !== 10) return { name: 'Normal', sub: 'Invalid', category: 6, label: 'Regular Number' };

  for (const rule of ALL_RULES) {
    const result = rule.test(s);
    if (result) {
      return {
        name: rule.name,
        category: rule.category_id,
        label: result.label || rule.name
      };
    }
  }

  return { name: 'Normal', category: 6, label: 'Regular Number' };
}

// ── Category labels ──────────────────────────────────────────

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

export const CATEGORIES = [1, 2, 3, 4, 5, 6, 7, 8];

// ── VIP Score (0-100, cumulative) ────────────────────────────

export function calculateVIPScore(num, categoryId, repeatCount, suffix, digitSum) {
  let score = 10;

  // Category-based base score
  const categoryScores = { 1: 50, 2: 40, 3: 30, 4: 20, 5: 15, 6: 5 };
  score += categoryScores[categoryId] || 0;

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

// ── Full classification ──────────────────────────────────

export function classifyNumber(num) {
  const s = String(num).replace(/\D/g, '');
  const detection = detectPattern(s);
  const digitSum = getDigitSum(s);

  return {
    mobile_number: s,
    pattern_name: detection.label,
    prefix: getPrefix(s),
    suffix: getSuffix(s),
    digit_sum: digitSum,
    number_category: detection.category,
    numerology_root: digitSum % 9 || 9
  };
}

// ── Compatibility Exports ──
export const PATTERN_TYPES = Array.from(new Set(ALL_RULES.map(r => r.name))).concat(['Normal']);
export const PATTERN_NAME_MAP = ALL_RULES.reduce((acc, r) => {
  acc[r.name] = r.label || r.name;
  return acc;
}, { 'Normal': 'Regular Number' });


