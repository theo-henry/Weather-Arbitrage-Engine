"use client"

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts'
import { motion } from 'framer-motion'
import { WeatherIcon } from '@/components/weather-icon'
import type { TimeWindow, Activity } from '@/lib/types'
import { cn } from '@/lib/utils'

interface TimelineChartProps {
  windows: TimeWindow[]
  activity: Activity
  bestWindow?: TimeWindow
  usualTime?: string
  className?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{
    payload: {
      time: string
      score: number
      temp: number
      wind: number
      rain: number
      condition: string
      day: string
    }
  }>
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload[0]) return null
  
  const data = payload[0].payload
  
  return (
    <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2 mb-2">
        <span className="font-semibold">{data.day} {data.time}</span>
        <WeatherIcon condition={data.condition as 'clear'} size="sm" animated={false} />
      </div>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Score</span>
          <span className="font-medium tabular-nums">{data.score}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Temp</span>
          <span className="tabular-nums">{data.temp}°C</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Wind</span>
          <span className="tabular-nums">{data.wind} km/h</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Rain</span>
          <span className="tabular-nums">{data.rain}%</span>
        </div>
      </div>
    </div>
  )
}

export function TimelineChart({
  windows,
  activity,
  bestWindow,
  usualTime = '17:00',
  className,
}: TimelineChartProps) {
  const chartData = useMemo(() => {
    // Sample every hour for cleaner visualization
    return windows
      .filter((_, i) => i % 2 === 0)
      .map((w) => ({
        time: w.startTime,
        day: w.day,
        score: w.scores[activity],
        temp: w.weather.temperature,
        wind: w.weather.windSpeed,
        rain: w.weather.precipitationProbability,
        condition: w.weather.condition,
        isBest: bestWindow?.id === w.id,
        fullTime: `${w.day} ${w.startTime}`,
      }))
  }, [windows, activity, bestWindow])

  const bestIndex = chartData.findIndex((d) => d.isBest)
  const usualIndex = chartData.findIndex((d) => d.time === usualTime)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('w-full', className)}
    >
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Score Timeline
      </h3>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                <stop offset="50%" stopColor="#84CC16" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="bestWindowGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            
            <XAxis 
              dataKey="fullTime" 
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval="preserveStartEnd"
              tickFormatter={(value) => {
                const parts = value.split(' ')
                return parts[1] || value
              }}
            />
            
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value}`}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            {/* Best window highlight */}
            {bestIndex >= 0 && (
              <ReferenceArea
                x1={chartData[Math.max(0, bestIndex - 1)]?.fullTime}
                x2={chartData[Math.min(chartData.length - 1, bestIndex + 1)]?.fullTime}
                fill="url(#bestWindowGradient)"
                fillOpacity={1}
              />
            )}
            
            {/* Usual time line */}
            {usualIndex >= 0 && (
              <ReferenceLine
                x={chartData[usualIndex]?.fullTime}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="5 5"
                label={{
                  value: 'Your usual',
                  position: 'top',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                }}
              />
            )}
            
            <Area
              type="monotone"
              dataKey="score"
              stroke="#22C55E"
              strokeWidth={2}
              fill="url(#scoreGradient)"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-blue-500 to-violet-500 opacity-50" />
          <span>Best Window</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0 border-t-2 border-dashed border-muted-foreground" />
          <span>Your Usual</span>
        </div>
      </div>
    </motion.div>
  )
}
