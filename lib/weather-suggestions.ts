import type {
  Activity,
  CalendarEvent,
  ProtectedEventAnalysis,
  SuggestedAlternative,
  TimeWindow,
  UserPreferences,
  WeatherRiskLevel,
  WeatherRelevanceSource,
} from './types'
import { isSameDay } from 'date-fns'
import { formatBlockedTimeRule, getBlockedTimeMatches, isTimeRangeBlocked } from './preferences'
import { getWindowEnd, getWindowStart } from './weather-window-utils'

const GOOD_SCORE_THRESHOLD = 70
const HIGH_RISK_THRESHOLD = 50
const MIN_IMPROVEMENT = 15

const RUN_KEYWORDS = ['run', 'jog', 'workout', 'yoga', 'hike']
const COMMUTE_KEYWORDS = ['commute', 'drive', 'driving', 'car', 'walk to work', 'walking commute', 'bike to work', 'bike commute', 'cycle to work', 'cycling commute']
const SOCIAL_KEYWORDS = ['picnic', 'terrace', 'drinks', 'dinner', 'bbq', 'outdoor', 'park', 'beach', 'rooftop']
const PHOTO_KEYWORDS = ['photo', 'photos', 'photography', 'camera', 'golden hour', 'sunset']
const INDOOR_KEYWORDS = ['meeting', 'call', 'standup', 'office', 'zoom', 'meet', 'review', 'workshop', 'study', 'deep work']

type ScorableActivity = keyof TimeWindow['scores']

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

function getAverageScore(windows: TimeWindow[], activity: ScorableActivity): number {
  if (windows.length === 0) return -1
  const scores = windows.map((w) => w.scores[activity])
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
}

function getAverageWeather(windows: TimeWindow[]) {
  if (windows.length === 0) return null

  const totals = windows.reduce(
    (acc, window) => {
      acc.rain += window.weather.precipitationProbability
      acc.wind += window.weather.windSpeed
      acc.temp += window.weather.temperature
      return acc
    },
    { rain: 0, wind: 0, temp: 0 }
  )

  return {
    rain: totals.rain / windows.length,
    wind: totals.wind / windows.length,
    temp: totals.temp / windows.length,
  }
}

function getRiskReasons(currentWindows: TimeWindow[]): string[] {
  if (currentWindows.length === 0) return ['No weather data available']

  const avg = getAverageWeather(currentWindows)
  if (!avg) return ['No weather data available']

  const reasons: string[] = []
  if (avg.rain > 40) reasons.push(`${Math.round(avg.rain)}% rain chance`)
  if (avg.wind > 20) reasons.push(`strong winds (${Math.round(avg.wind)} km/h)`)
  if (avg.temp > 35) reasons.push(`high heat (${Math.round(avg.temp)}°C)`)
  if (avg.temp < 10) reasons.push(`cold temperatures (${Math.round(avg.temp)}°C)`)

  const conditions = currentWindows.map((w) => w.weather.condition)
  if (conditions.includes('storm')) {
    reasons.push('storms expected')
  } else if (conditions.includes('rain')) {
    reasons.push('rain expected')
  }

  return reasons.length > 0 ? reasons : ['suboptimal conditions']
}

function getWeatherReason(
  currentWindows: TimeWindow[],
  suggestedWindows: TimeWindow[],
  blockedReason?: string | null,
): string {
  const currentReasons = getRiskReasons(currentWindows)
  const currentReason = blockedReason ? `${blockedReason}; ${currentReasons.join(', ')}` : currentReasons.join(', ')

  if (suggestedWindows.length > 0) {
    const suggestedAvg = getAverageWeather(suggestedWindows)
    const suggestedCondition = suggestedWindows[0].weather.condition

    if (
      suggestedAvg &&
      suggestedAvg.rain < 10 &&
      (suggestedCondition === 'clear' || suggestedCondition === 'partly-cloudy')
    ) {
      return `${currentReason} at current time. Clearer skies at the suggested time.`
    }
    return `${currentReason} at current time. Better conditions at the suggested time.`
  }

  return `${currentReason} at current time.`
}

function inferActivity(text: string): Activity | null {
  if (COMMUTE_KEYWORDS.some((keyword) => text.includes(keyword))) return 'commute'
  if (RUN_KEYWORDS.some((keyword) => text.includes(keyword))) return 'run'
  if (PHOTO_KEYWORDS.some((keyword) => text.includes(keyword))) return 'photo'
  if (SOCIAL_KEYWORDS.some((keyword) => text.includes(keyword))) return 'social'
  return null
}

function inferWeatherRelevance(
  event: CalendarEvent
): {
  isWeatherRelevant: boolean
  relevanceSource?: WeatherRelevanceSource
  scoredActivity?: ScorableActivity
} {
  if (event.category === 'weather-sensitive' && event.activity && event.activity !== 'custom' && event.activity !== 'study') {
    return {
      isWeatherRelevant: true,
      relevanceSource: 'tagged',
      scoredActivity: event.activity,
    }
  }

  const text = [event.title, event.notes, event.location].filter(Boolean).join(' ').toLowerCase()
  if (INDOOR_KEYWORDS.some((keyword) => text.includes(keyword))) {
    return { isWeatherRelevant: false }
  }

  const inferred = inferActivity(text)
  if (!inferred || inferred === 'study' || inferred === 'custom') {
    return { isWeatherRelevant: false }
  }

  return {
    isWeatherRelevant: true,
    relevanceSource: 'heuristic',
    scoredActivity: inferred,
  }
}

function getRiskLevel(score: number): WeatherRiskLevel {
  if (score < HIGH_RISK_THRESHOLD) return 'high'
  if (score < GOOD_SCORE_THRESHOLD) return 'medium'
  return 'low'
}

function getSuggestionFingerprint(event: CalendarEvent, suggestion: SuggestedAlternative | null, currentScore?: number) {
  if (!suggestion) return `${event.id}:${event.startTime}:${event.endTime}:none`
  return [
    event.id,
    event.startTime,
    event.endTime,
    suggestion.startTime,
    suggestion.endTime,
    suggestion.score,
    currentScore ?? 'na',
  ].join('|')
}

export function getConflictingEvents(
  startTime: Date,
  endTime: Date,
  events: CalendarEvent[],
  excludeEventId?: string
) {
  return events.filter((event) => {
    if (excludeEventId && event.id === excludeEventId) return false
    const eventStart = new Date(event.startTime)
    const eventEnd = new Date(event.endTime)
    return startTime < eventEnd && endTime > eventStart
  })
}

export function doesWindowConflictWithEvents(
  window: TimeWindow,
  events: CalendarEvent[]
): boolean {
  if (events.length === 0) return false
  return getConflictingEvents(getWindowStart(window), getWindowEnd(window), events).length > 0
}

export function computeSuggestion(
  event: CalendarEvent,
  windows: TimeWindow[],
  events: CalendarEvent[] = [],
  options?: {
    preferences?: UserPreferences
    timezone?: string
  }
): SuggestedAlternative | null {
  const relevance = inferWeatherRelevance(event)
  if (!relevance.isWeatherRelevant || !relevance.scoredActivity) return null

  const timezone = options?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
  const eventStart = new Date(event.startTime)
  const eventEnd = new Date(event.endTime)
  const durationMs = eventEnd.getTime() - eventStart.getTime()
  const durationSlots = Math.ceil(durationMs / (30 * 60 * 1000))

  const currentWindows = getOverlappingWindows(eventStart, eventEnd, windows)
  const currentScore = getAverageScore(currentWindows, relevance.scoredActivity)
  const blockedRules =
    options?.preferences && event.activity
      ? getBlockedTimeMatches(options.preferences, event.activity, eventStart, eventEnd, timezone)
      : []
  const blockedReason =
    blockedRules.length > 0
      ? `blocked by your schedule rule (${blockedRules.map((rule) => formatBlockedTimeRule(rule)).join(', ')})`
      : null

  if (currentScore < 0 || (currentScore >= GOOD_SCORE_THRESHOLD && !blockedReason)) return null

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

  let bestScore = currentScore
  let bestStart: Date | null = null
  let bestEnd: Date | null = null
  let bestWindows: TimeWindow[] = []

  for (let i = 0; i <= sameDayWindows.length - durationSlots; i++) {
    const block = sameDayWindows.slice(i, i + durationSlots)
    const blockScore = getAverageScore(block, relevance.scoredActivity)
    if (blockScore <= bestScore + MIN_IMPROVEMENT) continue

    const [sh, sm] = block[0].startTime.split(':').map(Number)
    const [eh, em] = block[block.length - 1].endTime.split(':').map(Number)
    const blockStart = new Date(eventStart)
    blockStart.setHours(sh, sm, 0, 0)
    const blockEnd = new Date(eventStart)
    blockEnd.setHours(eh, em, 0, 0)

    if (
      options?.preferences &&
      event.activity &&
      isTimeRangeBlocked(options.preferences, event.activity, blockStart, blockEnd, timezone)
    ) {
      continue
    }

    if (getConflictingEvents(blockStart, blockEnd, events, event.id).length > 0) continue

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

  if (!bestStart || !bestEnd) return null

  return {
    startTime: bestStart.toISOString(),
    endTime: bestEnd.toISOString(),
    score: bestScore,
    reason: getWeatherReason(currentWindows, bestWindows, blockedReason),
  }
}

export function computeProtectedEventAnalyses(
  events: CalendarEvent[],
  windows: TimeWindow[],
  options?: {
    dismissedFingerprints?: Set<string>
    preferences?: UserPreferences
    timezone?: string
  }
): ProtectedEventAnalysis[] {
  const dismissedFingerprints = options?.dismissedFingerprints ?? new Set<string>()
  const timezone = options?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone

  return events.map((event) => {
    const relevance = inferWeatherRelevance(event)
    if (!relevance.isWeatherRelevant || !relevance.scoredActivity) {
      return {
        eventId: event.id,
        event,
        riskLevel: 'low',
        riskReasons: [],
        isWeatherRelevant: false,
        currentScore: undefined,
        recommendedAlternative: null,
        dismissed: false,
      }
    }

    const currentWindows = getOverlappingWindows(new Date(event.startTime), new Date(event.endTime), windows)
    const currentScore = getAverageScore(currentWindows, relevance.scoredActivity)
    const blockedRules =
      options?.preferences && event.activity
        ? getBlockedTimeMatches(
            options.preferences,
            event.activity,
            new Date(event.startTime),
            new Date(event.endTime),
            timezone,
          )
        : []
    const blockedByPreference = blockedRules.length > 0
    const recommendedAlternative =
      currentScore >= 0 && (currentScore < GOOD_SCORE_THRESHOLD || blockedByPreference)
        ? computeSuggestion(event, windows, events, {
            preferences: options?.preferences,
            timezone,
          })
        : null

    const fingerprint = getSuggestionFingerprint(event, recommendedAlternative, currentScore >= 0 ? currentScore : undefined)
    const dismissed = dismissedFingerprints.has(fingerprint)
    const riskReasons = currentScore >= 0 ? getRiskReasons(currentWindows) : ['No weather data available']

    if (blockedByPreference) {
      riskReasons.unshift(
        `Blocked by your schedule rule: ${blockedRules.map((rule) => formatBlockedTimeRule(rule)).join(', ')}`,
      )
    }

    return {
      eventId: event.id,
      event,
      riskLevel: blockedByPreference ? 'high' : currentScore >= 0 ? getRiskLevel(currentScore) : 'low',
      riskReasons,
      isWeatherRelevant: true,
      weatherRelevanceSource: relevance.relevanceSource,
      currentScore: currentScore >= 0 ? currentScore : undefined,
      recommendedAlternative: dismissed ? null : recommendedAlternative,
      dismissed,
      suggestionFingerprint: fingerprint,
    }
  })
}

export function computeAllSuggestions(
  events: CalendarEvent[],
  windows: TimeWindow[],
  options?: {
    preferences?: UserPreferences
    timezone?: string
  }
): Map<string, SuggestedAlternative | null> {
  const result = new Map<string, SuggestedAlternative | null>()
  const analyses = computeProtectedEventAnalyses(events, windows, options)
  for (const analysis of analyses) {
    if (analysis.isWeatherRelevant) {
      result.set(analysis.eventId, analysis.recommendedAlternative ?? null)
    }
  }
  return result
}
