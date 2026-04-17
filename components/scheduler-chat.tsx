"use client"

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCalendarStore } from '@/hooks/use-calendar-store'
import type { ChatMessage, Intent, TimeWindow, CalendarEvent, Activity, EventColor } from '@/lib/types'
import { ACTIVITY_CONFIG } from '@/lib/types'
import { getBestWindow } from '@/lib/mockData'
import { cn } from '@/lib/utils'
import { format, addDays, startOfWeek, setHours, setMinutes } from 'date-fns'

interface SchedulerChatProps {
  windows: TimeWindow[]
  className?: string
}

const suggestedPrompts = [
  'Schedule a run tomorrow morning',
  'Plan a picnic this Saturday',
  'Sunset photo walk Friday',
  'Add terrace drinks Thursday evening',
]

function parseIntent(message: string): Intent {
  const lower = message.toLowerCase()

  let activity: Intent['activity'] = null
  if (lower.includes('run') || lower.includes('jog') || lower.includes('workout') || lower.includes('exercise') || lower.includes('5k') || lower.includes('10k')) {
    activity = 'run'
  } else if (lower.includes('study') || lower.includes('work') || lower.includes('focus') || lower.includes('deep work')) {
    activity = 'study'
  } else if (lower.includes('drink') || lower.includes('social') || lower.includes('terrace') || lower.includes('terrasse') || lower.includes('friends') || lower.includes('dinner') || lower.includes('picnic') || lower.includes('bbq')) {
    activity = 'social'
  } else if (lower.includes('photo') || lower.includes('picture') || lower.includes('shoot') || lower.includes('photography')) {
    activity = 'photo'
  } else if (lower.includes('flight') || lower.includes('fly') || lower.includes('travel')) {
    activity = 'flight'
  }

  let duration: string | undefined
  const durationMatch = lower.match(/(\d+)\s*(h|hour|hr|min|minute)/i)
  if (durationMatch) {
    duration = `${durationMatch[1]}${durationMatch[2].startsWith('h') ? 'h' : 'min'}`
  }
  if (lower.includes('5k')) duration = '30min'
  if (lower.includes('10k')) duration = '1h'

  let dayHint: string | undefined
  if (lower.includes('today')) dayHint = 'today'
  else if (lower.includes('tomorrow')) dayHint = 'tomorrow'
  else if (lower.includes('monday')) dayHint = 'Monday'
  else if (lower.includes('tuesday')) dayHint = 'Tuesday'
  else if (lower.includes('wednesday')) dayHint = 'Wednesday'
  else if (lower.includes('thursday')) dayHint = 'Thursday'
  else if (lower.includes('friday')) dayHint = 'Friday'
  else if (lower.includes('saturday')) dayHint = 'Saturday'
  else if (lower.includes('sunday')) dayHint = 'Sunday'
  else if (lower.includes('this week')) dayHint = 'this week'

  return { activity, duration, dayHint, raw: message }
}

function getDayFromHint(hint?: string): Date {
  const now = new Date()
  if (!hint || hint === 'today') return now
  if (hint === 'tomorrow') return addDays(now, 1)

  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
  const targetDay = dayNames.indexOf(hint.toLowerCase())
  if (targetDay >= 0) {
    const currentDay = now.getDay()
    let diff = targetDay - currentDay
    if (diff <= 0) diff += 7
    return addDays(now, diff)
  }
  return now
}

function getTimeHint(message: string): { hour: number; minute: number } {
  const lower = message.toLowerCase()
  // Check for specific time
  const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/)
  if (timeMatch) {
    let hour = parseInt(timeMatch[1])
    const minute = parseInt(timeMatch[2] || '0')
    if (timeMatch[3] === 'pm' && hour < 12) hour += 12
    if (timeMatch[3] === 'am' && hour === 12) hour = 0
    return { hour, minute }
  }
  if (lower.includes('morning')) return { hour: 8, minute: 0 }
  if (lower.includes('afternoon')) return { hour: 14, minute: 0 }
  if (lower.includes('evening') || lower.includes('sunset')) return { hour: 18, minute: 0 }
  if (lower.includes('lunch')) return { hour: 12, minute: 30 }
  return { hour: 10, minute: 0 }
}

function getDurationMinutes(duration?: string): number {
  if (!duration) return 60
  const match = duration.match(/(\d+)(h|min)/)
  if (!match) return 60
  return match[2] === 'h' ? parseInt(match[1]) * 60 : parseInt(match[1])
}

function getEventTitleFromIntent(intent: Intent): string {
  const lower = intent.raw.toLowerCase()
  if (lower.includes('picnic')) return 'Picnic'
  if (lower.includes('bbq')) return 'BBQ'
  if (lower.includes('drink')) return 'Terrace Drinks'
  if (lower.includes('dinner')) return 'Outdoor Dinner'
  if (lower.includes('5k')) return '5K Run'
  if (lower.includes('10k')) return '10K Run'
  if (lower.includes('jog')) return 'Morning Jog'
  if (lower.includes('photo walk')) return 'Photo Walk'
  if (lower.includes('photo')) return 'Photo Session'
  if (lower.includes('sunset')) return 'Sunset Session'

  const labels: Record<string, string> = {
    run: 'Run',
    study: 'Study Session',
    social: 'Social Outing',
    photo: 'Photography',
    flight: 'Flight Check',
  }
  return labels[intent.activity || ''] || 'Activity'
}

function getColorForActivity(activity: Activity | null): EventColor {
  const map: Record<string, EventColor> = {
    run: 'amber',
    study: 'violet',
    social: 'pink',
    photo: 'amber',
    flight: 'blue',
  }
  return map[activity || ''] || 'blue'
}

export function SchedulerChat({ windows, className }: SchedulerChatProps) {
  const { dispatch } = useCalendarStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your weather-aware scheduling assistant. Tell me what you'd like to plan — a run, picnic, photo walk, drinks with friends — and I'll find the best time based on weather conditions. You can also say things like \"Add a meeting tomorrow at 2pm\".",
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingEvent, setPendingEvent] = useState<Partial<CalendarEvent> | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const streamText = async (text: string, messageId: string) => {
    setIsTyping(true)
    let currentText = ''
    for (let i = 0; i < text.length; i++) {
      currentText += text[i]
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: currentText } : m))
      )
      await new Promise((resolve) => setTimeout(resolve, 12))
    }
    setIsTyping(false)
  }

  const handleSend = async () => {
    if (!input.trim() || isTyping) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMessage])
    const currentInput = input
    setInput('')

    const lower = currentInput.toLowerCase()

    // Check for confirmation of pending event
    if (
      (lower.includes('yes') || lower.includes('schedule') || lower.includes('book') || lower.includes('add it') || lower.includes('confirm')) &&
      pendingEvent
    ) {
      const event: CalendarEvent = {
        id: Date.now().toString(),
        title: pendingEvent.title || 'Activity',
        startTime: pendingEvent.startTime!,
        endTime: pendingEvent.endTime!,
        category: pendingEvent.category || 'weather-sensitive',
        color: pendingEvent.color || 'blue',
        createdVia: 'chat',
        ...(pendingEvent.activity ? { activity: pendingEvent.activity } : {}),
        ...(pendingEvent.location ? { location: pendingEvent.location } : {}),
      }

      dispatch({ type: 'ADD_EVENT', event })

      const confirmMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, confirmMsg])

      const startDate = new Date(event.startTime)
      await streamText(
        `Done! I've added "${event.title}" to your calendar on ${format(startDate, 'EEEE, MMM d')} at ${format(startDate, 'h:mm a')}. You can see it on the calendar now.`,
        confirmMsg.id
      )
      setPendingEvent(null)
      return
    }

    // Parse intent
    const intent = parseIntent(currentInput)
    const assistantMsg: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, assistantMsg])

    if (!intent.activity) {
      // Check if this is an indoor event creation
      if (lower.includes('meeting') || lower.includes('call') || lower.includes('standup')) {
        const day = getDayFromHint(intent.dayHint)
        const time = getTimeHint(currentInput)
        const duration = getDurationMinutes(intent.duration)
        const start = setMinutes(setHours(day, time.hour), time.minute)
        const end = new Date(start.getTime() + duration * 60 * 1000)

        const title = lower.includes('meeting') ? 'Meeting' :
                      lower.includes('call') ? 'Call' :
                      lower.includes('standup') ? 'Standup' : 'Event'

        const eventPartial: Partial<CalendarEvent> = {
          title,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          category: 'indoor',
          color: 'blue',
        }
        setPendingEvent(eventPartial)

        await streamText(
          `I'll add a "${title}" on ${format(start, 'EEEE, MMM d')} from ${format(start, 'h:mm a')} to ${format(end, 'h:mm a')}. Should I schedule it?`,
          assistantMsg.id
        )
        return
      }

      await streamText(
        "I can help you schedule activities! Try saying things like:\n• \"Schedule a run tomorrow morning\"\n• \"Plan a picnic Saturday afternoon\"\n• \"Add a photo walk Friday at sunset\"\n• \"Meeting tomorrow at 2pm\"",
        assistantMsg.id
      )
      return
    }

    // Build event from intent
    const day = getDayFromHint(intent.dayHint)
    const time = getTimeHint(currentInput)
    const duration = getDurationMinutes(intent.duration)

    // Find best window for this activity
    const bestWindow = getBestWindow(windows, intent.activity)
    const isWeatherSensitive = intent.activity !== 'study'

    let start: Date
    let end: Date

    if (isWeatherSensitive && bestWindow) {
      // Use best weather window's time
      const [bh, bm] = bestWindow.startTime.split(':').map(Number)
      start = setMinutes(setHours(day, bh), bm)
      end = new Date(start.getTime() + duration * 60 * 1000)
    } else {
      start = setMinutes(setHours(day, time.hour), time.minute)
      end = new Date(start.getTime() + duration * 60 * 1000)
    }

    const title = getEventTitleFromIntent(intent)
    const score = bestWindow?.scores[intent.activity as keyof typeof bestWindow.scores] ?? 75
    const location = bestWindow?.location

    const eventPartial: Partial<CalendarEvent> = {
      title,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      category: isWeatherSensitive ? 'weather-sensitive' : 'indoor',
      activity: intent.activity,
      color: getColorForActivity(intent.activity),
      location,
      weatherScore: score,
    }
    setPendingEvent(eventPartial)

    let response = `Great choice! For your ${title.toLowerCase()}, the best weather window is **${format(start, 'EEEE, MMM d')} at ${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}**`
    if (location) response += ` near ${location}`
    response += `. Weather score: ${score}/100`
    if (bestWindow) {
      response += ` (${bestWindow.weather.temperature}°C, ${bestWindow.weather.windSpeed} km/h wind`
      if (bestWindow.weather.precipitationProbability > 10) {
        response += `, ${bestWindow.weather.precipitationProbability}% rain`
      }
      response += ')'
    }
    response += '. Want me to add it to your calendar?'

    await streamText(response, assistantMsg.id)
  }

  const handlePromptClick = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-border/50">
        <div className="relative">
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <motion.div
            className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500"
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div>
          <h3 className="font-semibold">Weather Assistant</h3>
          <p className="text-xs text-muted-foreground">Always finding your edge</p>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                    message.role === 'user'
                      ? 'bg-foreground text-background rounded-br-md'
                      : 'bg-muted rounded-bl-md'
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === 'assistant' &&
                    (message.content.includes('Want me to') || message.content.includes('Should I schedule')) && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => {
                            setInput('Yes, schedule it')
                            setTimeout(() => {
                              const btn = document.querySelector('[data-chat-submit]') as HTMLButtonElement
                              btn?.click()
                            }, 100)
                          }}
                        >
                          Schedule it
                        </Button>
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
      </ScrollArea>

      {/* Suggested prompts */}
      <div className="px-4 py-2 flex gap-2 flex-wrap">
        {suggestedPrompts.map((prompt) => (
          <Badge
            key={prompt}
            variant="secondary"
            className="cursor-pointer hover:bg-muted transition-colors text-xs"
            onClick={() => handlePromptClick(prompt)}
          >
            {prompt}
          </Badge>
        ))}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border/50">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Try: 'Schedule a picnic Saturday' or 'Add a run tomorrow'"
            className="flex-1"
            disabled={isTyping}
          />
          <Button data-chat-submit type="submit" size="icon" disabled={!input.trim() || isTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
