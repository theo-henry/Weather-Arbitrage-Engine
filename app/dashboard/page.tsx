"use client"

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PreferencePanel } from '@/components/preference-panel'
import { RecommendationCard } from '@/components/recommendation-card'
import { RankedList } from '@/components/ranked-list'
import { TimelineChart } from '@/components/timeline-chart'
import { InsightPanel } from '@/components/insight-panel'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { getTopWindows, getWindowAtTime } from '@/lib/weather-window-utils'
import { isTimeWindowBlockedForAnyActivity } from '@/lib/preferences'
import { applyPreferenceScoresToWindows } from '@/lib/scoring'
import { doesWindowConflictWithEvents } from '@/lib/weather-suggestions'
import { useWeatherData } from '@/hooks/use-weather-data'
import { usePreferences } from '@/hooks/use-preferences'
import { useCalendarEvents } from '@/hooks/use-calendar-events'
import { useUser } from '@/hooks/use-user'
import { isSupabaseConfigured } from '@/lib/supabase/public-config'
import { ACTIVITY_CONFIG } from '@/lib/types'
import type { CalendarEvent, EventColor } from '@/lib/types'

const ACTIVITY_COLORS: Record<string, EventColor> = {
  run: 'amber',
  study: 'violet',
  social: 'pink',
  photo: 'amber',
  commute: 'blue',
  custom: 'blue',
}

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useUser()
  const [preferences, setPreferences, preferencesReady] = usePreferences()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { events: calendarEvents } = useCalendarEvents()

  const { windows, loading, error, isLive, source, snapshotAt } = useWeatherData(preferences.city)

  // Blocked preference windows and existing calendar events are hard constraints —
  // remove them before scoring or ranking suggestions.
  const eligibleWindows = useMemo(() => {
    if (!preferencesReady) return []
    return windows
      .filter((window) => !isTimeWindowBlockedForAnyActivity(preferences, window))
      .filter((window) => !doesWindowConflictWithEvents(window, calendarEvents))
  }, [windows, preferences, preferencesReady, calendarEvents])

  // Recalculate scores based on preferences only after blocked windows have been excluded.
  const scoredWindows = useMemo(() => applyPreferenceScoresToWindows(eligibleWindows, preferences), [eligibleWindows, preferences])

  // Get top windows sorted by current activity score
  const topWindows = useMemo(() => {
    return getTopWindows(scoredWindows, preferences.activity, 10)
  }, [scoredWindows, preferences.activity])

  const bestWindow = topWindows[0]

  // Get usual slot window
  const usualWindow = useMemo(() => {
    return getWindowAtTime(scoredWindows, preferences.usualTime, 0)
  }, [scoredWindows, preferences.usualTime])

  const usualSlotScore = usualWindow?.scores[preferences.activity]

  const handleFindEdge = useCallback(() => {
    // Scroll to recommendation card
    document.getElementById('recommendation')?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleAddToCalendar = useCallback(() => {
    if (isSupabaseConfigured() && !user) {
      router.push('/signup?next=/scheduler')
      return
    }
    if (!bestWindow) return

    // Build a CalendarEvent from the recommended window
    const startDate = new Date(bestWindow.date)
    const [sh, sm] = bestWindow.startTime.split(':').map(Number)
    startDate.setHours(sh, sm, 0, 0)
    const endDate = new Date(bestWindow.date)
    const [eh, em] = bestWindow.endTime.split(':').map(Number)
    endDate.setHours(eh, em, 0, 0)

    const event: CalendarEvent = {
      id: `dash-${Date.now()}`,
      title: ACTIVITY_CONFIG[preferences.activity].label,
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      category: 'weather-sensitive',
      activity: preferences.activity,
      color: ACTIVITY_COLORS[preferences.activity] ?? 'blue',
      location: bestWindow.location,
      weatherScore: bestWindow.scores[preferences.activity],
      createdVia: 'ui',
    }

    try {
      sessionStorage.setItem('pendingCalendarEvent', JSON.stringify(event))
    } catch {}

    router.push('/scheduler')
  }, [user, router, bestWindow, preferences.activity])

  const PreferencePanelContent = (
    <PreferencePanel
      preferences={preferences}
      onPreferencesChange={setPreferences}
      onFindEdge={handleFindEdge}
    />
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex">
            {/* Desktop Sidebar */}
            <aside className="hidden lg:block w-80 flex-shrink-0 border-r border-border/50 bg-card/50 sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="p-6">
                {PreferencePanelContent}
              </div>
            </aside>

            {/* Mobile Sidebar */}
            <div className="lg:hidden fixed bottom-6 right-6 z-50">
              <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
                <SheetTrigger asChild>
                  <Button size="lg" className="rounded-full h-14 w-14 shadow-lg">
                    {sidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-6 overflow-y-auto">
                  {PreferencePanelContent}
                </SheetContent>
              </Sheet>
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-8">
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h1 className="text-2xl sm:text-3xl font-bold mb-2">
                  Your Weather Edge
                </h1>
                <p className="text-muted-foreground">
                  Optimal windows for {preferences.activity} in {preferences.city}
                  {isLive && <span className="ml-2 inline-flex items-center gap-1 text-xs text-green-500 font-medium"><span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />Live</span>}
                  {source === 'snapshot' && <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-500 font-medium">Saved snapshot{snapshotAt ? ` from ${new Date(snapshotAt).toLocaleString()}` : ''}</span>}
                  {loading && <span className="ml-2 text-xs text-muted-foreground">Loading weather data...</span>}
                </p>
                {error && (
                  <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    Live Google weather data is unavailable: {error}
                  </div>
                )}
              </motion.div>

              {/* Recommendation Card */}
              <div id="recommendation">
                {!preferencesReady ? (
                  <div className="rounded-2xl border border-border/50 bg-card p-6">
                    <h2 className="text-lg font-semibold">Loading preferences</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Checking your blocked time rules before showing dashboard recommendations.
                    </p>
                  </div>
                ) : error ? (
                  <div className="rounded-2xl border border-border/50 bg-card p-6">
                    <h2 className="text-lg font-semibold">Live weather unavailable</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Recommendations are hidden until Google Weather data loads for {preferences.city}.
                    </p>
                  </div>
                ) : bestWindow ? (
                  <RecommendationCard
                    window={bestWindow}
                    activity={preferences.activity}
                    usualSlotScore={usualSlotScore}
                    onAddToCalendar={handleAddToCalendar}
                    onSeeWhy={() => {
                      document.getElementById('insights')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  />
                ) : !loading && (
                  <div className="rounded-2xl border border-border/50 bg-card p-6">
                    <h2 className="text-lg font-semibold">No available windows</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Every forecast window for {preferences.activity} currently overlaps your blocked time rules or existing calendar events.
                      Adjust your preferences or clear some events to see recommendations.
                    </p>
                  </div>
                )}
              </div>

              {/* Ranked Alternatives */}
              {topWindows.length > 1 && (
                <RankedList
                  windows={topWindows}
                  activity={preferences.activity}
                  onSelect={(w) => {
                    // Could highlight this window
                    console.log('Selected window:', w.id)
                  }}
                />
              )}

              {/* Timeline Chart */}
              <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6">
                <TimelineChart
                  windows={scoredWindows}
                  activity={preferences.activity}
                  bestWindow={bestWindow}
                  usualTime={preferences.usualTime}
                />
              </div>

              {/* Insights */}
              <div id="insights">
                {bestWindow && (
                  <InsightPanel
                    bestWindow={bestWindow}
                    usualWindow={usualWindow}
                    activity={preferences.activity}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
