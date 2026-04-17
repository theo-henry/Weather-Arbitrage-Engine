import type { CalendarEvent } from './types'

const STORAGE_KEY = 'weather-calendar-events'

export type CalendarAction =
  | { type: 'ADD_EVENT'; event: CalendarEvent }
  | { type: 'UPDATE_EVENT'; event: CalendarEvent }
  | { type: 'DELETE_EVENT'; id: string }
  | { type: 'MOVE_EVENT'; id: string; startTime: string; endTime: string }
  | { type: 'RESIZE_EVENT'; id: string; endTime: string }
  | { type: 'ACCEPT_SUGGESTION'; id: string }
  | { type: 'DISMISS_SUGGESTION'; id: string }
  | { type: 'LOAD_EVENTS'; events: CalendarEvent[] }

export interface CalendarState {
  events: CalendarEvent[]
}

export function calendarReducer(state: CalendarState, action: CalendarAction): CalendarState {
  let newState: CalendarState

  switch (action.type) {
    case 'ADD_EVENT':
      newState = { ...state, events: [...state.events, action.event] }
      break

    case 'UPDATE_EVENT':
      newState = {
        ...state,
        events: state.events.map((e) =>
          e.id === action.event.id ? action.event : e
        ),
      }
      break

    case 'DELETE_EVENT':
      newState = {
        ...state,
        events: state.events.filter((e) => e.id !== action.id),
      }
      break

    case 'MOVE_EVENT':
      newState = {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? { ...e, startTime: action.startTime, endTime: action.endTime, suggestedAlternative: null }
            : e
        ),
      }
      break

    case 'RESIZE_EVENT':
      newState = {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, endTime: action.endTime } : e
        ),
      }
      break

    case 'ACCEPT_SUGGESTION': {
      const event = state.events.find((e) => e.id === action.id)
      if (!event?.suggestedAlternative) return state
      newState = {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? {
                ...e,
                startTime: e.suggestedAlternative!.startTime,
                endTime: e.suggestedAlternative!.endTime,
                weatherScore: e.suggestedAlternative!.score,
                suggestedAlternative: null,
              }
            : e
        ),
      }
      break
    }

    case 'DISMISS_SUGGESTION':
      newState = {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, suggestedAlternative: null } : e
        ),
      }
      break

    case 'LOAD_EVENTS':
      newState = { ...state, events: action.events }
      break

    default:
      return state
  }

  // Persist to localStorage
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newState.events))
    } catch {
      // localStorage full or unavailable
    }
  }

  return newState
}

export function loadEventsFromStorage(): CalendarEvent[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as CalendarEvent[]
  } catch {
    return null
  }
}
