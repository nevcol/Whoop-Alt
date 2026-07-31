import { useCallback, useEffect, useState } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs an async loader, re-running whenever `deps` change. */
export function useAsync<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    run()
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message ?? 'Something went wrong'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [run, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}
