import { startOfWeek, addDays, setHours, setMinutes } from 'date-fns'
import type { Activity, CalendarEvent, EventColor, TimeWindow } from './types'

function makeEvent(
  dayOffset: number,
  startHour: number,
  startMin: number,
  endHour: number,
  endMin: number,
  title: string,
  category: 'weather-sensitive' | 'indoor',
  color: EventColor,
  opts: {
    activity?: CalendarEvent['activity']
    participants?: string[]
    notes?: string
    location?: string
  } = {}
): CalendarEvent {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }) // Monday
  const day = addDays(weekStart, dayOffset)
  const start = setMinutes(setHours(day, startHour), startMin)
  const end = setMinutes(setHours(day, endHour), endMin)

  return {
    id: `mock-${dayOffset}-${startHour}${startMin}-${title.replace(/\s/g, '')}`,
    title,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    category,
    color,
    createdVia: 'mock',
    ...opts,
  }
}

export function getMockCalendarEvents(): CalendarEvent[] {
  return [
    // Monday (day 0)
    makeEvent(0, 9, 0, 9, 30, 'Team Standup', 'indoor', 'blue', {
      participants: ['Alex', 'Maria', 'Carlos'],
      notes: 'Daily sync - blockers and priorities',
      location: 'Zoom',
    }),
    makeEvent(0, 10, 0, 12, 0, 'Deep Work: Q2 Planning', 'indoor', 'violet', {
      notes: 'Focus block - no meetings',
    }),
    makeEvent(0, 12, 30, 13, 30, 'Lunch with Sarah', 'indoor', 'green', {
      participants: ['Sarah'],
      location: 'Cafe downstairs',
    }),
    makeEvent(0, 14, 0, 15, 0, 'Client Call', 'indoor', 'blue', {
      participants: ['Client: Acme Corp'],
      notes: 'Q2 roadmap review',
      location: 'Google Meet',
    }),

    // Tuesday (day 1)
    makeEvent(1, 7, 0, 8, 0, 'Morning Run', 'weather-sensitive', 'amber', {
      activity: 'run',
      location: 'Retiro Park',
      notes: '5k easy pace',
    }),
    makeEvent(1, 10, 0, 11, 0, 'Sprint Review', 'indoor', 'blue', {
      participants: ['Dev Team'],
      location: 'Conference Room B',
    }),
    makeEvent(1, 15, 0, 15, 30, '1:1 with Manager', 'indoor', 'violet', {
      participants: ['Laura'],
      notes: 'Career growth discussion',
    }),

    // Wednesday (day 2)
    makeEvent(2, 7, 30, 8, 30, 'Yoga in the Park', 'weather-sensitive', 'green', {
      activity: 'run',
      location: 'Casa de Campo',
      participants: ['Yoga group'],
    }),
    makeEvent(2, 10, 0, 12, 0, 'Design Workshop', 'indoor', 'violet', {
      participants: ['Design Team', 'PM'],
      notes: 'New onboarding flow wireframes',
      location: 'Studio Room',
    }),
    makeEvent(2, 17, 0, 18, 30, 'Photo Walk', 'weather-sensitive', 'amber', {
      activity: 'photo',
      location: 'Madrid Río',
      notes: 'Golden hour street photography',
    }),

    // Thursday (day 3)
    makeEvent(3, 9, 0, 9, 30, 'Team Standup', 'indoor', 'blue', {
      participants: ['Alex', 'Maria', 'Carlos'],
      location: 'Zoom',
    }),
    makeEvent(3, 11, 0, 12, 0, 'Code Review', 'indoor', 'blue', {
      notes: 'Review PR #247 - auth refactor',
    }),
    makeEvent(3, 18, 0, 20, 0, 'Terrace Drinks', 'weather-sensitive', 'pink', {
      activity: 'social',
      participants: ['Friends'],
      location: 'Rooftop Bar',
      notes: 'Birthday celebration for Pablo',
    }),

    // Friday (day 4)
    makeEvent(4, 6, 30, 7, 30, 'Morning Jog', 'weather-sensitive', 'amber', {
      activity: 'run',
      location: 'Retiro Park',
      notes: 'Interval training',
    }),
    makeEvent(4, 11, 0, 12, 0, 'All Hands', 'indoor', 'blue', {
      participants: ['Entire company'],
      location: 'Main Hall',
      notes: 'Monthly company update',
    }),
    makeEvent(4, 12, 30, 13, 30, 'Bike to Lunch', 'weather-sensitive', 'green', {
      activity: 'run',
      participants: ['Tom'],
      location: 'Madrid Río',
      notes: 'Cycling to the new place by the river',
    }),

    // Saturday (day 5)
    makeEvent(5, 12, 0, 14, 0, 'Park Picnic', 'weather-sensitive', 'green', {
      activity: 'social',
      participants: ['Anna', 'Jake', 'Mia', 'Leo'],
      location: 'Retiro Park',
      notes: 'Bring blankets and snacks',
    }),
    makeEvent(5, 19, 0, 20, 30, 'Golden Hour Photos', 'weather-sensitive', 'amber', {
      activity: 'photo',
      location: 'El Capricho',
      notes: 'Landscape & portrait session',
    }),

    // Sunday (day 6)
    makeEvent(6, 8, 0, 10, 0, 'Long Run', 'weather-sensitive', 'amber', {
      activity: 'run',
      location: 'Casa de Campo',
      notes: '10k training run',
    }),
    makeEvent(6, 14, 0, 16, 0, 'Study Session', 'indoor', 'violet', {
      notes: 'TypeScript advanced patterns',
      location: 'Home office',
    }),
  ]
}

function createEventFromWindow(
  window: TimeWindow,
  title: string,
  activity: Activity,
  color: EventColor,
  durationMinutes: number,
  location?: string
): CalendarEvent {
  const start = new Date(window.date)
  const [startHour, startMinute] = window.startTime.split(':').map(Number)
  start.setHours(startHour, startMinute, 0, 0)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  return {
    id: `demo-${activity}-${window.id}`,
    title,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    category: 'weather-sensitive',
    activity,
    color,
    createdVia: 'mock',
    location: location || window.location,
    notes: 'Demo seeded risk event',
  }
}

export function buildDemoRiskEvents(windows: TimeWindow[]): CalendarEvent[] {
  if (windows.length === 0) return getMockCalendarEvents()

  const sortedBy = (activity: keyof TimeWindow['scores']) =>
    [...windows]
      .filter((window) => {
        const start = new Date(window.date)
        const hour = start.getHours()
        if (activity === 'run') return hour >= 6 && hour <= 10
        if (activity === 'photo') return hour >= 11 && hour <= 17
        return hour >= 12 && hour <= 20
      })
      .sort((a, b) => a.scores[activity] - b.scores[activity])

  const worstRun = sortedBy('run')[0] || windows[0]
  const worstSocial = sortedBy('social')[0] || windows[Math.min(1, windows.length - 1)]
  const worstPhoto = sortedBy('photo')[0] || windows[Math.min(2, windows.length - 1)]

  const usedIds = new Set<string>()
  const pickUnique = (candidate: TimeWindow) => {
    if (!usedIds.has(candidate.id)) {
      usedIds.add(candidate.id)
      return candidate
    }
    const alternative = windows.find((window) => !usedIds.has(window.id)) || candidate
    usedIds.add(alternative.id)
    return alternative
  }

  return [
    createEventFromWindow(pickUnique(worstRun), 'Morning Run', 'run', 'amber', 60, 'Retiro Park'),
    createEventFromWindow(pickUnique(worstSocial), 'Park Picnic', 'social', 'green', 120, 'Retiro Park'),
    createEventFromWindow(pickUnique(worstPhoto), 'Photo Walk', 'photo', 'amber', 90, 'Madrid Río'),
    makeEvent(1, 9, 30, 10, 0, 'Team Standup', 'indoor', 'blue', {
      participants: ['Alex', 'Marta'],
      location: 'Zoom',
    }),
  ]
}
