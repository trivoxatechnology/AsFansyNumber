import { useState, useEffect, useMemo } from 'react';

const API_BASE = 'https://asfancynumber.com/fancy_number/api.php';

export function useFancyNumbers() {
  const [numbers, setNumbers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // Filters State
  const [filters, setFilters] = useState({
    query: '',
    categoryId: '',
    digitSum: '',
    maxPrice: 500000,
    sortOrder: 'default'
  });

  useEffect(() => {
    let isMounted = true;
    async function fetchData(background = false) {
      if (!background) setLoading(true);
      else setIsRefreshing(true);
      if (!background) setError(null);
      
      try {
        const [numRes, catRes] = await Promise.all([
          fetch(`${API_BASE}/wp_fn_numbers?limit=10000`), // Increased from 100 to sync all
          fetch(`${API_BASE}/wp_fn_number_categories`)
        ]);

        if (!numRes.ok || !catRes.ok) {
          throw new Error('Failed to fetch data from API');
        }

        let numsData = await numRes.json();
        const catsData = await catRes.json();

        // Automatically expire old offers
        const now = new Date();
        numsData = numsData.map(n => {
          if (n.offer_end_date && new Date(n.offer_end_date) < now) {
            return { ...n, offer_price: null, discount_percentage: null };
          }
          return n;
        });

        if (isMounted) {
          setNumbers(numsData);
          setCategories(catsData);
        }
      } catch (err) {
        console.error(err);
        if (!background && isMounted) setError('Failed to load VIP numbers. Please try again later.');
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
    let result = [...numbers];

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
          // E.g. 5 consequence digits
          result = result.filter(n => Number(n.repeat_count) >= 4);
        } else if (patternType === 'SEQUENTIAL') {
          result = result.filter(n => {
            const str = String(n.mobile_number);
            // Very simple sequential check like 12345
            return str.includes('12345') || str.includes('54321') || str.includes('67890') || str.includes('09876');
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

    if (filters.categoryId) {
      result = result.filter(n => String(n.number_category) === String(filters.categoryId));
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
  }, [numbers, filters]);

  const resetFilters = () => {
    setFilters({
      query: '',
      categoryId: '',
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
    categories,
    loading,
    isRefreshing,
    error,
    filters,
    updateFilter,
    resetFilters
  };
}
