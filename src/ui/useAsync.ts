/**
 * Load something asynchronously with loading, error and retry. The loader is
 * re-run when `deps` change or `reload()` is called; a result that arrives
 * after unmount or after a newer request is discarded.
 */
import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

export type AsyncState<T> =
  | { status: 'loading'; data?: T }
  | { status: 'ready'; data: T }
  | { status: 'error'; error: unknown; data?: T }

export function useAsync<T>(loader: () => Promise<T>, deps: DependencyList = []): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [tick, setTick] = useState(0)
  const latest = useRef(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    const id = ++latest.current
    setState((prev) => ({ status: 'loading', data: prev.data }))
    loaderRef
      .current()
      .then((data) => {
        if (latest.current === id) setState({ status: 'ready', data })
      })
      .catch((error: unknown) => {
        if (latest.current === id) setState((prev) => ({ status: 'error', error, data: prev.data }))
      })
    return () => {
      // Invalidate so a late result from this run is ignored.
      if (latest.current === id) latest.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

export default useAsync
