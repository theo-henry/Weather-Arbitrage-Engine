"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CalendarCheck, Send, Sparkles } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { ComparisonCard } from '@/components/comparison-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CalendarStoreProvider, useCalendarStore } from '@/hooks/use-calendar-store'
import { usePreferences } from '@/hooks/use-preferences'
import { useWeatherData } from '@/hooks/use-weather-data'
import { isTimeRangeBlockedForAnyActivity } from '@/lib/preferences'
import { applyPreferenceScoresToWindows } from '@/lib/scoring'
import type {
  Activity,
  AssistantRequest,
  AssistantResponse,
  CalendarEvent,
  ChatMessage,
  CompareRecommendation,
  PendingCalendarOperation,
  TimeWindow,
  UserPreferences,
} from '@/lib/types'
import { cn } from '@/lib/utils'

type ScoredActivity = Exclude<Activity, 'custom'>

interface ActivityMeta {
  label: string
  color: CalendarEvent['color']
  defaultTitle: string
}

const ACTIVITY_META: Record<Activity, ActivityMeta> = {
  run: { label: 'Run / Workout', color: 'green', defaultTitle: 'Outdoor Workout' },
  photo: { label: 'Photo walk', color: 'violet', defaultTitle: 'Photo Walk' },
  social: { label: 'Social outing', color: 'amber', defaultTitle: 'Outdoor Plan' },
  study: { label: 'Study session', color: 'blue', defaultTitle: 'Study Session' },
  commute: { label: 'Commute', color: 'blue', defaultTitle: 'Commute' },
  custom: { label: 'Activity', color: 'blue', defaultTitle: 'Outdoor Activity' },
}

const CARD_VARIANTS: Array<'best' | 'usual' | 'alternate'> = ['best', 'usual', 'alternate']
const CARD_LABELS = ['Top Pick', 'Runner-Up', 'Alternative']

const suggestedPrompts = [
  'Best time for tennis tomorrow afternoon',
  'Outdoor dinner with friends Friday evening',
  'Is noon tomorrow good for a run?',
  'Best photo walk this week',
]

function createMessage(
  role: ChatMessage['role'],
  content: string,
  extras: Partial<ChatMessage> = {},
): ChatMessage {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    role,
    content,
    timestamp: new Date(),
    ...extras,
  }
}

function isConfirmationText(value: string) {
  const lower = value.trim().toLowerCase()
  return lower === 'yes' || lower.includes('confirm') || lower.includes('apply') || lower.includes('do it') || lower.includes('yes,')
}

function isCancelText(value: string) {
  const lower = value.trim().toLowerCase()
  return lower === 'no' || lower.includes('cancel') || lower.includes("don't") || lower.includes('do not')
}

function stripPendingDecorators(messages: ChatMessage[]) {
  return messages.map((message) =>
    message.pendingOperations || message.requiresConfirmation
      ? {
          ...message,
          pendingOperations: null,
          requiresConfirmation: false,
        }
      : message,
  )
}

function getWindowStart(window: TimeWindow): Date {
  const date = new Date(window.date)
  const [hour, minute] = window.startTime.split(':').map(Number)
  date.setHours(hour, minute, 0, 0)
  return date
}

function getWindowEnd(window: TimeWindow): Date {
  const date = new Date(window.date)
  const [hour, minute] = window.endTime.split(':').map(Number)
  date.setHours(hour, minute, 0, 0)
  return date
}

function formatLocalTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function recommendationToWindows(
  recommendation: CompareRecommendation | null,
  windows: TimeWindow[],
  preferences: UserPreferences,
  timezone: string,
) {
  if (!recommendation?.slots.length) return []
  const byId = new Map(windows.map((window) => [window.id, window]))
  const activity = recommendation.scoredActivity

  return recommendation.slots
    .map((slot) => {
      const window = slot.windowIds.map((id) => byId.get(id)).find((item): item is TimeWindow => !!item)
      if (!window || !activity) return null

      const startTime = new Date(slot.startTime)
      const endTime = new Date(slot.endTime)
      if (isTimeRangeBlockedForAnyActivity(preferences, startTime, endTime, timezone)) return null

      return {
        ...window,
        startTime: formatLocalTime(startTime, timezone),
        endTime: formatLocalTime(endTime, timezone),
      }
    })
    .filter((window): window is TimeWindow => !!window)
}

function buildEventFromWindow(
  window: TimeWindow,
  activity: ScoredActivity,
  recommendation: CompareRecommendation | null,
  eventId: string,
): CalendarEvent {
  const meta = ACTIVITY_META[activity]
  const slot = recommendation?.slots.find((candidate) => candidate.windowIds.includes(window.id))
  const start = slot?.startTime ? new Date(slot.startTime) : getWindowStart(window)
  const end = slot?.endTime ? new Date(slot.endTime) : getWindowEnd(window)
  const label = recommendation?.requestedActivityLabel?.trim()

  return {
    id: eventId,
    title: label ? label[0].toUpperCase() + label.slice(1) : meta.defaultTitle,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    category: activity === 'study' ? 'indoor' : 'weather-sensitive',
    activity,
    color: meta.color,
    location: window.location,
    weatherScore: slot?.score ?? window.scores[activity],
    createdVia: 'compare',
    suggestedAlternative: null,
  }
}

function CompareContent() {
  const router = useRouter()
  const { state, dispatch } = useCalendarStore()
  const [preferences, setPreferences] = usePreferences()
  const { windows: rawWindows } = useWeatherData(preferences.city)
  const windows = useMemo(
    () => applyPreferenceScoresToWindows(rawWindows, preferences),
    [rawWindows, preferences],
  )

  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      `Tell me what you want to do, and I’ll compare the best weather windows for it. You can be specific, like “tennis tomorrow afternoon” or “outdoor dinner Friday evening.”`,
    ),
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<PendingCalendarOperation[] | null>(null)
  const [recommendation, setRecommendation] = useState<CompareRecommendation | null>(null)
  const [scheduledEventId, setScheduledEventId] = useState<string | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

  const topWindows = useMemo(
    () => recommendationToWindows(recommendation, windows, preferences, timezone),
    [recommendation, preferences, timezone, windows],
  )
  const scoredActivity = recommendation?.scoredActivity

  const applyPendingOperations = (operations: PendingCalendarOperation[]) => {
    for (const operation of operations) {
      if (operation.type === 'create_event') {
        dispatch({
          type: 'ADD_EVENT',
          event: {
            ...operation.eventDraft,
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
          },
        })
        continue
      }

      if (operation.type === 'update_event') {
        const existingEvent = state.events.find((event) => event.id === operation.eventId)
        if (!existingEvent) continue
        dispatch({
          type: 'UPDATE_EVENT',
          event: {
            ...existingEvent,
            ...operation.changes,
          },
        })
        continue
      }

      dispatch({ type: 'DELETE_EVENT', id: operation.eventId })
    }
  }

  const sendToAssistant = async (nextMessages: ChatMessage[], activePendingOperations: PendingCalendarOperation[] | null) => {
    setIsTyping(true)

    try {
      const request: AssistantRequest = {
        mode: 'compare',
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        events: state.events,
        windows,
        city: preferences.city,
        preferences,
        now: new Date().toISOString(),
        timezone,
        pendingOperations: activePendingOperations,
      }

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      })

      const data = (await response.json()) as AssistantResponse | { error?: string }
      if (!response.ok || !('message' in data)) {
        throw new Error(('error' in data && data.error) || 'The assistant request failed.')
      }

      const assistantMessage = createMessage('assistant', data.message, {
        pendingOperations: data.pendingOperations,
        requiresConfirmation: data.requiresConfirmation,
        referencedEventIds: data.referencedEventIds,
      })

      if (data.updatedPreferences) {
        setPreferences(data.updatedPreferences)
      }

      setMessages((prev) => [...prev, assistantMessage])
      setPendingOperations(data.pendingOperations)
      if (data.compareRecommendation) {
        setRecommendation(data.compareRecommendation)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The assistant request failed.'
      setMessages((prev) => [...prev, createMessage('assistant', message, { isError: true })])
    } finally {
      setIsTyping(false)
    }
  }

  const finalizePending = (action: 'confirm' | 'cancel', originalInput?: string) => {
    if (!pendingOperations || pendingOperations.length === 0) return

    const userMessage = createMessage('user', originalInput || (action === 'confirm' ? 'Yes, apply it' : 'Cancel that'))

    if (action === 'confirm') {
      applyPendingOperations(pendingOperations)
      setMessages((prev) => [
        ...stripPendingDecorators(prev),
        userMessage,
        createMessage('assistant', 'Done. I applied that change to your calendar.'),
      ])
    } else {
      setMessages((prev) => [
        ...stripPendingDecorators(prev),
        userMessage,
        createMessage('assistant', 'Okay, I won’t make any calendar changes.'),
      ])
    }

    setPendingOperations(null)
    setInput('')
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    if (pendingOperations && pendingOperations.length > 0) {
      if (isConfirmationText(input)) {
        finalizePending('confirm', input)
        return
      }

      if (isCancelText(input)) {
        finalizePending('cancel', input)
        return
      }
    }

    const userMessage = createMessage('user', input)
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setScheduledEventId(null)
    await sendToAssistant(nextMessages, pendingOperations)
  }

  const handlePromptClick = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const handleSelectSlot = (window: TimeWindow) => {
    if (!scoredActivity || isScheduling) return
    const slot = recommendation?.slots.find((candidate) => candidate.windowIds.includes(window.id))
    const startTime = slot?.startTime ? new Date(slot.startTime) : getWindowStart(window)
    const endTime = slot?.endTime ? new Date(slot.endTime) : getWindowEnd(window)
    if (isTimeRangeBlockedForAnyActivity(preferences, startTime, endTime, timezone)) {
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', 'That slot is now blocked in your preferences, so I did not add it. Ask me for another option and I’ll only show unblocked times.'),
      ])
      setRecommendation(null)
      return
    }

    setIsScheduling(true)

    const eventId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString()
    const event = buildEventFromWindow(window, scoredActivity, recommendation, eventId)

    dispatch({ type: 'ADD_EVENT', event })
    setMessages((prev) => [
      ...prev,
      createMessage(
        'assistant',
        `Added "${event.title}" to your calendar for ${new Intl.DateTimeFormat('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        }).format(new Date(event.startTime))}.`,
      ),
    ])
    setScheduledEventId(eventId)
    setIsScheduling(false)
  }

  const handleGoToCalendar = () => {
    if (scheduledEventId) {
      try {
        sessionStorage.setItem('highlightEventId', scheduledEventId)
      } catch {}
    }
    router.push('/scheduler')
  }

  const hasActivePendingOperations = (message: ChatMessage) =>
    !!pendingOperations &&
    !!message.pendingOperations &&
    message.pendingOperations.length > 0 &&
    message.pendingOperations === pendingOperations

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="mx-auto max-w-5xl space-y-8">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Find Your Optimal Time</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ask naturally. I’ll interpret the activity, check your calendar and preferences, then compare the strongest weather windows.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-card/80">
              <div className="relative flex-shrink-0">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <motion.div
                  className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500"
                  animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                />
              </div>
              <div>
                <p className="text-sm font-semibold">Weather Planning Assistant</p>
                <p className="text-xs text-muted-foreground">LLM-powered activity matching and weather scoring</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex max-h-72 flex-col gap-3 overflow-y-auto px-4 py-4">
              <AnimatePresence initial={false}>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[84%] rounded-2xl px-4 py-2.5 text-sm',
                        message.role === 'user'
                          ? 'bg-foreground text-background rounded-br-md'
                          : message.isError
                            ? 'bg-red-500/10 text-red-700 dark:text-red-300 rounded-bl-md'
                            : 'bg-muted rounded-bl-md',
                      )}
                    >
                      <p className="whitespace-pre-wrap">{message.content}</p>

                      {message.pendingOperations && message.pendingOperations.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {message.pendingOperations.map((operation, index) => (
                            <div key={`${message.id}-${index}`} className="rounded-lg border border-border/60 bg-background/70 px-3 py-2">
                              <p className="text-xs font-medium">{operation.summary}</p>
                            </div>
                          ))}

                          {hasActivePendingOperations(message) && (
                            <div className="flex gap-2 pt-1">
                              <Button size="sm" onClick={() => finalizePending('confirm')}>
                                Confirm
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => finalizePending('cancel')}>
                                Cancel
                              </Button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 0.1, 0.2].map((delay) => (
                        <motion.div
                          key={delay}
                          className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                          animate={{ y: [0, -5, 0] }}
                          transition={{ duration: 0.5, repeat: Infinity, delay }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {!messages.some((message) => message.role === 'user') && (
              <div className="flex flex-wrap gap-2 px-4 pb-2">
                {suggestedPrompts.map((prompt) => (
                  <Badge
                    key={prompt}
                    variant="outline"
                    className="cursor-pointer px-3 py-1 transition-colors hover:bg-muted"
                    onClick={() => handlePromptClick(prompt)}
                  >
                    {prompt}
                  </Badge>
                ))}
              </div>
            )}

            <div className="px-4 py-3 border-t border-border/50 bg-card/40">
              {scheduledEventId ? (
                <Button onClick={handleGoToCalendar} className="w-full gap-2" size="lg">
                  <CalendarCheck className="h-4 w-4" />
                  Go to Calendar
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              ) : (
                <>
                  {pendingOperations && pendingOperations.length > 0 && (
                    <p className="mb-2 text-xs text-muted-foreground">
                      A calendar change is waiting for confirmation. Reply with “yes” to apply it or “cancel” to discard it.
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      ref={inputRef}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          handleSend()
                        }
                      }}
                      placeholder="Ask for an activity, time, weather tradeoff, or alternative..."
                      disabled={isTyping}
                      className="flex-1"
                      autoFocus
                    />
                    <Button onClick={handleSend} disabled={!input.trim() || isTyping}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          </motion.div>

          <AnimatePresence>
            {topWindows.length > 0 && scoredActivity && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <h2 className="text-lg font-semibold">
                    Best slots for {recommendation?.requestedActivityLabel || ACTIVITY_META[scoredActivity].label}
                  </h2>
                  {!scheduledEventId && (
                    <Badge variant="outline" className="text-xs">
                      Click a card to schedule
                    </Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {topWindows.map((window, index) => (
                    <motion.div
                      key={window.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className="flex flex-col gap-3"
                    >
                      <ComparisonCard
                        window={window}
                        activity={scoredActivity}
                        label={CARD_LABELS[index] ?? `Option ${index + 1}`}
                        variant={CARD_VARIANTS[index] ?? 'alternate'}
                      />

                      {!scheduledEventId && (
                        <Button
                          onClick={() => handleSelectSlot(window)}
                          disabled={isScheduling}
                          className={cn('w-full gap-2', index === 0 && 'bg-green-600 hover:bg-green-700 text-white')}
                          variant={index === 0 ? 'default' : 'outline'}
                        >
                          <CalendarCheck className="h-4 w-4" />
                          {isScheduling ? 'Scheduling...' : 'Choose This Slot'}
                        </Button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default function ComparePage() {
  return (
    <CalendarStoreProvider>
      <CompareContent />
    </CalendarStoreProvider>
  )
}
