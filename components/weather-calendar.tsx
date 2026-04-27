"use client"

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, Grid, List } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { WeatherIcon } from '@/components/weather-icon'
import { ScoreChip } from '@/components/score-chip'
import type { TimeWindow, ScheduledEvent } from '@/lib/types'
import { cn } from '@/lib/utils'

interface WeatherCalendarProps {
  windows: TimeWindow[]
  events: ScheduledEvent[]
  suggestedWindow?: TimeWindow
  onEventDrop?: (event: ScheduledEvent, newWindow: TimeWindow) => void
  className?: string
}

const hours = Array.from({ length: 16 }, (_, i) => i + 6) // 6am to 9pm

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500/20'
  if (score >= 60) return 'bg-lime-500/15'
  if (score >= 40) return 'bg-amber-500/10'
  return 'bg-red-500/10'
}

export function WeatherCalendar({ 
  windows, 
  events, 
  suggestedWindow,
  onEventDrop,
  className 
}: WeatherCalendarProps) {
  const [view, setView] = useState<'heatmap' | 'classic'>('heatmap')
  const [dayOffset, setDayOffset] = useState(0)

  // Group windows by day
  const windowsByDay = useMemo(() => {
    const days: Record<string, TimeWindow[]> = {}
    windows.forEach((w) => {
      const dateKey = w.date.split('T')[0]
      if (!days[dateKey]) days[dateKey] = []
      days[dateKey].push(w)
    })
    return Object.entries(days).slice(0, 2)
  }, [windows])

  const currentDay = windowsByDay[dayOffset]
  const dayLabel = currentDay?.[0] ? new Date(currentDay[1][0].date).toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  }) : 'Today'

  // Get window for a specific hour on current day
  const getWindowForHour = (hour: number): TimeWindow | undefined => {
    if (!currentDay) return undefined
    return currentDay[1].find((w) => {
      const windowHour = parseInt(w.startTime.split(':')[0])
      return windowHour === hour
    })
  }

  // Get event for a specific hour
  const getEventForHour = (hour: number): ScheduledEvent | undefined => {
    return events.find((e) => {
      const eventHour = parseInt(e.window.startTime.split(':')[0])
      const eventDay = new Date(e.window.date).toDateString()
      const currentDayDate = currentDay?.[1][0]?.date
      if (!currentDayDate) return false
      return eventHour === hour && eventDay === new Date(currentDayDate).toDateString()
    })
  }

  const isSuggestedHour = (hour: number): boolean => {
    if (!suggestedWindow || !currentDay) return false
    const suggestedHour = parseInt(suggestedWindow.startTime.split(':')[0])
    const suggestedDay = new Date(suggestedWindow.date).toDateString()
    const currentDayDate = new Date(currentDay[1][0].date).toDateString()
    return suggestedHour === hour && suggestedDay === currentDayDate
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDayOffset(Math.max(0, dayOffset - 1))}
            disabled={dayOffset === 0}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="font-semibold min-w-[150px] text-center">{dayLabel}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDayOffset(Math.min(1, dayOffset + 1))}
            disabled={dayOffset === 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        
        <Tabs value={view} onValueChange={(v) => setView(v as 'heatmap' | 'classic')}>
          <TabsList>
            <TabsTrigger value="heatmap" className="gap-1.5">
              <Grid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Heatmap</span>
            </TabsTrigger>
            <TabsTrigger value="classic" className="gap-1.5">
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Classic</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {hours.map((hour) => {
            const window = getWindowForHour(hour)
            const event = getEventForHour(hour)
            const isSuggested = isSuggestedHour(hour)
            const score = window?.scores.run ?? 50

            return (
              <motion.div
                key={hour}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: (hour - 6) * 0.02 }}
                className={cn(
                  'relative flex items-stretch rounded-lg border transition-all',
                  isSuggested 
                    ? 'border-blue-500/50 ring-2 ring-blue-500/20' 
                    : 'border-border/30 hover:border-border/50',
                  view === 'heatmap' && window && getScoreColor(score)
                )}
              >
                {/* Time label */}
                <div className="w-16 flex-shrink-0 flex items-center justify-center text-sm text-muted-foreground border-r border-border/30 py-3">
                  {hour.toString().padStart(2, '0')}:00
                </div>

                {/* Content area */}
                <div className="flex-1 min-h-[60px] p-2 relative">
                  {/* Weather info (every 3 hours) */}
                  {window && hour % 3 === 0 && (
                    <div className="absolute top-1 right-1 flex items-center gap-1.5">
                      <WeatherIcon condition={window.weather.condition} size="sm" animated={false} />
                      <span className="text-xs text-muted-foreground">{window.weather.temperature}°</span>
                    </div>
                  )}

                  {/* Score chip in heatmap view */}
                  {view === 'heatmap' && window && (
                    <div className="absolute bottom-1 right-1">
                      <ScoreChip score={score} size="sm" />
                    </div>
                  )}

                  {/* Event */}
                  <AnimatePresence>
                    {event && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="absolute inset-2 rounded-md bg-gradient-to-r from-blue-500/20 via-violet-500/20 to-amber-500/20 border border-blue-500/30 flex items-center gap-2 px-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <p className="text-xs text-muted-foreground">{event.window.location}</p>
                        </div>
                        <Badge variant="secondary" className="flex-shrink-0">
                          {event.score}
                        </Badge>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Suggested window indicator */}
                  {isSuggested && !event && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-2 rounded-md border-2 border-dashed border-blue-500/50 flex items-center justify-center"
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10">
                        <motion.div
                          className="w-2 h-2 rounded-full bg-blue-500"
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        />
                        <span className="text-xs font-medium text-blue-500">Best Window</span>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-border/50">
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-500/30" />
            <span>High score</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-amber-500/30" />
            <span>Medium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-blue-500/50" />
            <span>Suggested</span>
          </div>
        </div>
      </div>
    </div>
  )
}
