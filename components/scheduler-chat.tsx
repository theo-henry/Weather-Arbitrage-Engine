"use client"

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { ChatMessage, Intent, TimeWindow } from '@/lib/types'
import { cn } from '@/lib/utils'

interface SchedulerChatProps {
  onScheduleEvent: (window: TimeWindow, activity: string) => void
  suggestedWindow?: TimeWindow
  className?: string
}

const suggestedPrompts = [
  'Run 5k this week',
  '2h deep work session',
  'Sunset drinks Friday',
]

// Simple intent parser using keyword matching
function parseIntent(message: string): Intent {
  const lower = message.toLowerCase()
  
  let activity: Intent['activity'] = null
  if (lower.includes('run') || lower.includes('jog') || lower.includes('workout') || lower.includes('exercise') || lower.includes('5k') || lower.includes('10k')) {
    activity = 'run'
  } else if (lower.includes('study') || lower.includes('work') || lower.includes('focus') || lower.includes('deep work')) {
    activity = 'study'
  } else if (lower.includes('drink') || lower.includes('social') || lower.includes('terrasse') || lower.includes('friends') || lower.includes('dinner')) {
    activity = 'social'
  } else if (lower.includes('photo') || lower.includes('picture') || lower.includes('shoot')) {
    activity = 'photo'
  } else if (lower.includes('flight') || lower.includes('fly') || lower.includes('travel')) {
    activity = 'flight'
  }
  
  // Duration hints
  let duration: string | undefined
  const durationMatch = lower.match(/(\d+)\s*(h|hour|hr|min|minute)/i)
  if (durationMatch) {
    duration = `${durationMatch[1]}${durationMatch[2].startsWith('h') ? 'h' : 'min'}`
  }
  if (lower.includes('5k')) duration = '30min'
  if (lower.includes('10k')) duration = '1h'
  
  // Day hints
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
  
  return {
    activity,
    duration,
    dayHint,
    raw: message,
  }
}

function generateResponse(intent: Intent, window?: TimeWindow): string {
  if (!intent.activity) {
    return "I can help you schedule outdoor activities! Try asking about running, studying, social plans, photography, or flights. For example: \"I want to run 5k tomorrow\" or \"Plan a terrasse drink with friends\"."
  }
  
  if (!window) {
    return `I understand you want to ${intent.activity}${intent.dayHint ? ` ${intent.dayHint}` : ''}. Let me find the best window for you...`
  }
  
  const activityLabels: Record<string, string> = {
    run: 'run',
    study: 'deep work session',
    social: 'outdoor social',
    photo: 'photo session',
    flight: 'flight',
  }
  
  const activityLabel = activityLabels[intent.activity] || intent.activity
  
  return `Got it — a ${activityLabel}${intent.duration ? ` (${intent.duration})` : ''}${intent.dayHint ? ` ${intent.dayHint}` : ''}. Based on optimal weather conditions, your best window is **${window.day} ${window.startTime}–${window.endTime} at ${window.location}** — score ${window.scores[intent.activity as keyof typeof window.scores]}, with ${window.weather.temperature}°C and ${window.weather.windSpeed} km/h wind. Want me to schedule it?`
}

export function SchedulerChat({ onScheduleEvent, suggestedWindow, className }: SchedulerChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your weather-aware scheduling assistant. Tell me what activity you'd like to plan, and I'll find the optimal time window based on weather conditions.",
      timestamp: new Date(),
    },
    {
      id: '2',
      role: 'user',
      content: 'I want to run 5k tomorrow',
      timestamp: new Date(),
    },
    {
      id: '3',
      role: 'assistant',
      content: suggestedWindow 
        ? `Got it — a 5k run tomorrow. Based on your preferences (performance bias, high wind sensitivity), your optimal window is **${suggestedWindow.day} ${suggestedWindow.startTime}–${suggestedWindow.endTime} at ${suggestedWindow.location}** — score ${suggestedWindow.scores.run}, +18 vs your usual 17:00. Want me to schedule it?`
        : 'Got it — a 5k run tomorrow. Based on your preferences, your optimal window is **Wed 19:30–20:30 at Retiro Park** — score 89, +18 vs your usual 17:00. Want me to schedule it?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingIntent, setPendingIntent] = useState<Intent | null>({ activity: 'run', duration: '30min', dayHint: 'tomorrow', raw: 'I want to run 5k tomorrow' })
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
        prev.map((m) =>
          m.id === messageId ? { ...m, content: currentText } : m
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 15))
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
    setInput('')

    // Check if user wants to schedule
    const lower = input.toLowerCase()
    if ((lower.includes('schedule') || lower.includes('yes') || lower.includes('book') || lower.includes('add')) && pendingIntent && suggestedWindow) {
      const confirmMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, confirmMessage])
      
      await streamText(`Perfect! I've added your ${pendingIntent.activity} to your calendar for ${suggestedWindow.day} ${suggestedWindow.startTime}–${suggestedWindow.endTime} at ${suggestedWindow.location}. You'll get a reminder 30 minutes before. Good luck! 🎯`, confirmMessage.id)
      
      onScheduleEvent(suggestedWindow, pendingIntent.activity || 'run')
      setPendingIntent(null)
      return
    }

    // Parse intent
    const intent = parseIntent(input)
    setPendingIntent(intent)
    
    const assistantMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    }
    
    setMessages((prev) => [...prev, assistantMessage])
    
    const response = generateResponse(intent, intent.activity ? suggestedWindow : undefined)
    await streamText(response, assistantMessage.id)
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
                  {message.role === 'assistant' && message.content.includes('Want me to schedule') && (
                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        onClick={() => {
                          setInput('Yes, schedule it')
                          setTimeout(handleSend, 100)
                        }}
                      >
                        Schedule it
                      </Button>
                      <Button size="sm" variant="outline">
                        Show alternatives
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <motion.div
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.1 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-muted-foreground/50 rounded-full"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay: 0.2 }}
                  />
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
            className="cursor-pointer hover:bg-muted transition-colors"
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
            placeholder="Try: 'I want to run 5k this week' or 'Plan a terrasse drink with friends'"
            className="flex-1"
            disabled={isTyping}
          />
          <Button type="submit" size="icon" disabled={!input.trim() || isTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
