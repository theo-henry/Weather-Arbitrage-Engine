import { getResolvedActivityPreferences } from './preferences'
import type {
  Activity,
  ActivityWeatherComfort,
  ResolvedActivityPreferences,
  TimeWindow,
  UserPreferences,
  WeatherConditions,
} from './types'

const SCORABLE_ACTIVITIES: Array<Extract<Activity, 'run' | 'study' | 'social' | 'flight' | 'photo' | 'custom'>> = [
  'run',
  'study',
  'social',
  'flight',
  'photo',
  'custom',
]

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
}

// Utility functions
function gaussian(value: number, ideal: number, spread: number): number {
  return Math.exp(-Math.pow(value - ideal, 2) / (2 * spread * spread)) * 100
}

function clamp(value: number, min: number = 0, max: number = 100): number {
  return Math.max(min, Math.min(max, value))
}

function sensitivityMultiplier(
  sensitivity: ResolvedActivityPreferences['windSensitivity'] | ResolvedActivityPreferences['rainAvoidance'] | ResolvedActivityPreferences['turbulenceSensitivity'],
): number {
  switch (sensitivity) {
    case 'low':
      return 0.5
    case 'medium':
      return 1
    case 'high':
      return 1.5
    default:
      return 1
  }
}

function getComfortScore(weather: WeatherConditions, comfort?: ActivityWeatherComfort) {
  if (!comfort) return 100

  let score = 100

  if (weather.temperature < comfort.minTemperature) {
    score -= Math.min(60, (comfort.minTemperature - weather.temperature) * 8)
  } else if (weather.temperature > comfort.maxTemperature) {
    score -= Math.min(60, (weather.temperature - comfort.maxTemperature) * 8)
  }

  if (weather.windSpeed > comfort.maxWindSpeed) {
    score -= Math.min(50, (weather.windSpeed - comfort.maxWindSpeed) * 4)
  }

  if (weather.precipitationProbability > comfort.maxPrecipitationProbability) {
    score -= Math.min(70, (weather.precipitationProbability - comfort.maxPrecipitationProbability) * 1.2)
  }

  return clamp(score)
}

function finalizeScore(
  baseScore: number,
  factors: Record<string, number>,
  weather: WeatherConditions,
  comfort?: ActivityWeatherComfort,
) {
  const comfortScore = getComfortScore(weather, comfort)
  const adjustedScore = Math.round(clamp(baseScore * (0.45 + (comfortScore / 100) * 0.55)))

  return {
    score: adjustedScore,
    factors: {
      ...factors,
      comfort: comfortScore,
    },
  }
}

// Run scoring
export function scoreRun(
  weather: WeatherConditions,
  prefs: ResolvedActivityPreferences,
  hour: number,
): { score: number; factors: Record<string, number> } {
  const performanceBias = (prefs.performanceVsComfort ?? 75) / 100
  const idealTemp = performanceBias > 0.5 ? 14 : 18

  const factors: Record<string, number> = {
    temperature: gaussian(weather.temperature, idealTemp, 6),
    humidity: weather.humidity > 70 ? clamp(100 - (weather.humidity - 70) * 3) : 100,
    wind: clamp(100 - weather.windSpeed * sensitivityMultiplier(prefs.windSensitivity ?? 'medium') * 2),
    rain: clamp(
      100 - weather.precipitationProbability * sensitivityMultiplier(prefs.rainAvoidance ?? 'medium') * 1.5,
    ),
    uv: weather.uvIndex > 7 ? clamp(100 - (weather.uvIndex - 7) * 15) : 100,
    timing: getTimingScore(hour, prefs.timeBias ?? 'evening'),
  }

  const weights = WEIGHTS.run
  const baseScore = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0)
  }, 0)

  return finalizeScore(baseScore, factors, weather, prefs.comfort)
}

// Study scoring
export function scoreStudy(
  weather: WeatherConditions,
  prefs: ResolvedActivityPreferences,
  hour: number,
): { score: number; factors: Record<string, number> } {
  const idealTemp = prefs.preferCool ? 20 : 22

  const factors: Record<string, number> = {
    thermal: gaussian(weather.temperature, idealTemp, 4),
    daylight: getDaylightScore(hour, prefs.daylightPreference ?? 50),
    distraction: prefs.distractionSensitivity
      ? clamp(100 - weather.windSpeed * 2 - (weather.condition === 'storm' ? 30 : 0))
      : 80,
    timing: getStudyTimingScore(hour),
  }

  const weights = WEIGHTS.study
  const baseScore = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0)
  }, 0)

  return finalizeScore(baseScore, factors, weather, prefs.comfort)
}

// Social scoring
export function scoreSocial(
  weather: WeatherConditions,
  prefs: ResolvedActivityPreferences,
  hour: number,
  sunsetHour: number = 20,
): { score: number; factors: Record<string, number> } {
  const idealTemp = 22 + (prefs.warmthPreference ?? 50) / 25

  const factors: Record<string, number> = {
    temperature: gaussian(weather.temperature, idealTemp, 5),
    rain: clamp(100 - weather.precipitationProbability * 2),
    wind: clamp(100 - weather.windSpeed * 1.5),
    sunset: prefs.sunsetBonus && Math.abs(hour - sunsetHour) <= 1 ? 100 : 60,
    atmosphere: weather.condition === 'clear' || weather.condition === 'partly-cloudy' ? 100 : 60,
  }

  const weights = WEIGHTS.social
  const baseScore = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0)
  }, 0)

  return finalizeScore(baseScore, factors, weather, prefs.comfort)
}

// Flight scoring
export function scoreFlight(
  weather: WeatherConditions,
  prefs: ResolvedActivityPreferences,
  hour: number,
): { score: number; factors: Record<string, number> } {
  const turbSens = sensitivityMultiplier(prefs.turbulenceSensitivity ?? 'medium')

  const factors: Record<string, number> = {
    turbulence: clamp(100 - weather.windSpeed * turbSens * 2.5),
    weather: weather.condition === 'storm' ? 20 : weather.condition === 'rain' ? 50 : 100,
    stability: clamp(100 - Math.abs(weather.cloudCover - 30) * 0.5),
    timing: hour >= 6 && hour <= 10 ? 90 : hour >= 16 && hour <= 20 ? 85 : 70,
  }

  const weights = WEIGHTS.flight
  const baseScore = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0)
  }, 0)

  return finalizeScore(baseScore, factors, weather, prefs.comfort)
}

// Photo scoring
export function scorePhoto(
  weather: WeatherConditions,
  prefs: ResolvedActivityPreferences,
  hour: number,
  sunsetHour: number = 20,
  sunriseHour: number = 7,
): { score: number; factors: Record<string, number> } {
  const isGoldenHour = Math.abs(hour - sunsetHour) <= 1 || Math.abs(hour - sunriseHour) <= 1
  const wantsDramatic = prefs.cloudPreference === 'dramatic'

  const factors: Record<string, number> = {
    golden_hour: prefs.goldenHourPriority ? (isGoldenHour ? 100 : 40) : isGoldenHour ? 85 : 60,
    cloud_drama: wantsDramatic
      ? weather.cloudCover >= 30 && weather.cloudCover <= 70
        ? 100
        : 50
      : weather.cloudCover < 30
        ? 100
        : 60,
    rain: clamp(100 - weather.precipitationProbability * 1.5),
    visibility: weather.humidity < 80 ? 100 : clamp(100 - (weather.humidity - 80) * 3),
  }

  const weights = WEIGHTS.photo
  const baseScore = Object.entries(factors).reduce((sum, [key, value]) => {
    return sum + value * (weights[key as keyof typeof weights] ?? 0)
  }, 0)

  return finalizeScore(baseScore, factors, weather, prefs.comfort)
}

// Helper functions
function getTimingScore(hour: number, bias: 'morning' | 'neutral' | 'evening'): number {
  if (bias === 'morning') {
    return hour >= 6 && hour <= 10 ? 100 : hour >= 5 && hour <= 12 ? 70 : 40
  }
  if (bias === 'evening') {
    return hour >= 17 && hour <= 21 ? 100 : hour >= 15 && hour <= 22 ? 70 : 40
  }
  return 70
}

function getStudyTimingScore(hour: number): number {
  if (hour >= 9 && hour <= 12) return 100
  if (hour >= 14 && hour <= 16) return 60
  if (hour >= 16 && hour <= 20) return 85
  return 50
}

function getDaylightScore(hour: number, preference: number): number {
  const isDaylight = hour >= 7 && hour <= 20
  const prefersLight = preference > 50

  if (isDaylight && prefersLight) return 100
  if (!isDaylight && !prefersLight) return 90
  if (isDaylight && !prefersLight) return 70
  return 60
}

export function scoreWindow(
  weather: WeatherConditions,
  prefs: ResolvedActivityPreferences,
  hour: number,
  sunsetHour: number = 20,
  sunriseHour: number = 7,
): { score: number; factors: Record<string, number> } {
  switch (prefs.activity) {
    case 'run':
      return scoreRun(weather, prefs, hour)
    case 'study':
      return scoreStudy(weather, prefs, hour)
    case 'social':
      return scoreSocial(weather, prefs, hour, sunsetHour)
    case 'flight':
      return scoreFlight(weather, prefs, hour)
    case 'photo':
      return scorePhoto(weather, prefs, hour, sunsetHour, sunriseHour)
    default:
      return scoreRun(weather, { ...prefs, activity: 'run' }, hour)
  }
}

export function applyPreferenceScoresToWindows(windows: TimeWindow[], preferences: UserPreferences): TimeWindow[] {
  return windows.map((window) => {
    const hour = parseInt(window.startTime.split(':')[0], 10)
    const scores = { ...window.scores }

    for (const activity of SCORABLE_ACTIVITIES) {
      scores[activity] = scoreWindow(
        window.weather,
        getResolvedActivityPreferences(preferences, activity),
        hour,
      ).score
    }

    const selectedActivityFactors = scoreWindow(
      window.weather,
      getResolvedActivityPreferences(preferences, preferences.activity === 'custom' ? 'run' : preferences.activity),
      hour,
    ).factors

    return {
      ...window,
      scores,
      factorBreakdown: selectedActivityFactors,
    }
  })
}
