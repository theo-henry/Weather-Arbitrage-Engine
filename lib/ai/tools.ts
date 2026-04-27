import { addDays } from 'date-fns'
import {
  formatBlockedTimeRule,
  getActivityProfile,
  getBlockedTimeMatchesForAnyActivity,
  getBlockedTimeMatches,
  isTimeRangeBlocked,
  isTimeRangeBlockedForAnyActivity,
  normalizeUserPreferences,
  removeBlockedTimeRule,
  upsertBlockedTimeRule,
} from '@/lib/preferences'
import type {
  Activity,
  BlockedTimeRule,
  CalendarEvent,
  City,
  CommuteMode,
  EventCategory,
  EventColor,
  PendingCalendarOperation,
  TimeWindow,
  UserPreferences,
  WeekdayKey,
} from '@/lib/types'
import { computeProtectedEventAnalyses } from '@/lib/weather-suggestions'
import { applyPreferenceScoresToWindows } from '@/lib/scoring'
import type { LLMToolDefinition } from './provider'
import { matchesPreferredTimeBucket, type PreferredTime } from '@/lib/time-windows'

type ScorableActivity = keyof TimeWindow['scores']
type RelativeDay = 'today' | 'tomorrow'

interface ToolContext {
  city: City
  events: CalendarEvent[]
  windows: TimeWindow[]
  preferences: UserPreferences
  now: Date
  timezone: string
}

interface ToolExecutionResult {
  response: unknown
  pendingOperation?: PendingCalendarOperation
  referencedEventIds?: string[]
}

const SCORABLE_ACTIVITIES: ScorableActivity[] = ['run', 'study', 'social', 'commute', 'photo']

const DEFAULT_COLORS: Record<string, EventColor> = {
  run: 'amber',
  study: 'violet',
  social: 'pink',
  photo: 'amber',
  commute: 'blue',
  custom: 'blue',
}

function normalizeActivityAlias(value: unknown): Activity | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim().toLowerCase()

  if (normalized === 'flight') return 'commute'
  if (normalized.includes('photo') || normalized.includes('camera') || normalized.includes('sunset')) return 'photo'
  if (
    normalized.includes('walk') ||
    normalized.includes('bike') ||
    normalized.includes('cycling') ||
    normalized.includes('cycle') ||
    normalized.includes('commute') ||
    normalized.includes('drive') ||
    normalized.includes('driving') ||
    normalized.includes('travel') ||
    normalized.includes('transit')
  ) {
    return 'commute'
  }
  if (
    normalized.includes('run') ||
    normalized.includes('jog') ||
    normalized.includes('hike') ||
    normalized.includes('workout') ||
    normalized.includes('exercise') ||
    normalized.includes('tennis')
  ) {
    return 'run'
  }
  if (
    normalized.includes('study') ||
    normalized.includes('read') ||
    normalized.includes('reading') ||
    normalized.includes('focus') ||
    normalized.includes('work') ||
    normalized.includes('laptop') ||
    normalized.includes('write') ||
    normalized.includes('writing')
  ) {
    return 'study'
  }
  if (
    normalized.includes('social') ||
    normalized.includes('dinner') ||
    normalized.includes('drinks') ||
    normalized.includes('picnic') ||
    normalized.includes('date') ||
    normalized.includes('friends') ||
    normalized.includes('terrace') ||
    normalized.includes('market') ||
    normalized.includes('park')
  ) {
    return 'social'
  }

  if (
    normalized === 'run' ||
    normalized === 'study' ||
    normalized === 'social' ||
    normalized === 'commute' ||
    normalized === 'photo' ||
    normalized === 'custom'
  ) {
    return normalized
  }

  return undefined
}

function normalizeScorableActivity(value: unknown): ScorableActivity | undefined {
  const activity = normalizeActivityAlias(value)
  return activity && SCORABLE_ACTIVITIES.includes(activity as ScorableActivity)
    ? (activity as ScorableActivity)
    : undefined
}

function normalizeCommuteMode(value: unknown): CommuteMode | undefined {
  if (value === 'car' || value === 'bike' || value === 'walk') return value
  if (typeof value !== 'string') return undefined
  const normalized = value.toLowerCase()
  if (normalized.includes('walk') || normalized.includes('stroll')) return 'walk'
  if (normalized.includes('bike') || normalized.includes('cycl')) return 'bike'
  if (normalized.includes('drive') || normalized.includes('car')) return 'car'
  return undefined
}

function getScoredWindowsForActivity(
  windows: TimeWindow[],
  preferences: UserPreferences,
  activity: ScorableActivity | undefined | null,
  commuteMode: CommuteMode | undefined,
) {
  if (activity !== 'commute' || !commuteMode) return windows

  return applyPreferenceScoresToWindows(windows, {
    ...preferences,
    activityProfiles: {
      ...preferences.activityProfiles,
      commute: {
        ...(preferences.activityProfiles.commute ?? {}),
        commuteMode,
      },
    },
  })
}

function isScorableActivity(value: unknown): value is ScorableActivity {
  return !!normalizeScorableActivity(value)
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

function matchesPreferredTime(date: Date, preferredTime: PreferredTime | undefined, timezone: string) {
  return matchesPreferredTimeBucket(date, preferredTime, timezone)
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

function isActivity(value: unknown): value is Activity {
  return (
    typeof value === 'string' &&
    ['run', 'study', 'social', 'commute', 'photo', 'custom'].includes(value)
  )
}

function resolveSchedulingActivity(activity: unknown, context: ToolContext): Activity {
  return normalizeActivityAlias(activity) ?? context.preferences.activity
}

function isWeekday(value: unknown): value is WeekdayKey {
  return typeof value === 'string' && ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].includes(value)
}

function isTimeString(value: unknown, allowEndOfDay = false): value is string {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  if (hours === 24) return allowEndOfDay && minutes === 0
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function getSettingsSnapshot(preferences: UserPreferences, activity: Activity = preferences.activity) {
  const profile = getActivityProfile(preferences, activity)
  const blockedRules = preferences.blockedTimeRules[activity] ?? []

  return {
    selectedActivity: preferences.activity,
    city: preferences.city,
    usualTime: preferences.usualTime,
    activity,
    profile: {
      ...profile,
      comfort: profile.comfort ?? null,
    },
    blockedRules: blockedRules.map((rule) => ({
      id: rule.id,
      day: rule.day,
      startTime: rule.startTime,
      endTime: rule.endTime,
      label: formatBlockedTimeRule(rule),
    })),
  }
}

function buildBlockedPreferenceMessage(
  preferences: UserPreferences,
  activity: Activity,
  startTime: Date,
  endTime: Date,
  timezone: string,
) {
  const matches = getBlockedTimeMatches(preferences, activity, startTime, endTime, timezone)
  if (matches.length === 0) return null

  return {
    status: 'blocked_preference',
    message: `That ${activity} time falls inside your blocked scheduling windows.`,
    blockedRules: matches.map((rule) => ({
      id: rule.id,
      label: formatBlockedTimeRule(rule),
      day: rule.day,
      startTime: rule.startTime,
      endTime: rule.endTime,
    })),
  }
}

function buildAnyBlockedPreferenceMessage(
  preferences: UserPreferences,
  startTime: Date,
  endTime: Date,
  timezone: string,
) {
  const matches = getBlockedTimeMatchesForAnyActivity(preferences, startTime, endTime, timezone)
  if (matches.length === 0) return null

  return {
    status: 'blocked_preference',
    message: 'That time falls inside your blocked scheduling windows.',
    blockedRules: matches.map(({ activity, rule }) => ({
      activity,
      id: rule.id,
      label: `${activity}: ${formatBlockedTimeRule(rule)}`,
      day: rule.day,
      startTime: rule.startTime,
      endTime: rule.endTime,
    })),
  }
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
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo', 'custom'],
            description: 'Closest settings activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
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
      description:
        'Summarize weather and optional activity suitability for a given time range or part of the day. Map user activity words to the closest scored profile before calling: walk, walking, bike, biking, cycling, driving, travel -> commute; jog, hike, workout, tennis -> run; photo walk or sunset photos -> photo. Activity bestWindow results exclude blocked scheduling windows.',
      parameters: {
        type: 'object',
        properties: {
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo'],
            description: 'Closest scored activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'any'] },
          commute_mode: {
            type: 'string',
            enum: ['car', 'bike', 'walk'],
            description: 'Use when activity is commute and the user specifies walking, biking/cycling, or driving.',
          },
        },
      },
    },
    {
      name: 'find_optimal_slots',
      description:
        'Find the best conflict-free and preference-safe weather windows for a requested activity and exact duration in minutes when the user asks for the best time or wants alternatives. Map user activity words to the closest scored profile before calling: walk, walking, bike, biking, cycling, driving, travel -> commute; jog, hike, workout, tennis -> run; photo walk or sunset photos -> photo. Returned event ranges preserve duration_minutes exactly, even when weather scoring uses overlapping 30-minute forecast windows. This never returns slots that overlap blocked scheduling windows. Do not use this to silently override an explicitly requested clock time.',
      parameters: {
        type: 'object',
        properties: {
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo'],
            description: 'Closest scored activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
          requested_activity_label: {
            type: 'string',
            description: 'The user-facing activity name, especially when mapping a custom activity to a scored profile.',
          },
          duration_minutes: { type: 'integer' },
          relative_day: { type: 'string', enum: ['today', 'tomorrow'] },
          start_date: { type: 'string', description: 'YYYY-MM-DD in the user timezone' },
          end_date: { type: 'string', description: 'YYYY-MM-DD in the user timezone' },
          preferred_time: { type: 'string', enum: ['morning', 'afternoon', 'evening', 'any'] },
          commute_mode: {
            type: 'string',
            enum: ['car', 'bike', 'walk'],
            description: 'Use walk for walking requests, bike for biking/cycling requests, and car for driving requests.',
          },
          limit: { type: 'integer' },
        },
        required: ['activity', 'duration_minutes'],
      },
    },
    {
      name: 'score_time_range',
      description:
        'Score a specific time range for a weather-scored activity. Map aliases first: walk, walking, bike, biking, cycling, driving, travel -> commute; jog, hike, workout, tennis -> run; photo walk or sunset photos -> photo. Use this to evaluate an explicitly requested time before drafting a weather-sensitive event at that time.',
      parameters: {
        type: 'object',
        properties: {
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo'],
            description: 'Closest scored activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          commute_mode: {
            type: 'string',
            enum: ['car', 'bike', 'walk'],
            description: 'Use when activity is commute and the user specifies walking, biking/cycling, or driving.',
          },
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
      name: 'get_account_settings',
      description: 'Inspect the user account settings that affect scheduling, including weather comfort and blocked scheduling windows.',
      parameters: {
        type: 'object',
        properties: {
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo', 'custom'],
            description: 'Closest calendar activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
        },
      },
    },
    {
      name: 'update_account_settings',
      description:
        'Update saved account settings immediately. Use this when the user asks to change preference values, weather comfort, or blocked scheduling windows.',
      parameters: {
        type: 'object',
        properties: {
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo', 'custom'],
            description: 'Closest calendar activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
          set_selected_activity: { type: 'boolean' },
          city: { type: 'string', description: 'City name' },
          usual_time: { type: 'string', description: 'HH:MM' },
          profile_updates: {
            type: 'object',
            properties: {
              performance_vs_comfort: { type: 'integer' },
              wind_sensitivity: { type: 'string', enum: ['low', 'medium', 'high'] },
              rain_avoidance: { type: 'string', enum: ['low', 'medium', 'high'] },
              time_bias: { type: 'string', enum: ['morning', 'neutral', 'evening'] },
              prefer_cool: { type: 'boolean' },
              daylight_preference: { type: 'integer' },
              distraction_sensitivity: { type: 'boolean' },
              warmth_preference: { type: 'integer' },
              sunset_bonus: { type: 'boolean' },
              golden_hour_priority: { type: 'boolean' },
              cloud_preference: { type: 'string', enum: ['clear', 'dramatic'] },
              commute_mode: { type: 'string', enum: ['car', 'bike', 'walk'] },
            },
          },
          comfort_updates: {
            type: 'object',
            properties: {
              min_temperature: { type: 'integer' },
              max_temperature: { type: 'integer' },
              max_wind_speed: { type: 'integer' },
              max_precipitation_probability: { type: 'integer' },
            },
          },
          add_blocked_times: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string', enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
                start_time: { type: 'string', description: 'HH:MM' },
                end_time: { type: 'string', description: 'HH:MM' },
              },
              required: ['day', 'start_time', 'end_time'],
            },
          },
          remove_blocked_times: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                day: { type: 'string', enum: ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] },
                start_time: { type: 'string', description: 'HH:MM' },
                end_time: { type: 'string', description: 'HH:MM' },
              },
            },
          },
          clear_blocked_times: { type: 'boolean' },
        },
      },
    },
    {
      name: 'draft_create_event',
      description:
        'Draft a new calendar event proposal. This does not apply the change. The tool rejects drafts that overlap blocked scheduling windows. Map aliases first: walk, walking, bike, biking, cycling, driving, travel -> commute; jog, hike, workout, tennis -> run; photo walk or sunset photos -> photo. If the user gave an explicit time, preserve that requested time unless there is a conflict, blocked preference, or the user asked for a better slot.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          category: { type: 'string', enum: ['weather-sensitive', 'indoor'] },
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo', 'custom'],
            description: 'Closest calendar activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
          commute_mode: {
            type: 'string',
            enum: ['car', 'bike', 'walk'],
            description: 'Use when activity is commute and the user specifies walking, biking/cycling, or driving.',
          },
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
      description:
        'Draft an update to an existing calendar event. This does not apply the change. The tool rejects updates that overlap blocked scheduling windows. Map aliases first: walk, walking, bike, biking, cycling, driving, travel -> commute; jog, hike, workout, tennis -> run; photo walk or sunset photos -> photo. If the user gave an explicit new time, preserve it unless there is a conflict, blocked preference, or the user asked for a better slot.',
      parameters: {
        type: 'object',
        properties: {
          event_id: { type: 'string' },
          title: { type: 'string' },
          start_time: { type: 'string', description: 'ISO timestamp' },
          end_time: { type: 'string', description: 'ISO timestamp' },
          category: { type: 'string', enum: ['weather-sensitive', 'indoor'] },
          activity: {
            type: 'string',
            enum: ['run', 'study', 'social', 'commute', 'photo', 'custom'],
            description: 'Closest calendar activity profile. Use commute for walk/walking/bike/biking/cycling/driving/travel.',
          },
          commute_mode: {
            type: 'string',
            enum: ['car', 'bike', 'walk'],
            description: 'Use when activity is commute and the user specifies walking, biking/cycling, or driving.',
          },
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
  const activity = normalizeScorableActivity(args.activity) ?? null
  const commuteMode = normalizeCommuteMode(args.commute_mode) ?? normalizeCommuteMode(args.activity)
  const scoredWindows = getScoredWindowsForActivity(context.windows, context.preferences, activity, commuteMode)

  if (typeof args.start_time === 'string' && typeof args.end_time === 'string') {
    const startTime = new Date(args.start_time)
    const endTime = new Date(args.end_time)
    relevantWindows = getOverlappingWindows(startTime, endTime, scoredWindows)
    const blocked = activity
      ? buildAnyBlockedPreferenceMessage(context.preferences, startTime, endTime, context.timezone)
      : null

    return {
      response: {
        windowCount: relevantWindows.length,
        summary: summarizeWeather(relevantWindows),
        averageScore: activity ? getAverageScore(relevantWindows, activity) : null,
        blockedByPreferences: !!blocked,
        blockedRules: blocked?.blockedRules ?? [],
        bestWindow: null,
      },
    }
  } else {
    const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
    const preferredTime = (args.preferred_time as PreferredTime | undefined) || 'any'
    relevantWindows = scoredWindows.filter((window) => {
      const start = getWindowStart(window)
      if (relativeDayKey && getDateKey(start, context.timezone) !== relativeDayKey) return false
      return matchesPreferredTime(start, preferredTime, context.timezone)
    })
  }

  const averageScore = activity ? getAverageScore(relevantWindows, activity) : null
  const unblockedWindows = activity
    ? relevantWindows.filter((window) => {
        const windowStart = getWindowStart(window)
        const windowEnd = getWindowEnd(window)
        return !isTimeRangeBlockedForAnyActivity(context.preferences, windowStart, windowEnd, context.timezone)
      })
    : relevantWindows
  const blockedByPreferencesCount = relevantWindows.length - unblockedWindows.length
  const bestWindow =
    activity && unblockedWindows.length > 0
      ? [...unblockedWindows].sort((a, b) => b.scores[activity] - a.scores[activity])[0]
      : null

  return {
    response: {
      windowCount: relevantWindows.length,
      summary: summarizeWeather(relevantWindows),
      averageScore,
      blockedByPreferencesCount,
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
  const activity = normalizeScorableActivity(args.activity)
  if (!activity) {
    return { response: { error: 'Unsupported activity for weather scoring.' } }
  }

  const commuteMode =
    normalizeCommuteMode(args.commute_mode) ??
    normalizeCommuteMode(args.requested_activity_label) ??
    normalizeCommuteMode(args.activity)
  const scoredWindows = getScoredWindowsForActivity(context.windows, context.preferences, activity, commuteMode)
  const durationMinutes =
    typeof args.duration_minutes === 'number' && Number.isFinite(args.duration_minutes)
      ? Math.max(1, Math.round(args.duration_minutes))
      : 60
  const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
  const preferredTime = (args.preferred_time as PreferredTime | undefined) || 'any'
  const startDate = typeof args.start_date === 'string' ? args.start_date : undefined
  const endDate = typeof args.end_date === 'string' ? args.end_date : undefined
  const limit = typeof args.limit === 'number' ? args.limit : 3
  const requiredSlots = Math.max(1, Math.ceil(durationMinutes / 30))

  const windowsByDay = new Map<string, TimeWindow[]>()
  for (const window of scoredWindows) {
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
    windowIds: string[]
  }> = []
  let blockedByPreferencesCount = 0

  for (const dayWindows of windowsByDay.values()) {
    const sorted = [...dayWindows].sort((a, b) => getWindowStart(a).getTime() - getWindowStart(b).getTime())
    for (let index = 0; index <= sorted.length - requiredSlots; index++) {
      const block = sorted.slice(index, index + requiredSlots)
      const blockStart = getWindowStart(block[0])
      const exactEnd = new Date(blockStart.getTime() + durationMinutes * 60 * 1000)
      const scoringWindows = getOverlappingWindows(blockStart, exactEnd, block)

      if (scoringWindows.length === 0) continue

      if (isTimeRangeBlockedForAnyActivity(context.preferences, blockStart, exactEnd, context.timezone)) {
        blockedByPreferencesCount += 1
        continue
      }
      const conflicts = getConflictingEvents(blockStart, exactEnd, context.events, context.timezone)
      if (conflicts.length > 0) continue

      const score = getAverageScore(scoringWindows, activity)
      if (score === null) continue

      candidates.push({
        startTime: blockStart.toISOString(),
        endTime: exactEnd.toISOString(),
        score,
        location: block[0].location,
        weatherSummary: summarizeWeather(scoringWindows),
        windowIds: scoringWindows.map((window) => window.id),
      })
    }
  }

  const topCandidates = candidates
    .sort((a, b) => b.score - a.score || new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, limit)

  return {
    response: {
      count: topCandidates.length,
      requestedActivityLabel: typeof args.requested_activity_label === 'string' ? args.requested_activity_label : null,
      scoredActivity: activity,
      blockedByPreferencesCount,
      slots: topCandidates.map((candidate) => ({
        ...candidate,
        displayTime: `${formatDateTime(new Date(candidate.startTime), context.timezone)} - ${formatTime(new Date(candidate.endTime), context.timezone)}`,
      })),
    },
  }
}

function executeScoreTimeRange(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const activity = normalizeScorableActivity(args.activity)
  if (!activity) {
    return { response: { error: 'Unsupported activity for weather scoring.' } }
  }

  const commuteMode = normalizeCommuteMode(args.commute_mode) ?? normalizeCommuteMode(args.activity)
  const scoredWindows = getScoredWindowsForActivity(context.windows, context.preferences, activity, commuteMode)
  const startTime = new Date(String(args.start_time))
  const endTime = new Date(String(args.end_time))
  const overlapping = getOverlappingWindows(startTime, endTime, scoredWindows)
  const conflicts = getConflictingEvents(startTime, endTime, context.events, context.timezone)
  const blocked = buildBlockedPreferenceMessage(context.preferences, activity, startTime, endTime, context.timezone)

  return {
    response: {
      score: getAverageScore(overlapping, activity),
      weatherSummary: summarizeWeather(overlapping),
      conflictCount: conflicts.length,
      conflicts,
      blockedByPreferences: !!blocked,
      blockedRules: blocked?.blockedRules ?? [],
    },
    referencedEventIds: conflicts.map((conflict) => conflict.id),
  }
}

function executeListAtRiskEvents(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const relativeDayKey = resolveRelativeDay(args.relative_day as RelativeDay | undefined, context.now, context.timezone)
  const limit = typeof args.limit === 'number' ? args.limit : 5

  const analyses = computeProtectedEventAnalyses(context.events, context.windows, {
    preferences: context.preferences,
    timezone: context.timezone,
  })
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

function executeGetAccountSettings(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const activity = normalizeActivityAlias(args.activity) ?? context.preferences.activity
  return {
    response: {
      settings: getSettingsSnapshot(context.preferences, activity),
    },
  }
}

function executeUpdateAccountSettings(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const nextPreferences = normalizeUserPreferences(context.preferences)
  const targetActivity = normalizeActivityAlias(args.activity) ?? nextPreferences.activity
  const appliedChanges: string[] = []

  if (typeof args.city === 'string' && args.city.trim().length > 0) {
    nextPreferences.city = args.city.trim()
    context.city = nextPreferences.city
    appliedChanges.push(`city set to ${nextPreferences.city}`)
  }

  if (typeof args.usual_time === 'string' && isTimeString(args.usual_time)) {
    nextPreferences.usualTime = args.usual_time
    appliedChanges.push(`usual time set to ${nextPreferences.usualTime}`)
  }

  if (args.set_selected_activity === true) {
    nextPreferences.activity = targetActivity
    appliedChanges.push(`selected activity set to ${targetActivity}`)
  }

  const existingProfile = getActivityProfile(nextPreferences, targetActivity)
  const nextProfile = {
    ...existingProfile,
    comfort: existingProfile.comfort ? { ...existingProfile.comfort } : undefined,
  }

  if (typeof args.profile_updates === 'object' && args.profile_updates) {
    const updates = args.profile_updates as Record<string, unknown>

    if (typeof updates.performance_vs_comfort === 'number') {
      nextProfile.performanceVsComfort = updates.performance_vs_comfort
      appliedChanges.push(`${targetActivity} performance vs comfort set to ${updates.performance_vs_comfort}%`)
    }
    if (updates.wind_sensitivity === 'low' || updates.wind_sensitivity === 'medium' || updates.wind_sensitivity === 'high') {
      nextProfile.windSensitivity = updates.wind_sensitivity
      appliedChanges.push(`${targetActivity} wind sensitivity set to ${updates.wind_sensitivity}`)
    }
    if (updates.rain_avoidance === 'low' || updates.rain_avoidance === 'medium' || updates.rain_avoidance === 'high') {
      nextProfile.rainAvoidance = updates.rain_avoidance
      appliedChanges.push(`${targetActivity} rain avoidance set to ${updates.rain_avoidance}`)
    }
    if (updates.time_bias === 'morning' || updates.time_bias === 'neutral' || updates.time_bias === 'evening') {
      nextProfile.timeBias = updates.time_bias
      appliedChanges.push(`${targetActivity} time bias set to ${updates.time_bias}`)
    }
    if (typeof updates.prefer_cool === 'boolean') {
      nextProfile.preferCool = updates.prefer_cool
      appliedChanges.push(`${targetActivity} prefer cool set to ${updates.prefer_cool}`)
    }
    if (typeof updates.daylight_preference === 'number') {
      nextProfile.daylightPreference = updates.daylight_preference
      appliedChanges.push(`${targetActivity} daylight preference set to ${updates.daylight_preference}%`)
    }
    if (typeof updates.distraction_sensitivity === 'boolean') {
      nextProfile.distractionSensitivity = updates.distraction_sensitivity
      appliedChanges.push(`${targetActivity} distraction sensitivity set to ${updates.distraction_sensitivity}`)
    }
    if (typeof updates.warmth_preference === 'number') {
      nextProfile.warmthPreference = updates.warmth_preference
      appliedChanges.push(`${targetActivity} warmth preference set to ${updates.warmth_preference}%`)
    }
    if (typeof updates.sunset_bonus === 'boolean') {
      nextProfile.sunsetBonus = updates.sunset_bonus
      appliedChanges.push(`${targetActivity} sunset bonus set to ${updates.sunset_bonus}`)
    }
    if (typeof updates.golden_hour_priority === 'boolean') {
      nextProfile.goldenHourPriority = updates.golden_hour_priority
      appliedChanges.push(`${targetActivity} golden hour priority set to ${updates.golden_hour_priority}`)
    }
    if (updates.cloud_preference === 'clear' || updates.cloud_preference === 'dramatic') {
      nextProfile.cloudPreference = updates.cloud_preference
      appliedChanges.push(`${targetActivity} cloud preference set to ${updates.cloud_preference}`)
    }
    if (updates.commute_mode === 'car' || updates.commute_mode === 'bike' || updates.commute_mode === 'walk') {
      nextProfile.commuteMode = updates.commute_mode as CommuteMode
      appliedChanges.push(`${targetActivity} commute mode set to ${updates.commute_mode}`)
    }
  }

  if (typeof args.comfort_updates === 'object' && args.comfort_updates) {
    const updates = args.comfort_updates as Record<string, unknown>
    const currentComfort = nextProfile.comfort ? { ...nextProfile.comfort } : undefined

    if (currentComfort) {
      if (typeof updates.min_temperature === 'number') {
        currentComfort.minTemperature = updates.min_temperature
        appliedChanges.push(`${targetActivity} minimum comfort temperature set to ${updates.min_temperature}°C`)
      }
      if (typeof updates.max_temperature === 'number') {
        currentComfort.maxTemperature = updates.max_temperature
        appliedChanges.push(`${targetActivity} maximum comfort temperature set to ${updates.max_temperature}°C`)
      }
      if (typeof updates.max_wind_speed === 'number') {
        currentComfort.maxWindSpeed = updates.max_wind_speed
        appliedChanges.push(`${targetActivity} max wind set to ${updates.max_wind_speed} km/h`)
      }
      if (typeof updates.max_precipitation_probability === 'number') {
        currentComfort.maxPrecipitationProbability = updates.max_precipitation_probability
        appliedChanges.push(`${targetActivity} max rain chance set to ${updates.max_precipitation_probability}%`)
      }

      nextProfile.comfort = currentComfort
    }
  }

  nextPreferences.activityProfiles = {
    ...nextPreferences.activityProfiles,
    [targetActivity]: nextProfile,
  }

  if (args.clear_blocked_times === true) {
    nextPreferences.blockedTimeRules = {
      ...nextPreferences.blockedTimeRules,
      [targetActivity]: [],
    }
    appliedChanges.push(`cleared all blocked windows for ${targetActivity}`)
  }

  if (Array.isArray(args.add_blocked_times)) {
    let rules = nextPreferences.blockedTimeRules[targetActivity] ?? []

    for (const item of args.add_blocked_times) {
      if (
        typeof item === 'object' &&
        item &&
        isWeekday((item as Record<string, unknown>).day) &&
        isTimeString((item as Record<string, unknown>).start_time) &&
        isTimeString((item as Record<string, unknown>).end_time, true)
      ) {
        const ruleDay = (item as Record<string, unknown>).day as WeekdayKey
        const startTime = (item as Record<string, unknown>).start_time as string
        const endTime = (item as Record<string, unknown>).end_time as string

        if (startTime < endTime) {
          rules = upsertBlockedTimeRule(rules, {
            day: ruleDay,
            startTime,
            endTime,
          })
          appliedChanges.push(`added blocked window ${formatBlockedTimeRule({ id: '', day: ruleDay, startTime, endTime })}`)
        }
      }
    }

    nextPreferences.blockedTimeRules = {
      ...nextPreferences.blockedTimeRules,
      [targetActivity]: rules,
    }
  }

  if (Array.isArray(args.remove_blocked_times)) {
    let rules = nextPreferences.blockedTimeRules[targetActivity] ?? []

    for (const item of args.remove_blocked_times) {
      if (typeof item !== 'object' || !item) continue
      const entry = item as Record<string, unknown>

      rules = removeBlockedTimeRule(rules, {
        id: typeof entry.id === 'string' ? entry.id : '',
        day: isWeekday(entry.day) ? entry.day : 'mon',
        startTime: isTimeString(entry.start_time) ? entry.start_time : '',
        endTime: isTimeString(entry.end_time, true) ? entry.end_time : '',
      })
    }

    nextPreferences.blockedTimeRules = {
      ...nextPreferences.blockedTimeRules,
      [targetActivity]: rules,
    }
    appliedChanges.push(`updated blocked windows for ${targetActivity}`)
  }

  if (appliedChanges.length === 0) {
    return {
      response: {
        status: 'no_changes',
        message: 'No valid account setting changes were provided.',
        settings: getSettingsSnapshot(context.preferences, targetActivity),
      },
    }
  }

  context.preferences = normalizeUserPreferences(nextPreferences)

  return {
    response: {
      status: 'updated',
      appliedChanges,
      settings: getSettingsSnapshot(context.preferences, targetActivity),
    },
  }
}

function executeDraftCreateEvent(args: Record<string, unknown>, context: ToolContext): ToolExecutionResult {
  const startTime = new Date(String(args.start_time))
  const endTime = new Date(String(args.end_time))
  if (!(startTime < endTime)) {
    return { response: { status: 'invalid_time_range', message: 'The event end time must be after the start time.' } }
  }

  const eventActivity = normalizeActivityAlias(args.activity) ?? normalizeActivityAlias(args.title)
  const commuteMode = normalizeCommuteMode(args.commute_mode) ?? normalizeCommuteMode(args.title) ?? normalizeCommuteMode(args.activity)
  const scoredWindows = getScoredWindowsForActivity(
    context.windows,
    context.preferences,
    normalizeScorableActivity(eventActivity),
    commuteMode,
  )
  const schedulingActivity = eventActivity ?? resolveSchedulingActivity(args.activity, context)
  const blocked = buildBlockedPreferenceMessage(context.preferences, schedulingActivity, startTime, endTime, context.timezone)
  if (blocked) {
    return { response: blocked }
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

  const category = coerceCategory(eventActivity, args.category as EventCategory | undefined)
  const color = coerceColor(eventActivity, args.color as EventColor | undefined)
  const participants = sanitizeParticipants(args.participants)
  const eventDraft: Omit<CalendarEvent, 'id'> = {
    title: String(args.title),
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    category,
    color,
    createdVia: 'chat',
    ...(eventActivity ? { activity: eventActivity } : {}),
    ...(typeof args.location === 'string' && args.location ? { location: args.location } : {}),
    ...(participants ? { participants } : {}),
    ...(typeof args.notes === 'string' && args.notes ? { notes: args.notes } : {}),
    suggestedAlternative: null,
  }

  const weatherScore = computeWeatherScore(eventDraft, scoredWindows)
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
        weatherSummary: summarizeWeather(getOverlappingWindows(startTime, endTime, scoredWindows)),
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
        if (field === 'activity') {
          const normalizedActivity = normalizeActivityAlias(value)
          if (normalizedActivity) {
            changes.activity = normalizedActivity
          }
        } else {
          ;(changes as Record<string, unknown>)[field] = field === 'startTime' || field === 'endTime' ? new Date(value).toISOString() : value
        }
      }
    }
  }

  const participants = sanitizeParticipants(args.participants)
  if (participants) {
    changes.participants = participants
  }

  const commuteMode =
    normalizeCommuteMode(args.commute_mode) ??
    normalizeCommuteMode(args.title) ??
    normalizeCommuteMode(args.activity)

  const nextEvent: CalendarEvent = {
    ...existingEvent,
    ...changes,
  }

  if (!(new Date(nextEvent.startTime) < new Date(nextEvent.endTime))) {
    return { response: { status: 'invalid_time_range', message: 'The event end time must be after the start time.' } }
  }

  const schedulingActivity = nextEvent.activity ?? context.preferences.activity
  const blocked = buildBlockedPreferenceMessage(
    context.preferences,
    schedulingActivity,
    new Date(nextEvent.startTime),
    new Date(nextEvent.endTime),
    context.timezone,
  )
  if (blocked) {
    return {
      response: blocked,
      referencedEventIds: [existingEvent.id],
    }
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
  const scoredWindows = getScoredWindowsForActivity(
    context.windows,
    context.preferences,
    normalizeScorableActivity(nextEvent.activity),
    commuteMode,
  )
  const weatherScore = computeWeatherScore(nextEvent, scoredWindows)
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
    case 'get_account_settings':
      return executeGetAccountSettings(args, context)
    case 'update_account_settings':
      return executeUpdateAccountSettings(args, context)
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
  const initialPreferences = JSON.stringify(context.preferences)

  return {
    declarations: getToolDeclarations(),
    execute(name: string, args: Record<string, unknown>) {
      return executeTool(name, args, context)
    },
    getCurrentPreferences() {
      return context.preferences
    },
    hasPreferenceUpdates() {
      return JSON.stringify(context.preferences) !== initialPreferences
    },
  }
}
