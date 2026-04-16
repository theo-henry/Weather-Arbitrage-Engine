import type { City, TimeWindow, WeatherConditions, WeatherConditionType, Confidence } from './types';
import { scoreRun, scoreStudy, scoreSocial, scoreFlight, scorePhoto } from './scoring';

const CITY_LOCATIONS_MAP: Record<City, string[]> = {
  Madrid: ['Retiro Park', 'Casa de Campo', 'Madrid Río', 'El Capricho'],
  Barcelona: ['Barceloneta Beach', 'Park Güell', 'Montjuïc', 'Ciutadella Park'],
  Valencia: ['Turia Gardens', 'Malvarrosa Beach', 'Albufera', 'City of Arts'],
  Seville: ['María Luisa Park', 'Alamillo Park', 'Triana Bridge', 'Plaza de España'],
};

// Base temperature profiles for each city (hour -> base temp)
const CITY_BASE_TEMPS: Record<City, number> = {
  Madrid: 22,
  Barcelona: 24,
  Valencia: 25,
  Seville: 28,
};

// Generate realistic weather for a given hour
function generateWeather(hour: number, dayOffset: number, city: City): WeatherConditions {
  const baseTemp = CITY_BASE_TEMPS[city];
  
  // Temperature varies by time of day (cooler morning/night, warmer afternoon)
  const hourFactor = Math.sin(((hour - 6) / 24) * Math.PI * 2) * 0.5;
  const temperature = Math.round(baseTemp + hourFactor * 8 + (Math.random() - 0.5) * 3);
  
  // Humidity is higher in morning and evening
  const humidityBase = hour < 8 || hour > 20 ? 65 : 45;
  const humidity = Math.round(humidityBase + (Math.random() - 0.5) * 20);
  
  // Wind varies semi-randomly but typically lower in morning
  const windBase = hour < 10 ? 8 : hour > 18 ? 12 : 15;
  const windSpeed = Math.round(windBase + (Math.random() - 0.5) * 10);
  
  // Rain probability - add some rain blocks
  const isRainyBlock = (dayOffset === 0 && hour >= 15 && hour <= 17) || 
                       (dayOffset === 1 && hour >= 10 && hour <= 12);
  const precipitationProbability = isRainyBlock 
    ? Math.round(40 + Math.random() * 40)
    : Math.round(Math.random() * 20);
  
  // UV index (only during day)
  const uvIndex = hour >= 7 && hour <= 19 
    ? Math.round(3 + Math.sin(((hour - 7) / 12) * Math.PI) * 6)
    : 0;
  
  // Cloud cover
  const cloudCover = isRainyBlock 
    ? Math.round(60 + Math.random() * 30)
    : Math.round(20 + Math.random() * 40);
  
  // Determine condition
  let condition: WeatherConditionType = 'clear';
  if (precipitationProbability > 60) {
    condition = 'rain';
  } else if (precipitationProbability > 40) {
    condition = 'drizzle';
  } else if (cloudCover > 70) {
    condition = 'cloudy';
  } else if (cloudCover > 30) {
    condition = 'partly-cloudy';
  }
  
  // Calculate "feels like" temperature (simplified heat index / wind chill)
  let feelsLike = temperature;
  if (temperature > 27 && humidity > 40) {
    // Heat index approximation
    feelsLike = Math.round(temperature + (humidity - 40) * 0.1);
  } else if (temperature < 10 && windSpeed > 5) {
    // Wind chill approximation
    feelsLike = Math.round(temperature - (windSpeed * 0.2));
  }
  
  // Precipitation amount (mm) - only if raining
  const precipitation = condition === 'rain' 
    ? Math.round((2 + Math.random() * 8) * 10) / 10
    : condition === 'drizzle'
    ? Math.round((0.5 + Math.random() * 1.5) * 10) / 10
    : 0;
  
  // Air quality index (AQI) - lower is better
  // Typically 20-60 is good, higher in cities during peak hours
  const aqiBase = city === 'Madrid' ? 45 : city === 'Barcelona' ? 42 : city === 'Valencia' ? 35 : 38;
  const aqiHourFactor = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19) ? 15 : 0; // Rush hour
  const airQuality = Math.round(aqiBase + aqiHourFactor + (Math.random() - 0.5) * 20);
  
  return {
    temperature,
    feelsLike,
    humidity,
    windSpeed,
    precipitationProbability,
    precipitation,
    uvIndex,
    cloudCover,
    airQuality,
    condition,
  };
}

// Generate 48 hours of windows (96 × 30-min slots)
export function getWindows(city: City): TimeWindow[] {
  const windows: TimeWindow[] = [];
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const locations = CITY_LOCATIONS_MAP[city];
  
  // Default preferences for scoring
  const defaultPrefs = {
    activity: 'run' as const,
    city,
    usualTime: '17:00',
    performanceVsComfort: 75,
    windSensitivity: 'high' as const,
    rainAvoidance: 'medium' as const,
    timeBias: 'evening' as const,
    sunsetBonus: true,
    goldenHourPriority: true,
  };
  
  for (let dayOffset = 0; dayOffset < 2; dayOffset++) {
    for (let slot = 0; slot < 48; slot++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(Math.floor(slot / 2), (slot % 2) * 30, 0, 0);
      
      const hour = Math.floor(slot / 2);
      const minutes = (slot % 2) * 30;
      const startTime = `${hour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      const endHour = minutes === 30 ? hour + 1 : hour;
      const endMinutes = minutes === 30 ? 0 : 30;
      const endTime = `${endHour.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
      
      const weather = generateWeather(hour, dayOffset, city);
      const location = locations[Math.floor(Math.random() * locations.length)];
      
      // Calculate scores for all activities
      const runResult = scoreRun(weather, { ...defaultPrefs, activity: 'run' }, hour);
      const studyResult = scoreStudy(weather, { ...defaultPrefs, activity: 'study' }, hour);
      const socialResult = scoreSocial(weather, { ...defaultPrefs, activity: 'social' }, hour, 20);
      const flightResult = scoreFlight(weather, { ...defaultPrefs, activity: 'flight' }, hour);
      const photoResult = scorePhoto(weather, { ...defaultPrefs, activity: 'photo' }, hour, 20, 7);
      
      // Determine confidence based on weather stability
      let confidence: Confidence = 'High';
      if (weather.precipitationProbability > 40 || weather.windSpeed > 20) {
        confidence = 'Medium';
      }
      if (weather.precipitationProbability > 60 || weather.condition === 'storm') {
        confidence = 'Low';
      }
      
      windows.push({
        id: `${city}-${dayOffset}-${slot}`,
        day: days[date.getDay()],
        date: date.toISOString(),
        startTime,
        endTime,
        city,
        location,
        weather,
        scores: {
          run: runResult.score,
          study: studyResult.score,
          social: socialResult.score,
          flight: flightResult.score,
          photo: photoResult.score,
        },
        factorBreakdown: runResult.factors, // Default to run factors
        confidence,
      });
    }
  }
  
  return windows;
}

// Get the best window for an activity
export function getBestWindow(windows: TimeWindow[], activity: keyof TimeWindow['scores']): TimeWindow {
  return windows.reduce((best, current) => 
    current.scores[activity] > best.scores[activity] ? current : best
  );
}

// Get top N windows for an activity
export function getTopWindows(windows: TimeWindow[], activity: keyof TimeWindow['scores'], count: number = 5): TimeWindow[] {
  return [...windows]
    .sort((a, b) => b.scores[activity] - a.scores[activity])
    .slice(0, count);
}

// Get window at a specific time
export function getWindowAtTime(windows: TimeWindow[], time: string, dayOffset: number = 0): TimeWindow | undefined {
  const [hour, minute] = time.split(':').map(Number);
  const slotIndex = hour * 2 + (minute >= 30 ? 1 : 0);
  return windows.find(w => {
    const wDate = new Date(w.date);
    const today = new Date();
    const dayDiff = Math.floor((wDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const wHour = parseInt(w.startTime.split(':')[0]);
    const wMinute = parseInt(w.startTime.split(':')[1]);
    const wSlot = wHour * 2 + (wMinute >= 30 ? 1 : 0);
    return dayDiff === dayOffset && wSlot === slotIndex;
  });
}

// Export all cities' data
export function getAllCitiesData(): Record<City, TimeWindow[]> {
  return {
    Madrid: getWindows('Madrid'),
    Barcelona: getWindows('Barcelona'),
    Valencia: getWindows('Valencia'),
    Seville: getWindows('Seville'),
  };
}
