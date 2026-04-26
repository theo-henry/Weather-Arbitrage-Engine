import { useState, useEffect } from 'react';
import type { City, TimeWindow } from '@/lib/types';
import { fetchWeatherWindows } from '@/lib/weatherApi';

export function useWeatherData(city: City) {
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setIsLive(false);

      try {
        const data = await fetchWeatherWindows(city);
        if (!cancelled) {
          setWindows(data);
          setIsLive(true);
        }
      } catch (err) {
        if (!cancelled) {
          setWindows([]);
          setIsLive(false);
          setError(err instanceof Error ? err.message : 'Failed to fetch weather');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [city]);

  return { windows, loading, error, isLive };
}
