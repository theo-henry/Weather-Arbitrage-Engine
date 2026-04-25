"use client"

import { motion } from 'framer-motion'
import { MapPin, Calendar, ChevronRight, Wind, Droplets, Sun, Thermometer, CloudRain, Leaf } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScoreRing } from '@/components/score-ring'
import { DeltaChip } from '@/components/score-chip'
import { WeatherIcon } from '@/components/weather-icon'
import type { TimeWindow, Activity } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RecommendationCardProps {
  window: TimeWindow
  activity: Activity
  usualSlotScore?: number
  onAddToCalendar?: () => void
  onSeeWhy?: () => void
  className?: string
}

export function RecommendationCard({
  window,
  activity,
  usualSlotScore,
  onAddToCalendar,
  onSeeWhy,
  className,
}: RecommendationCardProps) {
  const score = window.scores[activity]
  const delta = usualSlotScore ? score - usualSlotScore : 0
  
  const explanations: Record<Activity, string> = {
    run: 'Lower wind and cooler temperature maximize your pace vs your usual slot.',
    study: 'Optimal thermal comfort and natural light for deep focus.',
    social: 'Perfect temperature and low rain risk for outdoor dining.',
    commute: 'Safer travel conditions with lower rain, wind, and weather disruption risk.',
    photo: 'Golden hour lighting with dramatic cloud coverage.',
    custom: 'Best overall conditions based on your preferences.',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        className
      )}
    >
      {/* Animated gradient border */}
      <div className="absolute inset-0 rounded-2xl p-[2px] bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 animate-gradient-rotate" 
        style={{ backgroundSize: '200% 200%' }}
      />
      
      {/* Card content */}
      <div className="relative rounded-[14px] bg-card p-6 sm:p-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Best Window
            </span>
            <div className="flex items-baseline gap-3 mt-1">
              <h2 className="text-3xl sm:text-4xl font-bold tabular-nums">
                {window.day} {window.startTime}
              </h2>
              <span className="text-xl text-muted-foreground">–</span>
              <span className="text-xl text-muted-foreground tabular-nums">
                {window.endTime}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">{window.location}, {window.city}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            <ScoreRing score={score} size="lg" />
            {delta !== 0 && (
              <DeltaChip value={delta} label="vs usual" size="sm" />
            )}
          </div>
        </div>

        {/* Weather Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50">
            <Thermometer className="h-4 w-4 text-orange-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Feels like</span>
              <span className="text-sm font-medium">{window.weather.feelsLike}°C</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50">
            <Wind className="h-4 w-4 text-sky-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Wind</span>
              <span className="text-sm font-medium">{window.weather.windSpeed} km/h</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50">
            <Droplets className="h-4 w-4 text-blue-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Humidity</span>
              <span className="text-sm font-medium">{window.weather.humidity}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-muted/50">
            <Sun className="h-4 w-4 text-amber-500" />
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">UV Index</span>
              <span className="text-sm font-medium">{window.weather.uvIndex}</span>
            </div>
          </div>
        </div>

        {/* Secondary Weather Info */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <WeatherIcon condition={window.weather.condition} size="sm" />
            <span className="text-sm font-medium">
              {window.weather.temperature}°C
            </span>
          </div>
          {window.weather.precipitation > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-500/10 text-blue-500">
              <CloudRain className="h-4 w-4" />
              <span className="text-sm font-medium">{window.weather.precipitation} mm</span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
            <Leaf className="h-4 w-4 text-green-500" />
            <span className="text-sm">
              AQI: <span className={cn(
                "font-medium",
                window.weather.airQuality <= 50 ? "text-green-500" : 
                window.weather.airQuality <= 100 ? "text-yellow-500" : "text-red-500"
              )}>{window.weather.airQuality}</span>
            </span>
          </div>
          <Badge 
            variant={window.confidence === 'High' ? 'default' : 'secondary'}
            className={cn(
              window.confidence === 'High' && 'bg-green-500/10 text-green-500 border-green-500/20'
            )}
          >
            Confidence: {window.confidence}
          </Badge>
        </div>

        {/* Explanation */}
        <p className="text-sm text-muted-foreground mb-6">
          {explanations[activity]}
        </p>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Button 
            onClick={onAddToCalendar}
            className="flex-1 sm:flex-none group"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Add to Calendar
          </Button>
          <Button 
            variant="outline" 
            onClick={onSeeWhy}
            className="flex-1 sm:flex-none group"
          >
            See Why
            <ChevronRight className="h-4 w-4 ml-1 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>

      {/* CSS for animated gradient */}
      <style jsx>{`
        @keyframes gradient-rotate {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-rotate {
          animation: gradient-rotate 3s ease infinite;
        }
      `}</style>
    </motion.div>
  )
}
