'use client'

import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WeatherIcon } from '@/components/weather-icon'
import { CalendarEventBlock, SuggestionGhost, SLOT_HEIGHT, DAY_START_HOUR } from '@/components/calendar-event-block'
import { useCalendarStore } from '@/hooks/use-calendar-store'
import type { CalendarEvent, TimeWindow } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  startOfWeek,
  endOfWeek,
  addWeeks,
  addDays,
  format,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
} from 'date-fns'

const DAY_END_HOUR = 22
const TOTAL_SLOTS = (DAY_END_HOUR - DAY_START_HOUR) * 2 // 32 slots
const TIME_GUTTER_WIDTH = 56
const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => i + DAY_START_HOUR)

function getScoreColor(score: number): string {
  if (score >= 80) return 'bg-green-500/10'
  if (score >= 60) return 'bg-lime-500/8'
  if (score >= 40) return 'bg-amber-500/6'
  return 'bg-red-500/6'
}

// Compute overlapping event lanes using a greedy algorithm
function computeLanes(events: CalendarEvent[]): Map<string, { lane: number; totalLanes: number }> {
  const result = new Map<string, { lane: number; totalLanes: number }>()
  if (events.length === 0) return result

  const sorted = [...events].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  // Build a list of groups (events that overlap with each other)
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
    // Assign lanes within this group
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
    // Set totalLanes for every event in this group
    const totalLanes = lanes.length
    for (const ev of group) {
      const r = result.get(ev.id)!
      r.totalLanes = totalLanes
    }
  }

  return result
}

interface WeeklyCalendarProps {
  windows: TimeWindow[]
  onCreateEvent: (startTime: Date, endTime: Date) => void
  onEditEvent: (event: CalendarEvent) => void
  className?: string
}

export function WeeklyCalendar({
  windows,
  onCreateEvent,
  onEditEvent,
  className,
}: WeeklyCalendarProps) {
  const { state, dispatch } = useCalendarStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Drag state
  const [dragState, setDragState] = useState<{
    type: 'create' | 'resize' | 'move'
    dayIndex?: number
    anchorSlot?: number
    startSlot?: number
    endSlot?: number
    event?: CalendarEvent
    active: boolean
  } | null>(null)

  const currentWeekStart = useMemo(
    () => startOfWeek(addWeeks(new Date(), weekOffset), { weekStartsOn: 1 }),
    [weekOffset]
  )

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i)),
    [currentWeekStart]
  )

  // Group events by day
  const eventsByDay = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>()
    for (let i = 0; i < 7; i++) map.set(i, [])
    for (const event of state.events) {
      const eventDate = new Date(event.startTime)
      const dayIdx = days.findIndex((d) => isSameDay(d, eventDate))
      if (dayIdx >= 0) {
        map.get(dayIdx)!.push(event)
      }
    }
    return map
  }, [state.events, days])

  // Group weather windows by day
  const windowsByDay = useMemo(() => {
    const map = new Map<number, TimeWindow[]>()
    for (let i = 0; i < 7; i++) map.set(i, [])
    for (const w of windows) {
      const wDate = new Date(w.date)
      const dayIdx = days.findIndex((d) => isSameDay(d, wDate))
      if (dayIdx >= 0) {
        map.get(dayIdx)!.push(w)
      }
    }
    return map
  }, [windows, days])

  // Scroll to 8am on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = ((8 - DAY_START_HOUR) * 2) * SLOT_HEIGHT
      scrollRef.current.scrollTop = scrollTo
    }
  }, [])

  // Slot coordinates
  const getSlotFromY = useCallback((y: number) => {
    return Math.max(0, Math.min(TOTAL_SLOTS - 1, Math.floor(y / SLOT_HEIGHT)))
  }, [])

  const getDayFromX = useCallback((x: number, gridWidth: number) => {
    const dayWidth = (gridWidth - TIME_GUTTER_WIDTH) / 7
    const dayIdx = Math.floor((x - TIME_GUTTER_WIDTH) / dayWidth)
    return Math.max(0, Math.min(6, dayIdx))
  }, [])

  const slotToTime = useCallback((slot: number, dayIndex: number) => {
    const totalMinutes = DAY_START_HOUR * 60 + slot * 30
    const h = Math.floor(totalMinutes / 60)
    const m = totalMinutes % 60
    return setMinutes(setHours(days[dayIndex], h), m)
  }, [days])

  const getSelectionRange = useCallback((anchorSlot: number, slot: number) => {
    const startSlot = Math.min(anchorSlot, slot)
    const endSlot = Math.max(anchorSlot, slot) + 1

    return { startSlot, endSlot }
  }, [])

  // Drag-to-create handlers
  const handleGridPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      // `rect.top` already reflects the scrolled position of the grid.
      const y = e.clientY - rect.top
      if (x < TIME_GUTTER_WIDTH) return

      const dayIdx = getDayFromX(x, rect.width)
      const slot = getSlotFromY(y)

      // Only start drag on empty areas (not on events)
      if ((e.target as HTMLElement).closest('[data-event-block]')) return

      setDragState({
        type: 'create',
        dayIndex: dayIdx,
        anchorSlot: slot,
        startSlot: slot,
        endSlot: slot + 1,
        active: true,
      })
      gridRef.current?.setPointerCapture?.(e.pointerId)
    },
    [getDayFromX, getSlotFromY]
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
        setDragState((prev) =>
          prev ? { ...prev, startSlot, endSlot } : null
        )
      } else if (dragState.type === 'resize' && dragState.event) {
        const slot = getSlotFromY(y)
        const eventStart = new Date(dragState.event.startTime)
        const startSlot = Math.floor(
          ((eventStart.getHours() - DAY_START_HOUR) * 60 + eventStart.getMinutes()) / 30
        )
        setDragState((prev) =>
          prev ? { ...prev, endSlot: Math.max(startSlot + 1, slot + 1) } : null
        )
      } else if (dragState.type === 'move' && dragState.event) {
        const x = e.clientX - rect.left
        const dayIdx = getDayFromX(x, rect.width)
        const slot = getSlotFromY(y)
        setDragState((prev) =>
          prev ? { ...prev, dayIndex: dayIdx, endSlot: slot } : null
        )
      }
    },
    [dragState, getSelectionRange, getSlotFromY, getDayFromX]
  )

  const handleGridPointerUp = useCallback(() => {
    if (!dragState?.active) return

    if (dragState.type === 'create' && dragState.dayIndex !== undefined) {
      const start = slotToTime(dragState.startSlot!, dragState.dayIndex)
      const end = slotToTime(dragState.endSlot!, dragState.dayIndex)
      onCreateEvent(start, end)
    } else if (dragState.type === 'resize' && dragState.event) {
      const newEnd = slotToTime(dragState.endSlot!, dragState.dayIndex!)
      dispatch({
        type: 'RESIZE_EVENT',
        id: dragState.event.id,
        endTime: newEnd.toISOString(),
      })
    } else if (dragState.type === 'move' && dragState.event) {
      const eventStart = new Date(dragState.event.startTime)
      const eventEnd = new Date(dragState.event.endTime)
      const durationMs = eventEnd.getTime() - eventStart.getTime()
      const newStart = slotToTime(dragState.endSlot!, dragState.dayIndex!)
      const newEnd = new Date(newStart.getTime() + durationMs)
      dispatch({
        type: 'MOVE_EVENT',
        id: dragState.event.id,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
      })
    }

    setDragState(null)
  }, [dragState, slotToTime, onCreateEvent, dispatch])

  const handleResizeStart = useCallback(
    (e: React.PointerEvent, event: CalendarEvent) => {
      e.stopPropagation()
      const eventDate = new Date(event.startTime)
      const dayIdx = days.findIndex((d) => isSameDay(d, eventDate))
      const eventEnd = new Date(event.endTime)
      const endSlot = Math.floor(
        ((eventEnd.getHours() - DAY_START_HOUR) * 60 + eventEnd.getMinutes()) / 30
      )
      setDragState({
        type: 'resize',
        dayIndex: dayIdx,
        anchorSlot: endSlot,
        startSlot: endSlot,
        endSlot,
        event,
        active: true,
      })
      gridRef.current?.setPointerCapture?.(e.pointerId)
    },
    [days]
  )

  const handleMoveStart = useCallback(
    (e: React.PointerEvent, event: CalendarEvent) => {
      // Only start move on left button, not on click (handled separately)
      if (e.button !== 0) return
      const eventDate = new Date(event.startTime)
      const dayIdx = days.findIndex((d) => isSameDay(d, eventDate))
      const startSlot = Math.floor(
        ((eventDate.getHours() - DAY_START_HOUR) * 60 + eventDate.getMinutes()) / 30
      )
      setDragState({
        type: 'move',
        dayIndex: dayIdx,
        anchorSlot: startSlot,
        startSlot,
        endSlot: startSlot,
        event,
        active: true,
      })
    },
    [days]
  )

  // Current time indicator
  const now = new Date()
  const currentTimeTop = useMemo(() => {
    const minutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes()
    return (minutes / 30) * SLOT_HEIGHT
  }, [now])

  const todayIndex = days.findIndex((d) => isToday(d))

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setWeekOffset(0)}
          >
            Today
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((w) => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold ml-2">
            {format(currentWeekStart, 'MMM d')} – {format(endOfWeek(currentWeekStart, { weekStartsOn: 1 }), 'MMM d, yyyy')}
          </span>
        </div>
      </div>

      {/* Day headers */}
      <div className="flex border-b border-border/50 flex-shrink-0">
        {/* Time gutter spacer */}
        <div className="w-14 flex-shrink-0" />
        {days.map((day, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 text-center py-2 border-l border-border/20',
              isToday(day) && 'bg-blue-500/5'
            )}
          >
            <div className="text-[10px] uppercase text-muted-foreground tracking-wider">
              {format(day, 'EEE')}
            </div>
            <div
              className={cn(
                'text-lg font-semibold leading-tight',
                isToday(day)
                  ? 'bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto'
                  : 'text-foreground'
              )}
            >
              {format(day, 'd')}
            </div>
          </div>
        ))}
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
        >
          {/* Time gutter */}
          <div className="w-14 flex-shrink-0 relative">
            {hours.map((hour) => (
              <div
                key={hour}
                className="absolute w-full text-right pr-2 text-[10px] text-muted-foreground -translate-y-1/2"
                style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT }}
              >
                {format(setHours(new Date(), hour), 'h a')}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIndex) => {
            const dayEvents = eventsByDay.get(dayIndex) || []
            const dayWindows = windowsByDay.get(dayIndex) || []
            const lanes = computeLanes(dayEvents)

            return (
              <div
                key={dayIndex}
                className={cn(
                  'flex-1 relative border-l border-border/20',
                  isToday(day) && 'bg-blue-500/[0.02]'
                )}
              >
                {/* Hour grid lines */}
                {hours.map((hour) => {
                  // Find the window matching this hour for weather heatmap
                  const window = dayWindows.find((w) => {
                    const wHour = parseInt(w.startTime.split(':')[0])
                    return wHour === hour
                  })
                  const avgScore = window
                    ? Math.round(
                        (window.scores.run +
                          window.scores.social +
                          window.scores.photo) /
                          3
                      )
                    : null

                  return (
                    <div key={hour}>
                      {/* Hour line */}
                      <div
                        className="absolute w-full border-t border-border/20"
                        style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT }}
                      />
                      {/* Half-hour line */}
                      <div
                        className="absolute w-full border-t border-border/10 border-dashed"
                        style={{ top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT + SLOT_HEIGHT }}
                      />
                      {/* Weather heatmap background */}
                      {avgScore !== null && (
                        <div
                          className={cn('absolute w-full', getScoreColor(avgScore))}
                          style={{
                            top: (hour - DAY_START_HOUR) * 2 * SLOT_HEIGHT,
                            height: SLOT_HEIGHT * 2,
                          }}
                        />
                      )}
                      {/* Weather icon every 3 hours */}
                      {window && hour % 3 === 0 && (
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
                        onEdit={onEditEvent}
                        onAcceptSuggestion={(id) => dispatch({ type: 'ACCEPT_SUGGESTION', id })}
                        onDismissSuggestion={(id) => dispatch({ type: 'DISMISS_SUGGESTION', id })}
                        onResizeStart={handleResizeStart}
                        onMoveStart={handleMoveStart}
                      />
                      <SuggestionGhost event={event} />
                    </div>
                  )
                })}

                {/* Current time indicator */}
                {dayIndex === todayIndex && currentTimeTop > 0 && currentTimeTop < TOTAL_SLOTS * SLOT_HEIGHT && (
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
            )
          })}

          {/* Drag-to-create overlay */}
          {dragState?.active && dragState.type === 'create' && dragState.dayIndex !== undefined && (
            <div
              className="absolute bg-blue-500/20 border-2 border-blue-500/40 rounded-md z-30 pointer-events-none"
              style={{
                left: `calc(${TIME_GUTTER_WIDTH}px + ${dragState.dayIndex} * ((100% - ${TIME_GUTTER_WIDTH}px) / 7))`,
                width: `calc((100% - ${TIME_GUTTER_WIDTH}px) / 7 - 4px)`,
                top: dragState.startSlot! * SLOT_HEIGHT,
                height: (dragState.endSlot! - dragState.startSlot!) * SLOT_HEIGHT,
              }}
            >
              <div className="p-1 text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                {format(slotToTime(dragState.startSlot!, dragState.dayIndex), 'h:mm a')} -{' '}
                {format(slotToTime(dragState.endSlot!, dragState.dayIndex), 'h:mm a')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
