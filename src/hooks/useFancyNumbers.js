import { useState, useEffect, useMemo } from 'react';
import { getNumbers, getGroupsList, getCouples, getGroups } from '../api/client';
import { classifyNumber } from '../utils/PatternEngine';

export function useFancyNumbers() {
  const [rawNumbers, setRawNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters State
  const [filters, setFilters] = useState({
    query: '',
    category: '',
    pattern_name: '',
    digitSum: '',
    maxPrice: 10000000,
    sortOrder: 'default'
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchData(background = false) {
      if (!background) setLoading(true);
      else setIsRefreshing(true);
      if (!background) setError(null);
      
      try {
        const [res, couplesRes, groupsRes] = await Promise.all([
          getNumbers({ limit: 2000 }),
          getCouples().catch(() => []),
          getGroups().catch(() => [])
        ]);
        
        const soloNumbers = res.data || [];
        
        // Process Couple Bundles
        const coupleBundles = (Array.isArray(couplesRes) ? couplesRes : []).map(c => ({
          ...c,
          is_bundle: true,
          bundle_type: 'couple',
          number_category: '7',
          base_price: c.couple_price,
          offer_price: c.couple_offer_price,
          mobile_number: `${c.number_1} & ${c.number_2}`
        }));

        // Process Group Bundles
        const groupMap = {};
        (Array.isArray(groupsRes) ? groupsRes : []).forEach(g => {
          if (!groupMap[g.group_id]) {
            groupMap[g.group_id] = {
              ...g,
              is_bundle: true,
              bundle_type: 'group',
              number_category: '8',
              base_price: g.group_price,
              offer_price: g.group_offer_price,
              numbers: [],
              mobile_number: ''
            };
          }
          groupMap[g.group_id].numbers.push(g);
          groupMap[g.group_id].mobile_number += (groupMap[g.group_id].mobile_number ? ' & ' : '') + g.mobile_number;
        });
        const groupBundles = Object.values(groupMap);
        
        // Track IDs that are already represented in a bundle to avoid duplicates
        const bundledIds = new Set();
        coupleBundles.forEach(c => { bundledIds.add(c.number_id_1); bundledIds.add(c.number_id_2); });
        groupBundles.forEach(g => g.numbers.forEach(n => bundledIds.add(n.number_id)));

        // Filter solo numbers to remove those that are already in an active bundle
        const finalSolo = soloNumbers.filter(n => !bundledIds.has(n.number_id));

        const now = new Date();
        const processedSolo = finalSolo.map(n => {
          const classification = classifyNumber(n.mobile_number);
          
          const resolveCat = () => {
             const cid = String(n.number_category || n.category || '6');
             if (cid === '7' || cid === '8') return cid;
             const bt = String(n.bundle_type || '').toLowerCase();
             if (bt.includes('couple') || n.couple_id) return '7';
             if (bt.includes('group') || bt.includes('business') || n.group_id) return '8';
             
             // If the backend has explicitly assigned a premium grade (1 through 5), RESPECT IT.
             if (['1', '2', '3', '4', '5'].includes(cid)) return cid;
             
             // If it's Normal (6) or empty, let the detection engine auto-upgrade it if possible.
             return String(classification.number_category || '6');
          };

          const finalCat = resolveCat();

          // Merge safely: Backend explicit values > Automatic Classification
          const finalNum = {
            ...n,
            ...classification,
            
            // Re-apply explicit manual overrides from DB
            pattern_name: (n.pattern_name && n.pattern_name !== 'Regular Number' && typeof n.pattern_name === 'string') ? n.pattern_name : classification.pattern_name,
            
            number_category: finalCat
          };

          if (n.offer_end_date && new Date(n.offer_end_date) < now) {
            finalNum.offer_price = null;
          }
          return finalNum;
        });

        const allItems = [...processedSolo, ...coupleBundles, ...groupBundles];

        if (isMounted) {
          setRawNumbers(allItems);
        }
      } catch (err) {
        console.error('API Error:', err);
        if (isMounted) setError('Failed to load numbers.');
      } finally {
        if (isMounted) {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    }

    fetchData();

    // Auto-refresh polling every 30 seconds
    const interval = setInterval(() => {
      fetchData(true);
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const sumDigits = (numStr) => {
    if (!numStr) return 0;
    return numStr.toString().split('').reduce((acc, digit) => acc + parseInt(digit || 0), 0);
  };

  const filteredNumbers = useMemo(() => {
    let result = [...rawNumbers];

    if (filters.query) {
      const q = String(filters.query).toUpperCase();
      
      // Handle the specialized Quick Pattern Buttons
      if (q.startsWith('PATTERN:')) {
        const patternType = q.split(':')[1];
        if (patternType === 'MIRROR') {
          result = result.filter(n => {
            const str = String(n.mobile_number);
            return str === str.split('').reverse().join('');
          });
        } else if (patternType === 'REPEATING') {
          // Use enhanced pattern detection
          result = result.filter(n => {
            const m = String(n.mobile_number).replace(/\D/g,'');
            let maxRun=1,run=1;
            for(let i=1;i<m.length;i++){if(m[i]===m[i-1])run++;else run=1;maxRun=Math.max(maxRun,run);}
            return maxRun >= 4;
          });
        } else if (patternType === 'SEQUENTIAL') {
          // Enhanced sequential detection
          result = result.filter(n => {
            const m = String(n.mobile_number).replace(/\D/g,'');
            if (m.length !== 10) return false;
            
            let asc=true,dsc=true;
            for(let i=1;i<m.length;i++){
              const current = parseInt(m[i]);
              const prev = parseInt(m[i-1]);
              if(current !== prev + 1) asc=false;
              if(current !== prev - 1) dsc=false;
            }
            // Special case: 1234567890
            if(m === '1234567890'){ asc=true; dsc=false; }
            
            return asc || dsc;
          });
        } else if (patternType === 'ABAB') {
          // ABAB pattern detection
          result = result.filter(n => {
            const m = String(n.mobile_number).replace(/\D/g,'');
            if (m.length !== 10) return false;
            
            const half=m.slice(0,5);
            let abab=true;
            for(let i=0;i<10;i++){
              if(m[i]!==half[i%5]){abab=false;break;}
            }
            return abab;
          });
        }
      } else if (q.includes('*')) {
        // Handle User Wildcard Searching (e.g. *786* or ****9999)
        // Convert the * into a Regex wildcard (.*)
        const regexPattern = new RegExp('^' + q.replace(/\*/g, '.*') + '$', 'i');
        result = result.filter(n => regexPattern.test(String(n.mobile_number)));
      } else {
        // Default standard inclusion
        result = result.filter(n => n.mobile_number && String(n.mobile_number).includes(q));
      }
    }

    if (filters.category) {
      result = result.filter(n => {
        const cid = String(n.number_category || n.category || '6');
        if (cid === String(filters.category)) return true;
        
        // Check bundle/type if filtering for Couple (7) or Business (8)
        if (filters.category === '7') {
          return String(n.bundle_type).toLowerCase().includes('couple') || !!n.couple_id || String(n.pattern_name).toLowerCase().includes('couple');
        }
        if (filters.category === '8') {
          return String(n.bundle_type).toLowerCase().includes('group') || String(n.bundle_type).toLowerCase().includes('business') || !!n.group_id || String(n.pattern_name).toLowerCase().includes('business');
        }
        
        return false;
      });
    }

    if (filters.pattern_name) {
      const pt = String(filters.pattern_name);
      result = result.filter(n => {
        // Match against pattern_name for direct mapping
        return String(n.pattern_name) === pt;
      });
    }

    if (filters.digitSum) {
      result = result.filter(n => {
        const sum = n.digit_sum || sumDigits(n.mobile_number);
        return String(sum) === String(filters.digitSum);
      });
    }

    if (filters.maxPrice) {
      result = result.filter(n => {
        const effectivePrice = n.offer_price && parseFloat(n.offer_price) > 0 ? parseFloat(n.offer_price) : parseFloat(n.base_price || 0);
        return effectivePrice <= filters.maxPrice;
      });
    }

    if (filters.sortOrder === 'price_asc') {
      result.sort((a, b) => {
        const p1 = a.offer_price ? parseFloat(a.offer_price) : parseFloat(a.base_price || 0);
        const p2 = b.offer_price ? parseFloat(b.offer_price) : parseFloat(b.base_price || 0);
        return p1 - p2;
      });
    } else if (filters.sortOrder === 'price_desc') {
      result.sort((a, b) => {
        const p1 = a.offer_price ? parseFloat(a.offer_price) : parseFloat(a.base_price || 0);
        const p2 = b.offer_price ? parseFloat(b.offer_price) : parseFloat(b.base_price || 0);
        return p2 - p1;
      });
    } else {
      // Default Sort: Priority Rank highest first, then Featured, then random/ID
      result.sort((a, b) => {
        const rankA = parseInt(a.priority_rank || 0);
        const rankB = parseInt(b.priority_rank || 0);
        return rankB - rankA;
      });
    }

    return result;
  }, [rawNumbers, filters]);

  const resetFilters = () => {
    setFilters({
      query: '',
      category: '',
      pattern_name: '',
      digitSum: '',
      maxPrice: 10000000,
      sortOrder: 'default'
    });
  };

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return {
    numbers: filteredNumbers,
    allNumbers: rawNumbers,
    loading,
    isRefreshing,
    error,
    filters,
    updateFilter,
    resetFilters
  };
}
