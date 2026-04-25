"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles, CalendarCheck, ArrowRight } from 'lucide-react'
import { addDays, isSameDay } from 'date-fns'
import { Navbar } from '@/components/navbar'
import { ComparisonCard } from '@/components/comparison-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { useWeatherData } from '@/hooks/use-weather-data'
import { usePreferences } from '@/hooks/use-preferences'
import { applyPreferenceScoresToWindows } from '@/lib/scoring'
import type { Activity, CalendarEvent, TimeWindow } from '@/lib/types'
import { cn } from '@/lib/utils'

// ─── activity helpers ────────────────────────────────────────────────────────

type ChatActivity = Activity

interface ActivityMeta {
  label: string
  color: CalendarEvent['color']
  duration: number // minutes
  defaultTitle: string
}

const ACTIVITY_META: Record<ChatActivity, ActivityMeta> = {
  run:    { label: 'Run',          color: 'green',  duration: 45,  defaultTitle: 'Morning Run' },
  photo:  { label: 'Photo walk',   color: 'violet', duration: 60,  defaultTitle: 'Photo Walk' },
  social: { label: 'Social outing',color: 'amber',  duration: 120, defaultTitle: 'Drinks / Dinner' },
  study:  { label: 'Study session',color: 'blue',   duration: 90,  defaultTitle: 'Study Session' },
  flight: { label: 'Flight',       color: 'blue',   duration: 30,  defaultTitle: 'Flight' },
  custom: { label: 'Activity',     color: 'blue',   duration: 60,  defaultTitle: 'Outdoor Activity' },
}

function parseActivity(text: string): ChatActivity | null {
  const t = text.toLowerCase()
  if (/\b(run|jog|running|jogging|sprint)\b/.test(t)) return 'run'
  if (/\b(bike|cycling|cycle|hike|hiking|walk|walking|yoga|exercise|workout|gym)\b/.test(t)) return 'run'
  if (/\b(photo|photography|camera|shoot|shooting|golden hour|sunset photo)\b/.test(t)) return 'photo'
  if (/\b(drink|drinks|beer|wine|dinner|brunch|lunch|friends|social|picnic|bbq|terrace|bar|cafe|coffee|outing|hangout)\b/.test(t)) return 'social'
  if (/\b(study|work|focus|read|homework|revision|writing)\b/.test(t)) return 'study'
  if (/\b(flight|fly|airport|travel|plane|flying)\b/.test(t)) return 'flight'
  return null
}

interface DayChoice {
  label: string
  offset: number | 'best'
}

function parseDay(text: string): DayChoice | null {
  const t = text.toLowerCase()
  if (/\btoday\b/.test(t)) return { label: 'today', offset: 0 }
  if (/\btomorrow\b/.test(t)) return { label: 'tomorrow', offset: 1 }
  if (/\bmonday\b/.test(t)) return { label: 'Monday', offset: daysUntil(1) }
  if (/\btuesday\b/.test(t)) return { label: 'Tuesday', offset: daysUntil(2) }
  if (/\bwednesday\b/.test(t)) return { label: 'Wednesday', offset: daysUntil(3) }
  if (/\bthursday\b/.test(t)) return { label: 'Thursday', offset: daysUntil(4) }
  if (/\bfriday\b/.test(t)) return { label: 'Friday', offset: daysUntil(5) }
  if (/\bsaturday\b/.test(t)) return { label: 'Saturday', offset: daysUntil(6) }
  if (/\bsunday\b/.test(t)) return { label: 'Sunday', offset: daysUntil(0) }
  if (/\b(any|best|whenever|anytime|this week|week)\b/.test(t)) return { label: 'this week', offset: 'best' }
  return null
}

function daysUntil(targetDow: number): number {
  const today = new Date().getDay()
  const diff = (targetDow - today + 7) % 7
  return diff === 0 ? 7 : diff
}

// ─── window helpers ──────────────────────────────────────────────────────────

function getTopWindowsForDay(
  windows: TimeWindow[],
  activity: ChatActivity,
  dayOffset: number,
  count = 3,
): TimeWindow[] {
  const target = addDays(new Date(), dayOffset)
  return windows
    .filter((w) => {
      const d = new Date(w.date)
      return isSameDay(d, target)
    })
    .filter((w) => {
      const [h] = w.startTime.split(':').map(Number)
      return h >= 6 && h < 22
    })
    .sort((a, b) => b.scores[activity] - a.scores[activity])
    .slice(0, count)
}

function getTopWindowsAny(
  windows: TimeWindow[],
  activity: ChatActivity,
  count = 3,
): TimeWindow[] {
  const now = new Date()
  return windows
    .filter((w) => {
      const d = new Date(w.date)
      return d >= now
    })
    .filter((w) => {
      const [h] = w.startTime.split(':').map(Number)
      return h >= 6 && h < 22
    })
    .sort((a, b) => b.scores[activity] - a.scores[activity])
    .slice(0, count)
}

function windowToEvent(
  win: TimeWindow,
  activity: ChatActivity,
  eventId: string,
): CalendarEvent {
  const meta = ACTIVITY_META[activity]
  const dateObj = new Date(win.date)
  const [startH, startM] = win.startTime.split(':').map(Number)
  const start = new Date(dateObj)
  start.setHours(startH, startM, 0, 0)
  const end = new Date(start.getTime() + meta.duration * 60_000)

  return {
    id: eventId,
    title: meta.defaultTitle,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    category: 'weather-sensitive',
    activity,
    color: meta.color,
    location: win.location,
    weatherScore: win.scores[activity],
    createdVia: 'compare',
  }
}

// ─── chat types ──────────────────────────────────────────────────────────────

type ChatStep = 'greeting' | 'ask_activity' | 'ask_day' | 'show_results' | 'scheduled'

interface ChatMsg {
  role: 'bot' | 'user'
  text: string
}

const CARD_VARIANTS: Array<'best' | 'usual' | 'alternate'> = ['best', 'usual', 'alternate']
const CARD_LABELS = ['Top Pick', 'Runner-Up', 'Alternative']

// ─── component ───────────────────────────────────────────────────────────────

export default function ComparePage() {
  const router = useRouter()
  const [preferences] = usePreferences()
  const { windows: rawWindows } = useWeatherData(preferences.city)
  const windows = useMemo(
    () => applyPreferenceScoresToWindows(rawWindows, preferences),
    [rawWindows, preferences],
  )

  // chat state
  const [step, setStep] = useState<ChatStep>('greeting')
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'bot',
      text: `Hi! I'll help you find the best weather window for your activity. What would you like to do? (e.g. go for a run, photo walk, drinks with friends)`,
    },
  ])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // selected state
  const [activity, setActivity] = useState<ChatActivity | null>(null)
  const [dayChoice, setDayChoice] = useState<DayChoice | null>(null)
  const [topWindows, setTopWindows] = useState<TimeWindow[]>([])
  const [scheduledEventId, setScheduledEventId] = useState<string | null>(null)
  const [isScheduling, setIsScheduling] = useState(false)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function addMsg(role: ChatMsg['role'], text: string) {
    setMessages((prev) => [...prev, { role, text }])
  }

  function handleSend() {
    const val = input.trim()
    if (!val) return
    setInput('')
    addMsg('user', val)

    if (step === 'greeting' || step === 'ask_activity') {
      const parsed = parseActivity(val)
      if (!parsed) {
        addMsg('bot', `I didn't catch the activity. Could you tell me what you'd like to do — for example a run, photo walk, or dinner with friends?`)
        setStep('ask_activity')
        return
      }
      setActivity(parsed)
      const meta = ACTIVITY_META[parsed]
      addMsg('bot', `Great — a ${meta.label}! When are you thinking — today, tomorrow, or another day this week?`)
      setStep('ask_day')
      return
    }

    if (step === 'ask_day') {
      const parsed = parseDay(val)
      if (!parsed) {
        addMsg('bot', `I didn't catch the day. Try "today", "tomorrow", "Friday", or "any day this week".`)
        return
      }
      setDayChoice(parsed)

      const act = activity!
      const results =
        parsed.offset === 'best'
          ? getTopWindowsAny(windows, act, 3)
          : getTopWindowsForDay(windows, act, parsed.offset as number, 3)

      setTopWindows(results)

      if (results.length === 0) {
        addMsg('bot', `I couldn't find any good slots for ${parsed.label}. Try a different day?`)
        return
      }

      const meta = ACTIVITY_META[act]
      addMsg(
        'bot',
        `Here are the top ${results.length} slots for your ${meta.label} on ${parsed.label}. Pick the one that works best — it'll be added straight to your calendar!`,
      )
      setStep('show_results')
      return
    }
  }

  async function handleSelectSlot(win: TimeWindow) {
    if (!activity || isScheduling) return
    setIsScheduling(true)

    const eventId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString()

    const event = windowToEvent(win, activity, eventId)

    try {
      await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      })
    } catch {
      // best-effort — user will still be navigated to the calendar
    }

    const meta = ACTIVITY_META[activity]
    addMsg(
      'bot',
      `Done! Your ${meta.label} on ${win.day} at ${win.startTime} has been added to the calendar. Head over to see it highlighted.`,
    )
    setScheduledEventId(eventId)
    setStep('scheduled')
    setIsScheduling(false)
  }

  function handleGoToCalendar() {
    if (scheduledEventId) {
      router.push(`/scheduler?highlight=${scheduledEventId}`)
    } else {
      router.push('/scheduler')
    }
  }

  const showCards = step === 'show_results' || step === 'scheduled'

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="mx-auto max-w-5xl space-y-8">

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">Find Your Optimal Time</h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Tell me what you want to do and I'll show you the best weather windows to choose from.
            </p>
          </motion.div>

          {/* Chat panel */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-sm overflow-hidden"
          >
            {/* Chat header */}
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
                <p className="text-sm font-semibold">Weather Window Finder</p>
                <p className="text-xs text-muted-foreground">Powered by real-time weather scoring</p>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex flex-col gap-3 px-4 py-4 max-h-52 overflow-y-auto"
            >
              <AnimatePresence initial={false}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                        msg.role === 'user'
                          ? 'bg-foreground text-background rounded-br-md'
                          : 'bg-muted rounded-bl-md',
                      )}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Input / Go to calendar */}
            <div className="px-4 py-3 border-t border-border/50 bg-card/40">
              {step === 'scheduled' ? (
                <Button
                  onClick={handleGoToCalendar}
                  className="w-full gap-2"
                  size="lg"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Go to Calendar
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSend()
                      }
                    }}
                    placeholder={
                      step === 'ask_day'
                        ? 'Today, tomorrow, Friday…'
                        : 'Type an activity (run, photo walk, drinks…)'
                    }
                    disabled={step === 'show_results'}
                    className="flex-1"
                    autoFocus
                  />
                  <Button onClick={handleSend} disabled={!input.trim() || step === 'show_results'}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>

          {/* Comparison cards */}
          <AnimatePresence>
            {showCards && topWindows.length > 0 && activity && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Best slots for your {ACTIVITY_META[activity].label}
                    {dayChoice && <span className="text-muted-foreground font-normal"> · {dayChoice.label}</span>}
                  </h2>
                  {step === 'show_results' && (
                    <Badge variant="outline" className="text-xs">
                      Click a card to schedule
                    </Badge>
                  )}
                </div>

                <div className="grid md:grid-cols-3 gap-6">
                  {topWindows.map((win, idx) => (
                    <motion.div
                      key={win.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08 }}
                      className="flex flex-col gap-3"
                    >
                      <ComparisonCard
                        window={win}
                        activity={activity}
                        label={CARD_LABELS[idx] ?? `Option ${idx + 1}`}
                        variant={CARD_VARIANTS[idx] ?? 'alternate'}
                      />

                      {step === 'show_results' && (
                        <Button
                          onClick={() => handleSelectSlot(win)}
                          disabled={isScheduling}
                          className={cn(
                            'w-full gap-2',
                            idx === 0 && 'bg-green-600 hover:bg-green-700 text-white',
                          )}
                          variant={idx === 0 ? 'default' : 'outline'}
                        >
                          <CalendarCheck className="h-4 w-4" />
                          {isScheduling ? 'Scheduling…' : 'Choose This Slot'}
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
