"use client"

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { ComparisonCard } from '@/components/comparison-card'
import { Card, CardContent } from '@/components/ui/card'
import { getWindows, getBestWindow, getTopWindows, getWindowAtTime } from '@/lib/mockData'
import { ACTIVITY_CONFIG } from '@/lib/types'

export default function ComparePage() {
  const windows = useMemo(() => getWindows('Madrid'), [])
  const bestWindow = useMemo(() => getBestWindow(windows, 'run'), [windows])
  const topWindows = useMemo(() => getTopWindows(windows, 'run', 5), [windows])
  const usualWindow = useMemo(() => getWindowAtTime(windows, '17:00', 0), [windows])
  const alternateWindow = topWindows[2] // Third best option

  // Prepare chart data
  const chartData = useMemo(() => {
    const factors = ACTIVITY_CONFIG.run.factors
    return factors.map((factor) => ({
      factor: factor.charAt(0).toUpperCase() + factor.slice(1).replace('_', ' '),
      'Best Slot': bestWindow.factorBreakdown[factor] ?? 70,
      'Your Usual': usualWindow?.factorBreakdown[factor] ?? 50,
      'Alternate': alternateWindow?.factorBreakdown[factor] ?? 60,
    }))
  }, [bestWindow, usualWindow, alternateWindow])

  // Calculate improvements
  const windImprovement = usualWindow 
    ? Math.round(((usualWindow.weather.windSpeed - bestWindow.weather.windSpeed) / usualWindow.weather.windSpeed) * 100)
    : 0
  const tempImprovement = usualWindow
    ? Math.round(Math.abs(20 - usualWindow.weather.temperature) - Math.abs(20 - bestWindow.weather.temperature))
    : 0

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="mx-auto max-w-7xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-12"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              Scenario Comparison
            </h1>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              See how different time slots compare across all factors for your running session.
            </p>
          </motion.div>

          {/* Comparison Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <ComparisonCard
              window={bestWindow}
              activity="run"
              label="Best Slot"
              variant="best"
            />
            {usualWindow && (
              <ComparisonCard
                window={usualWindow}
                activity="run"
                label="Your Usual Slot"
                variant="usual"
              />
            )}
            {alternateWindow && (
              <ComparisonCard
                window={alternateWindow}
                activity="run"
                label="Alternate Slot"
                variant="alternate"
              />
            )}
          </div>

          {/* Factor Comparison Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="border-border/50 mb-8">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-6">
                  Factor Comparison
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <XAxis 
                        dataKey="factor" 
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                        tickLine={false}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--popover))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend wrapperStyle={{ paddingTop: 20 }} />
                      <Bar dataKey="Best Slot" fill="#22C55E" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Your Usual" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Alternate" fill="#6B7280" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="border-border/50 bg-gradient-to-r from-blue-500/5 via-violet-500/5 to-amber-500/5">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  Summary
                </h3>
                <p className="text-lg">
                  The recommended slot reduces wind by{' '}
                  <span className="font-semibold text-green-500">{Math.abs(windImprovement)}%</span>{' '}
                  and improves temperature fit by{' '}
                  <span className="font-semibold text-green-500">{Math.abs(tempImprovement)}°C</span>{' '}
                  vs your usual time. Overall score improvement:{' '}
                  <span className="font-semibold text-green-500">
                    +{bestWindow.scores.run - (usualWindow?.scores.run || 0)} points
                  </span>.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
