import { useState, useEffect, useRef } from 'react';
import { getNumbers } from '../api/client';

export function useNumbers(filters = {}, deps = []) {
  const [data,    setData]    = useState([]);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const cache = useRef({});

  useEffect(() => {
    const key = JSON.stringify(filters);

    // Return cached result instantly if available
    if (cache.current[key]) {
      setData(cache.current[key].data);
      setTotal(cache.current[key].total);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    getNumbers(filters)
      .then(res => {
        cache.current[key] = res;
        setData(res.data  || []);
        setTotal(res.total || 0);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, deps);

  return { data, total, loading, error };
}
