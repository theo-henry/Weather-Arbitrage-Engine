'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2, CloudAlert } from 'lucide-react'
import type { CalendarEvent, EventColor, EventCategory, Activity, TimeWindow } from '@/lib/types'
import { ACTIVITY_CONFIG } from '@/lib/types'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'

const EVENT_COLORS: { value: EventColor; label: string; class: string }[] = [
  { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
  { value: 'green', label: 'Green', class: 'bg-green-500' },
  { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
  { value: 'red', label: 'Red', class: 'bg-red-500' },
  { value: 'violet', label: 'Violet', class: 'bg-violet-500' },
  { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
]

// Generate time options at 30-min increments across the full day.
const BASE_TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const totalMinutes = i * 30
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  return { value, label: formatTimeLabel(value) }
})

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function formatTimeLabel(value: string) {
  const [hours, minutes] = value.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  return format(date, 'h:mm a')
}

function buildTimeOptions(extraValues: string[] = []) {
  const seen = new Set<string>()

  return [...BASE_TIME_OPTIONS, ...extraValues.filter(Boolean).map((value) => ({ value, label: formatTimeLabel(value) }))]
    .filter((option) => {
      if (seen.has(option.value)) return false
      seen.add(option.value)
      return true
    })
    .sort((a, b) => timeToMinutes(a.value) - timeToMinutes(b.value))
}

function getNextTimeValue(value: string) {
  const currentMinutes = timeToMinutes(value)
  const next = BASE_TIME_OPTIONS.find((option) => timeToMinutes(option.value) > currentMinutes)
  return next?.value ?? value
}

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: Partial<CalendarEvent> | null // null = create mode, has id = edit mode
  onSave: (event: CalendarEvent) => void
  onDelete?: (id: string) => void
  windows?: TimeWindow[]
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  onSave,
  onDelete,
  windows = [],
}: EventDialogProps) {
  const isEditing = !!event?.id

  // Form state
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('10:00')
  const [category, setCategory] = useState<EventCategory>('indoor')
  const [activity, setActivity] = useState<Activity | ''>('')
  const [location, setLocation] = useState('')
  const [participants, setParticipants] = useState('')
  const [notes, setNotes] = useState('')
  const [color, setColor] = useState<EventColor>('blue')

  const startTimeOptions = useMemo(
    () =>
      buildTimeOptions([startTime]).filter(
        (option) => timeToMinutes(option.value) < 23 * 60 + 30 || option.value === startTime
      ),
    [startTime]
  )

  const endTimeOptions = useMemo(
    () =>
      buildTimeOptions([startTime, endTime]).filter(
        (option) => timeToMinutes(option.value) > timeToMinutes(startTime)
      ),
    [startTime, endTime]
  )

  // Populate form when event changes
  useEffect(() => {
    if (!event) return
    setTitle(event.title || '')
    if (event.startTime) {
      const start = new Date(event.startTime)
      setDate(format(start, 'yyyy-MM-dd'))
      setStartTime(format(start, 'HH:mm'))
    }
    if (event.endTime) {
      const end = new Date(event.endTime)
      setEndTime(format(end, 'HH:mm'))
    }
    setCategory(event.category || 'indoor')
    setActivity(event.activity || '')
    setLocation(event.location || '')
    setParticipants(event.participants?.join(', ') || '')
    setNotes(event.notes || '')
    setColor(event.color || 'blue')
  }, [event])

  useEffect(() => {
    if (timeToMinutes(endTime) > timeToMinutes(startTime)) return

    const nextTime = getNextTimeValue(startTime)
    if (nextTime !== endTime) {
      setEndTime(nextTime)
    }
  }, [startTime, endTime])

  // Weather score preview for weather-sensitive events
  const weatherPreview = useMemo(() => {
    if (category !== 'weather-sensitive' || !activity || !date || !startTime) return null

    // Find windows overlapping this time
    const eventStart = new Date(`${date}T${startTime}:00`)
    const eventEnd = new Date(`${date}T${endTime}:00`)

    const overlapping = windows.filter((w) => {
      const wStart = new Date(w.date)
      const wStartHour = parseInt(w.startTime.split(':')[0])
      const wStartMin = parseInt(w.startTime.split(':')[1])
      wStart.setHours(wStartHour, wStartMin, 0, 0)
      const wEnd = new Date(wStart)
      wEnd.setMinutes(wEnd.getMinutes() + 30)
      return wStart < eventEnd && wEnd > eventStart
    })

    if (overlapping.length === 0) return null

    const scores = overlapping.map(
      (w) => w.scores[activity as keyof typeof w.scores] ?? 50
    )
    const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)

    return { score: avgScore, slots: overlapping.length }
  }, [category, activity, date, startTime, endTime, windows])

  const handleSave = () => {
    if (!title.trim() || !date) return

    const startDate = new Date(`${date}T${startTime}:00`)
    const endDate = new Date(`${date}T${endTime}:00`)

    if (endDate <= startDate) return

    const calendarEvent: CalendarEvent = {
      id: event?.id || Date.now().toString(),
      title: title.trim(),
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      category,
      color,
      createdVia: event?.createdVia || 'ui',
      ...(category === 'weather-sensitive' && activity ? { activity: activity as Activity } : {}),
      ...(location ? { location } : {}),
      ...(participants ? { participants: participants.split(',').map((p) => p.trim()).filter(Boolean) } : {}),
      ...(notes ? { notes } : {}),
      ...(weatherPreview ? { weatherScore: weatherPreview.score } : {}),
      suggestedAlternative: event?.suggestedAlternative ?? null,
    }

    onSave(calendarEvent)
    onOpenChange(false)
  }

  const handleDelete = () => {
    if (event?.id && onDelete) {
      onDelete(event.id)
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Event' : 'New Event'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Event name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Start</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {startTimeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>End</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {endTimeOptions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label>Category</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={category === 'indoor' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => { setCategory('indoor'); setActivity('') }}
              >
                🏢 Indoor
              </Button>
              <Button
                type="button"
                variant={category === 'weather-sensitive' ? 'default' : 'outline'}
                size="sm"
                className="flex-1"
                onClick={() => setCategory('weather-sensitive')}
              >
                🌤️ Weather-sensitive
              </Button>
            </div>
          </div>

          {/* Activity type (only for weather-sensitive) */}
          {category === 'weather-sensitive' && (
            <div className="space-y-1.5">
              <Label>Activity Type</Label>
              <Select value={activity} onValueChange={(v) => setActivity(v as Activity)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select activity..." />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACTIVITY_CONFIG) as [Activity, typeof ACTIVITY_CONFIG.run][])
                    .filter(([key]) => key !== 'custom')
                    .map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Weather preview */}
          {weatherPreview && (
            <div
              className={cn(
                'rounded-lg p-3 border text-sm',
                weatherPreview.score >= 70
                  ? 'bg-green-500/10 border-green-500/30'
                  : weatherPreview.score >= 40
                  ? 'bg-amber-500/10 border-amber-500/30'
                  : 'bg-red-500/10 border-red-500/30'
              )}
            >
              <div className="flex items-center gap-2">
                <CloudAlert className="h-4 w-4" />
                <span className="font-medium">
                  Weather Score: {weatherPreview.score}/100
                </span>
              </div>
              {weatherPreview.score < 60 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Weather conditions may not be ideal. Consider choosing a different time.
                </p>
              )}
            </div>
          )}

          {/* Location */}
          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              placeholder="Add location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <Label htmlFor="participants">Participants</Label>
            <Input
              id="participants"
              placeholder="Add participants (comma-separated)"
              value={participants}
              onChange={(e) => setParticipants(e.target.value)}
            />
            {participants && (
              <div className="flex flex-wrap gap-1 mt-1">
                {participants
                  .split(',')
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {p}
                    </Badge>
                  ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className={cn(
                    'w-7 h-7 rounded-full transition-all',
                    c.class,
                    color === c.value
                      ? 'ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110'
                      : 'opacity-60 hover:opacity-100'
                  )}
                  onClick={() => setColor(c.value)}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2">
          {isEditing && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-500 hover:text-red-600 hover:bg-red-500/10 mr-auto"
              onClick={handleDelete}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={!title.trim() || !date}>
            {isEditing ? 'Save Changes' : 'Create Event'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
