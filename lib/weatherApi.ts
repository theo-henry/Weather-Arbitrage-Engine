import type { City, TimeWindow, WeatherConditions, WeatherConditionType, Confidence } from './types';
import { getDefaultUserPreferences, getResolvedActivityPreferences } from './preferences';
import { scoreRun, scoreStudy, scoreSocial, scoreFlight, scorePhoto, scoreWindow } from './scoring';

const CITY_LOCATIONS_MAP: Record<City, string[]> = {
  Madrid: ['Retiro Park', 'Casa de Campo', 'Madrid Río', 'El Capricho'],
  Barcelona: ['Barceloneta Beach', 'Park Güell', 'Montjuïc', 'Ciutadella Park'],
  Valencia: ['Turia Gardens', 'Malvarrosa Beach', 'Albufera', 'City of Arts'],
  Seville: ['María Luisa Park', 'Alamillo Park', 'Triana Bridge', 'Plaza de España'],
};

// Map Google Weather API condition types to our internal types
function mapConditionType(googleType: string): WeatherConditionType {
  switch (googleType) {
    case 'CLEAR':
    case 'MOSTLY_CLEAR':
      return 'clear';
    case 'PARTLY_CLOUDY':
      return 'partly-cloudy';
    case 'MOSTLY_CLOUDY':
    case 'CLOUDY':
    case 'FOG':
    case 'HAZE':
      return 'cloudy';
    case 'LIGHT_RAIN':
    case 'LIGHT_DRIZZLE':
    case 'DRIZZLE':
      return 'drizzle';
    case 'RAIN':
    case 'MODERATE_RAIN':
    case 'HEAVY_RAIN':
    case 'SHOWERS':
      return 'rain';
    case 'THUNDERSTORM':
    case 'HEAVY_THUNDERSTORM':
    case 'TORNADO':
      return 'storm';
    case 'SNOW':
    case 'LIGHT_SNOW':
    case 'HEAVY_SNOW':
    case 'BLIZZARD':
    case 'ICE':
    case 'SLEET':
    case 'FREEZING_RAIN':
      return 'snow';
    default:
      return 'partly-cloudy';
  }
}

// Convert a Google Weather API hourly forecast entry to our WeatherConditions
function mapHourToWeatherConditions(hour: Record<string, unknown>): WeatherConditions {
  const temperature = (hour.temperature as { degrees?: number })?.degrees ?? 20;
  const feelsLike = (hour.feelsLikeTemperature as { degrees?: number })?.degrees ?? temperature;
  const humidity = (hour.relativeHumidity as number) ?? 50;
  const windSpeed = (hour.wind as { speed?: { value?: number } })?.speed?.value ?? 10;
  const precipitation = hour.precipitation as { probability?: { percent?: number }; qpf?: { quantity?: number } } | undefined;
  const precipitationProbability = precipitation?.probability?.percent ?? 0;
  const precipitationAmount = precipitation?.qpf?.quantity ?? 0;
  const uvIndex = (hour.uvIndex as number) ?? 0;
  const cloudCover = (hour.cloudCover as number) ?? 0;
  const conditionType = (hour.weatherCondition as { type?: string })?.type ?? 'CLEAR';

  // Google Weather API doesn't provide AQI — estimate based on city rush-hour patterns
  // This is a placeholder; a real integration would use a separate AQI API
  const airQuality = 40;

  return {
    temperature: Math.round(temperature),
    feelsLike: Math.round(feelsLike),
    humidity: Math.round(humidity),
    windSpeed: Math.round(windSpeed),
    precipitationProbability: Math.round(precipitationProbability),
    precipitation: Math.round(precipitationAmount * 10) / 10,
    uvIndex: Math.round(uvIndex),
    cloudCover: Math.round(cloudCover),
    airQuality,
    condition: mapConditionType(conditionType),
  };
}

// Interpolate between two weather conditions for 30-min slots
function interpolateWeather(a: WeatherConditions, b: WeatherConditions): WeatherConditions {
  return {
    temperature: Math.round((a.temperature + b.temperature) / 2),
    feelsLike: Math.round((a.feelsLike + b.feelsLike) / 2),
    humidity: Math.round((a.humidity + b.humidity) / 2),
    windSpeed: Math.round((a.windSpeed + b.windSpeed) / 2),
    precipitationProbability: Math.round((a.precipitationProbability + b.precipitationProbability) / 2),
    precipitation: Math.round(((a.precipitation + b.precipitation) / 2) * 10) / 10,
    uvIndex: Math.round((a.uvIndex + b.uvIndex) / 2),
    cloudCover: Math.round((a.cloudCover + b.cloudCover) / 2),
    airQuality: Math.round((a.airQuality + b.airQuality) / 2),
    condition: a.condition, // Use the start-of-hour condition
  };
}

// Build TimeWindow[] from Google Weather API response
export function buildWindowsFromApiData(
  city: City,
  forecastHours: Record<string, unknown>[]
): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const locations = CITY_LOCATIONS_MAP[city];

  const defaultPreferences = getDefaultUserPreferences(city);

  // Map each hourly forecast to weather conditions
  const hourlyWeather: { weather: WeatherConditions; date: Date }[] = forecastHours.map((h) => {
    const interval = h.interval as { startTime?: string } | undefined;
    const displayDateTime = (h.displayDateTime as string) || (interval?.startTime as string) || new Date().toISOString();
    return {
      weather: mapHourToWeatherConditions(h),
      date: new Date(displayDateTime),
    };
  });

  // Generate 30-min slots from hourly data
  for (let i = 0; i < hourlyWeather.length; i++) {
    const { weather, date } = hourlyWeather[i];
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    // Calculate day offset from now
    const now = new Date();
    const dayDiff = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Slot at the top of the hour (:00)
    const startTime00 = `${hour.toString().padStart(2, '0')}:00`;
    const endTime00 = `${hour.toString().padStart(2, '0')}:30`;

    const location = locations[i % locations.length];

    const runResult = scoreRun(weather, getResolvedActivityPreferences(defaultPreferences, 'run'), hour);
    const studyResult = scoreStudy(weather, getResolvedActivityPreferences(defaultPreferences, 'study'), hour);
    const socialResult = scoreSocial(weather, getResolvedActivityPreferences(defaultPreferences, 'social'), hour, 20);
    const flightResult = scoreFlight(weather, getResolvedActivityPreferences(defaultPreferences, 'flight'), hour);
    const photoResult = scorePhoto(weather, getResolvedActivityPreferences(defaultPreferences, 'photo'), hour, 20, 7);
    const customResult = scoreWindow(weather, getResolvedActivityPreferences(defaultPreferences, 'custom'), hour);

    let confidence: Confidence = 'High';
    if (weather.precipitationProbability > 40 || weather.windSpeed > 20) confidence = 'Medium';
    if (weather.precipitationProbability > 60 || weather.condition === 'storm') confidence = 'Low';

    windows.push({
      id: `${city}-${dayDiff}-${hour * 2}`,
      day: days[dayOfWeek],
      date: date.toISOString(),
      startTime: startTime00,
      endTime: endTime00,
      city,
      location,
      weather,
      scores: {
        run: runResult.score,
        study: studyResult.score,
        social: socialResult.score,
        flight: flightResult.score,
        photo: photoResult.score,
        custom: customResult.score,
      },
      factorBreakdown: runResult.factors,
      confidence,
    });

    // Interpolated :30 slot
    const nextWeather = i + 1 < hourlyWeather.length
      ? interpolateWeather(weather, hourlyWeather[i + 1].weather)
      : weather;

    const startTime30 = `${hour.toString().padStart(2, '0')}:30`;
    const endHour = hour + 1;
    const endTime30 = `${endHour.toString().padStart(2, '0')}:00`;

    const date30 = new Date(date);
    date30.setMinutes(30);

    const runResult30 = scoreRun(nextWeather, getResolvedActivityPreferences(defaultPreferences, 'run'), hour);
    const studyResult30 = scoreStudy(nextWeather, getResolvedActivityPreferences(defaultPreferences, 'study'), hour);
    const socialResult30 = scoreSocial(nextWeather, getResolvedActivityPreferences(defaultPreferences, 'social'), hour, 20);
    const flightResult30 = scoreFlight(nextWeather, getResolvedActivityPreferences(defaultPreferences, 'flight'), hour);
    const photoResult30 = scorePhoto(nextWeather, getResolvedActivityPreferences(defaultPreferences, 'photo'), hour, 20, 7);
    const customResult30 = scoreWindow(nextWeather, getResolvedActivityPreferences(defaultPreferences, 'custom'), hour);

    let confidence30: Confidence = 'High';
    if (nextWeather.precipitationProbability > 40 || nextWeather.windSpeed > 20) confidence30 = 'Medium';
    if (nextWeather.precipitationProbability > 60 || nextWeather.condition === 'storm') confidence30 = 'Low';

    windows.push({
      id: `${city}-${dayDiff}-${hour * 2 + 1}`,
      day: days[dayOfWeek],
      date: date30.toISOString(),
      startTime: startTime30,
      endTime: endTime30,
      city,
      location: locations[(i + 1) % locations.length],
      weather: nextWeather,
      scores: {
        run: runResult30.score,
        study: studyResult30.score,
        social: socialResult30.score,
        flight: flightResult30.score,
        photo: photoResult30.score,
        custom: customResult30.score,
      },
      factorBreakdown: runResult30.factors,
      confidence: confidence30,
    });
  }

  return windows;
}

// Fetch weather data from our API route
export async function fetchWeatherWindows(city: City): Promise<TimeWindow[]> {
  const res = await fetch(`/api/weather?city=${city}`);
  if (!res.ok) {
    throw new Error(`Weather API error: ${res.status}`);
  }

  const data = await res.json();
  const forecastHours = data.forecast?.forecastHours ?? [];

  if (forecastHours.length === 0) {
    throw new Error('No forecast data received');
  }

  return buildWindowsFromApiData(city, forecastHours);
}
