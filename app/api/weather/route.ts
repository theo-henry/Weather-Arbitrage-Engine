import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleWeather, GoogleWeatherError } from '@/lib/google-weather';

export async function GET(request: NextRequest) {
  const city = request.nextUrl.searchParams.get('city')?.trim();

  if (!city) {
    return NextResponse.json({ error: 'Invalid city' }, { status: 400 });
  }

  try {
    return NextResponse.json(await fetchGoogleWeather(city), {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600',
      },
    });
  } catch (error) {
    if (error instanceof GoogleWeatherError) {
      console.error('Google Weather API error:', error.details ?? error.message);
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error('Weather API request failed:', error);
    return NextResponse.json({ error: 'Request failed' }, { status: 500 });
  }
}
