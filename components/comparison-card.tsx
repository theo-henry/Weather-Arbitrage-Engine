"use client"

import { motion } from 'framer-motion'
import { Check, AlertTriangle, MapPin, Wind, Droplets, Sun, Thermometer, CloudRain, Leaf } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScoreRing } from '@/components/score-ring'
import { WeatherIcon } from '@/components/weather-icon'
import { Progress } from '@/components/ui/progress'
import type { TimeWindow, Activity } from '@/lib/types'
import { ACTIVITY_CONFIG } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ComparisonCardProps {
  window: TimeWindow
  activity: Activity
  label: string
  variant?: 'best' | 'usual' | 'alternate'
  className?: string
}

function getStrengths(window: TimeWindow): string[] {
  const strengths: string[] = []
  if (window.weather.windSpeed < 12) strengths.push('Low wind conditions')
  if (window.weather.temperature >= 16 && window.weather.temperature <= 24) strengths.push('Comfortable temperature')
  if (window.weather.precipitationProbability < 20) strengths.push('Low rain risk')
  if (window.weather.condition === 'clear') strengths.push('Clear skies')
  if (window.weather.humidity < 70) strengths.push('Good humidity levels')
  return strengths.slice(0, 3)
}

function getWeaknesses(window: TimeWindow): string[] {
  const weaknesses: string[] = []
  if (window.weather.windSpeed >= 15) weaknesses.push('Higher wind speeds')
  if (window.weather.temperature < 14 || window.weather.temperature > 28) weaknesses.push('Temperature outside comfort zone')
  if (window.weather.precipitationProbability >= 30) weaknesses.push('Rain possibility')
  if (window.weather.uvIndex > 7) weaknesses.push('High UV exposure')
  if (window.weather.humidity >= 75) weaknesses.push('High humidity')
  return weaknesses.slice(0, 3)
}

export function ComparisonCard({
  window,
  activity,
  label,
  variant = 'alternate',
  className,
}: ComparisonCardProps) {
  const score = window.scores[activity]
  const factors = ACTIVITY_CONFIG[activity].factors
  const strengths = getStrengths(window)
  const weaknesses = getWeaknesses(window)

  const borderClasses = {
    best: 'ring-2 ring-green-500/30 border-green-500/50',
    usual: 'ring-2 ring-amber-500/30 border-amber-500/50',
    alternate: 'border-border/50',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className={cn('h-full', borderClasses[variant])}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge 
                variant={variant === 'best' ? 'default' : 'secondary'}
                className={cn(
                  'mb-2',
                  variant === 'best' && 'bg-green-500/10 text-green-500 border-green-500/20'
                )}
              >
                {label}
              </Badge>
              <div className="font-semibold text-lg tabular-nums">
                {window.day} {window.startTime}–{window.endTime}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                <MapPin className="h-3.5 w-3.5" />
                {window.location}
              </div>
            </div>
            <ScoreRing score={score} size="md" />
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Weather Header */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
            <WeatherIcon condition={window.weather.condition} size="lg" />
            <div className="flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{window.weather.temperature}°C</span>
                <span className="text-sm text-muted-foreground">
                  Feels like {window.weather.feelsLike}°C
                </span>
              </div>
              <p className="text-sm text-muted-foreground capitalize">
                {window.weather.condition.replace('-', ' ')}
              </p>
            </div>
          </div>

          {/* Weather Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Wind className="h-4 w-4 text-sky-500" />
              <div>
                <p className="text-xs text-muted-foreground">Wind</p>
                <p className="text-sm font-medium">{window.weather.windSpeed} km/h</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Droplets className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs text-muted-foreground">Humidity</p>
                <p className="text-sm font-medium">{window.weather.humidity}%</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <Sun className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xs text-muted-foreground">UV Index</p>
                <p className="text-sm font-medium">{window.weather.uvIndex}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
              <CloudRain className="h-4 w-4 text-blue-400" />
              <div>
                <p className="text-xs text-muted-foreground">Rain</p>
                <p className="text-sm font-medium">
                  {window.weather.precipitation > 0 
                    ? `${window.weather.precipitation} mm` 
                    : `${window.weather.precipitationProbability}%`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 col-span-2">
              <Leaf className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xs text-muted-foreground">Air Quality (AQI)</p>
                <p className={cn(
                  "text-sm font-medium",
                  window.weather.airQuality <= 50 ? "text-green-500" : 
                  window.weather.airQuality <= 100 ? "text-yellow-500" : "text-red-500"
                )}>
                  {window.weather.airQuality} - {
                    window.weather.airQuality <= 50 ? "Good" : 
                    window.weather.airQuality <= 100 ? "Moderate" : "Unhealthy"
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Factor bars */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Factor Scores
            </h4>
            {factors.slice(0, 4).map((factor) => {
              const value = window.factorBreakdown[factor] ?? 70
              return (
                <div key={factor} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground capitalize">
                      {factor.replace('_', ' ')}
                    </span>
                    <span className="font-medium tabular-nums">{Math.round(value)}</span>
                  </div>
                  <Progress value={value} className="h-1.5" />
                </div>
              )
            })}
          </div>

          {/* Strengths */}
          {strengths.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Strengths
              </h4>
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Weaknesses */}
          {weaknesses.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Weaknesses
              </h4>
              <ul className="space-y-1.5">
                {weaknesses.map((w, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
