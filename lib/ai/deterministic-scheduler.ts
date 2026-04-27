import { applyPreferenceScoresToWindows } from '@/lib/scoring'
import {
  getBlockedTimeMatches,
  isTimeRangeBlockedForAnyActivity,
} from '@/lib/preferences'
import type {
  CalendarEvent,
  CommuteMode,
  EventColor,
  PendingCalendarOperation,
  TimeWindow,
  UserPreferences,
} from '@/lib/types'
import {
  TIME_OF_DAY_WINDOWS,
  formatPreferredTimeWindow,
  matchesPreferredTimeBucket,
} from '@/lib/time-windows'
import type { DeterministicSchedulingIntent } from './scheduling-intent'

interface DeterministicSchedulerContext {
  events: CalendarEvent[]
  windows: TimeWindow[]
  preferences: UserPreferences
  timezone: string
}

interface DeterministicSlot {
  startTime: string
  endTime: string
  score: number
  location: string
  weatherSummary: string
  displayTime: string
}

interface AvailabilityResult {
  slots: DeterministicSlot[]
  checkedWindowLabel: string
  conflictCount: number
  blockedByPreferencesCount: number
  missingWeatherWindowCount: number
}

const DEFAULT_COLORS: Record<string, EventColor> = {
  run: 'amber',
  study: 'violet',
  social: 'pink',
  photo: 'amber',
  commute: 'blue',
  custom: 'blue',
}

function getTimeZoneOffsetMinutes(timezone: string, date: Date): number {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value

  const match = timeZoneName?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/)
  if (!match) return 0

  const sign = match[1] === '-' ? -1 : 1
  const hours = Number(match[2])
  const minutes = Number(match[3] || 0)
  return sign * (hours * 60 + minutes)
}

function zonedDateTimeToUtc(dateKey: string, time: string, timezone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  const utcGuessMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0)

  let offsetMinutes = getTimeZoneOffsetMinutes(timezone, new Date(utcGuessMs))
  let result = new Date(utcGuessMs - offsetMinutes * 60 * 1000)

  const adjustedOffsetMinutes = getTimeZoneOffsetMinutes(timezone, result)
  if (adjustedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = adjustedOffsetMinutes
    result = new Date(utcGuessMs - offsetMinutes * 60 * 1000)
  }

  return result
}

function getDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function getWindowStart(window: TimeWindow, timezone: string): Date {
  return zonedDateTimeToUtc(getDateKey(new Date(window.date), timezone), window.startTime, timezone)
}

function getWindowEnd(window: TimeWindow, timezone: string): Date {
  return zonedDateTimeToUtc(getDateKey(new Date(window.date), timezone), window.endTime, timezone)
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && endA > startB
}

function getOverlappingWindows(startTime: Date, endTime: Date, windows: TimeWindow[], timezone: string) {
  return windows.filter((window) => overlaps(startTime, endTime, getWindowStart(window, timezone), getWindowEnd(window, timezone)))
}

function getAverageScore(windows: TimeWindow[], activity: DeterministicSchedulingIntent['activity']) {
  if (windows.length === 0) return null
  return Math.round(windows.reduce((sum, window) => sum + window.scores[activity], 0) / windows.length)
}

function summarizeWeather(windows: TimeWindow[]) {
  if (windows.length === 0) return 'No weather data available for that time range.'
  const totals = windows.reduce(
    (acc, window) => {
      acc.temperature += window.weather.temperature
      acc.wind += window.weather.windSpeed
      acc.rain += window.weather.precipitationProbability
      return acc
    },
    { temperature: 0, wind: 0, rain: 0 },
  )
  const primaryCondition = windows[0].weather.condition.replace('-', ' ')
  return `${primaryCondition}, ${Math.round(totals.temperature / windows.length)}°C, ${Math.round(
    totals.wind / windows.length
  )} km/h wind, ${Math.round(totals.rain / windows.length)}% rain chance`
}

function getConflictingEvents(startTime: Date, endTime: Date, events: CalendarEvent[]) {
  return events.filter((event) => overlaps(startTime, endTime, new Date(event.startTime), new Date(event.endTime)))
}

function getScoredWindows(
  windows: TimeWindow[],
  preferences: UserPreferences,
  activity: DeterministicSchedulingIntent['activity'],
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

function findDeterministicSlots(
  intent: DeterministicSchedulingIntent,
  context: DeterministicSchedulerContext,
): AvailabilityResult {
  const scoredWindows = getScoredWindows(context.windows, context.preferences, intent.activity, intent.commuteMode)
  const windowRange =
    intent.preferredTime === 'any'
      ? { startTime: '00:00', endTime: '24:00' }
      : TIME_OF_DAY_WINDOWS[intent.preferredTime]
  const rangeStart = zonedDateTimeToUtc(intent.dateKey, windowRange.startTime, context.timezone)
  const rangeEnd = zonedDateTimeToUtc(intent.dateKey, windowRange.endTime, context.timezone)
  const slots: DeterministicSlot[] = []
  let conflictCount = 0
  let blockedByPreferencesCount = 0
  let missingWeatherWindowCount = 0

  const dayWindows = scoredWindows
    .filter((window) => {
      const start = getWindowStart(window, context.timezone)
      if (getDateKey(start, context.timezone) !== intent.dateKey) return false
      if (intent.preferredTime !== 'any' && !matchesPreferredTimeBucket(start, intent.preferredTime, context.timezone)) {
        return false
      }
      return start >= rangeStart && start < rangeEnd
    })
    .sort((a, b) => getWindowStart(a, context.timezone).getTime() - getWindowStart(b, context.timezone).getTime())

  for (const window of dayWindows) {
    const startTime = getWindowStart(window, context.timezone)
    const endTime = new Date(startTime.getTime() + intent.durationMinutes * 60 * 1000)
    if (endTime > rangeEnd) continue

    const scoringWindows = getOverlappingWindows(startTime, endTime, scoredWindows, context.timezone)
    if (scoringWindows.length === 0) {
      missingWeatherWindowCount += 1
      continue
    }

    if (isTimeRangeBlockedForAnyActivity(context.preferences, startTime, endTime, context.timezone)) {
      blockedByPreferencesCount += 1
      continue
    }

    const conflicts = getConflictingEvents(startTime, endTime, context.events)
    if (conflicts.length > 0) {
      conflictCount += 1
      continue
    }

    const score = getAverageScore(scoringWindows, intent.activity)
    if (score === null) continue

    slots.push({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      score,
      location: window.location,
      weatherSummary: summarizeWeather(scoringWindows),
      displayTime: `${formatDateTime(startTime, context.timezone)} - ${formatTime(endTime, context.timezone)}`,
    })
  }

  return {
    slots: slots
      .sort((a, b) => b.score - a.score || new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5),
    checkedWindowLabel:
      intent.preferredTime === 'any'
        ? `${intent.dateKey} any time`
        : `${intent.dateKey} ${intent.preferredTime} (${formatPreferredTimeWindow(intent.preferredTime)})`,
    conflictCount,
    blockedByPreferencesCount,
    missingWeatherWindowCount,
  }
}

function buildCreateOperation(
  intent: DeterministicSchedulingIntent,
  slot: DeterministicSlot,
  context: DeterministicSchedulerContext,
): PendingCalendarOperation {
  const startTime = new Date(slot.startTime)
  const endTime = new Date(slot.endTime)
  const eventDraft: Omit<CalendarEvent, 'id'> = {
    title: intent.title,
    startTime: slot.startTime,
    endTime: slot.endTime,
    category: 'weather-sensitive',
    activity: intent.activity,
    color: DEFAULT_COLORS[intent.activity] || 'blue',
    location: slot.location,
    weatherScore: slot.score,
    suggestedAlternative: null,
    createdVia: 'chat',
    ...(intent.commuteMode ? { notes: `Commute mode: ${intent.commuteMode}.` } : {}),
  }

  const blocked = getBlockedTimeMatches(context.preferences, intent.activity, startTime, endTime, context.timezone)
  if (blocked.length > 0) {
    throw new Error('Internal scheduling error: attempted to draft a blocked preference window.')
  }

  return {
    type: 'create_event',
    summary: `Create "${intent.title}" for ${formatDateTime(startTime, context.timezone)} - ${formatTime(
      endTime,
      context.timezone
    )}.`,
    eventDraft,
  }
}

function buildNoSlotsMessage(intent: DeterministicSchedulingIntent, availability: AvailabilityResult) {
  const reasons: string[] = []
  if (availability.conflictCount > 0) reasons.push(`${availability.conflictCount} candidate time(s) overlapped calendar events`)
  if (availability.blockedByPreferencesCount > 0) {
    reasons.push(`${availability.blockedByPreferencesCount} candidate time(s) were blocked by preferences`)
  }
  if (availability.missingWeatherWindowCount > 0) {
    reasons.push(`${availability.missingWeatherWindowCount} candidate time(s) had missing weather data`)
  }

  return `I checked ${availability.checkedWindowLabel} for a ${intent.durationMinutes}-minute ${intent.requestedActivityLabel}, and I do not see an available slot.${reasons.length > 0 ? ` ${reasons.join('; ')}.` : ''}`
}

export function answerDeterministicSchedulingIntent(
  intent: DeterministicSchedulingIntent,
  context: DeterministicSchedulerContext,
) {
  const availability = findDeterministicSlots(intent, context)
  if (availability.slots.length === 0) {
    return {
      message: buildNoSlotsMessage(intent, availability),
      pendingOperations: null,
      requiresConfirmation: false,
    }
  }

  const topSlots = availability.slots.slice(0, 3)
  const slotList = topSlots
    .map((slot, index) => `${index + 1}. ${slot.displayTime}, score ${slot.score}, ${slot.weatherSummary}`)
    .join('\n')

  if (!intent.shouldDraft) {
    return {
      message: `Yes. I checked ${availability.checkedWindowLabel} and found these ${intent.durationMinutes}-minute ${intent.requestedActivityLabel} slots:\n${slotList}`,
      pendingOperations: null,
      requiresConfirmation: false,
    }
  }

  const operation = buildCreateOperation(intent, availability.slots[0], context)
  return {
    message: `I checked ${availability.checkedWindowLabel} and found availability. I drafted the best ${intent.durationMinutes}-minute ${intent.requestedActivityLabel} slot:\n${slotList}\n\nConfirm to add the first slot to your calendar.`,
    pendingOperations: [operation],
    requiresConfirmation: true,
  }
}
