'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { getDefaultUserPreferences, normalizeUserPreferences } from '@/lib/preferences'
import type { UserPreferences } from '@/lib/types'
import { useUser } from '@/hooks/use-user'

type PreferencesSetter = (
  next: UserPreferences | ((prev: UserPreferences) => UserPreferences),
) => void

interface PreferencesContextValue {
  preferences: UserPreferences
  setPreferences: PreferencesSetter
  ready: boolean
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null)

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()
  const [preferences, setPreferencesState] = useState<UserPreferences>(() => getDefaultUserPreferences())
  const [ready, setReady] = useState(false)
  const hydrated = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (loading) {
      setReady(false)
      return
    }

    if (!user) {
      hydrated.current = true
      setPreferencesState(getDefaultUserPreferences())
      setReady(true)
      return
    }

    hydrated.current = false
    setReady(false)
    let cancelled = false

    fetch('/api/preferences')
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return
        setPreferencesState(normalizeUserPreferences(data?.preferences))
        hydrated.current = true
        setReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setPreferencesState(getDefaultUserPreferences())
        hydrated.current = true
        setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [user, loading])

  const setPreferences = useCallback<PreferencesSetter>(
    (next) => {
      setPreferencesState((prev) => {
        const value = normalizeUserPreferences(
          typeof next === 'function' ? (next as (current: UserPreferences) => UserPreferences)(prev) : next,
        )

        if (user && hydrated.current) {
          if (saveTimer.current) clearTimeout(saveTimer.current)
          saveTimer.current = setTimeout(() => {
            fetch('/api/preferences', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ preferences: value }),
            }).catch(() => {})
          }, 300)
        }

        return value
      })
    },
    [user],
  )

  const value = useMemo(
    () => ({
      preferences,
      setPreferences,
      ready,
    }),
    [preferences, setPreferences, ready],
  )

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
}

export function usePreferences(): [UserPreferences, PreferencesSetter, boolean] {
  const context = useContext(PreferencesContext)
  if (!context) {
    throw new Error('usePreferences must be used within PreferencesProvider')
  }

  return [context.preferences, context.setPreferences, context.ready]
}
