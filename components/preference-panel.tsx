"use client"

import { motion } from 'framer-motion'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ActivitySelector } from '@/components/activity-selector'
import type { Activity, City, UserPreferences, Sensitivity, TimeBias } from '@/lib/types'
import { CITIES } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PreferencePanelProps {
  preferences: UserPreferences
  onPreferencesChange: (prefs: UserPreferences) => void
  onFindEdge: () => void
  className?: string
}

export function PreferencePanel({
  preferences,
  onPreferencesChange,
  onFindEdge,
  className,
}: PreferencePanelProps) {
  const updatePref = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    onPreferencesChange({ ...preferences, [key]: value })
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Activity Selector */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
          Activity
        </Label>
        <ActivitySelector
          selected={preferences.activity}
          onSelect={(activity) => updatePref('activity', activity)}
          size="sm"
        />
      </div>

      {/* City Selector */}
      <div>
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
          City
        </Label>
        <Select
          value={preferences.city}
          onValueChange={(value) => updatePref('city', value as City)}
        >
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

      {/* Dynamic Preferences based on activity */}
      <motion.div
        key={preferences.activity}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5 pt-4 border-t border-border/50"
      >
        {/* Run preferences */}
        {preferences.activity === 'run' && (
          <>
            <div>
              <div className="flex justify-between mb-3">
                <Label className="text-sm">Performance vs Comfort</Label>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {preferences.performanceVsComfort ?? 75}%
                </span>
              </div>
              <Slider
                value={[preferences.performanceVsComfort ?? 75]}
                onValueChange={([value]) => updatePref('performanceVsComfort', value)}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Comfort</span>
                <span>Performance</span>
              </div>
            </div>

            <div>
              <Label className="text-sm mb-3 block">Wind Sensitivity</Label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as Sensitivity[]).map((level) => (
                  <Button
                    key={level}
                    variant={preferences.windSensitivity === level ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => updatePref('windSensitivity', level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-3 block">Rain Avoidance</Label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as Sensitivity[]).map((level) => (
                  <Button
                    key={level}
                    variant={preferences.rainAvoidance === level ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => updatePref('rainAvoidance', level)}
                  >
                    {level}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-sm mb-3 block">Time Preference</Label>
              <div className="flex gap-2">
                {(['morning', 'neutral', 'evening'] as TimeBias[]).map((bias) => (
                  <Button
                    key={bias}
                    variant={preferences.timeBias === bias ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => updatePref('timeBias', bias)}
                  >
                    {bias}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Study preferences */}
        {preferences.activity === 'study' && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Prefer Cooler Temperature</Label>
              <Switch
                checked={preferences.preferCool ?? false}
                onCheckedChange={(checked) => updatePref('preferCool', checked)}
              />
            </div>

            <div>
              <div className="flex justify-between mb-3">
                <Label className="text-sm">Daylight Preference</Label>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {preferences.daylightPreference ?? 50}%
                </span>
              </div>
              <Slider
                value={[preferences.daylightPreference ?? 50]}
                onValueChange={([value]) => updatePref('daylightPreference', value)}
                max={100}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Low light</span>
                <span>Bright light</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Distraction Sensitive</Label>
              <Switch
                checked={preferences.distractionSensitivity ?? false}
                onCheckedChange={(checked) => updatePref('distractionSensitivity', checked)}
              />
            </div>
          </>
        )}

        {/* Social preferences */}
        {preferences.activity === 'social' && (
          <>
            <div>
              <div className="flex justify-between mb-3">
                <Label className="text-sm">Warmth Preference</Label>
                <span className="text-sm text-muted-foreground tabular-nums">
                  {preferences.warmthPreference ?? 50}%
                </span>
              </div>
              <Slider
                value={[preferences.warmthPreference ?? 50]}
                onValueChange={([value]) => updatePref('warmthPreference', value)}
                max={100}
                step={10}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Cooler</span>
                <span>Warmer</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-sm">Sunset Bonus</Label>
              <Switch
                checked={preferences.sunsetBonus ?? true}
                onCheckedChange={(checked) => updatePref('sunsetBonus', checked)}
              />
            </div>
          </>
        )}

        {/* Flight preferences */}
        {preferences.activity === 'flight' && (
          <div>
            <Label className="text-sm mb-3 block">Turbulence Sensitivity</Label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as Sensitivity[]).map((level) => (
                <Button
                  key={level}
                  variant={preferences.turbulenceSensitivity === level ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 capitalize"
                  onClick={() => updatePref('turbulenceSensitivity', level)}
                >
                  {level}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Photo preferences */}
        {preferences.activity === 'photo' && (
          <>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Golden Hour Priority</Label>
              <Switch
                checked={preferences.goldenHourPriority ?? true}
                onCheckedChange={(checked) => updatePref('goldenHourPriority', checked)}
              />
            </div>

            <div>
              <Label className="text-sm mb-3 block">Cloud Preference</Label>
              <div className="flex gap-2">
                {(['clear', 'dramatic'] as const).map((pref) => (
                  <Button
                    key={pref}
                    variant={preferences.cloudPreference === pref ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1 capitalize"
                    onClick={() => updatePref('cloudPreference', pref)}
                  >
                    {pref}
                  </Button>
                ))}
              </div>
            </div>
          </>
        )}
      </motion.div>

      {/* Usual Time */}
      <div className="pt-4 border-t border-border/50">
        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 block">
          Your Usual Time
        </Label>
        <Select
          value={preferences.usualTime}
          onValueChange={(value) => updatePref('usualTime', value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select time" />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 24 }, (_, i) => {
              const time = `${i.toString().padStart(2, '0')}:00`
              return (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Find Edge Button */}
      <Button 
        onClick={onFindEdge}
        className="w-full relative overflow-hidden group"
        size="lg"
      >
        <span className="relative z-10 font-semibold">Find My Edge</span>
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Button>
    </div>
  )
}
