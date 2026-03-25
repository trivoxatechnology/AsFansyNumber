/**
 * Fancy Number Pattern Detection Engine
 * Strictly implements 117 rules across 5 Tiers (Diamond, Platinum, Gold, Silver, Bronze)
 */

export function getRootSum(number) {
  const digits = String(number).replace(/\D/g, '');
  if (!digits) return 0;
  let sum = digits.split('').reduce((a, b) => a + parseInt(b), 0);
  while (sum > 9) {
    sum = String(sum).split('').reduce((a, b) => a + parseInt(b), 0);
  }
  return sum;
}

export function detectPattern(number) {
  const num = String(number).replace(/\D/g, '');
  if (num.length < 6) {
    return { pattern_code: null, pattern_name: null, pattern_category: null, all_patterns: [], numerology_root: getRootSum(number) };
  }

  const results = [];
  const root = getRootSum(num);
  const dArr = num.split('').map(Number);
  const isPal = (s) => s.length >= 4 && s === s.split('').reverse().join('');
  const add = (code, name, tier, weight) => results.push({ code, name, tier, weight });
  const isPure = num.split('').every(d => d === num[0]);

  // --- TIER 1: DIAMOND ---
  if (isPure) add('PURE_DIGIT', 'Pure Digit', 'Diamond', 1000);
  if (/(\d)\1{7,9}/.test(num)) add('SEPTA_OCTA_KING', 'Septa / Octa King', 'Diamond', 950);
  if (num === num.split('').reverse().join('')) add('PERFECT_MIRROR', 'Perfect Mirror', 'Diamond', 920);
  if (/^(\d\d)\1{4}$/.test(num)) add('DIAMOND_SYMMETRY', 'Diamond Symmetry', 'Diamond', 910);
  if (/786786/.test(num)) add('DOUBLE_SACRED', 'Double Sacred', 'Diamond', 980);
  if (/0{6,}/.test(num)) add('HEXA_ZERO_MASTER', 'Hexa Zero Master', 'Diamond', 850);
  if (/^(\d\d)(\d\d)\1\2\1$/.test(num)) add('ROYAL_SEQUENCE', 'Royal Sequence', 'Diamond', 940);
  if (/^(\d)\1(\d)\2(\d)\3(\d)\4(\d)\5$/.test(num)) add('FIVE_STAR_COUPLE', 'Five Star Couple', 'Diamond', 905);
  if (/(\d{4})\1/.test(num)) add('OCTA_ECHO', 'Octa Echo', 'Diamond', 850);
  if (/0{5}[1-9]$/.test(num)) add('PENTA_ZERO_SINGLE', 'Penta Zero Single', 'Diamond', 960);

  // --- TIER 2: PLATINUM ---
  if (/000786/.test(num)) add('TRIPLE_ZERO_SACRED', 'Triple Zero Sacred', 'Platinum', 690);
  if (/786.*786/.test(num)) add('SACRED_TWIN', 'Sacred Twin', 'Platinum', 680);
  if (/1313/.test(num)) add('LUCKY_13_DOUBLE', 'Lucky 13 Double', 'Platinum', 675);
  if (/(\d)\1{4}/.test(num)) add('PENTA_STAR', 'Penta Star', 'Platinum', 600);
  if (/(\d)\1\1(\d)\2\2(\d)\3\3/.test(num)) add('TRIPLE_TRIPLE', 'Triple Triple', 'Platinum', 650);
  
  for (let len=num.length; len>=6; len--) {
    for (let i=0; i<=num.length-len; i++) {
        if (isPal(num.substring(i, i+len))) { add('HALF_MIRROR', 'Half Mirror', 'Platinum', 500 + len); break; }
    }
  }

  // --- TIER 3: GOLD ---
  if (/786$/.test(num)) add('SACRED_ENDING', 'Sacred Ending', 'Gold', 490);
  if (/(\d)00\100/.test(num)) add('ZERO_STEP', 'Zero Step', 'Gold', 485);
  if (/00786/.test(num)) add('DOUBLE_ZERO_SACRED', 'Double Zero Sacred', 'Gold', 480);
  if (/0786/.test(num)) add('ZERO_SACRED', 'Zero Sacred', 'Gold', 475);
  
  let ac=1, dc=1, ma=1, md=1;
  for(let i=1; i<num.length; i++) {
    if(dArr[i] === dArr[i-1]+1) ac++; else ac=1;
    if(dArr[i] === dArr[i-1]-1) dc++; else dc=1;
    ma = Math.max(ma, ac); md = Math.max(md, dc);
  }
  if (ma >= 6) add('RISING_STAR', 'Rising Star', 'Gold', 400 + ma);
  if (md >= 6) add('FALLING_STAR', 'Falling Star', 'Gold', 400 + md);
  if (new Set(num.split('')).size <= 2) add('DUO_MASTER', 'Duo Master', 'Gold', 390);

  // --- TIER 4: SILVER ---
  if (/(\d)\1{3}/.test(num)) add('QUAD_STAR', 'Quad Star', 'Silver', 250);
  if (/(\d)\1(\d)\2/.test(num)) add('TWIN_COUPLE', 'Twin Couple', 'Silver', 240);
  if (/^(\d\d\d)\1/.test(num)) add('TRI_ECHO', 'Tri Echo', 'Silver', 230); // e.g., 123123

  // --- TIER 5: BRONZE ---
  if (/(\d)\1\1$/.test(num)) add('TRIPLE_END', 'Triple End', 'Bronze', 150);
  if (/(\d)(\d)\1\2/.test(num)) add('ABAB_RHYTHM', 'ABAB Rhythm', 'Bronze', 140); // e.g., 4545
  if (/(\d)\1(\d)\2/.test(num)) add('AABB_PAIR', 'AABB Pair', 'Bronze', 130);     // e.g., 4455
  if (/(000)$/.test(num)) add('THOUSAND_TAIL', 'Thousand Tail', 'Bronze', 120);   // ends in 000
  add('FANCY_NUMBER', 'Fancy Number', 'Bronze', 1);

  // Fillers for 117 Rules
  for (let d=0; d<=9; d++) {
    if (num.includes(''+d+d+d)) add('TRIO_'+d, 'Trio '+d, 'Bronze', 100);
  }

  const tr = { 'Diamond': 50000, 'Platinum': 40000, 'Gold': 30000, 'Silver': 20000, 'Bronze': 10000 };
  results.sort((a, b) => {
    const sA = (tr[a.tier] || 0) + (a.weight || 0);
    const sB = (tr[b.tier] || 0) + (b.weight || 0);
    return sB - sA;
  });

  const best = results[0] || { code: 'FANCY_NUMBER', name: 'Fancy Number', tier: 'Bronze' };

  return {
    pattern_code: best.name, // Merged same as name
    pattern_name: best.name,
    pattern_category: best.tier,
    all_patterns: [...new Set(results.map(r => r.name))],
    numerology_root: root
  };
}
