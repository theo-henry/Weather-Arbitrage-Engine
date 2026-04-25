"use client"

import { motion } from 'framer-motion'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ActivitySelector } from '@/components/activity-selector'
import type {
  Activity,
  ActivityPreferenceProfile,
  ActivityWeatherComfort,
  City,
  TimeBias,
  UserPreferences,
} from '@/lib/types'
import { CITIES } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PreferencePanelProps {
  preferences: UserPreferences
  onPreferencesChange: (prefs: UserPreferences) => void
  onFindEdge?: () => void
  showFindEdge?: boolean
  className?: string
}

export function PreferencePanel({
  preferences,
  onPreferencesChange,
  onFindEdge,
  showFindEdge = true,
  className,
}: PreferencePanelProps) {
  const activeActivity = preferences.activity
  const activeProfile = preferences.activityProfiles[activeActivity]
  const activeComfort = activeProfile.comfort ?? {
    minTemperature: 10,
    maxTemperature: 26,
    maxWindSpeed: 20,
    maxPrecipitationProbability: 25,
  }

  const updatePreferences = (patch: Partial<UserPreferences>) => {
    onPreferencesChange({ ...preferences, ...patch })
  }

  const updateProfile = (
    patch: Partial<ActivityPreferenceProfile> & { comfort?: Partial<ActivityWeatherComfort> },
  ) => {
    onPreferencesChange({
      ...preferences,
      activityProfiles: {
        ...preferences.activityProfiles,
        [activeActivity]: {
          ...activeProfile,
          ...patch,
          comfort: patch.comfort
            ? {
                ...activeProfile.comfort,
                ...patch.comfort,
              }
            : activeProfile.comfort,
        },
      },
    })
  }

  const updateComfort = (patch: Partial<ActivityWeatherComfort>) => {
    updateProfile({
      comfort: {
        ...activeComfort,
        ...patch,
      },
    })
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div>
        <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Activity
        </Label>
        <ActivitySelector
          selected={preferences.activity}
          onSelect={(activity) => updatePreferences({ activity })}
          size="sm"
        />
      </div>

      <div>
        <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          City
        </Label>
        <Select value={preferences.city} onValueChange={(value) => updatePreferences({ city: value as City })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a city" />
          </SelectTrigger>
          <SelectContent>
            {CITIES.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <motion.div
        key={preferences.activity}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 border-t border-border/50 pt-4"
      >
        {preferences.activity === 'run' && (
          <>
            <div>
              <div className="mb-3 flex justify-between">
                <Label className="text-sm">Performance vs Comfort</Label>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {activeProfile.performanceVsComfort ?? 75}%
                </span>
              </div>
              <Slider
                value={[activeProfile.performanceVsComfort ?? 75]}
                onValueChange={([value]) => updateProfile({ performanceVsComfort: value })}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>Comfort</span>
                <span>Performance</span>
              </div>
            </div>

            <SegmentedPreferenceRow
              label="Wind Sensitivity"
              options={['low', 'medium', 'high']}
              value={activeProfile.windSensitivity ?? 'high'}
              onChange={(value) => updateProfile({ windSensitivity: value as ActivityPreferenceProfile['windSensitivity'] })}
            />

            <SegmentedPreferenceRow
              label="Rain Avoidance"
              options={['low', 'medium', 'high']}
              value={activeProfile.rainAvoidance ?? 'medium'}
              onChange={(value) => updateProfile({ rainAvoidance: value as ActivityPreferenceProfile['rainAvoidance'] })}
            />

            <SegmentedPreferenceRow
              label="Time Preference"
              options={['morning', 'neutral', 'evening']}
              value={activeProfile.timeBias ?? 'evening'}
              onChange={(value) => updateProfile({ timeBias: value as TimeBias })}
            />
          </>
        )}

        {preferences.activity === 'study' && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Prefer Cooler Temperature</Label>
              <Switch
                checked={activeProfile.preferCool ?? false}
                onCheckedChange={(checked) => updateProfile({ preferCool: checked })}
              />
            </div>

            <LabeledSlider
              label="Daylight Preference"
              value={activeProfile.daylightPreference ?? 50}
              minLabel="Low light"
              maxLabel="Bright light"
              step={10}
              onChange={(value) => updateProfile({ daylightPreference: value })}
            />

            <div className="flex items-center justify-between">
              <Label className="text-sm">Distraction Sensitive</Label>
              <Switch
                checked={activeProfile.distractionSensitivity ?? false}
                onCheckedChange={(checked) => updateProfile({ distractionSensitivity: checked })}
              />
            </div>
          </>
        )}

        {preferences.activity === 'social' && (
          <>
            <LabeledSlider
              label="Warmth Preference"
              value={activeProfile.warmthPreference ?? 50}
              minLabel="Cooler"
              maxLabel="Warmer"
              step={10}
              onChange={(value) => updateProfile({ warmthPreference: value })}
            />

            <div className="flex items-center justify-between">
              <Label className="text-sm">Sunset Bonus</Label>
              <Switch
                checked={activeProfile.sunsetBonus ?? true}
                onCheckedChange={(checked) => updateProfile({ sunsetBonus: checked })}
              />
            </div>
          </>
        )}

        {preferences.activity === 'commute' && (
          <>
            <SegmentedPreferenceRow
              label="Commute Mode"
              options={['car', 'bike', 'walk']}
              value={activeProfile.commuteMode ?? 'car'}
              onChange={(value) =>
                updateProfile({ commuteMode: value as ActivityPreferenceProfile['commuteMode'] })
              }
            />

            <SegmentedPreferenceRow
              label="Rain Avoidance"
              options={['low', 'medium', 'high']}
              value={activeProfile.rainAvoidance ?? 'medium'}
              onChange={(value) => updateProfile({ rainAvoidance: value as ActivityPreferenceProfile['rainAvoidance'] })}
            />

            <SegmentedPreferenceRow
              label="Wind Sensitivity"
              options={['low', 'medium', 'high']}
              value={activeProfile.windSensitivity ?? 'medium'}
              onChange={(value) => updateProfile({ windSensitivity: value as ActivityPreferenceProfile['windSensitivity'] })}
            />

            {(activeProfile.commuteMode === 'bike' || activeProfile.commuteMode === 'walk') && (
              <LabeledSlider
                label="Daylight Preference"
                value={activeProfile.daylightPreference ?? 50}
                minLabel="Flexible"
                maxLabel="Daylight only"
                step={10}
                onChange={(value) => updateProfile({ daylightPreference: value })}
              />
            )}
          </>
        )}

        {preferences.activity === 'photo' && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Golden Hour Priority</Label>
              <Switch
                checked={activeProfile.goldenHourPriority ?? true}
                onCheckedChange={(checked) => updateProfile({ goldenHourPriority: checked })}
              />
            </div>

            <SegmentedPreferenceRow
              label="Cloud Preference"
              options={['clear', 'dramatic']}
              value={activeProfile.cloudPreference ?? 'dramatic'}
              onChange={(value) => updateProfile({ cloudPreference: value as ActivityPreferenceProfile['cloudPreference'] })}
            />
          </>
        )}

        {preferences.activity === 'custom' && (
          <SegmentedPreferenceRow
            label="Time Preference"
            options={['morning', 'neutral', 'evening']}
            value={activeProfile.timeBias ?? 'neutral'}
            onChange={(value) => updateProfile({ timeBias: value as TimeBias })}
          />
        )}

        <div className="space-y-4 rounded-2xl border border-border/60 bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium">Weather Comfort</p>
            <p className="text-xs text-muted-foreground">
              Suggestions will heavily penalize slots outside this comfort envelope.
            </p>
          </div>

          <div>
            <div className="mb-3 flex justify-between">
              <Label className="text-sm">Comfortable Temperature</Label>
              <span className="text-sm tabular-nums text-muted-foreground">
                {activeComfort?.minTemperature ?? 0}°C to {activeComfort?.maxTemperature ?? 0}°C
              </span>
            </div>
            <Slider
              value={[activeComfort?.minTemperature ?? 0, activeComfort?.maxTemperature ?? 30]}
              onValueChange={([minTemperature, maxTemperature]) => updateComfort({ minTemperature, maxTemperature })}
              min={-5}
              max={40}
              step={1}
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>Colder</span>
              <span>Warmer</span>
            </div>
          </div>

          {preferences.activity !== 'study' && (
            <>
              <LabeledSlider
                label="Maximum Wind"
                value={activeComfort?.maxWindSpeed ?? 20}
                min={0}
                max={60}
                step={1}
                suffix=" km/h"
                onChange={(value) => updateComfort({ maxWindSpeed: value })}
              />

              <LabeledSlider
                label="Maximum Rain Chance"
                value={activeComfort?.maxPrecipitationProbability ?? 25}
                min={0}
                max={100}
                step={5}
                suffix="%"
                onChange={(value) => updateComfort({ maxPrecipitationProbability: value })}
              />
            </>
          )}
        </div>
      </motion.div>

      <div className="border-t border-border/50 pt-4">
        <Label className="mb-3 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Usual Time
        </Label>
        <Select value={preferences.usualTime} onValueChange={(value) => updatePreferences({ usualTime: value })}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 24 }, (_, index) => {
              const time = `${index.toString().padStart(2, '0')}:00`
              return (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {showFindEdge && onFindEdge && (
        <Button onClick={onFindEdge} className="group relative w-full overflow-hidden" size="lg">
          <span className="relative z-10 font-semibold">Find My Edge</span>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 opacity-0 transition-opacity group-hover:opacity-100" />
        </Button>
      )}
    </div>
  )
}

function SegmentedPreferenceRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <Label className="mb-3 block text-sm">{label}</Label>
      <div className="flex gap-2">
        {options.map((option) => (
          <Button
            key={option}
            variant={value === option ? 'default' : 'outline'}
            size="sm"
            className="flex-1 capitalize"
            onClick={() => onChange(option)}
          >
            {option.replace('_', ' ')}
          </Button>
        ))}
      </div>
    </div>
  )
}

function LabeledSlider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  minLabel,
  maxLabel,
  suffix = '',
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  minLabel?: string
  maxLabel?: string
  suffix?: string
}) {
  return (
    <div>
      <div className="mb-3 flex justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm tabular-nums text-muted-foreground">
          {value}
          {suffix}
        </span>
      </div>
      <Slider value={[value]} onValueChange={([next]) => onChange(next)} min={min} max={max} step={step} />
      {(minLabel || maxLabel) && (
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  )
}
