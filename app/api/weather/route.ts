import { NextRequest, NextResponse } from 'next/server';

const GOOGLE_WEATHER_API_KEY = process.env.GOOGLE_WEATHER_API_KEY;

const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Madrid: { lat: 40.4168, lng: -3.7038 },
  Barcelona: { lat: 41.3874, lng: 2.1686 },
  Valencia: { lat: 39.4699, lng: -0.3763 },
  Seville: { lat: 37.3891, lng: -5.9845 },
};

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city');

  if (!city || !CITY_COORDS[city]) {
    return NextResponse.json({ error: 'Invalid city' }, { status: 400 });
  }

  if (!GOOGLE_WEATHER_API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  const coords = CITY_COORDS[city];

  try {
    // Fetch current conditions and hourly forecast in parallel
    const [currentRes, forecastRes] = await Promise.all([
      fetch(
        `https://weather.googleapis.com/v1/currentConditions:lookup?key=${GOOGLE_WEATHER_API_KEY}&location.latitude=${coords.lat}&location.longitude=${coords.lng}&unitsSystem=METRIC`
      ),
      fetch(
        `https://weather.googleapis.com/v1/forecast/hours:lookup?key=${GOOGLE_WEATHER_API_KEY}&location.latitude=${coords.lat}&location.longitude=${coords.lng}&unitsSystem=METRIC&hours=48`
      ),
    ]);

    if (!currentRes.ok || !forecastRes.ok) {
      const errorText = !currentRes.ok ? await currentRes.text() : await forecastRes.text();
      console.error('Google Weather API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to fetch weather data', details: errorText },
        { status: currentRes.ok ? forecastRes.status : currentRes.status }
      );
    }

    const currentData = await currentRes.json();
    const forecastData = await forecastRes.json();

    return NextResponse.json({
      current: currentData,
      forecast: forecastData,
    });
  } catch (error) {
    console.error('Weather API request failed:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
