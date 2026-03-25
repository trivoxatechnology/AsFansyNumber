// Quick Pattern Detection Test
// Run: node admin/src/utils/test_pattern_quick.mjs

const testNumbers = [
  // Diamond
  { num: '9999999999', expect: { cat: 1, pattern: /Same/ } },
  { num: '9888888889', expect: { cat: 1, pattern: /Same/ } }, // Octa beats Symmetry
  { num: '1122334455', expect: { cat: 1, pattern: /5-Couple/ } },
  { num: '0000012345', expect: { cat: 1, pattern: /00000/ } },
  
  // Platinum
  { num: '9888885678', expect: { cat: 2, pattern: /Penta/ } },
  { num: '1234123499', expect: { cat: 2, pattern: /ABCD/ } }, // Correct ABCD-ABCD
  { num: '9876543210', expect: { cat: 2, pattern: /Ladder/ } },
  
  // Gold
  { num: '9876111123', expect: { cat: 3, pattern: /Tetra/ } },
  { num: '9876543786', expect: { cat: 3, pattern: /786/ } },
  
  // Silver
  { num: '9876543000', expect: { cat: 4, pattern: /Triple/ } },
  { num: '9876541313', expect: { cat: 4, pattern: /13/ } },
  
  // Bronze
  { num: '1512161212', expect: { cat: 5, pattern: /Double Couple/ } }, // No ladder overlap
  
  // Normal
  { num: '1592630487', expect: { cat: 6, pattern: /Regular/ } },
];

console.log('\\n=== Pattern Detection Test ===\\n');
let pass = 0, fail = 0;

// Inline minimal PHP-equivalent detection for testing
function detectFullPattern(num) {
  if (num.length !== 10) return { pattern_name: 'Regular Number', category_id: 6 };
  const d = num.split('');
  
  // Diamond
  if (/(.)\1{7}/.test(num)) return { pattern_name: '8 Digits Same', category_id: 1 };
  if (/(.)\1{6}/.test(num)) return { pattern_name: '7 Digits Same', category_id: 1 };
  if (/(.)\1{5}/.test(num)) {
    if (num.includes('000000')) return { pattern_name: 'Hexa Zeros', category_id: 1 };
    return { pattern_name: 'Hexa Number', category_id: 1 };
  }
  if (num.startsWith('00000')) return { pattern_name: '00000 + ' + num.slice(5), category_id: 1 };
  if (num === '0000000786' || num.endsWith('000786')) return { pattern_name: '000786 Sacred', category_id: 1 };
  const f5 = num.slice(0,5); const l5r = num.slice(5).split('').reverse().join('');
  if (f5 === l5r) return { pattern_name: '10 Digits Symmetry', category_id: 1 };
  const m8 = num.slice(1,9);
  if (m8.slice(0,4) === m8.slice(4).split('').reverse().join('')) return { pattern_name: '8 Digits Symmetry', category_id: 1 };
  if (d[0]===d[1]&&d[2]===d[3]&&d[4]===d[5]&&d[6]===d[7]&&d[8]===d[9])
    return { pattern_name: 'Full 5-Couple Sequence', category_id: 1 };
  const p1=num.slice(0,2),p2=num.slice(2,4);
  if(num.slice(4,6)===p1&&num.slice(6,8)===p2&&num.slice(8,10)===p1)
    return { pattern_name: 'AB-CD-AB-CD-AB', category_id: 1 };
  
  // Platinum
  if (/(.)\1{4}/.test(num)) {
    if (/(.)\1{4}$/.test(num)) return { pattern_name: 'Penta Last', category_id: 2 };
    return { pattern_name: 'Penta Number', category_id: 2 };
  }
  if (num.includes('786786')) return { pattern_name: 'Double 786', category_id: 2 };
  let isUp=true,isDn=true;
  for(let i=1;i<10;i++){
    if(parseInt(d[i])!==((parseInt(d[i-1])+1)%10))isUp=false;
    if(parseInt(d[i])!==((parseInt(d[i-1])-1+10)%10))isDn=false;
  }
  if(isUp) return { pattern_name: 'Full Ascending Ladder', category_id: 2 };
  if(isDn) return { pattern_name: 'Full Descending Ladder', category_id: 2 };
  if(num.slice(0,4)===num.slice(4,8)) return { pattern_name: 'Start ABCD-ABCD', category_id: 2 };
  if(num.slice(2,6)===num.slice(6,10)) return { pattern_name: 'Last ABCD-ABCD', category_id: 2 };
  if(num.slice(1,5)===num.slice(5,9)) return { pattern_name: 'Middle ABCD-ABCD', category_id: 2 };
  const l4d=num.slice(-4);
  if(l4d[0]===l4d[3]&&l4d[1]===l4d[2]) return { pattern_name: 'Semi Mirror', category_id: 2 };
  if(num.slice(0,3)===num.slice(3,6)) return { pattern_name: 'Start XYZ-XYZ', category_id: 2 };
  if(num.slice(4,7)===num.slice(7,10)) return { pattern_name: 'Last XYZ-XYZ', category_id: 2 };
  if(num.slice(2,5)===num.slice(5,8)) return { pattern_name: 'Middle XYZ-XYZ', category_id: 2 };
  
  // Gold
  if (/(.)\1{3}/.test(num)) {
    if (/(.)\1{3}$/.test(num)) return { pattern_name: 'Tetra Last', category_id: 3 };
    if (/^(.)\1{3}/.test(num)) return { pattern_name: 'Start Tetra', category_id: 3 };
    return { pattern_name: 'Tetra Number', category_id: 3 };
  }
  if(num.endsWith('786')) return { pattern_name: '786 Ending', category_id: 3 };
  if(num.startsWith('786')) return { pattern_name: '786 Starting', category_id: 3 };
  if(num.includes('786')) return { pattern_name: '786 Middle', category_id: 3 };
  const e6g=num.slice(-6);
  if(e6g[0]===e6g[1]&&e6g[2]===e6g[3]&&e6g[4]===e6g[5]&&e6g[0]!==e6g[2])
    return { pattern_name: 'Triple Doubling', category_id: 3 };
  if(new Set(d).size<=2) return { pattern_name: 'Duo Master', category_id: 3 };
  
  // Silver
  if (/(.)\1{2}/.test(num)) {
    if (/(.)\1{2}$/.test(num)) {
      if(num.endsWith('000')) return { pattern_name: 'Triple Zero (Last)', category_id: 4 };
      return { pattern_name: 'Triple Last', category_id: 4 };
    }
    if(num.includes('000')) return { pattern_name: 'Triple Zero (Mid)', category_id: 4 };
  }
  if(num.endsWith('1313')) return { pattern_name: '13 Double', category_id: 4 };
  let maxA=1,maxD2=1,a=1,dd=1;
  for(let i=1;i<10;i++){
    if(parseInt(d[i])===parseInt(d[i-1])+1){a++;maxA=Math.max(maxA,a);}else a=1;
    if(parseInt(d[i])===parseInt(d[i-1])-1){dd++;maxD2=Math.max(maxD2,dd);}else dd=1;
  }
  if(maxA>=4) return { pattern_name: maxA+'-Digit Sequential', category_id: 4 };
  if(maxD2>=4) return { pattern_name: maxD2+'-Digit Descending', category_id: 4 };
  if (/(.)\1{2}/.test(num)) return { pattern_name: 'Triple Number', category_id: 4 };
  
  // Bronze
  const l4b=num.slice(-4);
  if(l4b.slice(0,2)===l4b.slice(2,4)) return { pattern_name: 'Double Couple', category_id: 5 };
  
  return { pattern_name: 'Regular Number', category_id: 6 };
}

const catNames = { 1:'Diamond', 2:'Platinum', 3:'Gold', 4:'Silver', 5:'Bronze', 6:'Normal' };
let out = '\\n=== Pattern Detection Test ===\\n';

for (const t of testNumbers) {
  const result = detectFullPattern(t.num);
  const catOk = result.category_id === t.expect.cat;
  const patOk = t.expect.pattern.test(result.pattern_name);
  const ok = catOk && patOk;
  const icon = ok ? 'PASS' : 'FAIL';
  out += `${icon} ${t.num} -> ${catNames[result.category_id]} / ${result.pattern_name}${!ok ? ` (expected ${catNames[t.expect.cat]} with pattern ${t.expect.pattern})` : ''}\\n`;
  if (ok) pass++; else fail++;
}

out += `\\n${pass}/${pass+fail} tests passed${fail ? ` (${fail} failed)` : ' PASS'}\\n`;
import fs from 'fs';
fs.writeFileSync('test_out.txt', out);
