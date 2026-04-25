'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/use-user'
import { isSupabaseConfigured } from '@/lib/supabase/public-config'
import type { CalendarEvent } from '@/lib/types'

export function useCalendarEvents() {
  const { user, loading: userLoading } = useUser()
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return
    if (!isSupabaseConfigured() || !user) {
      setEvents([])
      setLoading(false)
      return
    }

    let cancelled = false
    fetch('/api/events')
      .then((r) => r.json())
      .then((data: { events?: CalendarEvent[] }) => {
        if (!cancelled) setEvents(data.events ?? [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user, userLoading])

  return { events, loading }
}
