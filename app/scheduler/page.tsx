"use client"

import { useState, useMemo, useCallback, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, MessageSquare, ShieldAlert, ShieldCheck } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { SchedulerChat } from '@/components/scheduler-chat'
import { WeeklyCalendar } from '@/components/weekly-calendar'
import { EventDialog } from '@/components/event-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CalendarStoreProvider, useCalendarStore } from '@/hooks/use-calendar-store'
import { usePreferences } from '@/hooks/use-preferences'
import { useWeatherData } from '@/hooks/use-weather-data'
import { applyPreferenceScoresToWindows } from '@/lib/scoring'
import { computeProtectedEventAnalyses } from '@/lib/weather-suggestions'
import { AutoProtectPanel } from '@/components/auto-protect-panel'
import { cn } from '@/lib/utils'
import type { CalendarEvent, ProtectedEventAnalysis, SuggestedAlternative } from '@/lib/types'

function SchedulerContent() {
  const [preferences] = usePreferences()
  const city = preferences.city
  const { windows, loading: weatherLoading, error: weatherError } = useWeatherData(city)
  const { state, dispatch, hydrated } = useCalendarStore()
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  // Event dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Partial<CalendarEvent> | null>(null)
  const [dismissedFingerprints, setDismissedFingerprints] = useState<string[]>([])
  const [chatOpen, setChatOpen] = useState(true)
  const [autoProtectOpen, setAutoProtectOpen] = useState(false)
  const [highlightEventId, setHighlightEventId] = useState<string | null>(null)

  // Read highlight ID from sessionStorage (set by compare page) and clear after 5 seconds
  useEffect(() => {
    try {
      const id = sessionStorage.getItem('highlightEventId')
      if (!id) return
      sessionStorage.removeItem('highlightEventId')
      setHighlightEventId(id)
      const timer = setTimeout(() => setHighlightEventId(null), 5000)
      return () => clearTimeout(timer)
    } catch {}
  }, [])

  // Pick up a pending event from the dashboard "Add to Calendar" button.
  // Wait for hydration so ADD_EVENT fires after LOAD_EVENTS (avoids overwrite).
  useEffect(() => {
    if (!hydrated) return
    try {
      const raw = sessionStorage.getItem('pendingCalendarEvent')
      if (!raw) return
      sessionStorage.removeItem('pendingCalendarEvent')
      const event = JSON.parse(raw) as CalendarEvent
      // Small delay so the calendar is visible before the event drops in
      const timer = setTimeout(() => {
        dispatch({ type: 'ADD_EVENT', event })
        setHighlightEventId(event.id)
        setTimeout(() => setHighlightEventId(null), 5000)
      }, 400)
      return () => clearTimeout(timer)
    } catch {}
  }, [hydrated, dispatch])

  const personalizedWindows = useMemo(
    () => applyPreferenceScoresToWindows(windows, preferences),
    [windows, preferences],
  )

  const analyses = useMemo(
    () =>
      computeProtectedEventAnalyses(state.events, personalizedWindows, {
        dismissedFingerprints: new Set(dismissedFingerprints),
        preferences,
        timezone,
      }),
    [state.events, personalizedWindows, dismissedFingerprints, preferences, timezone]
  )

  const analysesById = useMemo(
    () => new Map(analyses.map((analysis) => [analysis.eventId, analysis])),
    [analyses]
  )

  const autoProtectMeta = useMemo(() => {
    if (weatherLoading) {
      return {
        atRiskCount: 0,
        actionableCount: 0,
        highRiskCount: 0,
        status: 'loading' as const,
        buttonTone: 'border-blue-500/25 bg-blue-500/5 hover:bg-blue-500/10',
        badgeTone: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300',
        summary: 'Loading live Google weather for schedule protection.',
      }
    }

    if (weatherError) {
      return {
        atRiskCount: 0,
        actionableCount: 0,
        highRiskCount: 0,
        status: 'paused' as const,
        buttonTone: 'border-red-500/30 bg-red-500/8 hover:bg-red-500/12',
        badgeTone: 'border-red-500/30 bg-red-500/12 text-red-600 dark:text-red-300',
        summary: 'Live Google weather is unavailable; schedule protection is paused.',
      }
    }

    const atRiskCount = analyses.filter(
      (analysis) => analysis.isWeatherRelevant && analysis.riskLevel !== 'low'
    ).length
    const actionableCount = analyses.filter(
      (analysis) => analysis.isWeatherRelevant && analysis.recommendedAlternative
    ).length
    const highRiskCount = analyses.filter(
      (analysis) => analysis.isWeatherRelevant && analysis.riskLevel === 'high'
    ).length

    if (highRiskCount > 0) {
      return {
        atRiskCount,
        actionableCount,
        highRiskCount,
        status: 'high-risk' as const,
        buttonTone: 'border-red-500/30 bg-red-500/8 hover:bg-red-500/12',
        badgeTone: 'border-red-500/30 bg-red-500/12 text-red-600 dark:text-red-300',
        summary:
          actionableCount > 0
            ? `${highRiskCount} urgent weather conflict${highRiskCount === 1 ? '' : 's'} with safer moves ready.`
            : `${highRiskCount} urgent weather conflict${highRiskCount === 1 ? '' : 's'} detected.`,
      }
    }

    if (atRiskCount > 0) {
      return {
        atRiskCount,
        actionableCount,
        highRiskCount,
        status: 'at-risk' as const,
        buttonTone: 'border-amber-500/30 bg-amber-500/8 hover:bg-amber-500/12',
        badgeTone: 'border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-300',
        summary:
          actionableCount > 0
            ? `${actionableCount} weather-aware schedule improvement${actionableCount === 1 ? '' : 's'} ready to review.`
            : `${atRiskCount} weather issue${atRiskCount === 1 ? '' : 's'} worth checking.`,
      }
    }

    return {
      atRiskCount,
      actionableCount,
      highRiskCount,
      status: 'clear' as const,
      buttonTone: 'border-green-500/25 bg-green-500/5 hover:bg-green-500/10',
      badgeTone: 'border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300',
      summary: 'No active weather conflicts right now.',
    }
  }, [analyses, weatherError, weatherLoading])

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

  const autoProtectTrigger = (
    <Button
      type="button"
      variant="outline"
      onClick={() => setAutoProtectOpen(true)}
      className={cn(
        'h-auto w-full flex-col items-start rounded-xl px-3 py-2 text-left shadow-sm',
        autoProtectMeta.buttonTone
      )}
    >
      <div className="flex w-full items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          {autoProtectMeta.atRiskCount > 0 ? (
            <ShieldAlert
              className={cn(
                'h-4 w-4',
                autoProtectMeta.highRiskCount > 0 ? 'text-red-500' : 'text-amber-500'
              )}
            />
          ) : (
            <ShieldCheck className="h-4 w-4 text-green-500" />
          )}
          <span className="text-xs font-semibold">Auto-Protect</span>
        </span>
        <Badge variant="outline" className={cn('text-[10px]', autoProtectMeta.badgeTone)}>
          {autoProtectMeta.atRiskCount === 0
            ? autoProtectMeta.status === 'loading'
              ? 'Loading'
              : autoProtectMeta.status === 'paused'
                ? 'Paused'
                : 'Clear'
            : `${autoProtectMeta.atRiskCount} issue${autoProtectMeta.atRiskCount === 1 ? '' : 's'}`}
        </Badge>
      </div>
      <p className="w-full text-left text-[11px] leading-relaxed text-muted-foreground">
        {autoProtectMeta.summary}
      </p>
    </Button>
  )

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
              <div className="border-b border-border/50 bg-card/65 px-4 pb-3 pt-4 pr-12 backdrop-blur-sm">
                {autoProtectTrigger}
              </div>
              <SchedulerChat
                city={city}
                windows={personalizedWindows}
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
              windows={personalizedWindows}
              analyses={analysesById}
              onAcceptSuggestion={handleAcceptSuggestion}
              onDismissSuggestion={handleDismissSuggestion}
              onCreateEvent={handleCreateEvent}
              onEditEvent={handleEditEvent}
              highlightEventId={highlightEventId}
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

      <Sheet open={autoProtectOpen} onOpenChange={setAutoProtectOpen}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b border-border/50 bg-card/80 pr-12 backdrop-blur-sm">
            <div className="flex items-start gap-3">
              {autoProtectMeta.atRiskCount > 0 ? (
                <ShieldAlert
                  className={cn(
                    'mt-0.5 h-5 w-5 shrink-0',
                    autoProtectMeta.highRiskCount > 0 ? 'text-red-500' : 'text-amber-500'
                  )}
                />
              ) : (
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-500" />
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SheetTitle>Auto-Protect Schedule</SheetTitle>
                  <Badge variant="outline" className={cn('text-[10px]', autoProtectMeta.badgeTone)}>
                    {autoProtectMeta.atRiskCount === 0
                      ? autoProtectMeta.status === 'loading'
                        ? 'Loading'
                        : autoProtectMeta.status === 'paused'
                          ? 'Paused'
                          : 'All clear'
                      : `${autoProtectMeta.atRiskCount} at risk`}
                  </Badge>
                </div>
                <SheetDescription className="mt-1">
                  {autoProtectMeta.status === 'paused'
                    ? `Live Google weather is unavailable for ${city}: ${weatherError}`
                    : 'Review weather-driven conflicts and one-click safer moves when you want them.'}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            <AutoProtectPanel
              analyses={analyses}
              onMove={(analysis) =>
                analysis.recommendedAlternative &&
                handleAcceptSuggestion(analysis.eventId, analysis.recommendedAlternative)
              }
              onDismiss={handleDismissSuggestion}
              showHeader={false}
              limit={analyses.length}
              className="bg-transparent"
            />
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Event Dialog */}
      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        onSave={handleSaveEvent}
        onDelete={handleDeleteEvent}
        windows={personalizedWindows}
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
