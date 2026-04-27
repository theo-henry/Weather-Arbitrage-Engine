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
  providers?: {
    first48Hours: 'google-weather' | 'google-weather-snapshot';
    extendedForecast?: 'open-meteo';
  };
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
const EXTENDED_FORECAST_DAYS = 14;
const WEATHER_TIME_ZONE = 'Europe/Madrid';
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
    providers: payload.providers,
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
    providers: {
      first48Hours: 'google-weather-snapshot',
      ...(snapshot.payload.providers?.extendedForecast
        ? { extendedForecast: snapshot.payload.providers.extendedForecast }
        : {}),
    },
  };
}

async function buildSnapshotFallbackPayload(
  city: string,
  snapshot: SnapshotEntry,
  coords: { lat: number; lng: number },
) {
  const { forecast, extendedCount } = await mergeExtendedForecast(snapshot.payload.forecast, coords);
  const payload = withSnapshotMetadata({
    ...snapshot,
    payload: {
      ...snapshot.payload,
      forecast,
      providers: {
        first48Hours: 'google-weather-snapshot',
        ...(snapshot.payload.providers?.extendedForecast || extendedCount > 0
          ? { extendedForecast: 'open-meteo' as const }
          : {}),
      },
    },
  });

  snapshots.set(getSnapshotKey(city), {
    fetchedAt: snapshot.fetchedAt,
    payload: getSnapshotPayload(payload),
  });

  return payload;
}

function getTimeZoneOffsetSeconds(timeZone: string, date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  const offset = parts.timeZoneName ?? 'GMT';
  const match = offset.match(/^GMT(?:([+-])(\d{1,2})(?::(\d{2}))?)?$/);
  const [, signRaw, hoursRaw, minutesRaw] = match ?? [];
  if (!signRaw) return 0;

  const sign = signRaw === '-' ? -1 : 1;
  const hours = Number(hoursRaw ?? 0);
  const minutes = Number(minutesRaw ?? 0);
  return sign * (hours * 60 + minutes) * 60;
}

function parseLocalDateTime(value: string) {
  const [datePart, timePart = '00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  return {
    year,
    month,
    day,
    hours: hours ?? 0,
    minutes: minutes ?? 0,
    seconds: 0,
  };
}

function localDateTimeToUtc(value: string, timeZone: string) {
  const parts = parseLocalDateTime(value);
  const utcGuess = new Date(
    Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes, parts.seconds),
  );
  const offsetSeconds = getTimeZoneOffsetSeconds(timeZone, utcGuess);
  const date = new Date(utcGuess.getTime() - offsetSeconds * 1000);

  return { date, parts, offsetSeconds };
}

function mapOpenMeteoWeatherCode(code: number): string {
  if (code === 0) return 'CLEAR';
  if (code === 1) return 'MOSTLY_CLEAR';
  if (code === 2) return 'PARTLY_CLOUDY';
  if (code === 3 || code === 45 || code === 48) return 'CLOUDY';
  if (code >= 51 && code <= 57) return 'DRIZZLE';
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return 'RAIN';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'SNOW';
  if (code >= 95 && code <= 99) return 'THUNDERSTORM';

  return 'PARTLY_CLOUDY';
}

function getNumericValue(values: unknown, index: number, fallback: number) {
  if (!Array.isArray(values)) return fallback;
  const value = Number(values[index]);
  return Number.isFinite(value) ? value : fallback;
}

async function fetchOpenMeteoExtendedForecast(
  coords: { lat: number; lng: number },
  afterDate: Date,
): Promise<Record<string, unknown>[]> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', coords.lat.toString());
  url.searchParams.set('longitude', coords.lng.toString());
  url.searchParams.set(
    'hourly',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'precipitation_probability',
      'precipitation',
      'wind_speed_10m',
      'uv_index',
      'cloud_cover',
      'weather_code',
    ].join(','),
  );
  url.searchParams.set('forecast_days', EXTENDED_FORECAST_DAYS.toString());
  url.searchParams.set('timezone', WEATHER_TIME_ZONE);
  url.searchParams.set('wind_speed_unit', 'kmh');
  url.searchParams.set('precipitation_unit', 'mm');

  const res = await fetch(url.toString(), {
    next: { revalidate: GOOGLE_FETCH_REVALIDATE_SECONDS },
  });

  if (!res.ok) {
    console.error('Open-Meteo extended forecast failed:', await res.text());
    return [];
  }

  const data = (await res.json()) as { hourly?: Record<string, unknown> };
  const hourly = data.hourly;
  const times = hourly?.time;
  if (!hourly || !Array.isArray(times)) return [];

  return times.flatMap((time, index) => {
    if (typeof time !== 'string') return [];

    const { date, parts, offsetSeconds } = localDateTimeToUtc(time, WEATHER_TIME_ZONE);
    if (date <= afterDate) return [];

    const temperature = getNumericValue(hourly.temperature_2m, index, 20);
    const feelsLike = getNumericValue(hourly.apparent_temperature, index, temperature);
    const humidity = getNumericValue(hourly.relative_humidity_2m, index, 55);
    const precipitationProbability = getNumericValue(hourly.precipitation_probability, index, 0);
    const precipitation = getNumericValue(hourly.precipitation, index, 0);
    const windSpeed = getNumericValue(hourly.wind_speed_10m, index, 10);
    const uvIndex = getNumericValue(hourly.uv_index, index, 0);
    const cloudCover = getNumericValue(hourly.cloud_cover, index, 30);
    const weatherCode = getNumericValue(hourly.weather_code, index, 1);

    return {
      displayDateTime: {
        year: parts.year,
        month: parts.month,
        day: parts.day,
        hours: parts.hours,
        minutes: parts.minutes,
        seconds: 0,
        utcOffset: `${offsetSeconds}s`,
      },
      interval: { startTime: date.toISOString() },
      temperature: { degrees: temperature },
      feelsLikeTemperature: { degrees: feelsLike },
      relativeHumidity: humidity,
      precipitation: {
        probability: { percent: precipitationProbability },
        qpf: { quantity: precipitation },
      },
      wind: { speed: { value: windSpeed } },
      uvIndex,
      cloudCover,
      weatherCondition: { type: mapOpenMeteoWeatherCode(weatherCode) },
      provider: 'open-meteo',
    };
  });
}

function getLastForecastDate(forecast: Record<string, unknown>) {
  const forecastHours = (forecast.forecastHours as Record<string, unknown>[] | undefined) ?? [];
  let latest: Date | null = null;

  for (const hour of forecastHours) {
    const interval = hour.interval as { startTime?: string } | undefined;
    const rawDate = interval?.startTime;
    if (!rawDate) continue;

    const date = new Date(rawDate);
    if (!Number.isFinite(date.getTime())) continue;
    if (!latest || date > latest) latest = date;
  }

  return latest;
}

async function mergeExtendedForecast(
  forecast: Record<string, unknown>,
  coords: { lat: number; lng: number },
) {
  const forecastHours = (forecast.forecastHours as Record<string, unknown>[] | undefined) ?? [];
  const lastGoogleDate = getLastForecastDate(forecast);
  if (!lastGoogleDate) {
    return { forecast, extendedCount: 0 };
  }

  const extendedHours = await fetchOpenMeteoExtendedForecast(coords, lastGoogleDate);
  if (extendedHours.length === 0) {
    return { forecast, extendedCount: 0 };
  }

  return {
    forecast: {
      ...forecast,
      forecastHours: [...forecastHours, ...extendedHours],
    },
    extendedCount: extendedHours.length,
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
    const [currentRes, forecastResult] = await Promise.all([
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

    const { forecast, extendedCount } = await mergeExtendedForecast(forecastResult, coords);
    const payload = {
      current: await currentRes.json(),
      forecast,
      source: 'live' as const,
      providers: {
        first48Hours: 'google-weather' as const,
        ...(extendedCount > 0 ? { extendedForecast: 'open-meteo' as const } : {}),
      },
    };

    cache.set(normalizedCity, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
    await saveWeatherSnapshot(normalizedCity, payload);
    return payload;
  } catch (error) {
    if (error instanceof GoogleWeatherError && error.status === 429) {
      const snapshot = await loadWeatherSnapshot(normalizedCity);
      if (snapshot) {
        const payload = await buildSnapshotFallbackPayload(normalizedCity, snapshot, coords);
        cache.set(normalizedCity, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
        return payload;
      }
    }

    throw error;
  }
}
