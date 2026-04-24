'use client'

import { useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCalendarStore } from '@/hooks/use-calendar-store'
import type { CalendarEvent } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
} from 'date-fns'

const MAX_VISIBLE_EVENTS = 3

const pillColorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  violet: 'bg-violet-500',
  pink: 'bg-pink-500',
}

interface MonthViewProps {
  currentDate: Date
  onNavigate: (date: Date) => void
  onDayClick: (date: Date) => void
  onEditEvent: (event: CalendarEvent) => void
  className?: string
}

export function MonthView({
  currentDate,
  onNavigate,
  onDayClick,
  onEditEvent,
  className,
}: MonthViewProps) {
  const { state } = useCalendarStore()

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)

  // Build the grid: start from the Monday of the week containing the 1st
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const weeks = useMemo(() => {
    const result: Date[][] = []
    let day = gridStart
    while (day <= gridEnd) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(day)
        day = addDays(day, 1)
      }
      result.push(week)
    }
    return result
  }, [gridStart.getTime(), gridEnd.getTime()])

  // Group events by day key (YYYY-MM-DD)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const event of state.events) {
      const key = format(new Date(event.startTime), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(event)
    }
    // Sort events within each day by start time
    for (const [, events] of map) {
      events.sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      )
    }
    return map
  }, [state.events])

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className={cn('flex h-full min-h-0 flex-col overflow-hidden', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pr-28 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNavigate(addMonths(currentDate, -1))}
          >
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
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => onNavigate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold ml-2">
            {format(currentDate, 'MMMM yyyy')}
          </span>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-border/50 flex-shrink-0">
        {dayNames.map((name) => (
          <div
            key={name}
            className="text-center py-2 text-[10px] uppercase text-muted-foreground tracking-wider"
          >
            {name}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex-1 grid grid-rows-subgrid overflow-y-auto" style={{ gridTemplateRows: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map((week, weekIdx) => (
          <div key={weekIdx} className="grid grid-cols-7 border-b border-border/30 min-h-0">
            {week.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd')
              const dayEvents = eventsByDay.get(dayKey) || []
              const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS)
              const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS
              const inCurrentMonth = isSameMonth(day, currentDate)

              return (
                <div
                  key={dayKey}
                  className={cn(
                    'border-r border-border/30 p-1 flex flex-col min-h-0 cursor-pointer hover:bg-muted/30 transition-colors',
                    !inCurrentMonth && 'opacity-40',
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Day number */}
                  <div className="flex-shrink-0 mb-0.5">
                    <span
                      className={cn(
                        'text-xs font-medium inline-flex items-center justify-center',
                        isToday(day)
                          ? 'bg-blue-500 text-white rounded-full w-6 h-6'
                          : 'text-foreground w-6 h-6',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Event pills */}
                  <div className="flex-1 min-h-0 space-y-0.5 overflow-hidden">
                    {visibleEvents.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        className="w-full flex items-center gap-1 px-1 py-0.5 rounded text-left hover:bg-muted/50 transition-colors group/pill"
                        onClick={(e) => {
                          e.stopPropagation()
                          onEditEvent(event)
                        }}
                      >
                        <span
                          className={cn(
                            'w-1.5 h-1.5 rounded-full flex-shrink-0',
                            pillColorMap[event.color] || 'bg-blue-500',
                          )}
                        />
                        <span className="text-[10px] truncate text-foreground leading-tight">
                          {format(new Date(event.startTime), 'h:mm')} {event.title}
                        </span>
                      </button>
                    ))}
                    {overflowCount > 0 && (
                      <button
                        type="button"
                        className="w-full text-left px-1 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors font-medium"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDayClick(day)
                        }}
                      >
                        +{overflowCount} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
