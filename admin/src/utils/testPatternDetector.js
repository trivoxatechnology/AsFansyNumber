import { detectPattern } from './patternDetector.js';

const testCases = [
  { num: '9999999999', expectedCode: 'PURE_DIGIT', expectedTier: 'Diamond' },
  { num: '1234554321', expectedCode: 'PERFECT_MIRROR', expectedTier: 'Diamond' },
  { num: '9876786786', expectedCode: 'DOUBLE_SACRED', expectedTier: 'Diamond' },
  { num: '9988776655', expectedCode: 'FIVE_STAR_COUPLE', expectedTier: 'Diamond' },
  { num: '9999912345', expectedCode: 'PENTA_STAR', expectedTier: 'Platinum' },
  { num: '9876543210', expectedCode: 'FALLING_STAR', expectedTier: 'Gold' },
  { num: '9876540786', expectedCode: 'SACRED_ENDING', expectedTier: 'Gold' },
  { num: '9900990099', expectedCode: 'ROYAL_SEQUENCE', expectedTier: 'Diamond' },
  { num: '9900001313', expectedCode: 'LUCKY_13_DOUBLE', expectedTier: 'Platinum' },
  { num: '9800000001', expectedCode: 'PENTA_ZERO_SINGLE', expectedTier: 'Diamond' },
];

import fs from 'fs';

const resultsLog = [];
const log = (msg) => { console.log(msg); resultsLog.push(msg); };

log('--- PATTERN DETECTOR TEST SUITE ---');
global.DEBUG_PATTERNS = true;
const oldLog = console.log;
console.log = (...args) => { oldLog(...args); resultsLog.push(args.join(' ')); };

let passedCount = 0;

testCases.forEach(({ num, expectedCode, expectedTier }) => {
  const res = detectPattern(num);
  const passed = res.pattern_code === expectedCode && res.pattern_category === expectedTier;
  if (passed) {
    passedCount++;
    log(`✅ ${num}: ${res.pattern_code}`);
  } else {
    log(`❌ ${num}: Got ${res.pattern_code} (${res.pattern_category}), Expected ${expectedCode} (${expectedTier})`);
    log(`   Patterns: ${res.all_patterns.join(', ')}`);
  }
});

log(`\nResults: ${passedCount}/${testCases.length} tests passed.`);
fs.writeFileSync('./full_test_results.txt', resultsLog.join('\n'));
if (passedCount === testCases.length) {
    log('ALL TESTS PASSED SUCCESSFULLY! 🚀');
} else {
    process.exit(1);
}
