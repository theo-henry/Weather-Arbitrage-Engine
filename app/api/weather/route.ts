import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_WEATHER_API_KEY = process.env.GOOGLE_WEATHER_API_KEY;

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

// Module-level cache: forecasts change slowly, so reuse across renders/users
// to keep us under the 100 forecast-hours/day Google quota.
type CachedEntry = { expiresAt: number; payload: unknown };
const cache = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 min
const resolvedCityCoords = new Map<string, { lat: number; lng: number }>();

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
    throw new Error(`Nominatim geocoding failed: ${response.status}`);
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

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city')?.trim();

  if (!city) {
    return NextResponse.json({ error: 'Invalid city' }, { status: 400 });
  }

  if (!GOOGLE_WEATHER_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const cached = cache.get(city);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  let resolvedCoords: { lat: number; lng: number } | null = null;

  try {
    resolvedCoords = await resolveCityCoords(city);
  } catch (error) {
    console.error('City geocoding failed:', error);
    return NextResponse.json({ error: 'Failed to resolve city' }, { status: 502 });
  }

  if (!resolvedCoords) {
    return NextResponse.json({ error: 'City not found' }, { status: 400 });
  }

  const coords = resolvedCoords;

  // Aim for 10 days; if quota is tight the API returns a partial list and we use whatever we got.
  const TOTAL_HOURS = 240;
  const PAGE_SIZE = 240; // request everything in one page — Google caps per-call, pagination handles the rest

  async function fetchAllForecastHours() {
    const collected: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    let lastResponse: Record<string, unknown> | null = null;
    let lastError: { status: number; error: string } | null = null;

    while (collected.length < TOTAL_HOURS) {
      const url = new URL('https://weather.googleapis.com/v1/forecast/hours:lookup');
      url.searchParams.set('key', GOOGLE_WEATHER_API_KEY!);
      url.searchParams.set('location.latitude', coords.lat.toString());
      url.searchParams.set('location.longitude', coords.lng.toString());
      url.searchParams.set('unitsSystem', 'METRIC');
      url.searchParams.set('hours', TOTAL_HOURS.toString());
      url.searchParams.set('pageSize', PAGE_SIZE.toString());
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url.toString());
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
      return { ok: false as const, status: lastError?.status ?? 500, error: lastError?.error ?? 'No data' };
    }

    return {
      ok: true as const,
      data: { ...(lastResponse ?? {}), forecastHours: collected },
    };
  }

  try {
    const [currentRes, forecastResult] = await Promise.all([
      fetch(
        `https://weather.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_WEATHER_API_KEY}&location.latitude=${coords.lat}&location.longitude=${coords.lng}&unitsSystem=METRIC`
      ),
      fetchAllForecastHours(),
    ]);

    if (!currentRes.ok) {
      const errorText = await currentRes.text();
      console.error('Google Weather API error (current):', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch weather data', details: errorText },
        { status: currentRes.status }
      );
    }

    if (!forecastResult.ok) {
      console.error('Google Weather API error (forecast):', forecastResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch weather data', details: forecastResult.error },
        { status: forecastResult.status }
      );
    }

    const currentData = await currentRes.json();

    const payload = {
      current: currentData,
      forecast: forecastResult.data,
    };

    cache.set(city, { expiresAt: Date.now() + CACHE_TTL_MS, payload });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Weather API request failed:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
