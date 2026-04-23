'use client'

import { ShieldAlert, ShieldCheck, CloudRain, Wind, Thermometer } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { ProtectedEventAnalysis } from '@/lib/types'
import { cn } from '@/lib/utils'

interface AutoProtectPanelProps {
  analyses: ProtectedEventAnalysis[]
  onMove: (analysis: ProtectedEventAnalysis) => void
  onDismiss: (analysis: ProtectedEventAnalysis) => void
  showHeader?: boolean
  limit?: number
  className?: string
}

function riskTone(level: ProtectedEventAnalysis['riskLevel']) {
  if (level === 'high') return 'border-red-500/30 bg-red-500/10'
  if (level === 'medium') return 'border-amber-500/30 bg-amber-500/10'
  return 'border-green-500/30 bg-green-500/10'
}

function riskLabel(level: ProtectedEventAnalysis['riskLevel']) {
  if (level === 'high') return 'High risk'
  if (level === 'medium') return 'Watch closely'
  return 'Stable'
}

export function AutoProtectPanel({
  analyses,
  onMove,
  onDismiss,
  showHeader = true,
  limit = 3,
  className,
}: AutoProtectPanelProps) {
  const actionable = analyses
    .filter((analysis) => analysis.isWeatherRelevant && analysis.recommendedAlternative)
    .sort((a, b) => {
      const weight = { high: 0, medium: 1, low: 2 }
      return (
        weight[a.riskLevel] - weight[b.riskLevel] ||
        new Date(a.event.startTime).getTime() - new Date(b.event.startTime).getTime()
      )
    })
    .slice(0, limit)

  const atRiskCount = analyses.filter(
    (analysis) => analysis.isWeatherRelevant && analysis.riskLevel !== 'low'
  ).length

  return (
    <div
      className={cn(
        showHeader && 'border-b border-border/50 bg-card/70 backdrop-blur-sm',
        className
      )}
    >
      {showHeader ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h3 className="text-sm font-semibold">Auto-Protect Schedule</h3>
              <Badge variant="outline" className="text-[10px]">
                {atRiskCount} at risk
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Proactive weather-risk detection with one-click safer moves.
            </p>
          </div>
        </div>
      ) : null}

      <div className={cn('space-y-2', showHeader ? 'px-4 pb-4' : 'p-4')}>
        {actionable.length === 0 ? (
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-3 text-sm">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              <span className="font-medium">Your schedule looks weather-safe right now.</span>
            </div>
          </div>
        ) : (
          actionable.map((analysis) => {
            const alternative = analysis.recommendedAlternative!
            const delta = (alternative.score ?? 0) - (analysis.currentScore ?? 0)

            return (
              <div
                key={analysis.eventId}
                className={cn('rounded-xl border px-3 py-3 text-sm', riskTone(analysis.riskLevel))}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{analysis.event.title}</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {riskLabel(analysis.riskLevel)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(new Date(analysis.event.startTime), 'EEE h:mm a')} -{' '}
                      {format(new Date(analysis.event.endTime), 'h:mm a')}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    +{delta} pts
                  </Badge>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                  {analysis.riskReasons.slice(0, 3).map((reason) => {
                    const Icon = reason.includes('rain')
                      ? CloudRain
                      : reason.includes('wind')
                      ? Wind
                      : Thermometer

                    return (
                      <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-background/70 px-2 py-1">
                        <Icon className="h-3 w-3" />
                        {reason}
                      </span>
                    )
                  })}
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Move to {format(new Date(alternative.startTime), 'EEE h:mm a')} -{' '}
                  {format(new Date(alternative.endTime), 'h:mm a')} for a weather score of{' '}
                  {alternative.score}.
                </p>

                <div className="mt-3 flex gap-2">
                  <Button size="sm" className="h-8 flex-1" onClick={() => onMove(analysis)}>
                    Move to Better Time
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => onDismiss(analysis)}>
                    Dismiss
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
