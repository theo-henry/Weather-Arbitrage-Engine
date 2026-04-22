'use client'

import {
  Thermometer,
  Droplets,
  Wind,
  CloudRain,
  Sun,
  Eye,
} from 'lucide-react'
import { WeatherIcon } from '@/components/weather-icon'
import type { WeatherConditions } from '@/lib/types'

function levelLabel(value: number, thresholds: [number, number]): string {
  if (value <= thresholds[0]) return 'Low'
  if (value <= thresholds[1]) return 'Med'
  return 'High'
}

function levelColor(value: number, thresholds: [number, number], invert = false): string {
  const isLow = value <= thresholds[0]
  const isHigh = value > thresholds[1]
  if (invert) {
    if (isLow) return 'text-green-500'
    if (isHigh) return 'text-red-400'
    return 'text-amber-400'
  }
  if (isLow) return 'text-red-400'
  if (isHigh) return 'text-green-500'
  return 'text-amber-400'
}

interface WeatherSlotTooltipProps {
  weather: WeatherConditions
  time: string // e.g. "2:30 PM"
  x: number
  y: number
}

export function WeatherSlotTooltip({ weather, time, x, y }: WeatherSlotTooltipProps) {
  return (
    <div
      className="pointer-events-none fixed z-50 rounded-lg border border-border/60 bg-card/90 backdrop-blur-md shadow-lg px-3 py-2.5 min-w-[180px]"
      style={{
        left: x + 16,
        top: y - 8,
      }}
    >
      {/* Header: time + condition icon */}
      <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-border/40">
        <WeatherIcon condition={weather.condition} size="sm" animated={false} />
        <span className="text-xs font-semibold text-foreground">{time}</span>
        <span className="text-[10px] text-muted-foreground capitalize ml-auto">
          {weather.condition.replace('-', ' ')}
        </span>
      </div>

      {/* Weather rows */}
      <div className="space-y-1.5">
        {/* Temperature */}
        <div className="flex items-center gap-2 text-xs">
          <Thermometer className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
          <span className="text-muted-foreground">Temp</span>
          <span className="ml-auto font-medium text-foreground">
            {weather.temperature}°C
          </span>
          <span className="text-[10px] text-muted-foreground">
            (feels {weather.feelsLike}°)
          </span>
        </div>

        {/* Rain chance */}
        <div className="flex items-center gap-2 text-xs">
          <CloudRain className={`h-3.5 w-3.5 flex-shrink-0 ${levelColor(weather.precipitationProbability, [20, 50], true)}`} />
          <span className="text-muted-foreground">Rain</span>
          <span className="ml-auto font-medium text-foreground">
            {weather.precipitationProbability}%
          </span>
        </div>

        {/* Wind */}
        <div className="flex items-center gap-2 text-xs">
          <Wind className={`h-3.5 w-3.5 flex-shrink-0 ${levelColor(weather.windSpeed, [15, 30], true)}`} />
          <span className="text-muted-foreground">Wind</span>
          <span className="ml-auto font-medium text-foreground">
            {Math.round(weather.windSpeed)} km/h
          </span>
          <span className={`text-[10px] font-medium ${levelColor(weather.windSpeed, [15, 30], true)}`}>
            {levelLabel(weather.windSpeed, [15, 30])}
          </span>
        </div>

        {/* Humidity */}
        <div className="flex items-center gap-2 text-xs">
          <Droplets className={`h-3.5 w-3.5 flex-shrink-0 ${levelColor(weather.humidity, [40, 70], true)}`} />
          <span className="text-muted-foreground">Humidity</span>
          <span className="ml-auto font-medium text-foreground">
            {weather.humidity}%
          </span>
          <span className={`text-[10px] font-medium ${levelColor(weather.humidity, [40, 70], true)}`}>
            {levelLabel(weather.humidity, [40, 70])}
          </span>
        </div>

        {/* UV Index */}
        <div className="flex items-center gap-2 text-xs">
          <Sun className={`h-3.5 w-3.5 flex-shrink-0 ${levelColor(weather.uvIndex, [3, 6], true)}`} />
          <span className="text-muted-foreground">UV</span>
          <span className="ml-auto font-medium text-foreground">
            {weather.uvIndex}
          </span>
          <span className={`text-[10px] font-medium ${levelColor(weather.uvIndex, [3, 6], true)}`}>
            {levelLabel(weather.uvIndex, [3, 6])}
          </span>
        </div>

        {/* Cloud cover */}
        <div className="flex items-center gap-2 text-xs">
          <Eye className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />
          <span className="text-muted-foreground">Clouds</span>
          <span className="ml-auto font-medium text-foreground">
            {weather.cloudCover}%
          </span>
        </div>
      </div>
    </div>
  )
}
