"use client"

import { motion } from 'framer-motion'
import { Check, AlertTriangle, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TimeWindow, Activity } from '@/lib/types'
import { cn } from '@/lib/utils'

interface InsightPanelProps {
  bestWindow: TimeWindow
  usualWindow?: TimeWindow
  activity: Activity
  className?: string
}

function getInsights(best: TimeWindow, usual: TimeWindow | undefined, activity: Activity) {
  const insights = {
    whyWins: [] as string[],
    whatAvoid: [] as string[],
    sensitivity: '',
  }

  const bestWeather = best.weather
  const usualWeather = usual?.weather

  // Why this wins
  if (bestWeather.windSpeed < 12) {
    insights.whyWins.push('Low wind conditions ideal for outdoor activities')
  }
  if (bestWeather.temperature >= 16 && bestWeather.temperature <= 22) {
    insights.whyWins.push('Temperature in optimal comfort range')
  }
  if (bestWeather.precipitationProbability < 20) {
    insights.whyWins.push('Very low rain probability')
  }
  if (bestWeather.condition === 'clear' || bestWeather.condition === 'partly-cloudy') {
    insights.whyWins.push('Clear or partly cloudy skies')
  }
  
  const bestHour = parseInt(best.startTime.split(':')[0])
  if (activity === 'run' && (bestHour >= 17 && bestHour <= 20)) {
    insights.whyWins.push('Evening timing aligns with peak performance')
  }
  if (activity === 'photo' && ((bestHour >= 6 && bestHour <= 8) || (bestHour >= 18 && bestHour <= 20))) {
    insights.whyWins.push('Golden hour lighting conditions')
  }

  // What you avoid (comparing to usual)
  if (usualWeather) {
    if (usualWeather.windSpeed > bestWeather.windSpeed + 5) {
      insights.whatAvoid.push(`${Math.round(usualWeather.windSpeed - bestWeather.windSpeed)} km/h higher wind in your usual slot`)
    }
    if (usualWeather.precipitationProbability > bestWeather.precipitationProbability + 20) {
      insights.whatAvoid.push(`${Math.round(usualWeather.precipitationProbability - bestWeather.precipitationProbability)}% higher rain chance at your usual time`)
    }
    if (Math.abs(usualWeather.temperature - 20) > Math.abs(bestWeather.temperature - 20)) {
      insights.whatAvoid.push('Less comfortable temperature range')
    }
    if (usualWeather.uvIndex > 7 && bestWeather.uvIndex <= 7) {
      insights.whatAvoid.push('High UV exposure risk')
    }
  }

  // Sensitivity tip
  if (activity === 'run') {
    insights.sensitivity = 'If you lower wind sensitivity, 18:00 becomes viable (+6pts)'
  } else if (activity === 'study') {
    insights.sensitivity = 'Enabling distraction sensitivity could improve your score by 8pts'
  } else if (activity === 'social') {
    insights.sensitivity = 'Turning off sunset bonus opens up more afternoon options'
  } else if (activity === 'commute') {
    insights.sensitivity = 'Switching commute mode changes how strongly rain, wind, and daylight affect the ranking'
  } else if (activity === 'photo') {
    insights.sensitivity = 'Dramatic cloud preference would favor the 19:00 slot'
  } else {
    insights.sensitivity = 'Adjusting your preferences may reveal alternative windows'
  }

  // Ensure we have at least some insights
  if (insights.whyWins.length === 0) {
    insights.whyWins.push('Best overall score across all weighted factors')
  }
  if (insights.whatAvoid.length === 0 && usual) {
    insights.whatAvoid.push('Suboptimal conditions in your usual time slot')
  }

  return insights
}

export function InsightPanel({ bestWindow, usualWindow, activity, className }: InsightPanelProps) {
  const insights = getInsights(bestWindow, usualWindow, activity)

  const cards = [
    {
      title: 'Why This Wins',
      icon: Check,
      items: insights.whyWins,
      iconColor: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'What You Avoid',
      icon: AlertTriangle,
      items: insights.whatAvoid,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-4', className)}
    >
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Insights
      </h3>
      
      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <div className={cn('p-1.5 rounded-md', card.bgColor)}>
                    <card.icon className={cn('h-4 w-4', card.iconColor)} />
                  </div>
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {card.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', card.bgColor.replace('/10', ''))} />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Sensitivity Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-border/50 bg-muted/30">
          <CardContent className="flex items-start gap-3 p-4">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Lightbulb className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Sensitivity Tip</p>
              <p className="text-sm text-muted-foreground">{insights.sensitivity}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  )
}
