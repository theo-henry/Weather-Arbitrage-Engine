"use client"

import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { ActivitySelector } from '@/components/activity-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  formatBlockedTimeRule,
  removeBlockedTimeRule,
  upsertBlockedTimeRule,
} from '@/lib/preferences'
import type { Activity, BlockedTimeRule, UserPreferences, WeekdayKey } from '@/lib/types'

interface SchedulingRulesPanelProps {
  preferences: UserPreferences
  onPreferencesChange: (preferences: UserPreferences) => void
}

const WEEKDAY_OPTIONS: Array<{ value: WeekdayKey; label: string }> = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
]

const TIME_OPTIONS = Array.from({ length: 48 }, (_, index) => {
  const hours = Math.floor(index / 2)
  const minutes = index % 2 === 0 ? '00' : '30'
  return `${hours.toString().padStart(2, '0')}:${minutes}`
})

export function SchedulingRulesPanel({
  preferences,
  onPreferencesChange,
}: SchedulingRulesPanelProps) {
  const [activity, setActivity] = useState<Activity>(preferences.activity)
  const [day, setDay] = useState<WeekdayKey>('mon')
  const [startTime, setStartTime] = useState('07:00')
  const [endTime, setEndTime] = useState('09:00')

  useEffect(() => {
    setActivity(preferences.activity)
  }, [preferences.activity])

  const rules = useMemo(() => preferences.blockedTimeRules[activity] ?? [], [activity, preferences.blockedTimeRules])
  const isTimeRangeValid = startTime < endTime

  const updateRules = (nextRules: BlockedTimeRule[]) => {
    onPreferencesChange({
      ...preferences,
      blockedTimeRules: {
        ...preferences.blockedTimeRules,
        [activity]: nextRules,
      },
    })
  }

  const handleAddRule = () => {
    if (!isTimeRangeValid) return
    updateRules(upsertBlockedTimeRule(rules, { day, startTime, endTime }))
  }

  const handleRemoveRule = (rule: BlockedTimeRule) => {
    updateRules(removeBlockedTimeRule(rules, rule))
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-muted/20 shadow-none">
        <CardHeader>
          <CardTitle className="text-base">Blocked Scheduling Windows</CardTitle>
          <CardDescription>
            These are hard constraints. The scheduler and chatbot will avoid proposing these windows for the selected activity.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Activity
            </Label>
            <ActivitySelector selected={activity} onSelect={setActivity} size="sm" />
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

          {!isTimeRangeValid && (
            <p className="text-sm text-red-600 dark:text-red-300">End time must be later than start time.</p>
          )}

          <Button onClick={handleAddRule} disabled={!isTimeRangeValid} className="w-full sm:w-auto">
            Add blocked window
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Current rules for {activity}</p>
          <p className="text-xs text-muted-foreground">
            Weekly recurring windows. Remove a rule here if you want the assistant to use that time again.
          </p>
        </div>

        {rules.length === 0 ? (
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
                    <p className="text-xs text-muted-foreground">Applied every week for {activity} scheduling.</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRule(rule)}
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
