"use client"

import { useState, useMemo, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, MessageSquare } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { SchedulerChat } from '@/components/scheduler-chat'
import { WeeklyCalendar } from '@/components/weekly-calendar'
import { EventDialog } from '@/components/event-dialog'
import { CalendarStoreProvider, useCalendarStore } from '@/hooks/use-calendar-store'
import { useWeatherData } from '@/hooks/use-weather-data'
import { computeProtectedEventAnalyses } from '@/lib/weather-suggestions'
import { AutoProtectPanel } from '@/components/auto-protect-panel'
import { cn } from '@/lib/utils'
import type { CalendarEvent, ProtectedEventAnalysis, SuggestedAlternative } from '@/lib/types'

function SchedulerContent() {
  const city = 'Madrid'
  const { windows } = useWeatherData(city)
  const { state, dispatch } = useCalendarStore()

  // Event dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null)
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([])
  const [chatOpen, setChatOpen] = useState(true)

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

  return (
    <div className="h-screen bg-background overflow-hidden">
      <Navbar />

      <main className="relative mt-16 h-[calc(100vh-4rem)] overflow-hidden">
        <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row">
          {/* Chat Panel (stays mounted so chat history persists when toggled) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className={cn(
              'min-h-0 flex-shrink-0 overflow-hidden border-border/50 bg-card/50 transition-[width,height,border] duration-300 ease-in-out',
              chatOpen
                ? 'h-2/5 border-b lg:h-full lg:w-[380px] lg:border-b-0 lg:border-r'
                : 'h-0 border-b-0 lg:h-full lg:w-0 lg:border-r-0',
            )}
          >
            <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[380px]">
              <button
                type="button"
                onClick={() => setChatOpen(false)}
                aria-label="Hide chat"
                className="absolute right-2 top-2 z-10 hidden h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <AutoProtectPanel
                analyses={analyses}
                onMove={(analysis) =>
                  analysis.recommendedAlternative &&
                  handleAcceptSuggestion(analysis.eventId, analysis.recommendedAlternative)
                }
                onDismiss={handleDismissSuggestion}
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
            className={cn(
              'min-h-0 flex-1 overflow-hidden transition-[height] duration-300 ease-in-out lg:h-full',
              chatOpen ? 'h-3/5' : 'h-full',
            )}
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

        {/* Reopen chat tab (desktop only, when chat is hidden) */}
        <AnimatePresence>
          {!chatOpen && (
            <motion.button
              key="reopen-chat"
              type="button"
              initial={{ x: -40, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -40, opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setChatOpen(true)}
              aria-label="Show chat"
              className="absolute left-0 top-1/2 z-20 hidden -translate-y-1/2 items-center gap-2 rounded-r-md border border-l-0 border-border/50 bg-card/90 px-2 py-3 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card hover:text-foreground lg:flex"
            >
              <MessageSquare className="h-4 w-4" />
              <span className="[writing-mode:vertical-rl] rotate-180">Chat</span>
            </motion.button>
          )}
        </AnimatePresence>
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
