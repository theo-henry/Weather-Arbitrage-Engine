'use client'

import { createContext, useContext, useReducer, useEffect, useRef, type Dispatch } from 'react'
import { calendarReducer, loadEventsFromStorage, type CalendarAction, type CalendarState } from '@/lib/calendar-store'
import { getMockCalendarEvents } from '@/lib/mock-events'

interface CalendarStoreContextValue {
  state: CalendarState
  dispatch: Dispatch<CalendarAction>
}

const CalendarStoreContext = createContext<CalendarStoreContextValue | null>(null)

const initialState: CalendarState = { events: [] }

export function CalendarStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(calendarReducer, initialState)
  const hydrated = useRef(false)

  useEffect(() => {
    if (hydrated.current) return
    hydrated.current = true

    const stored = loadEventsFromStorage()
    if (stored && stored.length > 0) {
      dispatch({ type: 'LOAD_EVENTS', events: stored })
    } else {
      // First visit: load mock events
      const mocks = getMockCalendarEvents()
      dispatch({ type: 'LOAD_EVENTS', events: mocks })
    }
  }, [])

  return (
    <CalendarStoreContext.Provider value={{ state, dispatch }}>
      {children}
    </CalendarStoreContext.Provider>
  )
}

export function useCalendarStore() {
  const ctx = useContext(CalendarStoreContext)
  if (!ctx) throw new Error('useCalendarStore must be used within CalendarStoreProvider')
  return ctx
}
