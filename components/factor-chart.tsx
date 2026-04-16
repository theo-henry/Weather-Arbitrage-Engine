"use client"

import { useMemo } from 'react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { motion } from 'framer-motion'
import type { TimeWindow, Activity } from '@/lib/types'
import { ACTIVITY_CONFIG } from '@/lib/types'
import { scoreWindow } from '@/lib/scoring'
import { cn } from '@/lib/utils'

interface FactorChartProps {
  bestWindow: TimeWindow
  usualWindow?: TimeWindow
  activity: Activity
  className?: string
}

export function FactorChart({
  bestWindow,
  usualWindow,
  activity,
  className,
}: FactorChartProps) {
  const chartData = useMemo(() => {
    const factors = ACTIVITY_CONFIG[activity].factors
    const bestPrefs = {
      activity,
      city: bestWindow.city,
      usualTime: '17:00',
    }
    
    const bestScoring = scoreWindow(
      bestWindow.weather,
      bestPrefs,
      parseInt(bestWindow.startTime.split(':')[0])
    )
    
    const usualScoring = usualWindow 
      ? scoreWindow(
          usualWindow.weather,
          bestPrefs,
          parseInt(usualWindow.startTime.split(':')[0])
        )
      : null
    
    return factors.map((factor) => ({
      factor: factor.charAt(0).toUpperCase() + factor.slice(1).replace('_', ' '),
      best: bestScoring.factors[factor] ?? 70,
      usual: usualScoring?.factors[factor] ?? 50,
    }))
  }, [bestWindow, usualWindow, activity])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn('w-full', className)}
    >
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
        Factor Breakdown
      </h3>
      
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
            <PolarGrid 
              stroke="hsl(var(--border))" 
              strokeOpacity={0.5}
            />
            <PolarAngleAxis 
              dataKey="factor" 
              tick={{ 
                fontSize: 11, 
                fill: 'hsl(var(--muted-foreground))' 
              }}
            />
            <PolarRadiusAxis 
              angle={30} 
              domain={[0, 100]} 
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickCount={5}
            />
            
            {usualWindow && (
              <Radar
                name="Your Usual"
                dataKey="usual"
                stroke="#F59E0B"
                fill="#F59E0B"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            )}
            
            <Radar
              name="Best Window"
              dataKey="best"
              stroke="#22C55E"
              fill="#22C55E"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            
            <Legend 
              wrapperStyle={{ 
                paddingTop: 20,
                fontSize: 12,
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  )
}
