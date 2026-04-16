"use client"

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { PreferencePanel } from '@/components/preference-panel'
import { RecommendationCard } from '@/components/recommendation-card'
import { RankedList } from '@/components/ranked-list'
import { TimelineChart } from '@/components/timeline-chart'
import { FactorChart } from '@/components/factor-chart'
import { InsightPanel } from '@/components/insight-panel'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { getWindows, getTopWindows, getWindowAtTime } from '@/lib/mockData'
import { scoreWindow } from '@/lib/scoring'
import type { UserPreferences, TimeWindow, Activity } from '@/lib/types'

// Default preferences matching demo state
const defaultPreferences: UserPreferences = {
  activity: 'run',
  city: 'Madrid',
  usualTime: '17:00',
  performanceVsComfort: 75,
  windSensitivity: 'high',
  rainAvoidance: 'medium',
  timeBias: 'evening',
  sunsetBonus: true,
  goldenHourPriority: true,
}

export default function DashboardPage() {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Get windows for the selected city
  const windows = useMemo(() => {
    return getWindows(preferences.city)
  }, [preferences.city])

  // Recalculate scores based on preferences
  const scoredWindows = useMemo(() => {
    return windows.map((w) => {
      const hour = parseInt(w.startTime.split(':')[0])
      const result = scoreWindow(w.weather, preferences, hour)
      return {
        ...w,
        scores: {
          ...w.scores,
          [preferences.activity]: result.score,
        },
        factorBreakdown: result.factors,
      }
    })
  }, [windows, preferences])

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
    // Navigate to scheduler with the best window
    window.location.href = '/scheduler'
  }, [])

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
                </p>
              </motion.div>

              {/* Recommendation Card */}
              <div id="recommendation">
                {bestWindow && (
                  <RecommendationCard
                    window={bestWindow}
                    activity={preferences.activity}
                    usualSlotScore={usualSlotScore}
                    onAddToCalendar={handleAddToCalendar}
                    onSeeWhy={() => {
                      document.getElementById('insights')?.scrollIntoView({ behavior: 'smooth' })
                    }}
                  />
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

              {/* Factor Chart */}
              {bestWindow && (
                <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6">
                  <FactorChart
                    bestWindow={bestWindow}
                    usualWindow={usualWindow}
                    activity={preferences.activity}
                  />
                </div>
              )}

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
