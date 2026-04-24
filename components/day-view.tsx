'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WeatherIcon } from '@/components/weather-icon'
import { WeatherSlotTooltip } from '@/components/weather-slot-tooltip'
import { CalendarEventBlock, SuggestionGhost, SLOT_HEIGHT, DAY_START_HOUR } from '@/components/calendar-event-block'
import { useCalendarStore } from '@/hooks/use-calendar-store'
import type { CalendarEvent, ProtectedEventAnalysis, SuggestedAlternative, TimeWindow } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  addDays,
  format,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
} from 'date-fns'

const DAY_END_HOUR = 24
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2
const TIME_GUTTER_WIDTH = 56
const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i + DAY_START_HOUR)

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500/10'
  if (score >= 60) return 'bg-lime-500/8'
  if (score >= 40) return 'bg-amber-500/6'
  return 'bg-red-500/6'
}

function computeLanes(events: CalendarEvent[]): Map<string, { lane: number; totalLanes: number }> {
  const result = new Map<string, { lane: number; totalLanes: number }>()
  if (events.length === 0) return result

  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  const groups: CalendarEvent[][] = []
  let currentGroup: CalendarEvent[] = [sorted[0]]
  let groupEnd = new Date(sorted[0].endTime).getTime()

  for (let i = 1; i < sorted.length; i++) {
    const evStart = new Date(sorted[i].startTime).getTime()
    if (evStart < groupEnd) {
      currentGroup.push(sorted[i])
      groupEnd = Math.max(groupEnd, new Date(sorted[i].endTime).getTime())
    } else {
      groups.push(currentGroup)
      currentGroup = [sorted[i]]
      groupEnd = new Date(sorted[i].endTime).getTime()
    }
  }
  groups.push(currentGroup)

  for (const group of groups) {
    const lanes: { end: number }[] = []
    for (const ev of group) {
      const evStart = new Date(ev.startTime).getTime()
      let assigned = false
      for (let l = 0; l < lanes.length; l++) {
        if (lanes[l].end <= evStart) {
          lanes[l].end = new Date(ev.endTime).getTime()
          result.set(ev.id, { lane: l, totalLanes: 0 })
          assigned = true
          break
        }
      }
      if (!assigned) {
        result.set(ev.id, { lane: lanes.length, totalLanes: 0 })
        lanes.push({ end: new Date(ev.endTime).getTime() })
      }
    }
    const totalLanes = lanes.length
    for (const ev of group) {
      const r = result.get(ev.id)!
      r.totalLanes = totalLanes
    }
  }

  return result
}

interface DayViewProps {
  currentDate: Date
  onNavigate: (date: Date) => void
  windows: TimeWindow[]
  analyses: Map<string, ProtectedEventAnalysis>
  onAcceptSuggestion: (eventId: string, suggestion: SuggestedAlternative) => void
  onDismissSuggestion: (analysis: ProtectedEventAnalysis) => void
  onCreateEvent: (startTime: Date, endTime: Date) => void
  onEditEvent: (event: CalendarEvent) => void
  className?: string
}

export function DayView({
  currentDate,
  onNavigate,
  windows,
  analyses,
  onAcceptSuggestion,
  onDismissSuggestion,
  onCreateEvent,
  onEditEvent,
  className,
}: DayViewProps) {
  const { state, dispatch } = useCalendarStore()
  const [weatherOn, setWeatherOn] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Filter events for this day
  const dayEvents = useMemo(
    () => state.events.filter((ev) => isSameDay(new Date(ev.startTime), currentDate)),
    [state.events, currentDate]
  )

  // Filter weather windows for this day
  const dayWindows = useMemo(
    () => windows.filter((w) => isSameDay(new Date(w.date), currentDate)),
    [windows, currentDate]
  )

  const lanes = useMemo(() => computeLanes(dayEvents), [dayEvents])

  // Hover tooltip state
  const [hoverInfo, setHoverInfo] = useState<{
    slot: number
    mouseX: number
    mouseY: number
  } | null>(null)

  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'create' | 'resize' | 'move'
    anchorSlot?: number
    startSlot?: number
    endSlot?: number
    event?: CalendarEvent
    active: boolean
  } | null>(null)

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = ((8 - DAY_START_HOUR) * 2) * SLOT_HEIGHT
      scrollRef.current.scrollTop = scrollTo
    }
  }, [])

  const getSlotFromY = useCallback((y: number) => {
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)))
  }, [])

  const slotToTime = useCallback((slot: number) => {
    const totalMinutes = DAY_START_HOUR * 60 + slot * 30
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return setMinutes(setHours(currentDate, h), m)
  }, [currentDate])

  const getSelectionRange = useCallback((anchorSlot: number, slot: number) => {
    const startSlot = Math.min(anchorSlot, slot)
    const endSlot = Math.max(anchorSlot, slot) + 1
    return { startSlot, endSlot }
  }, [])

  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x < TIME_GUTTER_WIDTH) return
      if ((e.target as HTMLElement).closest('[data-event-block]')) return

      const slot = getSlotFromY(y)
      setDragState({
        type: 'create',
        anchorSlot: slot,
        startSlot: slot,
        endSlot: slot + 1,
        active: true,
      })
      gridRef.current?.setPointerCapture?.(e.pointerId)
    },
    [getSlotFromY]
  )

  const handleGridPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState?.active) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const y = e.clientY - rect.top

      if (dragState.type === 'create') {
        const slot = getSlotFromY(y)
        const { startSlot, endSlot } = getSelectionRange(dragState.anchorSlot!, slot)
        setDragState((prev) => prev ? { ...prev, startSlot, endSlot } : null)
      } else if (dragState.type === 'resize' && dragState.event) {
        const slot = getSlotFromY(y)
        const eventStart = new Date(dragState.event.startTime)
        const startSlot = Math.floor(
          ((eventStart.getHours() - DAY_START_HOUR) * 60 + eventStart.getMinutes()) / 30
        )
        setDragState((prev) => prev ? { ...prev, endSlot: Math.max(startSlot + 1, slot + 1) } : null)
      }
    },
    [dragState, getSelectionRange, getSlotFromY]
  )

  const handleGridPointerUp = useCallback(() => {
    if (!dragState?.active) return

    if (dragState.type === 'create') {
      const start = slotToTime(dragState.startSlot!)
      const end = slotToTime(dragState.endSlot!)
      onCreateEvent(start, end)
    } else if (dragState.type === 'resize' && dragState.event) {
      const newEnd = slotToTime(dragState.endSlot!)
      dispatch({
        type: 'RESIZE_EVENT',
        id: dragState.event.id,
        endTime: newEnd.toISOString(),
      })
    }

    setDragState(null)
  }, [dragState, slotToTime, onCreateEvent, dispatch])

  const handleGridMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (dragState?.active) {
        setHoverInfo(null)
        return
      }
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      if (x < TIME_GUTTER_WIDTH) {
        setHoverInfo(null)
        return
      }
      const slot = getSlotFromY(y)
      setHoverInfo({ slot, mouseX: e.clientX, mouseY: e.clientY })
    },
    [dragState, getSlotFromY]
  )

  const handleGridMouseLeave = useCallback(() => {
    setHoverInfo(null)
  }, [])

  const hoveredWindow = useMemo(() => {
    if (!hoverInfo) return null
    const slotMinutes = DAY_START_HOUR * 60 + hoverInfo.slot * 30
    const slotHour = Math.floor(slotMinutes / 60)
    const slotMin = slotMinutes % 60
    const slotTime = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`
    return dayWindows.find((w) => w.startTime === slotTime) ?? null
  }, [hoverInfo, dayWindows])

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, event: CalendarEvent) => {
      e.stopPropagation()
      const eventEnd = new Date(event.endTime)
      const endSlot = Math.floor(
        ((eventEnd.getHours() - DAY_START_HOUR) * 60 + eventEnd.getMinutes()) / 30
      )
      setDragState({
        type: 'resize',
        anchorSlot: endSlot,
        startSlot: endSlot,
        endSlot,
        event,
        active: true,
      })
      gridRef.current?.setPointerCapture?.(e.pointerId)
    },
    []
  )

  const handleMoveStart = useCallback(
    (e: React.PointerEvent, event: CalendarEvent) => {
      if (e.button !== 0) return
      const eventDate = new Date(event.startTime)
      const startSlot = Math.floor(
        ((eventDate.getHours() - DAY_START_HOUR) * 60 + eventDate.getMinutes()) / 30
      )
      setDragState({
        type: 'move',
        anchorSlot: startSlot,
        startSlot,
        endSlot: startSlot,
        event,
        active: true,
      })
    },
    []
  )

  // Current time indicator
  const now = new Date()
  const currentTimeTop = useMemo(() => {
    const minutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes()
    return (minutes / 30) * SLOT_HEIGHT
  }, [now])

  const showCurrentTime = isToday(currentDate)
  const isPast = currentDate < new Date() && !isToday(currentDate)

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pr-28 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate(addDays(currentDate, -1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onNavigate(new Date())}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate(addDays(currentDate, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold ml-2">
            {format(currentDate, 'EEEE, MMMM d, yyyy')}
          </span>
        </div>
        {!isPast && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => setWeatherOn((v) => !v)}
            title={weatherOn ? 'Hide weather overlay' : 'Show weather overlay'}
          >
            {weatherOn ? <Cloud className="h-3.5 w-3.5" /> : <CloudOff className="h-3.5 w-3.5" />}
            Weather
          </Button>
        )}
      </div>

      {/* Day header */}
      <div className="flex border-b border-border/50 flex-shrink-0">
        <div className="w-14 flex-shrink-0" />
        <div
          className={cn(
            'flex-1 text-center py-2 border-l border-border/50',
            isToday(currentDate) && 'bg-blue-500/5'
          )}
        >
          <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
            {format(currentDate, 'EEE')}
          </div>
          <div
            className={cn(
              'text-lg font-semibold leading-tight',
              isToday(currentDate)
                ? 'bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                : 'text-foreground'
            )}
          >
            {format(currentDate, 'd')}
          </div>
        </div>
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden">
        <div
          ref={gridRef}
          className="relative flex select-none"
          style={{ height: TOTAL_SLOTS * SLOT_HEIGHT, touchAction: 'none' }}
          onPointerDown={handleGridPointerDown}
          onPointerMove={handleGridPointerMove}
          onPointerUp={handleGridPointerUp}
          onMouseMove={handleGridMouseMove}
          onMouseLeave={handleGridMouseLeave}
        >
          {/* Time gutter */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.filter((hour) => hour !== DAY_START_HOUR).map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2 text-[10px] text-muted-foreground -translate-y-1/2"
                style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT }}
              >
                {format(setHours(new Date(), hour), 'h a')}
              </div>
            ))}
          </div>

          {/* Single day column */}
          <div
            className={cn(
              'flex-1 relative border-l border-border/50',
              isToday(currentDate) && 'bg-blue-500/[0.02]'
            )}
          >
            {/* Hour grid lines + weather */}
            {hours.map((hour) => {
              const window = dayWindows.find((w) => {
                const wHour = parseInt(w.startTime.split(':')[0])
                return wHour === hour
              })
              const avgScore = window
                ? Math.round(
                    (window.scores.run + window.scores.social + window.scores.photo) / 3
                  )
                : null
              const showWeather = weatherOn && !isPast

              return (
                <div key={hour}>
                  <div
                    className="absolute w-full border-t border-border/60"
                    style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT }}
                  />
                  <div
                    className="absolute w-full border-t border-border/30 border-dashed"
                    style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT + SLOT_HEIGHT }}
                  />
                  {showWeather && avgScore !== null && (
                    <div
                      className={cn('absolute w-full', getScoreColor(avgScore))}
                      style={{
                        top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT,
                        height: SLOT_HEIGHT * 2,
                      }}
                    />
                  )}
                  {/* Weather icon every 3 hours (hidden when an event overlaps) */}
                  {showWeather && window && hour % 3 === 0 && !dayEvents.some((ev) => {
                    const evStart = new Date(ev.startTime)
                    const evEnd = new Date(ev.endTime)
                    const evStartMin = evStart.getHours() * 60 + evStart.getMinutes()
                    const evEndMin = evEnd.getHours() * 60 + evEnd.getMinutes()
                    const iconMin = hour * 60
                    return evStartMin <= iconMin && evEndMin > iconMin
                  }) && (
                    <div
                      className="absolute right-1 flex items-center gap-0.5 pointer-events-none z-[1]"
                      style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT + 2 }}
                    >
                      <WeatherIcon condition={window.weather.condition} size="sm" animated={false} />
                      <span className="text-[9px] text-muted-foreground">{window.weather.temperature}°</span>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Events */}
            {dayEvents.map((event) => {
              const laneInfo = lanes.get(event.id) || { lane: 0, totalLanes: 1 }
              return (
                <div key={event.id} data-event-block>
                  <CalendarEventBlock
                    event={event}
                    lane={laneInfo.lane}
                    totalLanes={laneInfo.totalLanes}
                    analysis={analyses.get(event.id)}
                    onEdit={onEditEvent}
                    onAcceptSuggestion={onAcceptSuggestion}
                    onDismissSuggestion={onDismissSuggestion}
                    onResizeStart={handleResizeStart}
                    onMoveStart={handleMoveStart}
                  />
                  <SuggestionGhost suggestion={analyses.get(event.id)?.recommendedAlternative} />
                </div>
              )
            })}

            {/* Current time indicator */}
            {showCurrentTime && currentTimeTop > 0 && currentTimeTop < TOTAL_SLOTS * SLOT_HEIGHT && (
              <div
                className="absolute left-0 right-0 z-20 pointer-events-none"
                style={{ top: currentTimeTop }}
              >
                <div className="relative">
                  <div className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-red-500" />
                  <div className="h-[2px] bg-red-500 w-full" />
                </div>
              </div>
            )}
          </div>

          {/* Weather hover tooltip */}
          {hoverInfo && hoveredWindow && !dragState?.active && weatherOn && !isPast && (
            <WeatherSlotTooltip
              weather={hoveredWindow.weather}
              time={format(slotToTime(hoverInfo.slot), 'h:mm a')}
              x={hoverInfo.mouseX}
              y={hoverInfo.mouseY}
            />
          )}

          {/* Drag-to-create overlay */}
          {dragState?.active && dragState.type === 'create' && (
            <div
              className="absolute bg-blue-500/20 border-2 border-blue-500/40 rounded-md z-30 pointer-events-none"
              style={{
                left: TIME_GUTTER_WIDTH,
                width: `calc(100% - ${TIME_GUTTER_WIDTH}px - 4px)`,
                top: dragState.startSlot! * SLOT_HEIGHT,
                height: (dragState.endSlot! - dragState.startSlot!) * SLOT_HEIGHT,
              }}
            >
              <div className="p-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                {format(slotToTime(dragState.startSlot!), 'h:mm a')} -{' '}
                {format(slotToTime(dragState.endSlot!), 'h:mm a')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
