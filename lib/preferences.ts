import type {
  Activity,
  ActivityPreferenceProfile,
  ActivityWeatherComfort,
  BlockedTimeRule,
  City,
  ResolvedActivityPreferences,
  TimeBias,
  UserPreferences,
  WeekdayKey,
} from './types'

const ACTIVITIES: Activity[] = ['run', 'study', 'social', 'flight', 'photo', 'custom']
const DEFAULT_CITY: City = 'Madrid'
const DEFAULT_ACTIVITY: Activity = 'run'
const DEFAULT_USUAL_TIME = '17:00'
const DEFAULT_TIME_BIAS: TimeBias = 'evening'

const WEEKDAY_SORT_ORDER: WeekdayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

const DEFAULT_COMFORTS: Record<Activity, ActivityWeatherComfort> = {
  run: {
    minTemperature: 8,
    maxTemperature: 24,
    maxWindSpeed: 24,
    maxPrecipitationProbability: 35,
  },
  study: {
    minTemperature: 18,
    maxTemperature: 25,
    maxWindSpeed: 40,
    maxPrecipitationProbability: 100,
  },
  social: {
    minTemperature: 16,
    maxTemperature: 30,
    maxWindSpeed: 20,
    maxPrecipitationProbability: 20,
  },
  flight: {
    minTemperature: -10,
    maxTemperature: 40,
    maxWindSpeed: 30,
    maxPrecipitationProbability: 40,
  },
  photo: {
    minTemperature: 8,
    maxTemperature: 30,
    maxWindSpeed: 22,
    maxPrecipitationProbability: 25,
  },
  custom: {
    minTemperature: 14,
    maxTemperature: 28,
    maxWindSpeed: 20,
    maxPrecipitationProbability: 25,
  },
}

const DEFAULT_ACTIVITY_PROFILES: Record<Activity, ActivityPreferenceProfile> = {
  run: {
    performanceVsComfort: 75,
    windSensitivity: 'high',
    rainAvoidance: 'medium',
    timeBias: DEFAULT_TIME_BIAS,
    comfort: DEFAULT_COMFORTS.run,
  },
  study: {
    preferCool: false,
    daylightPreference: 50,
    distractionSensitivity: false,
    comfort: DEFAULT_COMFORTS.study,
  },
  social: {
    warmthPreference: 50,
    sunsetBonus: true,
    comfort: DEFAULT_COMFORTS.social,
  },
  flight: {
    turbulenceSensitivity: 'medium',
    comfort: DEFAULT_COMFORTS.flight,
  },
  photo: {
    goldenHourPriority: true,
    cloudPreference: 'dramatic',
    comfort: DEFAULT_COMFORTS.photo,
  },
  custom: {
    timeBias: 'neutral',
    comfort: DEFAULT_COMFORTS.custom,
  },
}

const TIME_PATTERN = /^\d{2}:\d{2}$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isActivity(value: unknown): value is Activity {
  return typeof value === 'string' && ACTIVITIES.includes(value as Activity)
}

function isCity(value: unknown): value is City {
  return (
    typeof value === 'string' &&
    (value === 'Madrid' || value === 'Barcelona' || value === 'Valencia' || value === 'Seville')
  )
}

function isWeekday(value: unknown): value is WeekdayKey {
  return typeof value === 'string' && WEEKDAY_SORT_ORDER.includes(value as WeekdayKey)
}

function isTimeString(value: unknown): value is string {
  if (typeof value !== 'string' || !TIME_PATTERN.test(value)) return false
  const [hours, minutes] = value.split(':').map(Number)
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function copyComfort(comfort: ActivityWeatherComfort): ActivityWeatherComfort {
  return { ...comfort }
}

function copyProfile(profile: ActivityPreferenceProfile): ActivityPreferenceProfile {
  return {
    ...profile,
    comfort: profile.comfort ? copyComfort(profile.comfort) : undefined,
  }
}

function copyProfiles(): Record<Activity, ActivityPreferenceProfile> {
  return {
    run: copyProfile(DEFAULT_ACTIVITY_PROFILES.run),
    study: copyProfile(DEFAULT_ACTIVITY_PROFILES.study),
    social: copyProfile(DEFAULT_ACTIVITY_PROFILES.social),
    flight: copyProfile(DEFAULT_ACTIVITY_PROFILES.flight),
    photo: copyProfile(DEFAULT_ACTIVITY_PROFILES.photo),
    custom: copyProfile(DEFAULT_ACTIVITY_PROFILES.custom),
  }
}

function emptyBlockedTimeRules(): Record<Activity, BlockedTimeRule[]> {
  return {
    run: [],
    study: [],
    social: [],
    flight: [],
    photo: [],
    custom: [],
  }
}

function normalizeComfort(activity: Activity, value: unknown): ActivityWeatherComfort {
  const defaults = DEFAULT_COMFORTS[activity]
  if (!isRecord(value)) return copyComfort(defaults)

  return {
    minTemperature:
      typeof value.minTemperature === 'number'
        ? clamp(Math.round(value.minTemperature), -20, 45)
        : defaults.minTemperature,
    maxTemperature:
      typeof value.maxTemperature === 'number'
        ? clamp(Math.round(value.maxTemperature), -20, 45)
        : defaults.maxTemperature,
    maxWindSpeed:
      typeof value.maxWindSpeed === 'number'
        ? clamp(Math.round(value.maxWindSpeed), 0, 80)
        : defaults.maxWindSpeed,
    maxPrecipitationProbability:
      typeof value.maxPrecipitationProbability === 'number'
        ? clamp(Math.round(value.maxPrecipitationProbability), 0, 100)
        : defaults.maxPrecipitationProbability,
  }
}

function mergeProfiles(
  activity: Activity,
  base: ActivityPreferenceProfile,
  patch: Partial<ActivityPreferenceProfile>,
): ActivityPreferenceProfile {
  return {
    ...base,
    ...patch,
    comfort: patch.comfort
      ? {
          ...(base.comfort ?? DEFAULT_COMFORTS[activity]),
          ...patch.comfort,
        }
      : base.comfort
        ? copyComfort(base.comfort)
        : copyComfort(DEFAULT_COMFORTS[activity]),
  }
}

function normalizeProfile(activity: Activity, value: unknown): ActivityPreferenceProfile {
  const defaults = DEFAULT_ACTIVITY_PROFILES[activity]
  if (!isRecord(value)) return copyProfile(defaults)

  const normalized: ActivityPreferenceProfile = {
    ...copyProfile(defaults),
    comfort: normalizeComfort(activity, value.comfort),
  }

  if (typeof value.performanceVsComfort === 'number') {
    normalized.performanceVsComfort = clamp(Math.round(value.performanceVsComfort), 0, 100)
  }
  if (value.windSensitivity === 'low' || value.windSensitivity === 'medium' || value.windSensitivity === 'high') {
    normalized.windSensitivity = value.windSensitivity
  }
  if (value.rainAvoidance === 'low' || value.rainAvoidance === 'medium' || value.rainAvoidance === 'high') {
    normalized.rainAvoidance = value.rainAvoidance
  }
  if (value.timeBias === 'morning' || value.timeBias === 'neutral' || value.timeBias === 'evening') {
    normalized.timeBias = value.timeBias
  }
  if (typeof value.preferCool === 'boolean') {
    normalized.preferCool = value.preferCool
  }
  if (typeof value.daylightPreference === 'number') {
    normalized.daylightPreference = clamp(Math.round(value.daylightPreference), 0, 100)
  }
  if (typeof value.distractionSensitivity === 'boolean') {
    normalized.distractionSensitivity = value.distractionSensitivity
  }
  if (typeof value.warmthPreference === 'number') {
    normalized.warmthPreference = clamp(Math.round(value.warmthPreference), 0, 100)
  }
  if (typeof value.sunsetBonus === 'boolean') {
    normalized.sunsetBonus = value.sunsetBonus
  }
  if (typeof value.goldenHourPriority === 'boolean') {
    normalized.goldenHourPriority = value.goldenHourPriority
  }
  if (value.cloudPreference === 'clear' || value.cloudPreference === 'dramatic') {
    normalized.cloudPreference = value.cloudPreference
  }
  if (
    value.turbulenceSensitivity === 'low' ||
    value.turbulenceSensitivity === 'medium' ||
    value.turbulenceSensitivity === 'high'
  ) {
    normalized.turbulenceSensitivity = value.turbulenceSensitivity
  }

  return normalized
}

function buildRuleId(day: WeekdayKey, startTime: string, endTime: string) {
  return `${day}-${startTime}-${endTime}-${Math.random().toString(36).slice(2, 8)}`
}

function normalizeBlockedTimeRules(value: unknown): BlockedTimeRule[] {
  if (!Array.isArray(value)) return []

  const normalized = value
    .map((item) => {
      if (!isRecord(item) || !isWeekday(item.day) || !isTimeString(item.startTime) || !isTimeString(item.endTime)) {
        return null
      }

      if (timeStringToMinutes(item.endTime) <= timeStringToMinutes(item.startTime)) {
        return null
      }

      return {
        id: typeof item.id === 'string' && item.id ? item.id : buildRuleId(item.day, item.startTime, item.endTime),
        day: item.day,
        startTime: item.startTime,
        endTime: item.endTime,
      } satisfies BlockedTimeRule
    })
    .filter((item): item is BlockedTimeRule => item !== null)

  return normalized.sort(sortBlockedTimeRules)
}

function sortBlockedTimeRules(a: BlockedTimeRule, b: BlockedTimeRule) {
  const dayOrder = WEEKDAY_SORT_ORDER.indexOf(a.day) - WEEKDAY_SORT_ORDER.indexOf(b.day)
  if (dayOrder !== 0) return dayOrder
  return timeStringToMinutes(a.startTime) - timeStringToMinutes(b.startTime)
}

export function timeStringToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

export function getDefaultUserPreferences(city: City = DEFAULT_CITY): UserPreferences {
  return {
    activity: DEFAULT_ACTIVITY,
    city,
    usualTime: DEFAULT_USUAL_TIME,
    activityProfiles: copyProfiles(),
    blockedTimeRules: emptyBlockedTimeRules(),
  }
}

function extractLegacyProfile(value: Record<string, unknown>): Partial<ActivityPreferenceProfile> {
  const legacy: Partial<ActivityPreferenceProfile> = {}

  if (typeof value.performanceVsComfort === 'number') {
    legacy.performanceVsComfort = clamp(Math.round(value.performanceVsComfort), 0, 100)
  }
  if (value.windSensitivity === 'low' || value.windSensitivity === 'medium' || value.windSensitivity === 'high') {
    legacy.windSensitivity = value.windSensitivity
  }
  if (value.rainAvoidance === 'low' || value.rainAvoidance === 'medium' || value.rainAvoidance === 'high') {
    legacy.rainAvoidance = value.rainAvoidance
  }
  if (value.timeBias === 'morning' || value.timeBias === 'neutral' || value.timeBias === 'evening') {
    legacy.timeBias = value.timeBias
  }
  if (typeof value.preferCool === 'boolean') {
    legacy.preferCool = value.preferCool
  }
  if (typeof value.daylightPreference === 'number') {
    legacy.daylightPreference = clamp(Math.round(value.daylightPreference), 0, 100)
  }
  if (typeof value.distractionSensitivity === 'boolean') {
    legacy.distractionSensitivity = value.distractionSensitivity
  }
  if (typeof value.warmthPreference === 'number') {
    legacy.warmthPreference = clamp(Math.round(value.warmthPreference), 0, 100)
  }
  if (typeof value.sunsetBonus === 'boolean') {
    legacy.sunsetBonus = value.sunsetBonus
  }
  if (typeof value.goldenHourPriority === 'boolean') {
    legacy.goldenHourPriority = value.goldenHourPriority
  }
  if (value.cloudPreference === 'clear' || value.cloudPreference === 'dramatic') {
    legacy.cloudPreference = value.cloudPreference
  }
  if (
    value.turbulenceSensitivity === 'low' ||
    value.turbulenceSensitivity === 'medium' ||
    value.turbulenceSensitivity === 'high'
  ) {
    legacy.turbulenceSensitivity = value.turbulenceSensitivity
  }

  return legacy
}

export function normalizeUserPreferences(value: unknown): UserPreferences {
  const raw = isRecord(value) ? value : {}
  const city = isCity(raw.city) ? raw.city : DEFAULT_CITY
  const defaults = getDefaultUserPreferences(city)
  const activity = isActivity(raw.activity) ? raw.activity : defaults.activity

  const activityProfiles = copyProfiles()
  if (isRecord(raw.activityProfiles)) {
    for (const candidate of ACTIVITIES) {
      activityProfiles[candidate] = normalizeProfile(candidate, raw.activityProfiles[candidate])
    }
  }

  const legacyProfile = extractLegacyProfile(raw)
  if (Object.keys(legacyProfile).length > 0) {
    activityProfiles[activity] = mergeProfiles(activity, activityProfiles[activity], legacyProfile)
  }

  const blockedTimeRules = emptyBlockedTimeRules()
  if (isRecord(raw.blockedTimeRules)) {
    for (const candidate of ACTIVITIES) {
      blockedTimeRules[candidate] = normalizeBlockedTimeRules(raw.blockedTimeRules[candidate])
    }
  }

  return {
    activity,
    city,
    usualTime: isTimeString(raw.usualTime) ? raw.usualTime : DEFAULT_USUAL_TIME,
    activityProfiles,
    blockedTimeRules,
  }
}

export function getActivityProfile(
  preferences: UserPreferences,
  activity: Activity = preferences.activity,
): ActivityPreferenceProfile {
  return preferences.activityProfiles[activity] ?? copyProfile(DEFAULT_ACTIVITY_PROFILES[activity])
}

export function getResolvedActivityPreferences(
  preferences: UserPreferences,
  activity: Activity = preferences.activity,
): ResolvedActivityPreferences {
  return {
    activity,
    city: preferences.city,
    usualTime: preferences.usualTime,
    ...copyProfile(getActivityProfile(preferences, activity)),
  }
}

function getWeekdayKey(date: Date, timezone: string): WeekdayKey {
  const weekday = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: timezone,
  }).format(date)

  switch (weekday) {
    case 'Sun':
      return 'sun'
    case 'Mon':
      return 'mon'
    case 'Tue':
      return 'tue'
    case 'Wed':
      return 'wed'
    case 'Thu':
      return 'thu'
    case 'Fri':
      return 'fri'
    default:
      return 'sat'
  }
}

function getLocalTimeString(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function getBlockedTimeRulesForActivity(preferences: UserPreferences, activity: Activity) {
  return preferences.blockedTimeRules[activity] ?? []
}

export function getBlockedTimeMatches(
  preferences: UserPreferences,
  activity: Activity,
  startTime: Date,
  endTime: Date,
  timezone: string,
) {
  if (!(startTime < endTime)) return [] as BlockedTimeRule[]

  const weekday = getWeekdayKey(startTime, timezone)
  const startMinutes = timeStringToMinutes(getLocalTimeString(startTime, timezone))
  const endMinutes = timeStringToMinutes(getLocalTimeString(endTime, timezone))

  return getBlockedTimeRulesForActivity(preferences, activity).filter((rule) => {
    if (rule.day !== weekday) return false
    const ruleStart = timeStringToMinutes(rule.startTime)
    const ruleEnd = timeStringToMinutes(rule.endTime)
    return startMinutes < ruleEnd && endMinutes > ruleStart
  })
}

export function isTimeRangeBlocked(
  preferences: UserPreferences,
  activity: Activity,
  startTime: Date,
  endTime: Date,
  timezone: string,
) {
  return getBlockedTimeMatches(preferences, activity, startTime, endTime, timezone).length > 0
}

export function formatBlockedTimeRule(rule: BlockedTimeRule) {
  const dayLabels: Record<WeekdayKey, string> = {
    sun: 'Sunday',
    mon: 'Monday',
    tue: 'Tuesday',
    wed: 'Wednesday',
    thu: 'Thursday',
    fri: 'Friday',
    sat: 'Saturday',
  }

  return `${dayLabels[rule.day]}, ${rule.startTime}–${rule.endTime}`
}

export function sortRules(rules: BlockedTimeRule[]) {
  return [...rules].sort(sortBlockedTimeRules)
}

export function upsertBlockedTimeRule(
  existingRules: BlockedTimeRule[],
  nextRule: Omit<BlockedTimeRule, 'id'>,
): BlockedTimeRule[] {
  const duplicate = existingRules.find(
    (rule) => rule.day === nextRule.day && rule.startTime === nextRule.startTime && rule.endTime === nextRule.endTime,
  )
  if (duplicate) return sortRules(existingRules)

  return sortRules([
    ...existingRules,
    {
      ...nextRule,
      id: buildRuleId(nextRule.day, nextRule.startTime, nextRule.endTime),
    },
  ])
}

export function removeBlockedTimeRule(
  existingRules: BlockedTimeRule[],
  match: Pick<BlockedTimeRule, 'id' | 'day' | 'startTime' | 'endTime'>,
) {
  return existingRules.filter((rule) => {
    if (match.id && rule.id === match.id) return false
    return !(rule.day === match.day && rule.startTime === match.startTime && rule.endTime === match.endTime)
  })
}
