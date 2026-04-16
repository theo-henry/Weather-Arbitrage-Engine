import type { WeatherConditions, UserPreferences, Sensitivity } from './types';

// Weights for easy tuning
const WEIGHTS = {
  run: {
    temperature: 0.25,
    humidity: 0.15,
    wind: 0.2,
    rain: 0.25,
    uv: 0.1,
    timing: 0.05,
  },
  study: {
    thermal: 0.3,
    daylight: 0.25,
    distraction: 0.25,
    timing: 0.2,
  },
  social: {
    temperature: 0.25,
    rain: 0.3,
    wind: 0.15,
    sunset: 0.15,
    atmosphere: 0.15,
  },
  flight: {
    turbulence: 0.4,
    weather: 0.3,
    stability: 0.2,
    timing: 0.1,
  },
  photo: {
    golden_hour: 0.35,
    cloud_drama: 0.25,
    rain: 0.2,
    visibility: 0.2,
  },
};

// Utility functions
function gaussian(value: number, ideal: number, spread: number): number {
  return Math.exp(-Math.pow(value - ideal, 2) / (2 * spread * spread)) * 100;
}

function clamp(value: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, value));
}

function sensitivityMultiplier(sensitivity: Sensitivity): number {
  switch (sensitivity) {
    case 'low': return 0.5;
    case 'medium': return 1;
    case 'high': return 1.5;
  }
}

// Run scoring
export function scoreRun(
  w: WeatherConditions,
  prefs: UserPreferences,
  hour: number
): { score: number; factors: Record<string, number> } {
  const performanceBias = (prefs.performanceVsComfort ?? 75) / 100;
  const idealTemp = performanceBias > 0.5 ? 14 : 18; // Performance prefers cooler
  
  const factors: Record<string, number> = {
    temperature: gaussian(w.temperature, idealTemp, 6),
    humidity: w.humidity > 70 ? clamp(100 - (w.humidity - 70) * 3) : 100,
    wind: clamp(100 - w.windSpeed * sensitivityMultiplier(prefs.windSensitivity ?? 'medium') * 2),
    rain: clamp(100 - w.precipitationProbability * sensitivityMultiplier(prefs.rainAvoidance ?? 'medium') * 1.5),
    uv: w.uvIndex > 7 ? clamp(100 - (w.uvIndex - 7) * 15) : 100,
    timing: getTimingScore(hour, prefs.timeBias ?? 'evening'),
  };

  const weights = WEIGHTS.run;
  const score = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0);
  }, 0);

  return { score: Math.round(clamp(score)), factors };
}

// Study scoring
export function scoreStudy(
  w: WeatherConditions,
  prefs: UserPreferences,
  hour: number
): { score: number; factors: Record<string, number> } {
  const idealTemp = prefs.preferCool ? 20 : 22;
  
  const factors: Record<string, number> = {
    thermal: gaussian(w.temperature, idealTemp, 4),
    daylight: getDaylightScore(hour, prefs.daylightPreference ?? 50),
    distraction: prefs.distractionSensitivity 
      ? clamp(100 - w.windSpeed * 2 - (w.condition === 'storm' ? 30 : 0))
      : 80,
    timing: getStudyTimingScore(hour),
  };

  const weights = WEIGHTS.study;
  const score = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0);
  }, 0);

  return { score: Math.round(clamp(score)), factors };
}

// Social scoring
export function scoreSocial(
  w: WeatherConditions,
  prefs: UserPreferences,
  hour: number,
  sunsetHour: number = 20
): { score: number; factors: Record<string, number> } {
  const idealTemp = 22 + (prefs.warmthPreference ?? 50) / 25; // 22-26°C
  
  const factors: Record<string, number> = {
    temperature: gaussian(w.temperature, idealTemp, 5),
    rain: clamp(100 - w.precipitationProbability * 2),
    wind: clamp(100 - w.windSpeed * 1.5),
    sunset: prefs.sunsetBonus && Math.abs(hour - sunsetHour) <= 1 ? 100 : 60,
    atmosphere: w.condition === 'clear' || w.condition === 'partly-cloudy' ? 100 : 60,
  };

  const weights = WEIGHTS.social;
  const score = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0);
  }, 0);

  return { score: Math.round(clamp(score)), factors };
}

// Flight scoring
export function scoreFlight(
  w: WeatherConditions,
  prefs: UserPreferences,
  hour: number
): { score: number; factors: Record<string, number> } {
  const turbSens = sensitivityMultiplier(prefs.turbulenceSensitivity ?? 'medium');
  
  const factors: Record<string, number> = {
    turbulence: clamp(100 - w.windSpeed * turbSens * 2.5),
    weather: w.condition === 'storm' ? 20 : w.condition === 'rain' ? 50 : 100,
    stability: clamp(100 - Math.abs(w.cloudCover - 30) * 0.5), // Moderate clouds = stable
    timing: hour >= 6 && hour <= 10 ? 90 : hour >= 16 && hour <= 20 ? 85 : 70,
  };

  const weights = WEIGHTS.flight;
  const score = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0);
  }, 0);

  return { score: Math.round(clamp(score)), factors };
}

// Photo scoring
export function scorePhoto(
  w: WeatherConditions,
  prefs: UserPreferences,
  hour: number,
  sunsetHour: number = 20,
  sunriseHour: number = 7
): { score: number; factors: Record<string, number> } {
  const isGoldenHour = Math.abs(hour - sunsetHour) <= 1 || Math.abs(hour - sunriseHour) <= 1;
  const wantsDramatic = prefs.cloudPreference === 'dramatic';
  
  const factors: Record<string, number> = {
    golden_hour: prefs.goldenHourPriority 
      ? (isGoldenHour ? 100 : 40)
      : (isGoldenHour ? 85 : 60),
    cloud_drama: wantsDramatic
      ? (w.cloudCover >= 30 && w.cloudCover <= 70 ? 100 : 50)
      : (w.cloudCover < 30 ? 100 : 60),
    rain: clamp(100 - w.precipitationProbability * 1.5),
    visibility: w.humidity < 80 ? 100 : clamp(100 - (w.humidity - 80) * 3),
  };

  const weights = WEIGHTS.photo;
  const score = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0);
  }, 0);

  return { score: Math.round(clamp(score)), factors };
}

// Helper functions
function getTimingScore(hour: number, bias: 'morning' | 'neutral' | 'evening'): number {
  if (bias === 'morning') {
    return hour >= 6 && hour <= 10 ? 100 : hour >= 5 && hour <= 12 ? 70 : 40;
  } else if (bias === 'evening') {
    return hour >= 17 && hour <= 21 ? 100 : hour >= 15 && hour <= 22 ? 70 : 40;
  }
  return 70; // neutral
}

function getStudyTimingScore(hour: number): number {
  // Morning focus peak, afternoon dip, evening secondary peak
  if (hour >= 9 && hour <= 12) return 100;
  if (hour >= 14 && hour <= 16) return 60; // post-lunch dip
  if (hour >= 16 && hour <= 20) return 85;
  return 50;
}

function getDaylightScore(hour: number, preference: number): number {
  const isDaylight = hour >= 7 && hour <= 20;
  const prefersLight = preference > 50;
  
  if (isDaylight && prefersLight) return 100;
  if (!isDaylight && !prefersLight) return 90;
  if (isDaylight && !prefersLight) return 70;
  return 60;
}

// Main scoring dispatcher
export function scoreWindow(
  w: WeatherConditions,
  prefs: UserPreferences,
  hour: number,
  sunsetHour: number = 20,
  sunriseHour: number = 7
): { score: number; factors: Record<string, number> } {
  switch (prefs.activity) {
    case 'run':
      return scoreRun(w, prefs, hour);
    case 'study':
      return scoreStudy(w, prefs, hour);
    case 'social':
      return scoreSocial(w, prefs, hour, sunsetHour);
    case 'flight':
      return scoreFlight(w, prefs, hour);
    case 'photo':
      return scorePhoto(w, prefs, hour, sunsetHour, sunriseHour);
    default:
      return scoreRun(w, prefs, hour); // Default to run scoring for custom
  }
}
