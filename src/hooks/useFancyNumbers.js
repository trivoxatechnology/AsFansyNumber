import { useState, useEffect, useMemo } from 'react';

const API_BASE = 'https://asfancynumber.com/fancy_number/api.php';

export function useFancyNumbers() {
  const [rawNumbers, setRawNumbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters State
  const [filters, setFilters] = useState({
    query: '',
    category: '',
    pattern_type: '',
    digitSum: '',
    maxPrice: 500000,
    sortOrder: 'default'
  });

  useEffect(() => {
    let isMounted = true;
    const ctrl = new AbortController();
    const opts = { signal: ctrl.signal };
    async function fetchData(background = false) {
      if (!background) setLoading(true);
      else setIsRefreshing(true);
      if (!background) setError(null);
      
      try {
        const numRes = await fetch(`${API_BASE}/wp_fn_numbers?limit=10000`, opts);

        if (!numRes.ok) {
          throw new Error('Failed to fetch data from API');
        }

        let numsData = await numRes.json();

<<<<<<< HEAD
        // Filter out draft/hidden numbers and expire old offers
=======
        // Handle both plain array and {data, total} API response formats
        if (!Array.isArray(numsData)) numsData = numsData?.data || [];

        // Automatically expire old offers, and filter out draft/hidden numbers
>>>>>>> b50d41b75f2cbb11c534bbd4982aade437c85e7f
        const now = new Date();
        numsData = numsData.filter(n => n.visibility_status !== '0' && n.visibility_status !== 0).map(n => {
          if (n.offer_end_date && new Date(n.offer_end_date) < now) {
            return { ...n, offer_price: null };
          }
          return n;
        });

        if (isMounted) {
          setRawNumbers(numsData);
        }
      } catch (err) {
        if (err?.name !== 'AbortError') {
          console.error(err);
          if (!background && isMounted) setError('Failed to load VIP numbers. Please try again later.');
        }
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
      ctrl.abort();
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
        const cat = String(n.number_category || '5');
        return cat === String(filters.category);
      });
    }

    if (filters.pattern_type) {
      result = result.filter(n => String(n.pattern_type) === String(filters.pattern_type));
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
      pattern_type: '',
      digitSum: '',
      maxPrice: 500000,
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
