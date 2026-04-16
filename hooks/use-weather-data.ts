import { useState, useEffect } from 'react';
import type { City, TimeWindow } from '@/lib/types';
import { fetchWeatherWindows } from '@/lib/weatherApi';
import { getWindows } from '@/lib/mockData';

export function useWeatherData(city: City) {
  const [windows, setWindows] = useState<TimeWindow[]>(() => getWindows(city));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchWeatherWindows(city);
        if (!cancelled) {
          setWindows(data);
          setIsLive(true);
        }
      } catch (err) {
        if (!cancelled) {
          // Fall back to mock data on error
          console.warn('Falling back to mock data:', err);
          setWindows(getWindows(city));
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
