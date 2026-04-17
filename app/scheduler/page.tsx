"use client"

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/navbar'
import { SchedulerChat } from '@/components/scheduler-chat'
import { WeeklyCalendar } from '@/components/weekly-calendar'
import { EventDialog } from '@/components/event-dialog'
import { CalendarStoreProvider, useCalendarStore } from '@/hooks/use-calendar-store'
import { useWeatherData } from '@/hooks/use-weather-data'
import { computeAllSuggestions } from '@/lib/weather-suggestions'
import type { CalendarEvent } from '@/lib/types'

function SchedulerContent() {
  const city = 'Madrid'
  const { windows } = useWeatherData(city)
  const { state, dispatch } = useCalendarStore()

  // Event dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null)

  // Compute weather suggestions for all weather-sensitive events
  useEffect(() => {
    if (windows.length === 0) return
    const suggestions = computeAllSuggestions(state.events, windows)
    suggestions.forEach((suggestion, eventId) => {
      const event = state.events.find((e) => e.id === eventId)
      if (!event) return
      // Only update if suggestion changed
      const currentSug = event.suggestedAlternative
      if (suggestion && !currentSug) {
        dispatch({
          type: 'UPDATE_EVENT',
          event: {
            ...event,
            weatherScore: undefined, // will be recomputed
            suggestedAlternative: suggestion,
          },
        })
      }
    })
  }, [windows, state.events.length]) // Only recompute when events are added/removed

  const handleCreateEvent = useCallback((startTime: Date, endTime: Date) => {
    setEditingEvent({
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    })
    setDialogOpen(true)
  }, [])

  const handleEditEvent = useCallback((event: CalendarEvent) => {
    setEditingEvent(event)
    setDialogOpen(true)
  }, [])

  const handleSaveEvent = useCallback(
    (event: CalendarEvent) => {
      const existing = state.events.find((e) => e.id === event.id)
      if (existing) {
        dispatch({ type: 'UPDATE_EVENT', event })
      } else {
        dispatch({ type: 'ADD_EVENT', event })
      }
    },
    [state.events, dispatch]
  )

  const handleDeleteEvent = useCallback(
    (id: string) => {
      dispatch({ type: 'DELETE_EVENT', id })
    },
    [dispatch]
  )

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16">
        <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
          {/* Chat Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-[380px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/50 h-[40vh] lg:h-full"
          >
            <SchedulerChat
              city={city}
              windows={windows}
              className="h-full"
            />
          </motion.div>

          {/* Calendar Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 h-[60vh] lg:h-full overflow-hidden"
          >
            <WeeklyCalendar
              windows={windows}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              className="h-full"
            />
          </motion.div>
        </div>
      </main>

      {/* Event Dialog */}
      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        windows={windows}
      />
    </div>
  )
}

export default function SchedulerPage() {
  return (
    <CalendarStoreProvider>
      <SchedulerContent />
    </CalendarStoreProvider>
  )
}
