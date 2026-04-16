"use client"

import { motion } from 'framer-motion'
import { Wind, Droplets } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScoreChip } from '@/components/score-chip'
import { WeatherIcon } from '@/components/weather-icon'
import type { TimeWindow, Activity } from '@/lib/types'
import { cn } from '@/lib/utils'

interface RankedListProps {
  windows: TimeWindow[]
  activity: Activity
  onSelect?: (window: TimeWindow) => void
  className?: string
}

function getTags(window: TimeWindow): string[] {
  const tags: string[] = []
  
  if (window.weather.windSpeed < 10) tags.push('Low wind')
  if (window.weather.temperature >= 18 && window.weather.temperature <= 24) tags.push('High comfort')
  if (window.weather.precipitationProbability < 10) tags.push('Dry')
  if (window.weather.condition === 'clear') tags.push('Clear skies')
  
  const hour = parseInt(window.startTime.split(':')[0])
  if ((hour >= 6 && hour <= 8) || (hour >= 18 && hour <= 20)) tags.push('Golden hour')
  
  return tags.slice(0, 3)
}

export function RankedList({ windows, activity, onSelect, className }: RankedListProps) {
  return (
    <div className={cn('space-y-3', className)}>
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Strong Alternatives
      </h3>
      
      <div className="space-y-2">
        {windows.slice(1, 6).map((window, index) => {
          const tags = getTags(window)
          const score = window.scores[activity]
          
          return (
            <motion.div
              key={window.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 4 }}
              onClick={() => onSelect?.(window)}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border/50 bg-card hover:border-border hover:bg-muted/30 transition-all cursor-pointer"
            >
              {/* Rank */}
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-sm font-semibold text-muted-foreground">
                {index + 2}
              </div>
              
              {/* Time & Location */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">
                    {window.day} {window.startTime}
                  </span>
                  <WeatherIcon condition={window.weather.condition} size="sm" animated={false} />
                  <span className="text-sm font-medium">{window.weather.feelsLike}°C</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="truncate">{window.location}</span>
                  <span className="hidden sm:flex items-center gap-1">
                    <Wind className="h-3 w-3" />
                    {window.weather.windSpeed}
                  </span>
                  <span className="hidden sm:flex items-center gap-1">
                    <Droplets className="h-3 w-3" />
                    {window.weather.humidity}%
                  </span>
                </div>
              </div>
              
              {/* Tags */}
              <div className="hidden sm:flex items-center gap-1.5 flex-wrap justify-end max-w-[200px]">
                {tags.map((tag) => (
                  <Badge 
                    key={tag} 
                    variant="secondary" 
                    className="text-xs whitespace-nowrap"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
              
              {/* Score */}
              <ScoreChip score={score} size="md" />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
