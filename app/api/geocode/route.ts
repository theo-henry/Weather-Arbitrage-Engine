import { NextRequest, NextResponse } from 'next/server';

interface GeocodeResult {
  name: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  name?: string;
  display_name?: string;
  lat?: string;
  lon?: string;
}

const geocodeCache = new Map<string, GeocodeResult[]>();

function getShortName(result: NominatimResult): string {
  if (result.name?.trim()) return result.name.trim();
  return result.display_name?.split(',')[0]?.trim() || 'Unknown city';
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim();

  if (!query) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached) {
    return NextResponse.json({ results: cached });
  }

  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'WeatherSchedulerApp/1.0',
        'Accept-Language': 'en',
      },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Geocoding failed' }, { status: response.status });
    }

    const data = (await response.json()) as NominatimResult[];
    const results = data
      .map((item) => ({
        name: getShortName(item),
        displayName: item.display_name ?? getShortName(item),
        lat: Number(item.lat),
        lng: Number(item.lon),
      }))
      .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));

    geocodeCache.set(cacheKey, results);

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Nominatim geocoding request failed:', error);
    return NextResponse.json({ error: 'Geocoding request failed' }, { status: 500 });
  }
}
