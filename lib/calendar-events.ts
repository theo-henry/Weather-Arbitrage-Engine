import type { Activity, CalendarEvent } from './types'

export function normalizeActivityValue(value: unknown): Activity | undefined {
  if (value === 'flight') return 'commute'
  if (
    value === 'run' ||
    value === 'study' ||
    value === 'social' ||
    value === 'commute' ||
    value === 'photo' ||
    value === 'custom'
  ) {
    return value
  }
  return undefined
}

export function normalizeCalendarEvent(event: CalendarEvent): CalendarEvent {
  const activity = normalizeActivityValue(event.activity)
  return {
    ...event,
    ...(activity ? { activity } : { activity: undefined }),
  }
}

export function normalizeCalendarEvents(events: CalendarEvent[]): CalendarEvent[] {
  return events.map(normalizeCalendarEvent)
}
