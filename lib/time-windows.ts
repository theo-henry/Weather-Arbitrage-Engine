export type PreferredTime = 'morning' | 'afternoon' | 'evening' | 'night' | 'any'

export const TIME_OF_DAY_WINDOWS: Record<Exclude<PreferredTime, 'any'>, { startTime: string; endTime: string }> = {
  morning: { startTime: '07:00', endTime: '12:00' },
  afternoon: { startTime: '12:00', endTime: '18:00' },
  evening: { startTime: '18:00', endTime: '21:00' },
  night: { startTime: '20:00', endTime: '23:00' },
}

export function getPreferredTimeBucket(date: Date, timezone: string): PreferredTime {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      hour12: false,
    }).format(date)
  )

  if (hour >= 7 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  if (hour >= 18 && hour < 21) return 'evening'
  return 'night'
}

export function matchesPreferredTimeBucket(
  date: Date,
  preferredTime: PreferredTime | undefined,
  timezone: string,
) {
  if (!preferredTime || preferredTime === 'any') return true
  return getPreferredTimeBucket(date, timezone) === preferredTime
}

export function formatPreferredTimeWindow(preferredTime: PreferredTime) {
  if (preferredTime === 'any') return 'any time'
  const window = TIME_OF_DAY_WINDOWS[preferredTime]
  return `${window.startTime}-${window.endTime}`
}
