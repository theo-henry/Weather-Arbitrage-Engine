import { createClient } from '@supabase/supabase-js';
import { getSupabasePublicEnv } from './supabase/public-config';

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Madrid: { lat: 40.4168, lng: -3.7038 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Valencia: { lat: 39.4699, lng: -0.3763 },
  Seville: { lat: 37.3891, lng: -5.9845 },
};

interface NominatimResult {
  lat?: string;
  lon?: string;
}

export interface GoogleWeatherPayload {
  current: unknown;
  forecast: Record<string, unknown>;
  source?: 'live' | 'snapshot';
  snapshotAt?: string;
}

export class GoogleWeatherError extends Error {
  status: number;
  details?: string;

  constructor(message: string, status = 500, details?: string) {
    super(message);
    this.name = 'GoogleWeatherError';
    this.status = status;
    this.details = details;
  }
}

type CachedEntry = { expiresAt: number; payload: GoogleWeatherPayload };
type SnapshotEntry = { fetchedAt: string; payload: GoogleWeatherPayload };
const cache = new Map<string, CachedEntry>();
const snapshots = new Map<string, SnapshotEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
const GOOGLE_FETCH_REVALIDATE_SECONDS = 60 * 60;
const FORECAST_HOURS = 48;
const resolvedCityCoords = new Map<string, { lat: number; lng: number }>();

function normalizeEnvValue(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

function getGoogleWeatherApiKey() {
  const apiKey = normalizeEnvValue(process.env.GOOGLE_WEATHER_API_KEY);
  if (!apiKey) {
    throw new GoogleWeatherError(
      'Google Weather API key is not configured for this deployment',
      500,
    );
  }

  return apiKey;
}

function getSnapshotKey(city: string) {
  return city.trim().toLowerCase();
}

function getSnapshotPayload(payload: GoogleWeatherPayload): GoogleWeatherPayload {
  return {
    current: payload.current,
    forecast: payload.forecast,
  };
}

function getSnapshotStoreClient() {
  const env = getSupabasePublicEnv();
  const serviceRoleKey = normalizeEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!env || !serviceRoleKey) return null;

  return createClient(env.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function saveWeatherSnapshot(city: string, payload: GoogleWeatherPayload) {
  const fetchedAt = new Date().toISOString();
  const snapshot = { fetchedAt, payload: getSnapshotPayload(payload) };
  snapshots.set(getSnapshotKey(city), snapshot);

  const supabase = getSnapshotStoreClient();
  if (!supabase) return;

  try {
    const { error } = await supabase.from('weather_snapshots').upsert(
      {
        city_key: getSnapshotKey(city),
        city,
        payload: snapshot.payload,
        fetched_at: fetchedAt,
        updated_at: fetchedAt,
      },
      { onConflict: 'city_key' },
    );
    if (error) {
      console.error('Failed to save weather snapshot:', error);
    }
  } catch (error) {
    console.error('Failed to save weather snapshot:', error);
  }
}

async function loadWeatherSnapshot(city: string): Promise<SnapshotEntry | null> {
  const cityKey = getSnapshotKey(city);
  const memorySnapshot = snapshots.get(cityKey);
  if (memorySnapshot) return memorySnapshot;

  const supabase = getSnapshotStoreClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('weather_snapshots')
      .select('payload, fetched_at')
      .eq('city_key', cityKey)
      .maybeSingle();

    if (error || !data?.payload || !data.fetched_at) {
      if (error) console.error('Failed to load weather snapshot:', error);
      return null;
    }

    const snapshot = {
      fetchedAt: data.fetched_at as string,
      payload: data.payload as GoogleWeatherPayload,
    };
    snapshots.set(cityKey, snapshot);
    return snapshot;
  } catch (error) {
    console.error('Failed to load weather snapshot:', error);
    return null;
  }
}

function withSnapshotMetadata(snapshot: SnapshotEntry): GoogleWeatherPayload {
  return {
    ...snapshot.payload,
    source: 'snapshot',
    snapshotAt: snapshot.fetchedAt,
  };
}

async function resolveCityCoords(city: string): Promise<{ lat: number; lng: number } | null> {
  const knownCoords = CITY_COORDS[city];
  if (knownCoords) return knownCoords;

  const cacheKey = city.toLowerCase();
  const cached = resolvedCityCoords.get(cacheKey);
  if (cached) return cached;

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', city);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '1');

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'WeatherSchedulerApp/1.0',
      'Accept-Language': 'en',
    },
  });

  if (!response.ok) {
    throw new GoogleWeatherError(`Nominatim geocoding failed: ${response.status}`, 502);
  }

  const data = (await response.json()) as NominatimResult[];
  const result = data[0];
  if (!result) return null;

  const coords = {
    lat: Number(result.lat),
    lng: Number(result.lon),
  };

  if (!Number.isFinite(coords.lat) || !Number.isFinite(coords.lng)) {
    return null;
  }

  resolvedCityCoords.set(cacheKey, coords);
  return coords;
}

async function fetchAllForecastHours(apiKey: string, coords: { lat: number; lng: number }) {
  const collected: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  let lastResponse: Record<string, unknown> | null = null;
  let lastError: { status: number; error: string } | null = null;

  const totalHours = FORECAST_HOURS;
  const pageSize = FORECAST_HOURS;

  while (collected.length < totalHours) {
    const url = new URL('https://weather.googleapis.com/v1/forecast/hours:lookup');
    url.searchParams.set('key', apiKey);
    url.searchParams.set('location.latitude', coords.lat.toString());
    url.searchParams.set('location.longitude', coords.lng.toString());
    url.searchParams.set('unitsSystem', 'METRIC');
    url.searchParams.set('hours', totalHours.toString());
    url.searchParams.set('pageSize', pageSize.toString());
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url.toString(), {
      next: { revalidate: GOOGLE_FETCH_REVALIDATE_SECONDS },
    });
    if (!res.ok) {
      lastError = { status: res.status, error: await res.text() };
      break;
    }

    const data = (await res.json()) as Record<string, unknown>;
    lastResponse = data;
    const hours = (data.forecastHours as Record<string, unknown>[] | undefined) ?? [];
    if (hours.length === 0) break;
    collected.push(...hours);

    pageToken = data.nextPageToken as string | undefined;
    if (!pageToken) break;
  }

  if (collected.length === 0) {
    if (lastError?.status === 429) {
      throw new GoogleWeatherError(
        'Google Weather forecast quota is exhausted. Try again after the quota resets or raise the Forecast Hours daily quota in Google Cloud.',
        429,
        lastError.error,
      );
    }

    throw new GoogleWeatherError(
      'Failed to fetch weather data',
      lastError?.status ?? 500,
      lastError?.error ?? 'No forecast data received',
    );
  }

  return { ...(lastResponse ?? {}), forecastHours: collected };
}

export async function fetchGoogleWeather(city: string): Promise<GoogleWeatherPayload> {
  const normalizedCity = city.trim();
  if (!normalizedCity) {
    throw new GoogleWeatherError('Invalid city', 400);
  }

  const apiKey = getGoogleWeatherApiKey();

  const cached = cache.get(normalizedCity);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const coords = await resolveCityCoords(normalizedCity);
  if (!coords) {
    throw new GoogleWeatherError('City not found', 400);
  }

  const currentUrl = new URL('https://weather.googleapis.com/v1/currentConditions:lookup');
  currentUrl.searchParams.set('key', apiKey);
  currentUrl.searchParams.set('location.latitude', coords.lat.toString());
  currentUrl.searchParams.set('location.longitude', coords.lng.toString());
  currentUrl.searchParams.set('unitsSystem', 'METRIC');

  try {
    const [currentRes, forecast] = await Promise.all([
      fetch(currentUrl.toString(), {
        next: { revalidate: GOOGLE_FETCH_REVALIDATE_SECONDS },
      }),
      fetchAllForecastHours(apiKey, coords),
    ]);

    if (!currentRes.ok) {
      const details = await currentRes.text();
      throw new GoogleWeatherError(
        currentRes.status === 429
          ? 'Google Weather quota is exhausted. Showing the last saved weather snapshot when available.'
          : 'Failed to fetch weather data',
        currentRes.status,
        details,
      );
    }

    const payload = {
      current: await currentRes.json(),
      forecast,
      source: 'live' as const,
    };

    cache.set(normalizedCity, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    await saveWeatherSnapshot(normalizedCity, payload);
    return payload;
  } catch (error) {
    if (error instanceof GoogleWeatherError && error.status === 429) {
      const snapshot = await loadWeatherSnapshot(normalizedCity);
      if (snapshot) {
        const payload = withSnapshotMetadata(snapshot);
        cache.set(normalizedCity, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return payload;
      }
    }

    throw error;
  }
}
