'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type Dispatch,
} from 'react'
import {
  calendarReducer,
  type CalendarAction,
  type CalendarState,
} from '@/lib/calendar-store'
import type { CalendarEvent } from '@/lib/types'
import { useUser } from '@/hooks/use-user'

interface CalendarStoreContextValue {
  state: CalendarState
  dispatch: Dispatch<CalendarAction>
}

const CalendarStoreContext = createContext<CalendarStoreContextValue | null>(null)

const initialState: CalendarState = { events: [] }

async function persistAction(
  action: CalendarAction,
  prev: CalendarState,
  next: CalendarState,
) {
  try {
    switch (action.type) {
      case 'ADD_EVENT':
        await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.event),
        })
        return
      case 'UPDATE_EVENT':
        await fetch(`/api/events/${encodeURIComponent(action.event.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action.event),
        })
        return
      case 'DELETE_EVENT':
        await fetch(`/api/events/${encodeURIComponent(action.id)}`, {
          method: 'DELETE',
        })
        return
      case 'MOVE_EVENT':
      case 'RESIZE_EVENT':
      case 'ACCEPT_SUGGESTION':
      case 'DISMISS_SUGGESTION': {
        const updated = next.events.find((e) => e.id === (action as { id: string }).id)
        if (!updated) return
        await fetch(`/api/events/${encodeURIComponent(updated.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        })
        return
      }
      default:
        return
    }
  } catch {
    // best-effort; UI already reflects optimistic change
  }
}

export function CalendarStoreProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const [state, baseDispatch] = useReducer(calendarReducer, initialState)
  const stateRef = useRef(state)
  const hydrated = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    if (loading || hydrated.current) return
    if (!user) {
      hydrated.current = true
      return
    }

    let cancelled = false
    fetch('/api/events')
      .then((r) => r.json())
      .then((data: { events?: CalendarEvent[] }) => {
        if (cancelled) return
        baseDispatch({ type: 'LOAD_EVENTS', events: data.events ?? [] })
        hydrated.current = true
      })
      .catch(() => {
        hydrated.current = true
      })

    return () => {
      cancelled = true
    }
  }, [user, loading])

  const dispatch = useCallback<Dispatch<CalendarAction>>((action) => {
    const prev = stateRef.current
    const next = calendarReducer(prev, action)
    baseDispatch(action)
    if (user && hydrated.current && action.type !== 'LOAD_EVENTS') {
      void persistAction(action, prev, next)
    }
  }, [user])

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch])

  return (
    <CalendarStoreContext.Provider value={value}>
      {children}
    </CalendarStoreContext.Provider>
  )
}

export function useCalendarStore() {
  const ctx = useContext(CalendarStoreContext)
  if (!ctx) throw new Error('useCalendarStore must be used within CalendarStoreProvider')
  return ctx
}
