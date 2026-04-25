'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ActivitySelector } from '@/components/activity-selector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  formatBlockedTimeRule,
  removeBlockedTimeRule,
  sortRules,
  timeStringToMinutes,
  upsertBlockedTimeRule,
} from '@/lib/preferences'
import type { Activity, BlockedTimeRule, UserPreferences, WeekdayKey } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SchedulingRulesPanelProps {
  preferences: UserPreferences
  onPreferencesChange: (preferences: UserPreferences) => void
}

const ACTIVITIES: Activity[] = ['run', 'study', 'social', 'flight', 'photo', 'custom']

const WEEKDAY_OPTIONS: Array<{ value: WeekdayKey; label: string }> = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
]

const TIME_OPTIONS = Array.from({ length: 49 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? '00' : '30'
  return `${hours.toString().padStart(2, '0')}:${minutes}`
})

const GRID_START_HOUR = 0
const GRID_END_HOUR = 24
const SLOT_MINUTES = 30
const GRID_SLOTS = Array.from({ length: ((GRID_END_HOUR - GRID_START_HOUR) * 60) / SLOT_MINUTES }, (_, index) => {
  const minutes = GRID_START_HOUR * 60 + index * SLOT_MINUTES
  return {
    index,
    startTime: minutesToTimeString(minutes),
    endTime: minutesToTimeString(minutes + SLOT_MINUTES),
    label: minutes % 60 === 0 ? minutesToTimeString(minutes) : '',
  }
})

type CellIntent = 'block' | 'unblock'
type ActivityScope = Activity | 'all'

export function SchedulingRulesPanel({
  preferences,
  onPreferencesChange,
}: SchedulingRulesPanelProps) {
  const [activityScope, setActivityScope] = useState<ActivityScope>(preferences.activity)
  const [day, setDay] = useState<WeekdayKey>('mon')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('09:00')
  const dragIntent = useRef<CellIntent | null>(null)
  const dragCells = useRef<Set<string> | null>(null)
  const dragCellsByActivity = useRef<Record<Activity, Set<string>> | null>(null)
  const touchedDuringDrag = useRef<Set<string>>(new Set())

  useEffect(() => {
    setActivityScope((current) => (current === 'all' ? current : preferences.activity))
  }, [preferences.activity])

  const rules = useMemo(
    () => (activityScope === 'all' ? [] : preferences.blockedTimeRules[activityScope] ?? []),
    [activityScope, preferences.blockedTimeRules],
  )
  const allActivityRules = useMemo(
    () => ACTIVITIES.flatMap((activity) => (preferences.blockedTimeRules[activity] ?? []).map((rule) => ({ activity, rule }))),
    [preferences.blockedTimeRules],
  )
  const isTimeRangeValid = startTime < endTime
  const { blockedCells, partiallyBlockedCells } = useMemo(
    () => getBlockedCellCoverage(preferences, activityScope),
    [activityScope, preferences],
  )
  const allWeekRangeLabel = `${startTime}-${endTime}`
  const scopeLabel = activityScope === 'all' ? 'all activities' : activityScope

  const updateRulesForActivity = (activity: Activity, nextRules: BlockedTimeRule[]) => {
    onPreferencesChange({
      ...preferences,
      blockedTimeRules: {
        ...preferences.blockedTimeRules,
        [activity]: nextRules,
      },
    })
  }

  const updateRulesForScope = (buildNextRules: (activity: Activity, currentRules: BlockedTimeRule[]) => BlockedTimeRule[]) => {
    const targetActivities = activityScope === 'all' ? ACTIVITIES : [activityScope]
    const nextBlockedTimeRules = { ...preferences.blockedTimeRules }

    for (const activity of targetActivities) {
      nextBlockedTimeRules[activity] = buildNextRules(activity, nextBlockedTimeRules[activity] ?? [])
    }

    onPreferencesChange({
      ...preferences,
      blockedTimeRules: nextBlockedTimeRules,
    })
  }

  const handleAddRule = () => {
    if (!isTimeRangeValid) return
    updateRulesForScope((_, currentRules) => upsertBlockedTimeRule(currentRules, { day, startTime, endTime }))
  }

  const handleAddAllWeekRule = () => {
    if (!isTimeRangeValid) return

    updateRulesForScope((_, currentRules) =>
      WEEKDAY_OPTIONS.reduce(
        (nextRules, option) => upsertBlockedTimeRule(nextRules, {
          day: option.value,
          startTime,
          endTime,
        }),
        currentRules,
      ),
    )
  }

  const handleRemoveRule = (rule: BlockedTimeRule, targetActivity: Activity) => {
    updateRulesForActivity(targetActivity, removeBlockedTimeRule(preferences.blockedTimeRules[targetActivity] ?? [], rule))
  }

  const updateGridCell = (nextCells: Set<string>) => {
    if (activityScope === 'all') return
    updateRulesForActivity(activityScope, blockedCellsToRules(nextCells))
  }

  const updateAllActivityGridCell = (cellKey: string, intent: CellIntent) => {
    const cellsByActivity = dragCellsByActivity.current ?? buildCellsByActivity(preferences)

    for (const activity of ACTIVITIES) {
      if (intent === 'block') {
        cellsByActivity[activity].add(cellKey)
      } else {
        cellsByActivity[activity].delete(cellKey)
      }
    }

    dragCellsByActivity.current = cellsByActivity
    onPreferencesChange({
      ...preferences,
      blockedTimeRules: ACTIVITIES.reduce(
        (nextRules, activity) => ({
          ...nextRules,
          [activity]: blockedCellsToRules(cellsByActivity[activity]),
        }),
        { ...preferences.blockedTimeRules },
      ),
    })
  }

  const applyCellIntent = (cellKey: string, intent: CellIntent) => {
    if (touchedDuringDrag.current.has(cellKey)) return
    touchedDuringDrag.current.add(cellKey)

    if (activityScope === 'all') {
      updateAllActivityGridCell(cellKey, intent)
      return
    }

    const nextCells = dragCells.current ?? new Set(blockedCells)
    if (intent === 'block') {
      nextCells.add(cellKey)
    } else {
      nextCells.delete(cellKey)
    }

    dragCells.current = nextCells
    updateGridCell(nextCells)
  }

  const handleCellPointerDown = (cellKey: string, isBlocked: boolean) => {
    const intent: CellIntent = isBlocked ? 'unblock' : 'block'
    dragIntent.current = intent
    if (activityScope === 'all') {
      dragCellsByActivity.current = buildCellsByActivity(preferences)
      dragCells.current = null
    } else {
      dragCells.current = new Set(blockedCells)
      dragCellsByActivity.current = null
    }
    touchedDuringDrag.current = new Set()
    applyCellIntent(cellKey, intent)
  }

  const handleCellPointerEnter = (cellKey: string) => {
    if (!dragIntent.current) return
    applyCellIntent(cellKey, dragIntent.current)
  }

  const stopDrag = () => {
    dragIntent.current = null
    dragCells.current = null
    dragCellsByActivity.current = null
    touchedDuringDrag.current = new Set()
  }

  return (
    <div className="space-y-6" onPointerUp={stopDrag} onPointerCancel={stopDrag} onPointerLeave={stopDrag}>
      <Card className="border-border/60 bg-muted/20 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Blocked Scheduling Windows</CardTitle>
          <CardDescription>
            Drag across the week to paint blocked time red. These are hard constraints, so the scheduler and chatbot
            avoid them for the selected activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Activity
            </Label>
            <ActivityScopeSelector selected={activityScope} onSelect={setActivityScope} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Day</Label>
              <Select value={day} onValueChange={(value) => setDay(value as WeekdayKey)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select day" />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start</Label>
              <Select value={startTime} onValueChange={setStartTime}>
                <SelectTrigger>
                  <SelectValue placeholder="Start time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>End</Label>
              <Select value={endTime} onValueChange={setEndTime}>
                <SelectTrigger>
                  <SelectValue placeholder="End time" />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <WeeklyBlockGrid
            blockedCells={blockedCells}
            partiallyBlockedCells={partiallyBlockedCells}
            onCellPointerDown={handleCellPointerDown}
            onCellPointerEnter={handleCellPointerEnter}
          />

          {!isTimeRangeValid && (
            <p className="text-sm text-red-600 dark:text-red-300">End time must be later than start time.</p>
          )}

          <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
            <div className="mb-4 flex flex-col gap-1">
              <p className="text-sm font-medium">Precise add</p>
              <p className="text-xs text-muted-foreground">
                Use this for exact day-specific blocks or to repeat the same time window across the whole week.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleAddRule} disabled={!isTimeRangeValid} className="w-full sm:w-auto">
                Add for {WEEKDAY_OPTIONS.find((option) => option.value === day)?.label}
              </Button>
              <Button
                onClick={handleAddAllWeekRule}
                disabled={!isTimeRangeValid}
                variant="outline"
                className="w-full sm:w-auto"
              >
                Block {allWeekRangeLabel} all week
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Applies to {scopeLabel}.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">
              Current rules for {activityScope === 'all' ? 'all activities' : activityScope}
            </p>
            <Badge variant="secondary">{activityScope === 'all' ? allActivityRules.length : rules.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Weekly recurring windows. Select one activity to inspect it, or All activities to bulk-edit every profile.
          </p>
        </div>

        {activityScope === 'all' ? (
          <AllActivityRulesList rules={allActivityRules} onRemoveRule={handleRemoveRule} />
        ) : rules.length === 0 ? (
          <Card className="border-dashed border-border/60 bg-transparent shadow-none">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No blocked windows for this activity yet.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <Card key={rule.id} className="border-border/60 shadow-none">
                <CardContent className="flex items-center justify-between gap-4 py-4">
                  <div>
                    <p className="text-sm font-medium">{formatBlockedTimeRule(rule)}</p>
                    <p className="text-xs text-muted-foreground">Applied every week for {activityScope} scheduling.</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRule(rule, activityScope)}
                    aria-label={`Remove ${formatBlockedTimeRule(rule)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ActivityScopeSelector({
  selected,
  onSelect,
}: {
  selected: ActivityScope
  onSelect: (activityScope: ActivityScope) => void
}) {
  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant={selected === 'all' ? 'default' : 'outline'}
        className="w-full justify-start"
        onClick={() => onSelect('all')}
      >
        All activities
      </Button>
      <ActivitySelector
        selected={selected === 'all' ? null : selected}
        onSelect={onSelect}
        size="sm"
        className={cn(selected === 'all' && 'opacity-75')}
      />
    </div>
  )
}

function AllActivityRulesList({
  rules,
  onRemoveRule,
}: {
  rules: Array<{ activity: Activity; rule: BlockedTimeRule }>
  onRemoveRule: (rule: BlockedTimeRule, activity: Activity) => void
}) {
  if (rules.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-transparent shadow-none">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No blocked windows for any activity yet.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {rules.map(({ activity, rule }) => (
        <Card key={`${activity}-${rule.id}`} className="border-border/60 shadow-none">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Badge variant="outline" className="capitalize">{activity}</Badge>
                <p className="text-sm font-medium">{formatBlockedTimeRule(rule)}</p>
              </div>
              <p className="text-xs text-muted-foreground">Applied every week for {activity} scheduling.</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onRemoveRule(rule, activity)}
              aria-label={`Remove ${formatBlockedTimeRule(rule)} for ${activity}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function WeeklyBlockGrid({
  blockedCells,
  partiallyBlockedCells,
  onCellPointerDown,
  onCellPointerEnter,
}: {
  blockedCells: Set<string>
  partiallyBlockedCells: Set<string>
  onCellPointerDown: (cellKey: string, isBlocked: boolean) => void
  onCellPointerEnter: (cellKey: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium">Weekly block painter</p>
          <p className="text-xs text-muted-foreground">
            Click or drag to block. Drag red cells again to unblock.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-3 w-3 rounded-sm border border-red-500/60 bg-red-500/80" />
          Blocked
          {partiallyBlockedCells.size > 0 && (
            <>
              <span className="ml-2 h-3 w-3 rounded-sm border border-amber-500/50 bg-amber-500/40" />
              Some activities
            </>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-background shadow-sm">
        <div className="grid grid-cols-[3.5rem_repeat(7,minmax(3rem,1fr))] border-b border-border/60 bg-muted/40 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <div className="border-r border-border/60 px-2 py-2 text-left">Time</div>
          {WEEKDAY_OPTIONS.map((option) => (
            <div key={option.value} className="border-r border-border/60 px-2 py-2 last:border-r-0">
              <span className="hidden sm:inline">{option.label.slice(0, 3)}</span>
              <span className="sm:hidden">{option.label.slice(0, 1)}</span>
            </div>
          ))}
        </div>

        <div className="max-h-[32rem] overflow-y-auto select-none touch-none">
          <div className="grid grid-cols-[3.5rem_repeat(7,minmax(3rem,1fr))]">
            {GRID_SLOTS.map((slot) => (
              <TimeSlotRow
                key={slot.startTime}
                slot={slot}
                blockedCells={blockedCells}
                partiallyBlockedCells={partiallyBlockedCells}
                onCellPointerDown={onCellPointerDown}
                onCellPointerEnter={onCellPointerEnter}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function TimeSlotRow({
  slot,
  blockedCells,
  partiallyBlockedCells,
  onCellPointerDown,
  onCellPointerEnter,
}: {
  slot: (typeof GRID_SLOTS)[number]
  blockedCells: Set<string>
  partiallyBlockedCells: Set<string>
  onCellPointerDown: (cellKey: string, isBlocked: boolean) => void
  onCellPointerEnter: (cellKey: string) => void
}) {
  const isHour = slot.startTime.endsWith(':00')

  return (
    <>
      <div
        className={cn(
          'border-r border-border/60 px-2 text-[11px] tabular-nums text-muted-foreground',
          isHour ? 'border-t border-border/60 pt-1.5' : 'border-t border-border/30',
        )}
      >
        {slot.label}
      </div>
      {WEEKDAY_OPTIONS.map((dayOption) => {
        const cellKey = buildCellKey(dayOption.value, slot.index)
        const isBlocked = blockedCells.has(cellKey)
        const isPartiallyBlocked = partiallyBlockedCells.has(cellKey)

        return (
          <button
            key={cellKey}
            type="button"
            aria-label={`${isBlocked ? 'Unblock' : 'Block'} ${dayOption.label} ${slot.startTime} to ${slot.endTime}`}
            aria-pressed={isBlocked}
            className={cn(
              'h-7 border-r border-t border-border/50 transition-colors last:border-r-0 focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isHour ? 'border-t-border/70' : 'border-t-border/35',
              isBlocked
                ? 'bg-red-500/80 hover:bg-red-500 dark:bg-red-500/70 dark:hover:bg-red-500'
                : isPartiallyBlocked
                  ? 'bg-amber-500/35 hover:bg-red-500/25'
                : 'bg-background hover:bg-red-500/15',
            )}
            onPointerDown={(event) => {
              event.preventDefault()
              onCellPointerDown(cellKey, isBlocked)
            }}
            onPointerEnter={() => onCellPointerEnter(cellKey)}
          />
        )
      })}
    </>
  )
}

function buildCellKey(day: WeekdayKey, slotIndex: number) {
  return `${day}:${slotIndex}`
}

function parseCellKey(cellKey: string) {
  const [day, slotIndex] = cellKey.split(':')
  return {
    day: day as WeekdayKey,
    slotIndex: Number(slotIndex),
  }
}

function minutesToTimeString(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function rulesToBlockedCells(rules: BlockedTimeRule[]) {
  const cells = new Set<string>()
  for (const rule of rules) {
    const startSlot = Math.max(
      0,
      Math.floor((timeStringToMinutes(rule.startTime) - GRID_START_HOUR * 60) / SLOT_MINUTES),
    )
    const endSlot = Math.min(
      GRID_SLOTS.length,
      Math.ceil((timeStringToMinutes(rule.endTime) - GRID_START_HOUR * 60) / SLOT_MINUTES),
    )

    for (let slotIndex = startSlot; slotIndex < endSlot; slotIndex += 1) {
      cells.add(buildCellKey(rule.day, slotIndex))
    }
  }
  return cells
}

function buildCellsByActivity(preferences: UserPreferences) {
  return ACTIVITIES.reduce(
    (cellsByActivity, activity) => ({
      ...cellsByActivity,
      [activity]: rulesToBlockedCells(preferences.blockedTimeRules[activity] ?? []),
    }),
    {} as Record<Activity, Set<string>>,
  )
}

function getBlockedCellCoverage(preferences: UserPreferences, activityScope: ActivityScope) {
  if (activityScope !== 'all') {
    return {
      blockedCells: rulesToBlockedCells(preferences.blockedTimeRules[activityScope] ?? []),
      partiallyBlockedCells: new Set<string>(),
    }
  }

  const cellCounts = new Map<string, number>()
  for (const activity of ACTIVITIES) {
    for (const cellKey of rulesToBlockedCells(preferences.blockedTimeRules[activity] ?? [])) {
      cellCounts.set(cellKey, (cellCounts.get(cellKey) ?? 0) + 1)
    }
  }

  const blockedCells = new Set<string>()
  const partiallyBlockedCells = new Set<string>()
  for (const [cellKey, count] of cellCounts) {
    if (count === ACTIVITIES.length) {
      blockedCells.add(cellKey)
    } else {
      partiallyBlockedCells.add(cellKey)
    }
  }

  return { blockedCells, partiallyBlockedCells }
}

function blockedCellsToRules(cells: Set<string>) {
  const slotsByDay = new Map<WeekdayKey, number[]>()
  for (const cellKey of cells) {
    const { day, slotIndex } = parseCellKey(cellKey)
    slotsByDay.set(day, [...(slotsByDay.get(day) ?? []), slotIndex])
  }

  const rules: BlockedTimeRule[] = []
  for (const { value: day } of WEEKDAY_OPTIONS) {
    const slots = [...(slotsByDay.get(day) ?? [])].sort((a, b) => a - b)
    let runStart: number | null = null
    let previousSlot: number | null = null

    for (const slotIndex of slots) {
      if (runStart === null) {
        runStart = slotIndex
        previousSlot = slotIndex
        continue
      }

      if (previousSlot !== null && slotIndex === previousSlot + 1) {
        previousSlot = slotIndex
        continue
      }

      rules.push(buildRuleFromSlots(day, runStart, previousSlot ?? runStart))
      runStart = slotIndex
      previousSlot = slotIndex
    }

    if (runStart !== null) {
      rules.push(buildRuleFromSlots(day, runStart, previousSlot ?? runStart))
    }
  }

  return sortRules(rules)
}

function buildRuleFromSlots(day: WeekdayKey, startSlot: number, endSlot: number): BlockedTimeRule {
  const startMinutes = GRID_START_HOUR * 60 + startSlot * SLOT_MINUTES
  const endMinutes = GRID_START_HOUR * 60 + (endSlot + 1) * SLOT_MINUTES

  return {
    id: `${day}-${minutesToTimeString(startMinutes)}-${minutesToTimeString(endMinutes)}`,
    day,
    startTime: minutesToTimeString(startMinutes),
    endTime: minutesToTimeString(endMinutes),
  }
}
