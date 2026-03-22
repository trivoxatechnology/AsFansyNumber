import { useState, useEffect } from 'react';
import {
  getHomepageRows,
  getStats,
  getFeatured,
  getCategories,
  getPatterns,
} from '../api/client';

export function useHomepage(limitPerRow = 12) {
  const [rows,       setRows]       = useState(null);
  const [stats,      setStats]      = useState(null);
  const [featured,   setFeatured]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [patterns,   setPatterns]   = useState({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getHomepageRows(limitPerRow),
      getStats(),
      getFeatured(),
      getCategories(),
      getPatterns(),
    ])
    .then(([r, s, f, c, p]) => {
      setRows(r);
      setStats(s.stats);
      setFeatured(f.data       || []);
      setCategories(c.categories || []);
      setPatterns(p.patterns   || {});
    })
    .catch(err => setError(err.message))
    .finally(() => setLoading(false));
  }, []);

  return {
    rows, stats, featured,
    categories, patterns,
    loading, error
  };
}
