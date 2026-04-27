import type { Activity, CommuteMode } from '@/lib/types'
import type { PreferredTime } from '@/lib/time-windows'

export interface DeterministicSchedulingIntent {
  activity: Exclude<Activity, 'custom'>
  requestedActivityLabel: string
  title: string
  durationMinutes: number
  dateKey: string
  preferredTime: PreferredTime
  commuteMode?: CommuteMode
  shouldDraft: boolean
  sourceText: string
}

const WEEKDAYS: Array<{ key: string; label: string; aliases: string[] }> = [
  { key: 'sun', label: 'Sunday', aliases: ['sunday', 'sun'] },
  { key: 'mon', label: 'Monday', aliases: ['monday', 'mon'] },
  { key: 'tue', label: 'Tuesday', aliases: ['tuesday', 'tues', 'tue'] },
  { key: 'wed', label: 'Wednesday', aliases: ['wednesday', 'weds', 'wed'] },
  { key: 'thu', label: 'Thursday', aliases: ['thursday', 'thurs', 'thu'] },
  { key: 'fri', label: 'Friday', aliases: ['friday', 'fri'] },
  { key: 'sat', label: 'Saturday', aliases: ['saturday', 'sat'] },
] as const

function getLocalDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function getLocalWeekdayIndex(date: Date, timezone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
  }).format(date).toLowerCase()

  return WEEKDAYS.findIndex((day) => day.aliases.includes(weekday))
}

function resolveDateKey(text: string, now: Date, timezone: string): string | null {
  if (/\btoday\b/i.test(text)) return getLocalDateKey(now, timezone)
  if (/\btomorrow\b/i.test(text)) return getLocalDateKey(new Date(now.getTime() + 24 * 60 * 60 * 1000), timezone)

  const currentWeekday = getLocalWeekdayIndex(now, timezone)
  const mentionedWeekday = WEEKDAYS.findIndex((day) =>
    day.aliases.some((alias) => new RegExp(`\\b${alias}\\b`, 'i').test(text))
  )
  if (mentionedWeekday === -1 || currentWeekday === -1) return null

  const saysNext = /\bnext\s+(?:sunday|sun|monday|mon|tuesday|tues|tue|wednesday|weds|wed|thursday|thurs|thu|friday|fri|saturday|sat)\b/i.test(text)
  let offset = (mentionedWeekday - currentWeekday + 7) % 7
  if (offset === 0 || saysNext) offset += 7
  return getLocalDateKey(new Date(now.getTime() + offset * 24 * 60 * 60 * 1000), timezone)
}

function parsePreferredTime(text: string): PreferredTime | null {
  if (/\bmorning\b/i.test(text)) return 'morning'
  if (/\bafternoon\b/i.test(text)) return 'afternoon'
  if (/\bevening\b/i.test(text)) return 'evening'
  if (/\bnight\b/i.test(text)) return 'night'
  if (/\banytime\b|\bany time\b/i.test(text)) return 'any'
  return null
}

function parseDurationMinutes(text: string): number | null {
  const hoursAndMinutes = text.match(/\b(\d+)\s*(?:h|hr|hrs|hour|hours)\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?\b/i)
  if (hoursAndMinutes) {
    const hours = Number(hoursAndMinutes[1])
    const minutes = hoursAndMinutes[2] ? Number(hoursAndMinutes[2]) : 0
    return hours * 60 + minutes
  }

  const minutes = text.match(/\b(\d+)\s*(?:-| )?\s*(?:m|min|mins|minute|minutes)\b/i)
  if (minutes) return Number(minutes[1])

  return null
}

function parseActivity(text: string): {
  activity: Exclude<Activity, 'custom'>
  requestedActivityLabel: string
  title: string
  commuteMode?: CommuteMode
} | null {
  if (/\b(?:photo walk|photo|photography|camera|photos|sunset photos)\b/i.test(text)) {
    return { activity: 'photo', requestedActivityLabel: 'photo walk', title: 'Photo walk' }
  }
  if (/\b(?:walk|walking|stroll)\b/i.test(text)) {
    return { activity: 'commute', requestedActivityLabel: 'walk', title: 'Walk', commuteMode: 'walk' }
  }
  if (/\b(?:bike|biking|cycle|cycling)\b/i.test(text)) {
    return { activity: 'commute', requestedActivityLabel: 'bike ride', title: 'Bike ride', commuteMode: 'bike' }
  }
  if (/\b(?:drive|driving|car trip|commute|travel|transit)\b/i.test(text)) {
    return { activity: 'commute', requestedActivityLabel: 'commute', title: 'Commute', commuteMode: 'car' }
  }
  if (/\b(?:run|running|jog|jogging|hike|hiking|workout|exercise|tennis)\b/i.test(text)) {
    return { activity: 'run', requestedActivityLabel: 'run', title: 'Run' }
  }
  if (/\b(?:drinks|dinner|lunch|picnic|date|friends|social|market|park)\b/i.test(text)) {
    return { activity: 'social', requestedActivityLabel: 'outdoor social plan', title: 'Outdoor plan' }
  }
  if (/\b(?:study|reading|read|focus|writing|laptop work|deep work)\b/i.test(text)) {
    return { activity: 'study', requestedActivityLabel: 'study', title: 'Study' }
  }

  return null
}

function hasExplicitClockTime(text: string) {
  return (
    /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.test(text) ||
    /\bat\s+\d{1,2}(?::\d{2})?\b/i.test(text) ||
    /\b\d{1,2}:\d{2}\b/.test(text)
  )
}

function shouldDraftFromText(text: string) {
  return /\b(?:schedule|add|book|put|create|plan)\b/i.test(text)
}

function isAvailabilityQuery(text: string) {
  return /\b(?:available|availability|free|open slot|open slots|slot|slots|can i|could i|is there|are there)\b/i.test(text)
}

export function parseDeterministicSchedulingIntent(
  text: string,
  now: Date,
  timezone: string,
): DeterministicSchedulingIntent | null {
  const sourceText = text.trim()
  if (!sourceText || hasExplicitClockTime(sourceText)) return null

  const dateKey = resolveDateKey(sourceText, now, timezone)
  const preferredTime = parsePreferredTime(sourceText)
  const durationMinutes = parseDurationMinutes(sourceText)
  const activity = parseActivity(sourceText)

  if (!dateKey || !preferredTime || !durationMinutes || !activity) return null
  if (!shouldDraftFromText(sourceText) && !isAvailabilityQuery(sourceText)) return null

  return {
    ...activity,
    durationMinutes,
    dateKey,
    preferredTime,
    shouldDraft: shouldDraftFromText(sourceText),
    sourceText,
  }
}
