'use client'

import { memo } from 'react'
import { motion } from 'framer-motion'
import { CloudAlert, MoveRight, X, Users, MapPin } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { CalendarEvent, ProtectedEventAnalysis, SuggestedAlternative } from '@/lib/types'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

const SLOT_HEIGHT = 48 // px per 30-min slot
const DAY_START_HOUR = 0

const colorMap: Record<string, { bg: string; border: string; text: string }> = {
  blue:   { bg: 'bg-blue-500/20',   border: 'border-blue-500/40',   text: 'text-blue-700 dark:text-blue-300' },
  green:  { bg: 'bg-green-500/20',  border: 'border-green-500/40',  text: 'text-green-700 dark:text-green-300' },
  amber:  { bg: 'bg-amber-500/20',  border: 'border-amber-500/40',  text: 'text-amber-700 dark:text-amber-300' },
  red:    { bg: 'bg-red-500/20',    border: 'border-red-500/40',    text: 'text-red-700 dark:text-red-300' },
  violet: { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-700 dark:text-violet-300' },
  pink:   { bg: 'bg-pink-500/20',   border: 'border-pink-500/40',   text: 'text-pink-700 dark:text-pink-300' },
}

interface CalendarEventBlockProps {
  event: CalendarEvent
  lane: number
  totalLanes: number
  analysis?: ProtectedEventAnalysis
  isHighlighted?: boolean
  onEdit: (event: CalendarEvent) => void
  onAcceptSuggestion: (eventId: string, suggestion: SuggestedAlternative) => void
  onDismissSuggestion: (analysis: ProtectedEventAnalysis) => void
  onResizeStart: (e: React.PointerEvent, event: CalendarEvent) => void
  onMoveStart: (e: React.PointerEvent, event: CalendarEvent) => void
}

function getEventPosition(event: CalendarEvent) {
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const startMinutes = (start.getHours() - DAY_START_HOUR) * 60 + start.getMinutes()
  const endMinutes = (end.getHours() - DAY_START_HOUR) * 60 + end.getMinutes()
  const top = (startMinutes / 30) * SLOT_HEIGHT
  const height = Math.max(((endMinutes - startMinutes) / 30) * SLOT_HEIGHT, SLOT_HEIGHT / 2)
  return { top, height }
}

export const CalendarEventBlock = memo(function CalendarEventBlock({
  event,
  lane,
  totalLanes,
  analysis,
  isHighlighted,
  onEdit,
  onAcceptSuggestion,
  onDismissSuggestion,
  onResizeStart,
  onMoveStart,
}: CalendarEventBlockProps) {
  const { top, height } = getEventPosition(event)
  const colors = colorMap[event.color] || colorMap.blue
  const isCompact = height < SLOT_HEIGHT * 1.5
  const suggestion = analysis?.recommendedAlternative ?? null
  const hasSuggestion = !!suggestion
  const riskLevel = analysis?.riskLevel
  const showRiskHighlight = analysis?.isWeatherRelevant && riskLevel && riskLevel !== 'low'

  const laneWidth = 100 / totalLanes
  const left = `${lane * laneWidth}%`
  const width = `calc(${laneWidth}% - 4px)`

  return (
    <motion.div
      initial={isHighlighted ? { opacity: 0, scale: 0.7, y: -30 } : { opacity: 0, scale: 0.95 }}
      animate={
        isHighlighted
          ? { opacity: 1, scale: [1, 1.04, 1, 1.04, 1], y: 0, boxShadow: ['0 0 0 0px rgba(99,102,241,0)', '0 0 0 4px rgba(99,102,241,0.5)', '0 0 0 0px rgba(99,102,241,0)', '0 0 0 4px rgba(99,102,241,0.5)', '0 0 0 0px rgba(99,102,241,0)'] }
          : { opacity: 1, scale: 1 }
      }
      transition={isHighlighted ? { duration: 2, times: [0, 0.25, 0.5, 0.75, 1], y: { duration: 0.4, ease: [0.34, 1.56, 0.64, 1] } } : undefined}
      className={cn(
        'absolute rounded-md border-l-[3px] cursor-pointer group select-none overflow-hidden',
        colors.bg,
        colors.border,
        isHighlighted && 'ring-2 ring-violet-500/60 shadow-[0_0_0_2px_rgba(139,92,246,0.3)]',
        showRiskHighlight && riskLevel === 'high' && 'ring-1 ring-red-500/40 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]',
        showRiskHighlight && riskLevel === 'medium' && 'ring-1 ring-amber-500/40 shadow-[0_0_0_1px_rgba(245,158,11,0.18)]',
      )}
      style={{ top, height, left, width, zIndex: isHighlighted ? 20 : 10 }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).dataset.resize) return
        onMoveStart(e, event)
      }}
      onClick={(e) => {
        e.stopPropagation()
        onEdit(event)
      }}
    >
      {/* Content */}
      <div className="px-1.5 py-1 h-full flex flex-col min-w-0">
        <div className="flex items-start justify-between gap-0.5">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className={cn('font-medium truncate', isCompact ? 'text-[11px]' : 'text-xs', colors.text)}>
              {event.title}
            </span>
          </div>
          {hasSuggestion && (
            <TooltipProvider delayDuration={200}>
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        className="flex-shrink-0 p-0.5 rounded hover:bg-amber-500/20 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CloudAlert className={cn('h-3.5 w-3.5', riskLevel === 'high' ? 'text-red-500' : 'text-amber-500')} />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-[200px]">
                    {analysis?.riskReasons?.[0] || suggestion!.reason}
                  </TooltipContent>
                </Tooltip>
                <PopoverContent
                  className="w-64 p-3"
                  side="right"
                  align="start"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Auto-protect recommendation</p>
                    <p className="text-xs text-muted-foreground">
                      {suggestion!.reason}
                    </p>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge variant="secondary" className="bg-red-500/10 text-red-600">
                        Score: {analysis?.currentScore ?? event.weatherScore ?? '?'}
                      </Badge>
                      <MoveRight className="h-3 w-3 text-muted-foreground" />
                      <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                        Score: {suggestion!.score}
                      </Badge>
                    </div>
                    {analysis?.riskReasons?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {analysis.riskReasons.slice(0, 2).map((reason) => (
                          <Badge key={reason} variant="outline" className="text-[10px]">
                            {reason}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                      Move to {format(new Date(suggestion!.startTime), 'h:mm a')} - {format(new Date(suggestion!.endTime), 'h:mm a')}
                    </p>
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        className="flex-1 h-7 text-xs"
                        onClick={() => onAcceptSuggestion(event.id, suggestion!)}
                      >
                        Move
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => analysis && onDismissSuggestion(analysis)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </TooltipProvider>
          )}
        </div>

        {!isCompact && (
          <div className="mt-0.5 space-y-0.5">
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(event.startTime), 'h:mm a')} - {format(new Date(event.endTime), 'h:mm a')}
            </p>
            {event.location && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
            {event.participants && event.participants.length > 0 && (
              <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Users className="h-2.5 w-2.5" />
                <span className="truncate">{event.participants.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div
        data-resize="true"
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-black/10 to-transparent"
        onPointerDown={(e) => {
          e.stopPropagation()
          onResizeStart(e, event)
        }}
      />
    </motion.div>
  )
})

// Ghost block for weather suggestions
export function SuggestionGhost({
  suggestion,
}: {
  suggestion: SuggestedAlternative | null | undefined
}) {
  return null
}

export { SLOT_HEIGHT, DAY_START_HOUR }
