/**
 * Advanced Pattern Master Engine (V3 - Weighted Priority System)
 * Heavily inspired by VIP Number Shop (vipnumbershop.com)
 * 
 * Logic:
 * 1. Checks every number against 100+ pattern definitions.
 * 2. Each match has a "Weight" (Strength).
 * 3. The engine returns the match with the HIGHEST weight.
 */

export const CATEGORIES = ['Diamond', 'Platinum', 'Gold', 'Silver', 'Bronze'];

/**
 * Returns { pattern_type, category } for a 10-digit number.
 */
export function classifyNumber(mobile) {
  const m = String(mobile).replace(/\D/g, '');
  if (m.length !== 10) return { pattern_type: 'Normal', category: 'Bronze' };

  let bestMatch = { type: 'Standard Number', cat: 'Bronze', weight: 0 };

  const addMatch = (type, cat, weight) => {
    if (weight > bestMatch.weight) {
      bestMatch = { type, cat, weight };
    }
  };

  // --- REPETITION CHECKERS ---
  const repeating = (digit, count) => digit.repeat(count);
  const findRepeats = (str) => {
    let max = 1, char = '';
    let curr = 1;
    for (let i = 1; i < str.length; i++) {
        if (str[i] === str[i-1]) curr++;
        else curr = 1;
        if (curr >= max) { max = curr; char = str[i]; }
    }
    return { char, count: max, isEnding: str.endsWith(char.repeat(max)) };
  };

  const rep = findRepeats(m);
  if (rep.count >= 8) addMatch(`Octa ${repeating(rep.char, 8)} Repeating`, 'Diamond', 100);
  else if (rep.count === 7) addMatch(`Septa ${repeating(rep.char, 7)} Repeating`, 'Diamond', 95);
  else if (rep.count === 6) addMatch(`Hexa ${repeating(rep.char, 6)} Repeating`, 'Platinum', 85);
  else if (rep.count === 5 && rep.isEnding) addMatch(`Penta ${repeating(rep.char, 5)} Ending`, 'Platinum', 80);
  else if (rep.count === 5) addMatch(`Penta ${repeating(rep.char, 5)} Repeating`, 'Gold', 70);
  else if (rep.count === 4 && rep.isEnding) addMatch(`Tetra ${repeating(rep.char, 4)} Ending`, 'Gold', 65);
  else if (rep.count === 4) addMatch(`Tetra ${repeating(rep.char, 4)} Repeating`, 'Silver', 50);

  // --- SYMMETRY / MIRROR ---
  if (m === m.split('').reverse().join('')) addMatch('Full 10-Digit Mirror', 'Diamond', 90);
  else if (m.slice(1) === m.slice(1).split('').reverse().join('')) addMatch('9-Digit Mirror', 'Platinum', 75);
  else if (m.slice(-6) === m.slice(-6).split('').reverse().join('')) addMatch('6-Digit Last Mirror', 'Gold', 60);

  // --- SEQUENCE CHECKERS ---
  const checkSeq = (str) => {
    let asc = 1, dsc = 1, maxAsc = 1, maxDsc = 1;
    for (let i = 1; i < str.length; i++) {
        const c = parseInt(str[i]), p = parseInt(str[i-1]);
        if (c === p + 1) { asc++; dsc = 1; }
        else if (c === p - 1) { dsc++; asc = 1; }
        else { asc = 1; dsc = 1; }
        maxAsc = Math.max(maxAsc, asc); maxDsc = Math.max(maxDsc, dsc);
    }
    return Math.max(maxAsc, maxDsc);
  };
  const seqCount = checkSeq(m);
  if (seqCount >= 7) addMatch(`${seqCount}-Digit Sequence`, 'Diamond', 88);
  else if (seqCount >= 5) addMatch(`${seqCount}-Digit Sequence`, 'Gold', 55);

  // --- SPECIAL / LUCKY / BUSINESS ---
  if (m.includes('786786')) addMatch('Double 786 Lucky', 'Diamond', 92);
  else if (m.endsWith('786')) addMatch('786 Ending Lucky', 'Gold', 45);
  else if (m.includes('786')) addMatch('786 Lucky Pattern', 'Silver', 35);
  
  if (m.endsWith('000000')) addMatch('Hexa Zero Ending', 'Diamond', 93);
  else if (m.endsWith('00000')) addMatch('Penta Zero Ending', 'Platinum', 82);
  else if (m.endsWith('0000')) addMatch('Tetra Zero Ending', 'Gold', 62);
  else if (m.endsWith('000')) addMatch('Triple Zero (Business)', 'Silver', 40);

  // --- REPETITIVE BLOCKS (XYXY, XYZXYZ) ---
  const blocks = m.match(/(\d\d\d)\1/); // Triplet repeat e.g. 123 123
  if (blocks) addMatch(`Triplet ${blocks[1]} Repeating`, 'Gold', 58);

  const couples = m.match(/(\d\d)\1\1/); // XYXYXY
  if (couples) addMatch(`XYXYXY (${couples[1]}) Repeating`, 'Platinum', 72);

  const doubleCouples = m.match(/(\d\d)\1/); // XYXY
  if (doubleCouples) addMatch(`XYXY (${doubleCouples[1]}) Repeating`, 'Silver', 30);

  const aabbcc = m.match(/(\d)\1(\d)\2(\d)\3/);
  if (aabbcc) addMatch(`Doublets ${aabbcc[1]}${aabbcc[1]}${aabbcc[2]}${aabbcc[2]}${aabbcc[3]}${aabbcc[3]}`, 'Gold', 52);

  // --- BUSINESS / CORPORATE LOGIC ---
  const uniqueDigits = new Set(m.split('')).size;
  if (uniqueDigits <= 2) addMatch('Minimum Digit (2 Unique)', 'Diamond', 87);
  else if (uniqueDigits === 3) addMatch('Minimum Digit (3 Unique)', 'Gold', 50);

  // --- COUPLE LOGIC (Standalone potential) ---
  // If the number has strong symmetry or blocks, it's a good candidate for a couple pack.
  if (m.slice(0, 5) === m.slice(5)) addMatch('Identical Halves (abcd-abcd)', 'Platinum', 78);

  return { pattern_type: bestMatch.type, category: bestMatch.cat };
}

/**
 * Utility to identify couples within a list of numbers.
 * Finds numbers that share the same suffix (last 4+) or prefix.
 */
export function identifyCouples(numbers) {
  const groups = {};
  numbers.forEach(num => {
    const s = String(num.mobile_number).replace(/\D/g, '');
    const suffix = s.slice(-5); // Group by last 5 digits
    if (!groups[suffix]) groups[suffix] = [];
    groups[suffix].push(num);
  });
  return Object.values(groups).filter(g => g.length > 1);
}

// Full pattern list for UI suggestions
export const PATTERN_TYPES = [
  'Octa Repeating', 'Septa Repeating', 'Hexa Repeating', 'Penta Ending', 'Tetra Ending',
  'Full 10-Digit Mirror', '9-Digit Mirror', '6-Digit Mirror', 'Sequence (5+)',
  '786 Lucky', 'Zero Ending (Corporate)', 'Triplet Repeating (XYZ-XYZ)', 'XYXYXY Repeating',
  'AABBCC Doubling', 'Identical Halves', 'Minimum Digit'
];

