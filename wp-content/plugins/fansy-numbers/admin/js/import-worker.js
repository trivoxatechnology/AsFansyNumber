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

function autoGenerate(row) {
  const num    = String(row.mobile_number || '').trim();
  if (!num) return row; // Cannot generate without mobile number

  const digits = num.split('').map(Number);
  const gen    = {};

  if (!row.prefix)       gen.prefix       = num.substring(0, 4);
  if (!row.suffix)       gen.suffix       = num.substring(num.length - 4);
  if (!row.digit_sum)    gen.digit_sum    = digits.reduce((a,b)=>a+b,0);
  if (!row.repeat_count && !isNaN(digits[0])) { // ensure valid digits
    const freq = {};
    digits.forEach(d => freq[d] = (freq[d]||0)+1);
    gen.repeat_count = Math.max(...Object.values(freq));
  }

  if (!row.pattern_type) {
    const d     = digits;
    const half  = Math.floor(d.length/2);
    const fh    = d.slice(0,half);
    const sh    = d.slice(d.length-half).reverse();
    const isMirror  = fh.every((v,i)=>v===sh[i]);
    const isPalin   = num === [...num].reverse().join('');
    
    // Safety check for ladder up/down to ensure it doesn't break on non-number strings
    const isLadUp   = d.length > 0 && d.every((v,i)=>i===0||v===d[i-1]+1);
    const isLadDn   = d.length > 0 && d.every((v,i)=>i===0||v===d[i-1]-1);
    
    const isRepeat  = /(.)\1{2,}/.test(num);
    const isDblPair = /(.)\1(.)\2/.test(num);
    const isTriple  = /(.)\1\1/.test(num);
    const isSeq     = (()=>{
      let u=0,dn=0;
      for(let i=1;i<d.length;i++){
        if(d[i]===d[i-1]+1)u++; else u=0;
        if(d[i]===d[i-1]-1)dn++; else dn=0;
        if(u>=3||dn>=3)return true;
      }
      return false;
    })();

    if      (isMirror)  gen.pattern_type='Mirror';
    else if (isPalin)   gen.pattern_type='Palindrome';
    else if (isLadUp)   gen.pattern_type='Ladder Up';
    else if (isLadDn)   gen.pattern_type='Ladder Down';
    else if (isRepeat)  gen.pattern_type='Repeating';
    else if (isDblPair) gen.pattern_type='Double Pair';
    else if (isTriple)  gen.pattern_type='Triple';
    else if (isSeq)     gen.pattern_type='Sequential';
    else                gen.pattern_type='Normal';
  }

  if (!row.pattern_name) {
    const map = {
      'Mirror':'Mirror Number','Palindrome':'Palindrome Number',
      'Ladder Up':'Ladder Series','Ladder Down':'Descending Ladder',
      'Repeating':'Repeating Fancy','Double Pair':'Double Pair Fancy',
      'Triple':'Triple Digit','Sequential':'Sequential Number',
      'Normal':'Regular Number'
    };
    gen.pattern_name = map[gen.pattern_type||row.pattern_type]||'Regular Number';
  }

  if (!row.vip_score) {
    const pt    = gen.pattern_type||row.pattern_type||'Normal';
    const ds    = Number(gen.digit_sum||row.digit_sum||0);
    const rc    = Number(gen.repeat_count||row.repeat_count||0);
    const sx    = gen.suffix||row.suffix||'';
    let score   = 10;

    if (['Mirror','Palindrome'].includes(pt))         score+=25;
    else if (pt==='Repeating')                        score+=20;
    else if (['Ladder Up','Ladder Down'].includes(pt))score+=15;
    else if (['Double Pair','Triple'].includes(pt))   score+=10;
    else if (pt==='Sequential')                       score+=5;

    if (rc>=4)                                        score+=10;
    if (ds>=1&&ds<=9)                                 score+=5;
    if (ds===7||ds===9)                               score+=5;
    if (/^(.)\1+$/.test(sx))                          score+=5;
    if (/^(?:0123|1234|2345|3456|4567|5678|6789|9876|8765|7654|6543|5432|4321|3210)/.test(sx)) score+=5;

    gen.vip_score = String(Math.min(score,100));
  }

  if (!row.number_category) {
    const s = parseInt(gen.vip_score||row.vip_score||'0');
    gen.number_category = s>=80?1:s>=50?2:s>=25?3:4;
  }

  gen.auto_detected = Object.keys(gen).length > 0 ? 1 : 0;
  
  // Tag which fields were exactly auto-generated for UI highlighting
  row._autogen_keys = Object.keys(gen);
  
  return {...row, ...gen};
}
