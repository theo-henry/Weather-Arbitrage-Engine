import type { CalendarEvent, SuggestedAlternative, TimeWindow, Activity } from './types'
import { isSameDay } from 'date-fns'

const GOOD_SCORE_THRESHOLD = 70
const MIN_IMPROVEMENT = 15

function getOverlappingWindows(
  startTime: Date,
  endTime: Date,
  windows: TimeWindow[]
): TimeWindow[] {
  return windows.filter((w) => {
    const wDate = new Date(w.date)
    const [wh, wm] = w.startTime.split(':').map(Number)
    wDate.setHours(wh, wm, 0, 0)
    const wEnd = new Date(wDate)
    wEnd.setMinutes(wEnd.getMinutes() + 30)
    return wDate < endTime && wEnd > startTime
  })
}

function getAverageScore(windows: TimeWindow[], activity: Activity): number {
  if (windows.length === 0) return -1
  const scores = windows.map((w) => w.scores[activity as keyof typeof w.scores] ?? 50)
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

function getWeatherReason(
  currentWindows: TimeWindow[],
  suggestedWindows: TimeWindow[]
): string {
  if (currentWindows.length === 0) return 'No weather data available'

  const reasons: string[] = []

  // Check rain
  const avgRain =
    currentWindows.reduce((a, w) => a + w.weather.precipitationProbability, 0) /
    currentWindows.length
  if (avgRain > 40) {
    reasons.push(`${Math.round(avgRain)}% rain chance`)
  }

  // Check wind
  const avgWind =
    currentWindows.reduce((a, w) => a + w.weather.windSpeed, 0) / currentWindows.length
  if (avgWind > 20) {
    reasons.push(`strong winds (${Math.round(avgWind)} km/h)`)
  }

  // Check temperature
  const avgTemp =
    currentWindows.reduce((a, w) => a + w.weather.temperature, 0) / currentWindows.length
  if (avgTemp > 35) {
    reasons.push(`high heat (${Math.round(avgTemp)}°C)`)
  } else if (avgTemp < 10) {
    reasons.push(`cold (${Math.round(avgTemp)}°C)`)
  }

  // Check conditions
  const conditions = currentWindows.map((w) => w.weather.condition)
  if (conditions.includes('storm')) {
    reasons.push('storms expected')
  } else if (conditions.includes('rain')) {
    reasons.push('rain expected')
  }

  const currentReason =
    reasons.length > 0
      ? reasons.join(', ')
      : 'suboptimal conditions'

  // Describe suggested time weather
  if (suggestedWindows.length > 0) {
    const sugAvgRain =
      suggestedWindows.reduce((a, w) => a + w.weather.precipitationProbability, 0) /
      suggestedWindows.length
    const sugCondition = suggestedWindows[0].weather.condition

    if (sugAvgRain < 10 && (sugCondition === 'clear' || sugCondition === 'partly-cloudy')) {
      return `${currentReason} at current time. Clear skies at suggested time.`
    }
    return `${currentReason} at current time. Better conditions at suggested time.`
  }

  return `${currentReason} at current time.`
}

export function computeSuggestion(
  event: CalendarEvent,
  windows: TimeWindow[]
): SuggestedAlternative | null {
  if (event.category !== 'weather-sensitive' || !event.activity) return null

  const eventStart = new Date(event.startTime)
  const eventEnd = new Date(event.endTime)
  const durationMs = eventEnd.getTime() - eventStart.getTime()
  const durationSlots = Math.ceil(durationMs / (30 * 60 * 1000))

  // Get current score
  const currentWindows = getOverlappingWindows(eventStart, eventEnd, windows)
  const currentScore = getAverageScore(currentWindows, event.activity)

  if (currentScore < 0 || currentScore >= GOOD_SCORE_THRESHOLD) return null

  // Find all same-day windows
  const sameDayWindows = windows
    .filter((w) => {
      const wDate = new Date(w.date)
      return isSameDay(wDate, eventStart)
    })
    .sort((a, b) => {
      const aH = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1])
      const bH = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1])
      return aH - bH
    })

  if (sameDayWindows.length < durationSlots) return null

  // Scan for best contiguous block of the right duration
  let bestScore = currentScore
  let bestStart: Date | null = null
  let bestEnd: Date | null = null
  let bestWindows: TimeWindow[] = []

  for (let i = 0; i <= sameDayWindows.length - durationSlots; i++) {
    const block = sameDayWindows.slice(i, i + durationSlots)
    const blockScore = getAverageScore(block, event.activity)

    if (blockScore > bestScore + MIN_IMPROVEMENT) {
      // Build actual start/end times from this block
      const [sh, sm] = block[0].startTime.split(':').map(Number)
      const [eh, em] = block[block.length - 1].endTime.split(':').map(Number)
      const blockStart = new Date(eventStart)
      blockStart.setHours(sh, sm, 0, 0)
      const blockEnd = new Date(eventStart)
      blockEnd.setHours(eh, em, 0, 0)

      // Prefer block closer to original time
      if (
        bestStart === null ||
        blockScore > bestScore + 5 ||
        Math.abs(blockStart.getTime() - eventStart.getTime()) <
          Math.abs(bestStart.getTime() - eventStart.getTime())
      ) {
        bestScore = blockScore
        bestStart = blockStart
        bestEnd = blockEnd
        bestWindows = block
      }
    }
  }

  if (!bestStart || !bestEnd) return null

  const reason = getWeatherReason(currentWindows, bestWindows)

  return {
    startTime: bestStart.toISOString(),
    endTime: bestEnd.toISOString(),
    score: bestScore,
    reason,
  }
}

export function computeAllSuggestions(
  events: CalendarEvent[],
  windows: TimeWindow[]
): Map<string, SuggestedAlternative | null> {
  const result = new Map<string, SuggestedAlternative | null>()
  for (const event of events) {
    if (event.category === 'weather-sensitive' && event.activity) {
      result.set(event.id, computeSuggestion(event, windows))
    }
  }
  return result
}
