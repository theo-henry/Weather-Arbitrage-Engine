"use client"

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { SchedulerChat } from '@/components/scheduler-chat'
import { WeatherCalendar } from '@/components/weather-calendar'
import { getBestWindow } from '@/lib/mockData'
import { useWeatherData } from '@/hooks/use-weather-data'
import type { ScheduledEvent, TimeWindow } from '@/lib/types'

export default function SchedulerPage() {
  const { windows } = useWeatherData('Madrid')
  const bestWindow = useMemo(() => getBestWindow(windows, 'run'), [windows])
  
  // Pre-seed with one event
  const [events, setEvents] = useState<ScheduledEvent[]>([
    {
      id: 'initial-event',
      title: '5k Run',
      activity: 'run',
      window: bestWindow,
      score: bestWindow.scores.run,
    },
  ])

  const handleScheduleEvent = (window: TimeWindow, activity: string) => {
    const newEvent: ScheduledEvent = {
      id: Date.now().toString(),
      title: activity === 'run' ? '5k Run' : 
             activity === 'study' ? 'Deep Work Session' :
             activity === 'social' ? 'Outdoor Drinks' :
             activity === 'photo' ? 'Photo Session' :
             activity === 'flight' ? 'Flight Check' : 'Activity',
      activity: activity as ScheduledEvent['activity'],
      window,
      score: window.scores[activity as keyof typeof window.scores] || 75,
    }
    
    setEvents((prev) => [...prev, newEvent])
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />

      <main className="flex-1 pt-16">
        <div className="h-[calc(100vh-4rem)] flex flex-col lg:flex-row">
          {/* Chat Panel */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:w-[400px] flex-shrink-0 border-b lg:border-b-0 lg:border-r border-border/50 bg-card/50 h-[50vh] lg:h-full"
          >
            <SchedulerChat
              onScheduleEvent={handleScheduleEvent}
              suggestedWindow={bestWindow}
              className="h-full"
            />
          </motion.div>

          {/* Calendar Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex-1 h-[50vh] lg:h-full overflow-hidden"
          >
            <WeatherCalendar
              windows={windows}
              events={events}
              suggestedWindow={bestWindow}
              className="h-full"
            />
          </motion.div>
        </div>
      </main>
    </div>
  )
}
