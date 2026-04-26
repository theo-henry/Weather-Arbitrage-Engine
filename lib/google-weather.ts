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

export interface GoogleWeatherPayload {
  current: unknown;
  forecast: Record<string, unknown>;
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
const cache = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 15 * 60 * 1000;
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

async function fetchAllForecastHours(coords: { lat: number; lng: number }) {
  const collected: Record<string, unknown>[] = [];
  let pageToken: string | undefined;
  let lastResponse: Record<string, unknown> | null = null;
  let lastError: { status: number; error: string } | null = null;

  const totalHours = 240;
  const pageSize = 240;

  while (collected.length < totalHours) {
    const url = new URL('https://weather.googleapis.com/v1/forecast/hours:lookup');
    url.searchParams.set('key', GOOGLE_WEATHER_API_KEY!);
    url.searchParams.set('location.latitude', coords.lat.toString());
    url.searchParams.set('location.longitude', coords.lng.toString());
    url.searchParams.set('unitsSystem', 'METRIC');
    url.searchParams.set('hours', totalHours.toString());
    url.searchParams.set('pageSize', pageSize.toString());
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

  if (!GOOGLE_WEATHER_API_KEY) {
    throw new GoogleWeatherError('Google Weather API key is not configured', 500);
  }

  const cached = cache.get(normalizedCity);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.payload;
  }

  const coords = await resolveCityCoords(normalizedCity);
  if (!coords) {
    throw new GoogleWeatherError('City not found', 400);
  }

  const [currentRes, forecast] = await Promise.all([
    fetch(
      `https://weather.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_WEATHER_API_KEY}&location.latitude=${coords.lat}&location.longitude=${coords.lng}&unitsSystem=METRIC`,
    ),
    fetchAllForecastHours(coords),
  ]);

  if (!currentRes.ok) {
    const details = await currentRes.text();
    throw new GoogleWeatherError('Failed to fetch weather data', currentRes.status, details);
  }

  const payload = {
    current: await currentRes.json(),
    forecast,
  };

  cache.set(normalizedCity, { expiresAt: Date.now() + CACHE_TTL_MS, payload });
  return payload;
}
