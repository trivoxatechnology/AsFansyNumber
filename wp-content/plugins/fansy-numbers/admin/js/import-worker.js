importScripts('https://cdn.sheetjs.com/xlsx-latest/package/dist/xlsx.full.min.js');

self.onmessage = function(e) {
  const { fileData } = e.data;
  
  try {
    const workbook = XLSX.read(fileData, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

    const processedRows = rawData.map((row, index) => {
      // Normalize keys to expected DB columns where possible, or rely on exact template columns
      // We assume template exact match for this implementation based on spec
      let cleanRow = { ...row, _OriginalId: index + 1 };
      
      // Auto generate missing fields per spec rules
      cleanRow = autoGenerate(cleanRow);
      
      // Status & Validation check
      cleanRow._status = 'valid';
      cleanRow._errors = [];
      const mobile = String(cleanRow.mobile_number || '').trim();
      
      if (!mobile || mobile.length !== 10 || !/^[6-9]/.test(mobile)) {
        cleanRow._status = 'error';
        cleanRow._errors.push('Mobile number must be 10 digits starting with 6-9');
      }
      if (!cleanRow.base_price || isNaN(parseFloat(cleanRow.base_price)) || parseFloat(cleanRow.base_price) <= 0) {
        cleanRow._status = 'error';
        cleanRow._errors.push('Base price must be a number > 0');
      }
      
      return cleanRow;
    });

    self.postMessage({ success: true, rows: processedRows });
  } catch (err) {
    self.postMessage({ success: false, error: err.message });
  }
};

// Count occurrences of a digit in number
function countDigit(num, d) {
  return num.split('').filter(x=>x===String(d)).length;
}

// Check if substring exists in number
function has(num, sub) {
  return num.includes(sub);
}

// Count how many unique digits are in number
function uniqueDigits(num) {
  return new Set(num.split('')).size;
}

// Get digit frequency map
function digitFreq(num) {
  const f={};
  num.split('').forEach(x=>f[x]=(f[x]||0)+1);
  return f;
}

// Check if string is ascending sequence of length n
function isAscSeq(s) {
  if (s.length < 2) return false;
  for(let i=1;i<s.length;i++)
    if(parseInt(s[i])!==parseInt(s[i-1])+1) return false;
  return true;
}

// Check if string is descending sequence of length n
function isDescSeq(s) {
  if (s.length < 2) return false;
  for(let i=1;i<s.length;i++)
    if(parseInt(s[i])!==parseInt(s[i-1])-1) return false;
  return true;
}

// Check full mirror: first half === reverse of second half
function isMirror(num) {
  const h=Math.floor(num.length/2);
  const fh=num.substring(0,h);
  const sh=num.substring(num.length-h).split('').reverse().join('');
  return fh===sh;
}

// Check palindrome
function isPalin(num) {
  return num===num.split('').reverse().join('');
}

// Reduce digit_sum to single digit (numerology)
function reduceToSingle(n) {
  while(n>9) { n=String(n).split('').reduce((a,b)=>a+parseInt(b),0); }
  return n;
}

function autoGenerate(row) {
  const num = String(row.mobile_number || '').trim();
  if (!num) return row;
  const d   = num.split('').map(Number);
  const n   = d.length;
  const gen = {};

  // STEP A — EXTRACT BASIC FIELDS
  if (!row.prefix)       gen.prefix       = num.substring(0, 4);
  if (!row.suffix)       gen.suffix       = num.substring(n - 4);
  if (!row.digit_sum)    gen.digit_sum    = d.reduce((a,b)=>a+b,0);
  if (!row.repeat_count) {
    const freq = {};
    d.forEach(x => freq[x] = (freq[x]||0)+1);
    gen.repeat_count = Math.max(...Object.values(freq), 0);
  }

  // STEP B — DETECT category_type + sub_category
  if (!row.category_type && !row.sub_category) {
    let detectedType = null;
    let detectedSub = null;
    const maxRep = gen.repeat_count || row.repeat_count || 0;

    // Helper to set and short-circuit
    const setCat = (t, s) => { detectedType = t; detectedSub = s; return true; };

    // 1. Single Digit Repeating
    if (/^(.)\1+$/.test(num)) setCat('Single Digit Repeating', 'Full Repeating');
    else if (maxRep >= 8) setCat('Single Digit Repeating', 'Septa Octa');
    else if (maxRep >= 6 && maxRep < 8 && /(.)\1{5,}/.test(num) === false) setCat('Single Digit Repeating', 'Septa Octa Broken'); // Check gap
    
    // 2. Penta Numbers
    else if (num.endsWith('00000')) {
      if (/^(.)\1{4}$/.test(num.substring(0,5))) setCat('Penta Numbers', 'Penta Last');
      else if (num === '0000000001'.slice(-10)) setCat('Penta Numbers', '000001');
      else setCat('Penta Numbers', '00000 Last');
    } else if (num.match(/(.)\1{4}/)) {
      const pMatch = num.match(/(.)\1{4}/);
      const pPos = num.indexOf(pMatch[0]);
      if (pPos === 5) setCat('Penta Numbers', 'Penta Last');
      else if (pPos === 0) {
        const rem = num.length - 5;
        if (rem === 5) setCat('Penta Numbers', 'xxxxxABC / ABCD');
      }
      else if (pMatch[0] === '00000') {
        const after = num.substring(pPos + 5);
        if (after.length === 1) setCat('Penta Numbers', '00000X');
        else if (after.length === 2) setCat('Penta Numbers', '00000xy');
        else if (after.length === 3) setCat('Penta Numbers', '00000abc');
        else if (after.length === 4) setCat('Penta Numbers', '00000abcd');
        else setCat('Penta Numbers', '00000 Last');
      } else {
        const after = num.substring(pPos + 5);
        if (pPos === 0 && after.length === 5) setCat('Penta Numbers', 'xxxxxABC / ABCD');
        else if (after.length === 1) setCat('Penta Numbers', 'xxxxxA');
        else if (after.length === 2) setCat('Penta Numbers', 'xxxxxAB');
        else setCat('Penta Numbers', 'Penta Last'); // fallback
      }
    }
    
    // 3. Tetra Numbers
    else if (num.match(/(.)\1{3}/)) {
      const tMatch = num.match(/(.)\1{3}/);
      const tPos = num.indexOf(tMatch[0]);
      const isZero = tMatch[1] === '0';
      const tetraCount = (num.match(new RegExp(`(${tMatch[1]})\\1{3}`, 'g')) || []).length;
      
      if (isZero) {
        if (num.endsWith('0000')) setCat('Tetra Numbers', '0000 Last');
        else if (num.startsWith('0000')) {
          const rest = num.substring(4);
          if (rest.length === 1) setCat('Tetra Numbers', '0000x');
          else if (rest === '1') setCat('Tetra Numbers', '00001');
          else if (rest.length === 2) setCat('Tetra Numbers', '0000xy');
          else if (rest.length === 4) {
             if (isAscSeq(rest) || isDescSeq(rest)) setCat('Tetra Numbers', '0000abcd');
             else if (/(..)\1/.test(rest)) setCat('Tetra Numbers', '0000xyxy');
             else setCat('Tetra Numbers', '0000abcd');
          } else if (rest.length === 3) setCat('Tetra Numbers', '0000abc');
          else setCat('Tetra Numbers', 'Start Tetra');
        } else if (num.match(/0000/g)?.length === 2) {
           setCat('Tetra Numbers', '2 Times Tetra');
        } else {
           setCat('Tetra Numbers', '0000 Special');
        }
      } else {
        if (tPos === 6) setCat('Tetra Numbers', 'Tetra Last');
        else if (tPos === 0) {
          const rem = num.length - 4;
          if (rem === 1) setCat('Tetra Numbers', 'xxxxA');
          else if (rem === 2) setCat('Tetra Numbers', 'xxxxAB');
          else if (rem === 3) setCat('Tetra Numbers', 'xxxxABC');
          else if (rem === 6) setCat('Tetra Numbers', 'xxxxABCD');
          else setCat('Tetra Numbers', 'Start Tetra');
        } else if (tetraCount === 2) setCat('Tetra Numbers', '2 Times Tetra');
        else setCat('Tetra Numbers', 'Tetra Last Special');
      }
    }
    
    // 4. Hexa
    else if (/(.)\1{5}/.test(num)) {
      const hMatch = num.match(/(.)\1{5}/);
      const hPos = num.indexOf(hMatch[0]);
      const isZero = hMatch[1] === '0';
      if (isZero) {
        if (hPos === 4) setCat('Hexa', 'Hexa Zeros Last');
        else if (hPos === 2) setCat('Hexa', 'Hexa Zeros Middle');
        else setCat('Hexa', 'Broken Hexa Zeros');
      } else {
        if (hPos === 4) setCat('Hexa', 'Hexa Last');
        else if (hPos === 2) setCat('Hexa', 'Hexa Middle');
        else setCat('Hexa', 'Broken Hexa Digits');
      }
    }
    
    // 5. Mirror
    else if (isMirror(num) && isPalin(num)) setCat('Mirror', 'Mirror');
    else if (isPalin(num) && !isMirror(num)) setCat('Mirror', 'Ulta-Pulta');
    else if (num.substring(0,4) === num.substring(6).split('').reverse().join('')) {
      if (num.substring(4,6) === '00') setCat('Mirror', 'Semi Mirror with 00');
      else setCat('Mirror', 'Semi Mirror');
    }
    else if (num.substring(0,5) === num.substring(5).split('').reverse().join('')) {
      setCat('Mirror', '5 Digits Semi Mirror');
    }
    else if (num.substring(0,3) === num.substring(7).split('').reverse().join('')) {
      setCat('Mirror', '4 Digits Semi Mirror');
    }
    else if (num[0]===num[8] && num[1]===num[9] && num[2]===num[6] && num[3]===num[7]) {
      setCat('Mirror', 'Full Symmetry xy*xy');
    }
    
    // 6. 10 Digit Symmetry (fallback if perfect but not caught above)
    // 7. XYXYXY
    else if (/^(..)(\1){2}/.test(num)) setCat('XYXYXY', 'xyxyxy Start');
    else if (num.substring(4).match(/^(..)(\1){2}/)) setCat('XYXYXY', 'xyxyxy Last');
    else if (num.match(/(..).*?\1.*?\1/)) {
      if (/(..)\1\1/.test(num)) setCat('XYXYXY', 'xyxyxy Middle');
      else setCat('XYXYXY', '3 Times xy - broken');
    }
    
    // 8. xyzxyz
    else if (/^(...)(\1)/.test(num)) setCat('xyzxyz', 'xyzxyz Start');
    else if (num.substring(4).match(/^(...)(\1)/)) setCat('xyzxyz', 'xyzxyz Last');
    else if (num.match(/(...)(\1)/)) setCat('xyzxyz', 'xyzxyz Middle');
    else if (num.match(/(...).*?\1/)) setCat('xyzxyz', 'xyz*xyz');
    else if (num.match(/(...).*?\1.*?\1/)) setCat('xyzxyz', '3 Times xyz');
    
    // 9. abcd-abcd
    else if (/^(.{4})\1$/.test(num.substring(1,9))) setCat('abcd-abcd', 'X-abcd-abcd-Y');
    else if (/^(..)(..)(\1)(\2)/.test(num)) setCat('abcd-abcd', 'AB-CD-AB-CD-AB');
    else if (/^(.{4})\1/.test(num)) setCat('abcd-abcd', 'AbcdAbcd-xy');
    else if (num.substring(2).match(/^(.{4})\1/)) setCat('abcd-abcd', 'XY-abcd-abcd');
    else if (num.substring(0,4) === num.substring(6,10)) setCat('abcd-abcd', 'abcd-xy-abcd');
    else if (num.match(/(.{4}).*?\1/)) setCat('abcd-abcd', 'abcd*-abcd*');

    // 10. ABAB-XYXY
    else if (/(..)\1/.test(num.substring(0,4)) && /(..)\1/.test(num.substring(4,8))) setCat('ABAB-XYXY', 'abab-xyxy-**');
    else if (/(..)\1/.test(num.substring(2,6)) && /(..)\1/.test(num.substring(6,10))) setCat('ABAB-XYXY', '**-abab-xyxy');
    else if (/(..)\1/.test(num.substring(0,4)) && /(..)\1/.test(num.substring(6,10))) setCat('ABAB-XYXY', 'abab-**-xyxy');
    
    // 11. Doubling AABBCC
    else if ((num.match(/(.)\1/g) || []).length >= 3) {
      const matchDb = num.match(/(.)\1/g);
      if (matchDb.length >= 3) {
         if (/(.)\1(.)\2(.)\3/.test(num)) {
            if (num.endsWith(matchDb.slice(0,3).join(''))) setCat('Doubling AABBCC', 'xxxyyy Last');
            else if (num.startsWith(matchDb.slice(0,3).join(''))) setCat('Doubling AABBCC', 'xxxyyy Start');
            else setCat('Doubling AABBCC', 'xxxyyy Middle');
         } else setCat('Doubling AABBCC', '3 Times Tripling');
      } else {
         setCat('Doubling AABBCC', '2 Times Tripling');
      }
    }
    
    // 12. 786
    else if (num.includes('786786')) setCat('786', '786786');
    else if (num.match(/786.786/)) setCat('786', '786*786');
    else if (num.startsWith('786')) setCat('786', '786 Start');
    else if (num.endsWith('786')) setCat('786', '786 End');
    else if (num.startsWith('000786')) setCat('786', '000786');
    else if (num.startsWith('00786')) setCat('786', '00786');
    else if (num.startsWith('0786')) setCat('786', '0786');
    else if (num.includes('786') && num.includes('13')) setCat('786', '786+13');
    else if (num.includes('786') && num.includes('92')) setCat('786', '786+92');
    else if (num.includes('786')) setCat('786', '786 Middle');
    
    // 13. 13 Special
    else if (num.includes('0000013')) setCat('13 Special', '0000013');
    else if (num.includes('000013') || num.includes('00013')) setCat('13 Special', '00013 / 000013');
    else if (num.includes('01313')) setCat('13 Special', '01313');
    else if (num.startsWith('13000')) setCat('13 Special', '13000');
    else if (num.match(/13.*13.*13/)) setCat('13 Special', '3 times 13');
    else if (num.match(/13.13/)) setCat('13 Special', '13x13');
    else if (num.includes('1313')) setCat('13 Special', '1313');
    
    // 14. 00xy00 Pattern
    else if (num.match(/00([^0]{2})00/)) {
       if (num.match(/^.00.{2}00$/)) setCat('00xy00 Pattern', 'x00x00');
       else if (num.match(/00.{2}00.*xy$/)) setCat('00xy00 Pattern', '00xy00xy');
       else setCat('00xy00 Pattern', '00xy00');
    }
    
    // 15. xyxy Pattern
    else if (num.match(/(..)(\1)/)) {
      const xy = num.match(/(..)(\1)/)[1];
      const count = (num.match(new RegExp(xy, 'g')) || []).length;
      if (count >= 4) setCat('xyxy Pattern', '4 Times xy');
      else if (count >= 3) setCat('xyxy Pattern', '3 Times xy - broken');
      else if (num.endsWith(xy+xy+'00') || num.endsWith(xy+xy+'0')) setCat('xyxy Pattern', 'xyxy0 / 00');
      else if (new RegExp(`(${xy}).*(${xy})`).test(num.replace(xy+xy, ''))) setCat('xyxy Pattern', 'xy*xy');
      else setCat('xyxy Pattern', 'xyxy');
    }
    
    // 16. Ascending Descending
    else if ((() => {
      let maxUp=1, maxDn=1, curUp=1, curDn=1;
      for(let i=1;i<10;i++) {
        if(d[i]===d[i-1]+1) curUp++; else { maxUp=Math.max(maxUp,curUp); curUp=1; }
        if(d[i]===d[i-1]-1) curDn++; else { maxDn=Math.max(maxDn,curDn); curDn=1; }
      }
      maxUp=Math.max(maxUp,curUp); maxDn=Math.max(maxDn,curDn);
      const rl = Math.max(maxUp, maxDn);
      if (rl >= 9) return setCat('Ascending Descending', '8-9 Digit Ascending');
      if (rl >= 6) return setCat('Ascending Descending', '3 Digit AD 5D'); // Rough proxy
      if (rl >= 5) return setCat('Ascending Descending', 'One Digit Asc 5D');
      if (rl >= 4) return setCat('Ascending Descending', '4 Digit Ascending');
      
      const uniq = uniqueDigits(num);
      if (uniq === 2) return setCat('Ascending Descending', '2 Digit Numbers');
      if (uniq === 3) {
         if (num.includes('0')) return setCat('Ascending Descending', '3 Digits with 0');
         return setCat('Ascending Descending', '3 Digit Numbers');
      }
      return false;
    })()) {}
    
    // 17. 000 Series
    else if (num.endsWith('000')) setCat('000 Series', 'End with 000');
    else if (num.includes('000') && !num.startsWith('000') && !num.endsWith('000')) setCat('000 Series', '000 Middle');
    else if (num.endsWith('0001')) setCat('000 Series', '0001');
    else if (num.match(/000.$/)) setCat('000 Series', '000x');
    else if (num.match(/000.{2}$/)) setCat('000 Series', '000xy');
    else if (num.match(/000.{3}$/)) setCat('000 Series', '000xyz');
    else if (num.match(/00.{2}000/)) setCat('000 Series', '00xy000');
    else if (num.includes('13000')) setCat('000 Series', '13000');
    else if (num.match(/(.{4})000$/)) setCat('000 Series', 'xyxy000');
    else if (num.match(/(.)\1000$/)) setCat('000 Series', 'xx000');
    else if (num.match(/(.{2})000\1/)) setCat('000 Series', 'xy000xy');
    
    // 18. Numerology
    else if ((() => {
      const red = reduceToSingle(gen.digit_sum);
      if (num.includes('108') || num.includes('1008')) return setCat('Numerology Numbers', '108-1008');
      if (num.match(/302|307|751|720/)) return setCat('Numerology Numbers', 'Acts-302-307');
      if (num.match(/855|5911/)) return setCat('Numerology Numbers', 'Vehicle 855-5911');
      if (red > 0) return setCat('Numerology Numbers', 'Numerology ' + red);
      return false;
    })()) {}
    
    // 19. 5 Couples
    else if ((() => {
       const uniq = uniqueDigits(num);
       if (uniq === 2) {
         const cnts = Object.values(digitFreq(num)).sort((a,b)=>b-a);
         if (cnts[0]===5) return setCat('5 Couples', '5 Couples');
         if (cnts[0]===6) return setCat('5 Couples', '4 Couples');
         if (cnts[0]===7) return setCat('5 Couples', '3 Couples');
         if (cnts[0]===8) return setCat('5 Couples', '2 Couples');
       }
       return false;
    })()) {}
    
    // 20. Special Characters
    else if (num.match(/19[0-9]{2}|20[0-9]{2}/)) setCat('Special Characters', 'Years Words Etc');
    else if (num.match(/855|5911/)) setCat('Special Characters', 'Vehicle 855-5911');
    
    // 21. Normal Fancy
    else setCat('Normal Fancy', 'Normal Fancy Numbers');

    gen.category_type = detectedType;
    gen.sub_category  = detectedSub;
  }

  // Preserve existing logic where applicable
  const ct = gen.category_type || row.category_type || 'Normal Fancy';
  const sc = gen.sub_category  || row.sub_category  || 'Normal Fancy Numbers';

  // STEP C — DERIVE number_category
  if (!row.number_category) {
    const C_GRADE = {
      'Single Digit Repeating': 1, 'Mirror': 1, 'Hexa': 1, '10 Digit Symmetry': 1,
      'Penta Numbers': 2, 'XYXYXY': 2, 'Tetra Numbers': 2, 'xyzxyz': 2,
      'Doubling AABBCC': 3, 'ABAB-XYXY': 3, 'abcd-abcd': 3, '786': 3, 'Numerology Numbers': 3,
      'Ascending Descending': 4, '000 Series': 4, '13 Special': 4, '00xy00 Pattern': 4, 'xyxy Pattern': 4,
      'Minimum Digit': 5, '5 Couples': 5, 'Special Characters': 5,
      'Normal Fancy': 6
    };
    gen.number_category = C_GRADE[ct] || 6;
  }

  // STEP D — DERIVE pattern_name
  if (!row.pattern_name) {
    const pNames = {
      'Mirror|Mirror': 'Mirror Number',
      'Mirror|Ulta-Pulta': 'Ulta Pulta Mirror',
      'Mirror|Semi Mirror': 'Semi Mirror Number',
      'Mirror|Full Symmetry xy*xy': 'Full Symmetry',
      'Single Digit Repeating|Full Repeating': 'All Same Digits VIP',
      'Single Digit Repeating|Septa Octa': '7-8 Same Digits VIP',
      '786|786 End': '786 Lucky End',
      '786|786786': 'Full 786 Lucky',
      'Numerology Numbers|Numerology 7': 'Numerology No. 7',
      'Numerology Numbers|Numerology 9': 'Numerology No. 9',
      'Normal Fancy|Normal Fancy Numbers': 'Regular Number'
    };
    gen.pattern_name = pNames[ct+'|'+sc] || sc;
  }

  // STEP E — SET pattern_type
  if (!row.pattern_type) {
    gen.pattern_type = ct;
  }

  // STEP F — CALCULATE vip_score
  if (!row.vip_score) {
    const grade = parseInt(gen.number_category || row.number_category || 6);
    const ds = parseInt(gen.digit_sum || row.digit_sum || 0);
    const rc = parseInt(gen.repeat_count || row.repeat_count || 0);
    const sx = String(gen.suffix || row.suffix || '');
    
    let score = 10;
    const gmap = {1:35, 2:25, 3:15, 4:10, 5:5};
    score += gmap[grade] || 0;
    
    if (rc >= 4) score += 10;
    if (ds >= 1 && ds <= 9) score += 5;
    if (ds === 7 || ds === 9) score += 5;
    if (/^(.)\1+$/.test(sx)) score += 5;
    
    const seqs = ['0123','1234','2345','3456','4567','5678','6789','9876','8765','7654','6543','5432','4321','3210'];
    if (seqs.includes(sx)) score += 5;
    
    gen.vip_score = String(Math.min(score, 100));
  }

  // STEP G — SET auto_detected
  gen.auto_detected = Object.keys(gen).length > 0 ? 1 : 0;
  
  // Tag keys
  row._autogen_keys = Object.keys(gen);
  
  return { ...row, ...gen };
}
