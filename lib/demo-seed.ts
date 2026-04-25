import type { CalendarEvent, City, EventColor, TimeWindow, UserPreferences } from './types';
import { getDefaultUserPreferences } from './preferences';
import { getWindows } from './mockData';
import { computeSuggestion } from './weather-suggestions';

const DEMO_CITY: City = 'Madrid';
const DEMO_TIME_ZONE = 'Europe/Madrid';
const DAY_MS = 24 * 60 * 60 * 1000;
const DEMO_BLOCKED_ACTIVITIES: Array<keyof UserPreferences['blockedTimeRules']> = [
  'run',
  'study',
  'social',
  'commute',
  'photo',
  'custom',
];
const DEMO_BLOCKED_WEEKDAYS: Array<UserPreferences['blockedTimeRules']['run'][number]['day']> = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
];

export function applyDemoBlockedTimeRules(preferences: UserPreferences): UserPreferences {
  const lateNightBlockedRules = DEMO_BLOCKED_WEEKDAYS.map((day) => ({
    id: `demo-block-${day}-2300-2400`,
    day,
    startTime: '23:00',
    endTime: '24:00',
  }));

  return {
    ...preferences,
    blockedTimeRules: DEMO_BLOCKED_ACTIVITIES.reduce(
      (rules, activity) => {
        const existingRules = rules[activity] ?? [];
        const missingRules = lateNightBlockedRules.filter(
          (rule) =>
            !existingRules.some(
              (existing) =>
                existing.day === rule.day &&
                existing.startTime === rule.startTime &&
                existing.endTime === rule.endTime,
            ),
        );

        return {
          ...rules,
          [activity]: [
            ...existingRules,
            ...missingRules.map((rule) => ({ ...rule })),
          ],
        };
      },
      { ...preferences.blockedTimeRules },
    ),
  };
}

type WeatherSeedActivity = 'run' | 'social' | 'photo';
type DayKind = 'weekday' | 'weekend' | 'any';

interface EventSeedOptions {
  title: string;
  dateKey: string;
  start: string;
  end: string;
  category: CalendarEvent['category'];
  color: EventColor;
  location?: string;
  notes?: string;
  participants?: string[];
  activity?: WeatherSeedActivity;
  weatherScore?: number;
}

interface WeatherEventPlan {
  slug: string;
  title: string;
  activity: WeatherSeedActivity;
  durationSlots: number;
  color: EventColor;
  location: string;
  notes: string;
  participants?: string[];
  dayKind: DayKind;
  minOffset: number;
  maxOffset: number;
  preferredRanges: Array<[string, string]>;
}

interface CandidateWeatherEvent {
  event: CalendarEvent;
  dateKey: string;
  currentScore: number;
  improvement: number;
  offset: number;
}

const DEMO_PREFERENCES: UserPreferences = (() => {
  const preferences = getDefaultUserPreferences(DEMO_CITY);

  return applyDemoBlockedTimeRules({
    ...preferences,
    activity: 'run',
    usualTime: '18:30',
    activityProfiles: {
      ...preferences.activityProfiles,
      run: {
        ...preferences.activityProfiles.run,
        performanceVsComfort: 70,
        rainAvoidance: 'high',
      },
    },
  });
})();

const WEATHER_EVENT_PLANS: WeatherEventPlan[] = [
  {
    slug: 'retiro-tempo-run',
    title: 'Retiro tempo run',
    activity: 'run',
    durationSlots: 2,
    color: 'amber',
    location: 'Retiro Park',
    notes: 'Flexible session. Easy to move later the same day if conditions improve.',
    dayKind: 'weekday',
    minOffset: 0,
    maxOffset: 5,
    preferredRanges: [['17:30', '20:30']],
  },
  {
    slug: 'sunset-photo-walk',
    title: 'Sunset photo walk',
    activity: 'photo',
    durationSlots: 2,
    color: 'amber',
    location: 'Madrid Río',
    notes: 'Golden-hour scouting session for demo photos.',
    dayKind: 'weekday',
    minOffset: 1,
    maxOffset: 8,
    preferredRanges: [['18:30', '21:00']],
  },
  {
    slug: 'rooftop-drinks',
    title: 'Rooftop drinks with product team',
    activity: 'social',
    durationSlots: 3,
    color: 'pink',
    location: 'Picalagartos Sky Bar',
    notes: 'Flexible social plan. Worth nudging if wind or rain makes the terrace awkward.',
    participants: ['Nina', 'Marco', 'Lucia'],
    dayKind: 'weekday',
    minOffset: 2,
    maxOffset: 8,
    preferredRanges: [['18:30', '22:30']],
  },
  {
    slug: 'casa-de-campo-run',
    title: 'Casa de Campo long run',
    activity: 'run',
    durationSlots: 3,
    color: 'amber',
    location: 'Casa de Campo',
    notes: 'Weekend endurance run. Usually moved away from rain or peak heat.',
    dayKind: 'weekend',
    minOffset: 3,
    maxOffset: 10,
    preferredRanges: [['08:00', '11:30']],
  },
  {
    slug: 'retiro-picnic',
    title: 'Picnic in El Retiro',
    activity: 'social',
    durationSlots: 3,
    color: 'pink',
    location: 'Retiro Park',
    notes: 'Friends can shift this later in the day if the weather is rough.',
    participants: ['Paula', 'Javi'],
    dayKind: 'weekend',
    minOffset: 4,
    maxOffset: 10,
    preferredRanges: [['11:30', '17:00']],
  },
  {
    slug: 'golden-hour-shoot',
    title: 'Golden hour photo session',
    activity: 'photo',
    durationSlots: 2,
    color: 'amber',
    location: 'Temple of Debod',
    notes: 'Light-dependent shoot for social assets.',
    dayKind: 'weekday',
    minOffset: 6,
    maxOffset: 12,
    preferredRanges: [['18:30', '21:00']],
  },
  {
    slug: 'open-air-cinema',
    title: 'Open-air cinema meetup',
    activity: 'social',
    durationSlots: 3,
    color: 'pink',
    location: 'Parque de la Bombilla',
    notes: 'Outdoor plan that can move later if wind or rain picks up.',
    participants: ['Clara', 'Mauro'],
    dayKind: 'weekend',
    minOffset: 8,
    maxOffset: 13,
    preferredRanges: [['19:30', '23:00']],
  },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatDateKey(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Failed to format demo seed date');
  }

  return `${year}-${month}-${day}`;
}

function getWeekdayLabel(dateKey: string): string {
  const date = zonedDateTimeToUtc(dateKey, '12:00');
  return new Intl.DateTimeFormat('en-US', {
    timeZone: DEMO_TIME_ZONE,
    weekday: 'long',
  }).format(date);
}

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const timeZoneName = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'longOffset',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value;

  const match = timeZoneName?.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] || 0);
  return sign * (hours * 60 + minutes);
}

function zonedDateTimeToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const utcGuessMs = Date.UTC(year, month - 1, day, hours, minutes, 0, 0);

  let offsetMinutes = getTimeZoneOffsetMinutes(DEMO_TIME_ZONE, new Date(utcGuessMs));
  let result = new Date(utcGuessMs - offsetMinutes * 60 * 1000);

  const adjustedOffsetMinutes = getTimeZoneOffsetMinutes(DEMO_TIME_ZONE, result);
  if (adjustedOffsetMinutes !== offsetMinutes) {
    offsetMinutes = adjustedOffsetMinutes;
    result = new Date(utcGuessMs - offsetMinutes * 60 * 1000);
  }

  return result;
}

function windowStart(window: TimeWindow): Date {
  const date = new Date(window.date);
  const [hours, minutes] = window.startTime.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function windowEnd(window: TimeWindow): Date {
  const date = new Date(window.date);
  const [hours, minutes] = window.endTime.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function averagesScore(windows: TimeWindow[], activity: WeatherSeedActivity): number {
  return Math.round(
    windows.reduce((sum, window) => sum + window.scores[activity], 0) / windows.length
  );
}

function overlapsExisting(startTime: Date, endTime: Date, events: CalendarEvent[]): boolean {
  return events.some((event) => {
    const eventStart = new Date(event.startTime);
    const eventEnd = new Date(event.endTime);
    return startTime < eventEnd && endTime > eventStart;
  });
}

function matchesDayKind(dateKey: string, dayKind: DayKind): boolean {
  if (dayKind === 'any') return true;
  const weekday = getWeekdayLabel(dateKey);
  const isWeekend = weekday === 'Saturday' || weekday === 'Sunday';
  return dayKind === 'weekend' ? isWeekend : !isWeekend;
}

function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
}

function createEvent(options: EventSeedOptions): CalendarEvent {
  const startTime = zonedDateTimeToUtc(options.dateKey, options.start).toISOString();
  const endTime = zonedDateTimeToUtc(options.dateKey, options.end).toISOString();

  return {
    id: `demo-${options.dateKey}-${slugify(options.title)}`,
    title: options.title,
    startTime,
    endTime,
    category: options.category,
    ...(options.category === 'weather-sensitive' && options.activity
      ? { activity: options.activity }
      : {}),
    color: options.color,
    ...(options.participants ? { participants: options.participants } : {}),
    ...(options.notes ? { notes: options.notes } : {}),
    ...(options.location ? { location: options.location } : {}),
    ...(typeof options.weatherScore === 'number'
      ? { weatherScore: options.weatherScore }
      : {}),
    suggestedAlternative: null,
    createdVia: 'mock',
  };
}

function buildBaseDayEvents(dateKey: string, offset: number): CalendarEvent[] {
  const weekIndex = offset < 7 ? 0 : 1;
  const weekday = getWeekdayLabel(dateKey);

  switch (weekday) {
    case 'Monday':
      return [
        createEvent({
          title: 'Team standup',
          dateKey,
          start: '09:30',
          end: '10:00',
          category: 'indoor',
          color: 'blue',
          location: 'Zoom',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Focus block: roadmap deck' : 'Focus block: partnership brief',
          dateKey,
          start: '11:00',
          end: '12:30',
          category: 'indoor',
          color: 'violet',
          location: 'Home office',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Ops review call' : 'Budget check-in',
          dateKey,
          start: '15:30',
          end: '16:15',
          category: 'indoor',
          color: 'blue',
          location: 'Google Meet',
        }),
      ];

    case 'Tuesday':
      return [
        createEvent({
          title: 'Design review',
          dateKey,
          start: '10:00',
          end: '11:00',
          category: 'indoor',
          color: 'blue',
          location: 'Studio room',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Lunch with Elena' : 'Dentist appointment',
          dateKey,
          start: '13:00',
          end: '14:00',
          category: 'indoor',
          color: 'green',
          location: weekIndex === 0 ? 'Chamberí' : 'Clínica Velázquez',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Deep work: investor notes' : 'Deep work: onboarding polish',
          dateKey,
          start: '16:00',
          end: '17:30',
          category: 'indoor',
          color: 'violet',
          location: 'Home office',
        }),
      ];

    case 'Wednesday':
      return [
        createEvent({
          title: 'Weekly planning',
          dateKey,
          start: '09:00',
          end: '09:45',
          category: 'indoor',
          color: 'blue',
          location: 'Notion + coffee',
        }),
        createEvent({
          title: 'Customer discovery call',
          dateKey,
          start: '12:00',
          end: '13:00',
          category: 'indoor',
          color: 'blue',
          location: 'Zoom',
        }),
        createEvent({
          title: 'Prototype sprint',
          dateKey,
          start: '15:00',
          end: '16:30',
          category: 'indoor',
          color: 'violet',
          location: 'Coworking space',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Spanish tutoring call' : 'Family call',
          dateKey,
          start: '20:30',
          end: '21:15',
          category: 'indoor',
          color: 'green',
          location: 'Phone',
        }),
      ];

    case 'Thursday':
      return [
        createEvent({
          title: 'Roadmap review',
          dateKey,
          start: '10:00',
          end: '11:00',
          category: 'indoor',
          color: 'blue',
          location: 'Meeting room B',
        }),
        createEvent({
          title: 'Coffee with mentor',
          dateKey,
          start: '13:30',
          end: '14:15',
          category: 'indoor',
          color: 'green',
          location: 'Café Comercial',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Prototype sprint' : 'Admin block',
          dateKey,
          start: '16:00',
          end: '17:30',
          category: 'indoor',
          color: 'violet',
          location: weekIndex === 0 ? 'Coworking space' : 'Home office',
        }),
      ];

    case 'Friday':
      return [
        createEvent({
          title: 'Inbox zero',
          dateKey,
          start: '09:30',
          end: '10:00',
          category: 'indoor',
          color: 'green',
          location: 'Home office',
        }),
        createEvent({
          title: 'Weekly retro',
          dateKey,
          start: '11:00',
          end: '12:00',
          category: 'indoor',
          color: 'blue',
          location: 'Zoom',
        }),
        createEvent({
          title: weekIndex === 0 ? 'Grocery pickup' : 'Bank appointment',
          dateKey,
          start: '15:00',
          end: '16:00',
          category: 'indoor',
          color: 'green',
          location: weekIndex === 0 ? 'Mercado de Chamberí' : 'BBVA Serrano',
        }),
      ];

    case 'Saturday':
      return [
        createEvent({
          title: 'Laundry + home reset',
          dateKey,
          start: '10:30',
          end: '11:15',
          category: 'indoor',
          color: 'green',
          location: 'Home',
        }),
        createEvent({
          title: 'Call parents',
          dateKey,
          start: '17:30',
          end: '18:00',
          category: 'indoor',
          color: 'green',
          location: 'Phone',
        }),
      ];

    case 'Sunday':
      return [
        createEvent({
          title: 'Meal prep',
          dateKey,
          start: '11:00',
          end: '11:45',
          category: 'indoor',
          color: 'green',
          location: 'Home',
        }),
        createEvent({
          title: 'Week planning',
          dateKey,
          start: '18:00',
          end: '18:30',
          category: 'indoor',
          color: 'green',
          location: 'Home office',
        }),
      ];

    default:
      return [];
  }
}

function buildUpcomingDateKeys(totalDays: number): string[] {
  const todayKey = formatDateKey(new Date(), DEMO_TIME_ZONE);
  const anchor = zonedDateTimeToUtc(todayKey, '12:00');

  return Array.from({ length: totalDays }, (_, offset) =>
    formatDateKey(new Date(anchor.getTime() + offset * DAY_MS), DEMO_TIME_ZONE)
  );
}

function findWeatherCandidate(
  plan: WeatherEventPlan,
  dateKeys: string[],
  windowsByDate: Map<string, TimeWindow[]>,
  allWindows: TimeWindow[],
  existingEvents: CalendarEvent[],
  usedDateKeys: Set<string>,
  ignoreDateLock: boolean
): CandidateWeatherEvent | null {
  const candidates: CandidateWeatherEvent[] = [];

  const maxIndex = Math.min(plan.maxOffset, dateKeys.length - 1);
  for (let offset = plan.minOffset; offset <= maxIndex; offset++) {
    const dateKey = dateKeys[offset];
    if (!dateKey) continue;
    if (!ignoreDateLock && usedDateKeys.has(dateKey)) continue;
    if (!matchesDayKind(dateKey, plan.dayKind)) continue;

    const dayWindows = [...(windowsByDate.get(dateKey) ?? [])].sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    );
    if (dayWindows.length < plan.durationSlots) continue;

    for (let index = 0; index <= dayWindows.length - plan.durationSlots; index++) {
      const block = dayWindows.slice(index, index + plan.durationSlots);
      const blockStartMinutes = timeToMinutes(block[0].startTime);
      const blockEndMinutes = timeToMinutes(block[block.length - 1].endTime);

      const withinPreferredRange = plan.preferredRanges.some(([start, end]) => {
        return (
          blockStartMinutes >= timeToMinutes(start) &&
          blockEndMinutes <= timeToMinutes(end)
        );
      });
      if (!withinPreferredRange) continue;

      const currentScore = averagesScore(block, plan.activity);
      if (currentScore >= 68) continue;

      const startTime = windowStart(block[0]);
      const endTime = windowEnd(block[block.length - 1]);
      if (overlapsExisting(startTime, endTime, existingEvents)) continue;

      const event: CalendarEvent = {
        id: `demo-${dateKey}-${plan.slug}`,
        title: plan.title,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        category: 'weather-sensitive',
        activity: plan.activity,
        color: plan.color,
        ...(plan.participants ? { participants: plan.participants } : {}),
        location: plan.location,
        notes: plan.notes,
        weatherScore: currentScore,
        suggestedAlternative: null,
        createdVia: 'mock',
      };

      const suggestion = computeSuggestion(event, allWindows, existingEvents);
      if (!suggestion) continue;

      candidates.push({
        event,
        dateKey,
        currentScore,
        improvement: suggestion.score - currentScore,
        offset,
      });
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    return (
      a.currentScore - b.currentScore ||
      b.improvement - a.improvement ||
      a.offset - b.offset
    );
  });

  return candidates[0];
}

function buildWeatherSensitiveEvents(
  dateKeys: string[],
  windows: TimeWindow[],
  baseEvents: CalendarEvent[]
): CalendarEvent[] {
  const windowsByDate = new Map<string, TimeWindow[]>();
  for (const window of windows) {
    const dateKey = formatDateKey(new Date(window.date), DEMO_TIME_ZONE);
    const existing = windowsByDate.get(dateKey);
    if (existing) existing.push(window);
    else windowsByDate.set(dateKey, [window]);
  }

  const selectedEvents: CalendarEvent[] = [];
  const usedDateKeys = new Set<string>();

  for (const plan of WEATHER_EVENT_PLANS) {
    const existingEvents = [...baseEvents, ...selectedEvents];
    const candidate =
      findWeatherCandidate(
        plan,
        dateKeys,
        windowsByDate,
        windows,
        existingEvents,
        usedDateKeys,
        false
      ) ??
      findWeatherCandidate(
        plan,
        dateKeys,
        windowsByDate,
        windows,
        existingEvents,
        usedDateKeys,
        true
      );

    if (!candidate) continue;

    selectedEvents.push(candidate.event);
    usedDateKeys.add(candidate.dateKey);
  }

  return selectedEvents;
}

export function buildDemoSeed(): {
  preferences: UserPreferences;
  events: CalendarEvent[];
} {
  const dateKeys = buildUpcomingDateKeys(14);
  const baseEvents = sortEvents(
    dateKeys.flatMap((dateKey, offset) => buildBaseDayEvents(dateKey, offset))
  );
  const windows = getWindows(DEMO_CITY);
  const weatherSensitiveEvents = buildWeatherSensitiveEvents(
    dateKeys,
    windows,
    baseEvents
  );

  return {
    preferences: DEMO_PREFERENCES,
    events: sortEvents([...baseEvents, ...weatherSensitiveEvents]),
  };
}
