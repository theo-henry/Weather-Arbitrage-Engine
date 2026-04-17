import { addDays } from 'date-fns'
import type {
  Activity,
  CalendarEvent,
  City,
  EventCategory,
  EventColor,
  PendingCalendarOperation,
  TimeWindow,
} from '@/lib/types'
import { computeProtectedEventAnalyses } from '@/lib/weather-suggestions'
import type { LLMToolDefinition } from './provider'

type ScorableActivity = keyof TimeWindow['scores']
type RelativeDay = 'today' | 'tomorrow'
type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'any'

interface ToolContext {
  city: City
  events: CalendarEvent[]
  windows: TimeWindow[]
  now: Date
  timezone: string
}

interface ToolExecutionResult {
  response: unknown
  pendingOperation?: PendingCalendarOperation
  referencedEventIds?: string[]
}

const SCORABLE_ACTIVITIES: ScorableActivity[] = ['run', 'study', 'social', 'flight', 'photo']

const DEFAULT_COLORS: Record<string, EventColor> = {
  run: 'amber',
  study: 'violet',
  social: 'pink',
  photo: 'amber',
  flight: 'blue',
  custom: 'blue',
}

function isScorableActivity(value: unknown): value is ScorableActivity {
  return typeof value === 'string' && SCORABLE_ACTIVITIES.includes(value as ScorableActivity)
}

function getDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getWeekdayLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'long',
  }).format(date)
}

function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function resolveRelativeDay(relativeDay: RelativeDay | undefined, now: Date, timezone: string) {
  if (!relativeDay) return null
  const target = relativeDay === 'tomorrow' ? addDays(now, 1) : now
  return getDateKey(target, timezone)
}

function getWindowStart(window: TimeWindow): Date {
  const date = new Date(window.date)
  const [hour, minute] = window.startTime.split(':').map(Number)
  date.setHours(hour, minute, 0, 0)
  return date
}

function getWindowEnd(window: TimeWindow): Date {
  const date = new Date(window.date)
  const [hour, minute] = window.endTime.split(':').map(Number)
  date.setHours(hour, minute, 0, 0)
  return date
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

function getOverlappingWindows(startTime: Date, endTime: Date, windows: TimeWindow[]) {
  return windows.filter((window) => {
    const windowStart = getWindowStart(window)
    const windowEnd = getWindowEnd(window)
    return overlaps(startTime, endTime, windowStart, windowEnd)
  })
}

function getAverageScore(windows: TimeWindow[], activity: ScorableActivity) {
  if (windows.length === 0) return null
  const total = windows.reduce((sum, window) => sum + window.scores[activity], 0)
  return Math.round(total / windows.length)
}

function getAverageMetrics(windows: TimeWindow[]) {
  if (windows.length === 0) return null

  const total = windows.reduce(
    (acc, window) => {
      acc.temperature += window.weather.temperature
      acc.wind += window.weather.windSpeed
      acc.rain += window.weather.precipitationProbability
      return acc
    },
    { temperature: 0, wind: 0, rain: 0 }
  )

  return {
    temperature: Math.round(total.temperature / windows.length),
    wind: Math.round(total.wind / windows.length),
    rain: Math.round(total.rain / windows.length),
  }
}

function getTimeBucket(date: Date, timezone: string): PreferredTime {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(date)
  )

  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

function matchesPreferredTime(date: Date, preferredTime: PreferredTime | undefined, timezone: string) {
  if (!preferredTime || preferredTime === 'any') return true
  return getTimeBucket(date, timezone) === preferredTime
}

function matchesDateRange(date: Date, startDate: string | undefined, endDate: string | undefined, timezone: string) {
  const key = getDateKey(date, timezone)
  if (startDate && key < startDate) return false
  if (endDate && key > endDate) return false
  return true
}

function getConflictingEvents(
  startTime: Date,
  endTime: Date,
  events: CalendarEvent[],
  timezone: string,
  excludeEventId?: string
) {
  return events.filter((event) => {
    if (excludeEventId && event.id === excludeEventId) return false
    const eventStart = new Date(event.startTime)
    const eventEnd = new Date(event.endTime)
    return overlaps(startTime, endTime, eventStart, eventEnd)
  }).map((event) => ({
    id: event.id,
    title: event.title,
    startTime: formatDateTime(new Date(event.startTime), timezone),
    endTime: formatTime(new Date(event.endTime), timezone),
  }))
}

function getEventSearchText(event: CalendarEvent, timezone: string) {
  const parts = [
    event.title,
    event.activity || '',
    event.category,
    event.location || '',
    event.notes || '',
    event.participants?.join(' ') || '',
    formatDateTime(new Date(event.startTime), timezone),
    formatTime(new Date(event.startTime), timezone),
  ]

  return parts.join(' ').toLowerCase()
}

function getEventPreview(event: CalendarEvent, timezone: string) {
  return {
    id: event.id,
    title: event.title,
    activity: event.activity || null,
    category: event.category,
    startTime: event.startTime,
    endTime: event.endTime,
    displayTime: `${formatDateTime(new Date(event.startTime), timezone)} - ${formatTime(new Date(event.endTime), timezone)}`,
    location: event.location || null,
  }
}

function summarizeWeather(windows: TimeWindow[]) {
  if (windows.length === 0) return 'No weather data available for that time range.'
  const metrics = getAverageMetrics(windows)
  if (!metrics) return 'No weather data available for that time range.'
  const primaryCondition = windows[0].weather.condition.replace('-', ' ')
  return `${primaryCondition}, ${metrics.temperature}°C, ${metrics.wind} km/h wind, ${metrics.rain}% rain chance`
}

function coerceCategory(activity: Activity | undefined, category: EventCategory | undefined): EventCategory {
  if (category) return category
  if (!activity || activity === 'study' || activity === 'custom') return 'indoor'
  return 'weather-sensitive'
}

function coerceColor(activity: Activity | undefined, color: EventColor | undefined): EventColor {
  if (color) return color
  return DEFAULT_COLORS[activity || 'custom'] || 'blue'
}

function computeWeatherScore(
  event: Pick<CalendarEvent, 'category' | 'activity' | 'startTime' | 'endTime'>,
  windows: TimeWindow[]
) {
  if (event.category !== 'weather-sensitive' || !isScorableActivity(event.activity)) return undefined
  const overlapping = getOverlappingWindows(new Date(event.startTime), new Date(event.endTime), windows)
  return getAverageScore(overlapping, event.activity) ?? undefined
}

function sanitizeParticipants(participants: unknown): string[] | undefined {
  if (!Array.isArray(participants)) return undefined
  const clean = participants.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
  return clean.length > 0 ? clean : undefined
}

function getToolDeclarations(): LLMToolDefinition[] {
  return [
    {
      name: 'list_events',
      description: 'List current calendar events, optionally filtered by day, activity, or title query.',
      parameters: {
        type: 'object',
        properties: {
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          title_query: { type: 'string' },
          activity: { type: 'string', enum: ['run', 'study', 'social', 'flight', 'photo', 'custom'] },
          limit: { type: 'integer' },
        },
      },
    },
    {
      name: 'find_events',
      description: 'Find one or more events that match a user reference, like "my picnic" or "the 3pm meeting".',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          limit: { type: 'integer' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_weather_summary',
      description: 'Summarize weather and optional activity suitability for a given time range or part of the day.',
      parameters: {
        type: 'object',
        properties: {
          activity: { type: 'string', enum: ['run', 'study', 'social', 'flight', 'photo'] },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'any'] },
        },
      },
    },
    {
      name: 'find_optimal_slots',
      description: 'Find the best conflict-free weather windows for a requested activity and duration.',
      parameters: {
        type: 'object',
        properties: {
          activity: { type: 'string', enum: ['run', 'study', 'social', 'flight', 'photo'] },
          duration_minutes: { type: 'integer' },
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          start_date: { type: 'string', description: 'YYYY-MM-DD in the user timezone' },
          end_date: { type: 'string', description: 'YYYY-MM-DD in the user timezone' },
          preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'any'] },
          limit: { type: 'integer' },
        },
        required: ['activity', 'duration_minutes'],
      },
    },
    {
      name: 'score_time_range',
      description: 'Score a specific time range for a weather-scored activity.',
      parameters: {
        type: 'object',
        properties: {
          activity: { type: 'string', enum: ['run', 'study', 'social', 'flight', 'photo'] },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
        },
        required: ['activity', 'start_time', 'end_time'],
      },
    },
    {
      name: 'list_at_risk_events',
      description: 'List weather-risk events and their best suggested same-day move.',
      parameters: {
        type: 'object',
        properties: {
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          limit: { type: 'integer' },
        },
      },
    },
    {
      name: 'draft_create_event',
      description: 'Draft a new calendar event proposal. This does not apply the change.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          category: { type: 'string', enum: ['weather-sensitive', 'indoor'] },
          activity: { type: 'string', enum: ['run', 'study', 'social', 'flight', 'photo', 'custom'] },
          color: { type: 'string', enum: ['blue', 'green', 'amber', 'red', 'violet', 'pink'] },
          location: { type: 'string' },
          participants: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['title', 'start_time', 'end_time'],
      },
    },
    {
      name: 'draft_update_event',
      description: 'Draft an update to an existing calendar event. This does not apply the change.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          title: { type: 'string' },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          category: { type: 'string', enum: ['weather-sensitive', 'indoor'] },
          activity: { type: 'string', enum: ['run', 'study', 'social', 'flight', 'photo', 'custom'] },
          color: { type: 'string', enum: ['blue', 'green', 'amber', 'red', 'violet', 'pink'] },
          location: { type: 'string' },
          participants: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['event_id'],
      },
    },
    {
      name: 'draft_delete_event',
      description: 'Draft deleting an existing event. This does not apply the change.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
        },
        required: ['event_id'],
      },
    },
  ]
}

function executeListEvents(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
  const titleQuery = typeof args.title_query === 'string' ? args.title_query.toLowerCase() : ''
  const activity = typeof args.activity === 'string' ? args.activity : undefined
  const limit = typeof args.limit === 'number' ? args.limit : 10

  const matches = context.events
    .filter((event) => {
      if (relativeDayKey && getDateKey(new Date(event.startTime), context.timezone) !== relativeDayKey) return false
      if (activity && event.activity !== activity) return false
      if (titleQuery && !getEventSearchText(event, context.timezone).includes(titleQuery)) return false
      return true
    })
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit)

  return {
    response: {
      count: matches.length,
      events: matches.map((event) => getEventPreview(event, context.timezone)),
    },
    referencedEventIds: matches.map((event) => event.id),
  }
}

function executeFindEvents(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const query = String(args.query || '').trim().toLowerCase()
  const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
  const limit = typeof args.limit === 'number' ? args.limit : 5

  const matches = context.events
    .map((event) => {
      let score = 0
      const haystack = getEventSearchText(event, context.timezone)
      if (haystack.includes(query)) score += 5

      for (const token of query.split(/\s+/).filter(Boolean)) {
        if (haystack.includes(token)) score += 1
      }

      if (relativeDayKey && getDateKey(new Date(event.startTime), context.timezone) === relativeDayKey) {
        score += 2
      }

      return { event, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime())
    .slice(0, limit)

  return {
    response: {
      count: matches.length,
      events: matches.map((item) => getEventPreview(item.event, context.timezone)),
      ambiguous: matches.length > 1,
    },
    referencedEventIds: matches.map((item) => item.event.id),
  }
}

function executeGetWeatherSummary(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  let relevantWindows: TimeWindow[] = []

  if (typeof args.start_time === 'string' && typeof args.end_time === 'string') {
    relevantWindows = getOverlappingWindows(new Date(args.start_time), new Date(args.end_time), context.windows)
  } else {
    const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
    const preferredTime = (args.preferred_time as PreferredTime | undefined) || 'any'
    relevantWindows = context.windows.filter((window) => {
      const start = getWindowStart(window)
      if (relativeDayKey && getDateKey(start, context.timezone) !== relativeDayKey) return false
      return matchesPreferredTime(start, preferredTime, context.timezone)
    })
  }

  const activity = isScorableActivity(args.activity) ? args.activity : null
  const averageScore = activity ? getAverageScore(relevantWindows, activity) : null
  const bestWindow =
    activity && relevantWindows.length > 0
      ? [...relevantWindows].sort((a, b) => b.scores[activity] - a.scores[activity])[0]
      : null

  return {
    response: {
      windowCount: relevantWindows.length,
      summary: summarizeWeather(relevantWindows),
      averageScore,
      bestWindow: bestWindow
        ? {
            startTime: getWindowStart(bestWindow).toISOString(),
            endTime: getWindowEnd(bestWindow).toISOString(),
            score: bestWindow.scores[activity as ScorableActivity],
            location: bestWindow.location,
          }
        : null,
    },
  }
}

function executeFindOptimalSlots(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  if (!isScorableActivity(args.activity)) {
    return { response: { error: 'Unsupported activity for weather scoring.' } }
  }

  const durationMinutes = typeof args.duration_minutes === 'number' ? args.duration_minutes : 60
  const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
  const preferredTime = (args.preferred_time as PreferredTime | undefined) || 'any'
  const startDate = typeof args.start_date === 'string' ? args.start_date : undefined
  const endDate = typeof args.end_date === 'string' ? args.end_date : undefined
  const limit = typeof args.limit === 'number' ? args.limit : 3
  const requiredSlots = Math.max(1, Math.ceil(durationMinutes / 30))

  const windowsByDay = new Map<string, TimeWindow[]>()
  for (const window of context.windows) {
    const start = getWindowStart(window)
    const dateKey = getDateKey(start, context.timezone)
    if (relativeDayKey && dateKey !== relativeDayKey) continue
    if (!matchesDateRange(start, startDate, endDate, context.timezone)) continue
    if (!matchesPreferredTime(start, preferredTime, context.timezone)) continue
    const existing = windowsByDay.get(dateKey) || []
    existing.push(window)
    windowsByDay.set(dateKey, existing)
  }

  const candidates: Array<{
    startTime: string
    endTime: string
    score: number
    location: string
    weatherSummary: string
  }> = []

  for (const dayWindows of windowsByDay.values()) {
    const sorted = [...dayWindows].sort((a, b) => getWindowStart(a).getTime() - getWindowStart(b).getTime())
    for (let index = 0; index <= sorted.length - requiredSlots; index++) {
      const block = sorted.slice(index, index + requiredSlots)
      const blockStart = getWindowStart(block[0])
      const blockEnd = getWindowEnd(block[block.length - 1])
      const conflicts = getConflictingEvents(blockStart, blockEnd, context.events, context.timezone)
      if (conflicts.length > 0) continue

      const score = getAverageScore(block, args.activity)
      if (score === null) continue

      candidates.push({
        startTime: blockStart.toISOString(),
        endTime: blockEnd.toISOString(),
        score,
        location: block[0].location,
        weatherSummary: summarizeWeather(block),
      })
    }
  }

  const topCandidates = candidates
    .sort((a, b) => b.score - a.score || new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit)

  return {
    response: {
      count: topCandidates.length,
      slots: topCandidates.map((candidate) => ({
        ...candidate,
        displayTime: `${formatDateTime(new Date(candidate.startTime), context.timezone)} - ${formatTime(new Date(candidate.endTime), context.timezone)}`,
      })),
    },
  }
}

function executeScoreTimeRange(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  if (!isScorableActivity(args.activity)) {
    return { response: { error: 'Unsupported activity for weather scoring.' } }
  }

  const startTime = new Date(String(args.start_time))
  const endTime = new Date(String(args.end_time))
  const overlapping = getOverlappingWindows(startTime, endTime, context.windows)
  const conflicts = getConflictingEvents(startTime, endTime, context.events, context.timezone)

  return {
    response: {
      score: getAverageScore(overlapping, args.activity),
      weatherSummary: summarizeWeather(overlapping),
      conflictCount: conflicts.length,
      conflicts,
    },
    referencedEventIds: conflicts.map((conflict) => conflict.id),
  }
}

function executeListAtRiskEvents(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
  const limit = typeof args.limit === 'number' ? args.limit : 5

  const analyses = computeProtectedEventAnalyses(context.events, context.windows)
    .filter((analysis) => {
      if (!analysis.isWeatherRelevant || analysis.riskLevel === 'low') return false
      if (relativeDayKey && getDateKey(new Date(analysis.event.startTime), context.timezone) !== relativeDayKey) return false
      return true
    })
    .sort((a, b) => {
      const weight = { high: 0, medium: 1, low: 2 }
      return (
        weight[a.riskLevel] - weight[b.riskLevel] ||
        new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
      )
    })
    .slice(0, limit)

  return {
    response: {
      count: analyses.length,
      events: analyses.map((analysis) => ({
        id: analysis.eventId,
        title: analysis.event.title,
        riskLevel: analysis.riskLevel,
        reasons: analysis.riskReasons,
        currentScore: analysis.currentScore ?? null,
        currentTime: `${formatDateTime(new Date(analysis.event.startTime), context.timezone)} - ${formatTime(
          new Date(analysis.event.endTime),
          context.timezone
        )}`,
        recommendedAlternative: analysis.recommendedAlternative
          ? {
              startTime: analysis.recommendedAlternative.startTime,
              endTime: analysis.recommendedAlternative.endTime,
              displayTime: `${formatDateTime(new Date(analysis.recommendedAlternative.startTime), context.timezone)} - ${formatTime(
                new Date(analysis.recommendedAlternative.endTime),
                context.timezone
              )}`,
              score: analysis.recommendedAlternative.score,
              reason: analysis.recommendedAlternative.reason,
            }
          : null,
      })),
    },
    referencedEventIds: analyses.map((analysis) => analysis.eventId),
  }
}

function executeDraftCreateEvent(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const startTime = new Date(String(args.start_time))
  const endTime = new Date(String(args.end_time))
  if (!(startTime < endTime)) {
    return { response: { status: 'invalid_time_range', message: 'The event end time must be after the start time.' } }
  }

  const conflicts = getConflictingEvents(startTime, endTime, context.events, context.timezone)
  if (conflicts.length > 0) {
    return {
      response: {
        status: 'blocked_conflict',
        message: 'The requested time conflicts with existing calendar events.',
        conflicts,
      },
      referencedEventIds: conflicts.map((conflict) => conflict.id),
    }
  }

  const activity = typeof args.activity === 'string' ? (args.activity as Activity) : undefined
  const category = coerceCategory(activity, args.category as EventCategory | undefined)
  const color = coerceColor(activity, args.color as EventColor | undefined)
  const participants = sanitizeParticipants(args.participants)
  const eventDraft: Omit<CalendarEvent, 'id'> = {
    title: String(args.title),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    category,
    color,
    createdVia: 'chat',
    ...(activity ? { activity } : {}),
    ...(typeof args.location === 'string' && args.location ? { location: args.location } : {}),
    ...(participants ? { participants } : {}),
    ...(typeof args.notes === 'string' && args.notes ? { notes: args.notes } : {}),
    suggestedAlternative: null,
  }

  const weatherScore = computeWeatherScore(eventDraft, context.windows)
  if (weatherScore !== undefined) {
    eventDraft.weatherScore = weatherScore
  }

  const summary = `Create "${eventDraft.title}" for ${formatDateTime(startTime, context.timezone)} - ${formatTime(endTime, context.timezone)}.`

  return {
    response: {
      status: 'drafted',
      summary,
      preview: {
        ...eventDraft,
        weatherSummary: summarizeWeather(getOverlappingWindows(startTime, endTime, context.windows)),
      },
    },
    pendingOperation: {
      type: 'create_event',
      summary,
      eventDraft,
    },
  }
}

function executeDraftUpdateEvent(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const eventId = String(args.event_id)
  const existingEvent = context.events.find((event) => event.id === eventId)
  if (!existingEvent) {
    return { response: { status: 'not_found', message: `No event exists with id ${eventId}.` } }
  }

  const changes: Partial<CalendarEvent> = {}
  const scalarFields: Array<keyof CalendarEvent> = ['title', 'location', 'notes', 'category', 'activity', 'color', 'startTime', 'endTime']
  for (const field of scalarFields) {
    const argKey = field === 'startTime' ? 'start_time' : field === 'endTime' ? 'end_time' : field
    if (argKey in args) {
      const value = args[argKey]
      if (typeof value === 'string') {
        ;(changes as Record<string, unknown>)[field] = field === 'startTime' || field === 'endTime' ? new Date(value).toISOString() : value
      }
    }
  }

  const participants = sanitizeParticipants(args.participants)
  if (participants) {
    changes.participants = participants
  }

  const nextEvent: CalendarEvent = {
    ...existingEvent,
    ...changes,
  }

  if (!(new Date(nextEvent.startTime) < new Date(nextEvent.endTime))) {
    return { response: { status: 'invalid_time_range', message: 'The event end time must be after the start time.' } }
  }

  const conflicts = getConflictingEvents(
    new Date(nextEvent.startTime),
    new Date(nextEvent.endTime),
    context.events,
    context.timezone,
    existingEvent.id
  )

  if (conflicts.length > 0) {
    return {
      response: {
        status: 'blocked_conflict',
        message: 'The requested update would conflict with other calendar events.',
        conflicts,
      },
      referencedEventIds: conflicts.map((conflict) => conflict.id),
    }
  }

  nextEvent.suggestedAlternative = null
  const weatherScore = computeWeatherScore(nextEvent, context.windows)
  if (weatherScore !== undefined) {
    changes.weatherScore = weatherScore
  } else {
    changes.weatherScore = undefined
  }

  const summary = `Update "${existingEvent.title}" to ${formatDateTime(new Date(nextEvent.startTime), context.timezone)} - ${formatTime(new Date(nextEvent.endTime), context.timezone)}.`

  return {
    response: {
      status: 'drafted',
      summary,
      preview: {
        ...existingEvent,
        ...changes,
      },
    },
    pendingOperation: {
      type: 'update_event',
      summary,
      eventId: existingEvent.id,
      changes,
    },
    referencedEventIds: [existingEvent.id],
  }
}

function executeDraftDeleteEvent(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const eventId = String(args.event_id)
  const event = context.events.find((item) => item.id === eventId)
  if (!event) {
    return { response: { status: 'not_found', message: `No event exists with id ${eventId}.` } }
  }

  const summary = `Delete "${event.title}" on ${formatDateTime(new Date(event.startTime), context.timezone)}.`
  return {
    response: {
      status: 'drafted',
      summary,
      preview: getEventPreview(event, context.timezone),
    },
    pendingOperation: {
      type: 'delete_event',
      summary,
      eventId: event.id,
    },
    referencedEventIds: [event.id],
  }
}

function executeTool(name: string, args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  switch (name) {
    case 'list_events':
      return executeListEvents(args, context)
    case 'find_events':
      return executeFindEvents(args, context)
    case 'get_weather_summary':
      return executeGetWeatherSummary(args, context)
    case 'find_optimal_slots':
      return executeFindOptimalSlots(args, context)
    case 'score_time_range':
      return executeScoreTimeRange(args, context)
    case 'list_at_risk_events':
      return executeListAtRiskEvents(args, context)
    case 'draft_create_event':
      return executeDraftCreateEvent(args, context)
    case 'draft_update_event':
      return executeDraftUpdateEvent(args, context)
    case 'draft_delete_event':
      return executeDraftDeleteEvent(args, context)
    default:
      return { response: { error: `Unknown tool: ${name}` } }
  }
}

export function buildAssistantTools(context: ToolContext) {
  return {
    declarations: getToolDeclarations(),
    execute(name: string, args: Record<string, unknown>) {
      return executeTool(name, args, context)
    },
  }
}
