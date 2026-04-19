'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserPreferences } from '@/lib/types'
import { useUser } from '@/hooks/use-user'

const DEFAULT_PREFERENCES: UserPreferences = {
  activity: 'run',
  city: 'Madrid',
  usualTime: '17:00',
  performanceVsComfort: 75,
  windSensitivity: 'high',
  rainAvoidance: 'medium',
  timeBias: 'evening',
  sunsetBonus: true,
  goldenHourPriority: true,
}

export function usePreferences(): [
  UserPreferences,
  (next: UserPreferences | ((prev: UserPreferences) => UserPreferences)) => void,
] {
  const { user, loading } = useUser()
  const [prefs, setPrefsState] = useState<UserPreferences>(DEFAULT_PREFERENCES)
  const hydrated = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      hydrated.current = true
      return
    }
    let cancelled = false
    fetch('/api/preferences')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data?.preferences) setPrefsState(data.preferences)
        hydrated.current = true
      })
      .catch(() => {
        hydrated.current = true
      })
    return () => {
      cancelled = true
    }
  }, [user, loading])

  const setPrefs = useCallback(
    (next: UserPreferences | ((prev: UserPreferences) => UserPreferences)) => {
      setPrefsState((prev) => {
        const value = typeof next === 'function' ? (next as (p: UserPreferences) => UserPreferences)(prev) : next
        if (user && hydrated.current) {
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => {
            fetch('/api/preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ preferences: value }),
            }).catch(() => {})
          }, 400)
        }
        return value
      })
    },
    [user],
  )

  return [prefs, setPrefs]
}
