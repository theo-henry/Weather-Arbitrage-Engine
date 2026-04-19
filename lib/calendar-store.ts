import type { CalendarEvent } from './types'

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
  switch (action.type) {
    case 'ADD_EVENT':
      return { ...state, events: [...state.events, action.event] }

    case 'UPDATE_EVENT':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.event.id ? action.event : e
        ),
      }

    case 'DELETE_EVENT':
      return {
        ...state,
        events: state.events.filter((e) => e.id !== action.id),
      }

    case 'MOVE_EVENT':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id
            ? { ...e, startTime: action.startTime, endTime: action.endTime, suggestedAlternative: null }
            : e
        ),
      }

    case 'RESIZE_EVENT':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, endTime: action.endTime } : e
        ),
      }

    case 'ACCEPT_SUGGESTION': {
      const event = state.events.find((e) => e.id === action.id)
      if (!event?.suggestedAlternative) return state
      return {
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
    }

    case 'DISMISS_SUGGESTION':
      return {
        ...state,
        events: state.events.map((e) =>
          e.id === action.id ? { ...e, suggestedAlternative: null } : e
        ),
      }

    case 'LOAD_EVENTS':
      return { ...state, events: action.events }

    default:
      return state
  }
}
