"use client"

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/navbar'
import { SchedulerChat } from '@/components/scheduler-chat'
import { WeeklyCalendar } from '@/components/weekly-calendar'
import { EventDialog } from '@/components/event-dialog'
import { CalendarStoreProvider, useCalendarStore } from '@/hooks/use-calendar-store'
import { useWeatherData } from '@/hooks/use-weather-data'
import { buildDemoRiskEvents } from '@/lib/mock-events'
import { computeProtectedEventAnalyses } from '@/lib/weather-suggestions'
import { AutoProtectPanel } from '@/components/auto-protect-panel'
import type { CalendarEvent, ProtectedEventAnalysis, SuggestedAlternative } from '@/lib/types'

function SchedulerContent() {
  const city = 'Madrid'
  const { windows } = useWeatherData(city)
  const { state, dispatch } = useCalendarStore()

  // Event dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null)
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([])

  const analyses = useMemo(
    () =>
      computeProtectedEventAnalyses(state.events, windows, {
        dismissedFingerprints: new Set(dismissedFingerprints),
      }),
    [state.events, windows, dismissedFingerprints]
  )

  const analysesById = useMemo(
    () => new Map(analyses.map((analysis) => [analysis.eventId, analysis])),
    [analyses]
  )

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

  const handleAcceptSuggestion = useCallback(
    (eventId: string, suggestion: SuggestedAlternative) => {
      dispatch({
        type: 'MOVE_EVENT',
        id: eventId,
        startTime: suggestion.startTime,
        endTime: suggestion.endTime,
      })
    },
    [dispatch]
  )

  const handleDismissSuggestion = useCallback((analysis: ProtectedEventAnalysis) => {
    if (!analysis.suggestionFingerprint) return
    setDismissedFingerprints((prev) =>
      prev.includes(analysis.suggestionFingerprint!) ? prev : [...prev, analysis.suggestionFingerprint!]
    )
  }, [])

  const handleLoadDemo = useCallback(() => {
    const demoEvents = buildDemoRiskEvents(windows)
    dispatch({ type: 'LOAD_EVENTS', events: demoEvents })
    setDismissedFingerprints([])
  }, [dispatch, windows])

  return (
    <div className="h-screen bg-background overflow-hidden">
      <Navbar />

      <main className="mt-16 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
          {/* Chat Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-2/5 min-h-0 flex-shrink-0 overflow-hidden border-b border-border/50 bg-card/50 lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r"
          >
            <div className="flex h-full min-h-0 flex-col overflow-hidden">
              <AutoProtectPanel
                analyses={analyses}
                onMove={(analysis) =>
                  analysis.recommendedAlternative &&
                  handleAcceptSuggestion(analysis.eventId, analysis.recommendedAlternative)
                }
                onDismiss={handleDismissSuggestion}
                onLoadDemo={handleLoadDemo}
              />
              <SchedulerChat
                city={city}
                windows={windows}
                className="min-h-0 flex-1"
              />
            </div>
          </motion.div>

          {/* Calendar Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="h-3/5 min-h-0 flex-1 overflow-hidden lg:h-full"
          >
            <WeeklyCalendar
              windows={windows}
              analyses={analysesById}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              className="h-full min-h-0"
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
