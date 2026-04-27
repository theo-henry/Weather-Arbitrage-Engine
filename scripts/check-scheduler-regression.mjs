import { spawn } from 'node:child_process'
import process from 'node:process'

const PORT = 4312
const SPAWNED_BASE_URL = `http://127.0.0.1:${PORT}`
const EXISTING_BASE_URL = process.env.SCHEDULER_CHECK_URL || 'http://127.0.0.1:3000'

function zonedDateTimeToUtc(dateKey, time) {
  const [year, month, day] = dateKey.split('-').map(Number)
  const [hours, minutes] = time.split(':').map(Number)
  return new Date(Date.UTC(year, month - 1, day, hours - 2, minutes, 0, 0)).toISOString()
}

function makeWeatherWindow(index, startTime, endTime) {
  return {
    id: `test-madrid-sat-${index}`,
    day: 'Sat',
    date: zonedDateTimeToUtc('2026-05-02', startTime),
    startTime,
    endTime,
    city: 'Madrid',
    location: 'Retiro Park',
    weather: {
      temperature: 21,
      feelsLike: 21,
      humidity: 45,
      windSpeed: 8,
      precipitationProbability: 5,
      precipitation: 0,
      uvIndex: 5,
      cloudCover: 25,
      airQuality: 40,
      condition: 'clear',
    },
    scores: {
      run: 85,
      study: 70,
      social: 88,
      commute: 92,
      photo: 70,
      custom: 80,
    },
    factorBreakdown: {},
    confidence: 'High',
  }
}

const slotTimes = [
  ['12:00', '12:30'],
  ['12:30', '13:00'],
  ['13:00', '13:30'],
  ['13:30', '14:00'],
  ['14:00', '14:30'],
  ['14:30', '15:00'],
  ['15:00', '15:30'],
  ['15:30', '16:00'],
  ['16:00', '16:30'],
  ['16:30', '17:00'],
  ['17:00', '17:30'],
  ['17:30', '18:00'],
]

const emptyProfiles = {
  run: {},
  study: {},
  social: {},
  commute: { commuteMode: 'walk' },
  photo: {},
  custom: {},
}

const emptyBlockedRules = {
  run: [],
  study: [],
  social: [],
  commute: [],
  photo: [],
  custom: [],
}

const payload = {
  messages: [{ role: 'user', content: 'Schedule a 45-min walk Saturday afternoon' }],
  events: [
    {
      id: 'existing-photo',
      title: 'Golden hour photography',
      startTime: zonedDateTimeToUtc('2026-05-02', '17:00'),
      endTime: zonedDateTimeToUtc('2026-05-02', '18:30'),
      category: 'weather-sensitive',
      activity: 'photo',
      color: 'amber',
      location: 'Temple of Debod',
      suggestedAlternative: null,
      createdVia: 'mock',
    },
  ],
  windows: slotTimes.map(([start, end], index) => makeWeatherWindow(index, start, end)),
  city: 'Madrid',
  preferences: {
    activity: 'run',
    city: 'Madrid',
    usualTime: '18:30',
    activityProfiles: emptyProfiles,
    blockedTimeRules: emptyBlockedRules,
  },
  now: '2026-04-27T10:00:00.000Z',
  timezone: 'Europe/Madrid',
  pendingOperations: null,
}

async function postRegressionPayload(baseUrl) {
  const response = await fetch(`${baseUrl}/api/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) {
    throw new Error(`Assistant API returned ${response.status}: ${await response.text()}`)
  }
  return response.json()
}

function waitForServer(baseUrl) {
  const deadline = Date.now() + 30_000

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        resolve(await postRegressionPayload(baseUrl))
        return
      } catch {}

      if (Date.now() > deadline) {
        reject(new Error('Timed out waiting for Next dev server.'))
        return
      }

      setTimeout(poll, 500)
    }

    void poll()
  })
}

let server = null

try {
  let data
  try {
    data = await postRegressionPayload(EXISTING_BASE_URL)
  } catch {
    server = spawn('pnpm', ['exec', 'next', 'start', '-H', '127.0.0.1', '-p', String(PORT)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PORT: String(PORT) },
    })
    data = await waitForServer(SPAWNED_BASE_URL)
  }

  const draft = data.pendingOperations?.[0]?.eventDraft

  if (!data.requiresConfirmation || !draft) {
    throw new Error(`Expected a drafted calendar operation, got: ${JSON.stringify(data)}`)
  }

  const start = new Date(draft.startTime)
  const localHour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(start)

  if (localHour < '12:00' || localHour >= '17:00') {
    throw new Error(`Expected a Saturday afternoon start before the 17:00 conflict, got ${localHour}.`)
  }

  console.log(`Regression passed: drafted ${draft.title} at ${localHour} Europe/Madrid.`)
} finally {
  server?.kill('SIGTERM')
}
