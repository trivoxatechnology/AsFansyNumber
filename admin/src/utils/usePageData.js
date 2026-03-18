import { useState, useEffect, useCallback, useRef } from 'react'
import { Cache } from './cache'

export function usePageData(fetchFn, cacheKey, pollMs = 60000) {
  const [data,        setData]        = useState(
    () => Cache.get(cacheKey)
  )
  const [loading,     setLoading]     = useState(
    !Cache.get(cacheKey)
  )
  const [showBanner,  setShowBanner]  = useState(false)
  const failCount  = useRef(0)
  const mounted    = useRef(true)

  const execute = useCallback(async () => {
    try {
      const result = await fetchFn()
      if (!mounted.current) return

      if (result !== null && result !== undefined) {
        setData(result)
        Cache.set(cacheKey, result)
        failCount.current = 0
        setShowBanner(false)
        setLoading(false)
      } else {
        failCount.current += 1
        if (failCount.current >= 3) setShowBanner(true)
        setLoading(false)
      }
    } catch (err) {
      if (!mounted.current) return
      failCount.current += 1
      if (failCount.current >= 3) setShowBanner(true)
      setLoading(false)
    }
  }, [fetchFn, cacheKey])

  const refresh = useCallback(() => {
    failCount.current = 0
    setShowBanner(false)
    setLoading(true)
    execute()
  }, [execute])

  useEffect(() => {
    mounted.current = true
    execute()
    const id = setInterval(execute, pollMs)
    return () => {
      mounted.current = false
      clearInterval(id)
    }
  }, [execute, pollMs])

  return { data, loading, showBanner, refresh }
}
