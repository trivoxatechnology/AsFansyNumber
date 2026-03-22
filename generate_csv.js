import fs from 'fs';

const PATTERNS = {
  1: ['Mirror', 'XYXYXY'],
  2: ['786', 'Sequential', 'XYXYXY', 'Mirror'],
  3: ['Repeating', 'Mirror', '786'],
  4: ['Numerology', 'ABAB-XYXY', 'Mirror'],
  5: ['Mirror', 'Repeating'],
  6: ['Normal']
};

const rows = [];
const header = 'mobile_number,base_price,offer_price,number_status,category,pattern_type,remarks\n';

function randRange(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// Categories 1 to 6 (500 each)
for (let cat = 1; cat <= 6; cat++) {
  const patternsForCat = PATTERNS[cat];
  for (let pIdx = 0; pIdx < patternsForCat.length; pIdx++) {
    const pattern = patternsForCat[pIdx];
    const target = Math.ceil(500 / patternsForCat.length);
    for (let i = 0; i < target; i++) {
       const mobile = String(randRange(6000000000, 9999999999));
       const bp = randRange(100, 500) * 1000;
       const op = bp - randRange(10, 50) * 1000;
       rows.push(`${mobile},${bp},${op},available,${cat},${pattern},Test Data Cat ${cat}`);
    }
  }
}

// Category 7: Couple (100)
for (let i=0; i<100; i++) {
  const mobile = String(randRange(6000000000, 9999999999));
  const bp = randRange(50, 150) * 1000;
  const op = bp - randRange(5, 15) * 1000;
  rows.push(`${mobile},${bp},${op},available,7,Couple,Matching Pair Data`);
}

// Category 8: Business (500)
for (let i=0; i<500; i++) {
  const mobile = String(randRange(6000000000, 9999999999));
  const bp = randRange(200, 800) * 1000;
  const op = bp - randRange(20, 80) * 1000;
  rows.push(`${mobile},${bp},${op},available,8,Business,Corporate Block Data`);
}

const outputPath = 'C:/Users/dk637/OneDrive/Desktop/fansi_massive_test_data.csv';
fs.writeFileSync(outputPath, header + rows.join('\n'));
console.log('Saved to Desktop as fansi_massive_test_data.csv. Total rows:', rows.length);
