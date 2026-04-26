import { useState, useEffect } from 'react';
import type { City, TimeWindow } from '@/lib/types';
import { fetchWeatherWindowsResult, type WeatherDataSource } from '@/lib/weatherApi';

export function useWeatherData(city: City) {
  const [windows, setWindows] = useState<TimeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [source, setSource] = useState<WeatherDataSource | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      setIsLive(false);
      setSource(null);
      setSnapshotAt(null);

      try {
        const data = await fetchWeatherWindowsResult(city);
        if (!cancelled) {
          setWindows(data.windows);
          setSource(data.source);
          setSnapshotAt(data.snapshotAt ?? null);
          setIsLive(data.source === 'live');
        }
      } catch (err) {
        if (!cancelled) {
          setWindows([]);
          setIsLive(false);
          setSource(null);
          setSnapshotAt(null);
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

  return { windows, loading, error, isLive, source, snapshotAt };
}
