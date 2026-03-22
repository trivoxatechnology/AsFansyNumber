/**
 * Pattern Family: Special
 * Covers: 786, 00786, 000 (Triple Zero), 13, 108, 1008
 */

export const specialRules = [
  // 1. Holy 786
  {
    name: '786',
    priority: 97, 
    category_id: 3, // Changed from 1 to 3 (Gold)
    test: (s) => {
      if (s === '0000000786' || s.endsWith('000786')) return { sub: '000786', label: '000786 (Holy)' };
      if (s.endsWith('00786')) return { sub: '00786', label: '00786 (Holy)' };
      if (s.endsWith('0786')) return { sub: '0786', label: '0786 (Holy)' };
      if (s.endsWith('786')) return { sub: '786 End', label: '786 Holy (End)' };
      if (s.startsWith('786')) return { sub: '786 start', label: '786 Holy (Start)' };
      if (s.includes('786786')) return { sub: '786786', label: 'Double 786' };
      if (s.includes('786') && s.includes('13')) return { sub: '786+13', label: '786 + 13' };
      if (s.includes('786')) return { sub: '786 Middle', label: '786 Holy (Middle)' };
      return null;
    }
  },
  // 2. Lucky/Unlucky 13
  {
    name: '13',
    priority: 79,
    category_id: 4, // Changed from 3 to 4 (Silver)
    test: (s) => {
      if (s.endsWith('0000013')) return { sub: '0000013', label: '5 Zeros + 13' };
      if (s.endsWith('00013')) return { sub: '00013 / 000013', label: '3 Zeros + 13' };
      if (s.includes('131313')) return { sub: '3 times 13', label: '13 Triple' };
      if (s.endsWith('1313')) return { sub: '1313', label: '13 Double (End)' };
      if (s.startsWith('13000')) return { sub: '13000', label: '13 + 3 Zeros' };
      return null;
    }
  },
  // 3. Triple Zero (000)
  {
    name: '000',
    priority: 81,
    category_id: 4, // Changed from 4 to 4 (Silver) - wait 4 is correct
    test: (s) => {
      if (s.endsWith('000')) return { sub: 'End with 000', label: 'Triple Zero (Last)' };
      if (s.includes('000')) return { sub: '000 Middle', label: 'Triple Zero (Mid)' };
      return null;
    }
  },
  // 4. Special Numerology / Devotional
  {
    name: 'Numerology',
    priority: 60,
    category_id: 5,
    test: (s) => {
      if (s.endsWith('108')) return { sub: '108-1008', label: '108 Devotional' };
      if (s.endsWith('1008')) return { sub: '108-1008', label: '1008 Devotional' };
      return null;
    }
  }
];
