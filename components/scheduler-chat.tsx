"use client"

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCalendarStore } from '@/hooks/use-calendar-store'
import type {
  AssistantRequest,
  AssistantResponse,
  CalendarEvent,
  ChatMessage,
  City,
  PendingCalendarOperation,
  TimeWindow,
} from '@/lib/types'
import { cn } from '@/lib/utils'

interface SchedulerChatProps {
  city: City
  windows: TimeWindow[]
  className?: string
}

const suggestedPrompts = [
  'What do I have tomorrow?',
  'Schedule a 45-minute run tomorrow morning',
  'Move my picnic to the best weather slot on Saturday',
  'Is Friday 6:30pm good for terrace drinks?',
]

function createMessage(
  role: ChatMessage['role'],
  content: string,
  extras: Partial<ChatMessage> = {}
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
      : message
  )
}

export function SchedulerChat({ city, windows, className }: SchedulerChatProps) {
  const { state, dispatch } = useCalendarStore()
  const [messages, setMessages] = useState<ChatMessage[]>([
    createMessage(
      'assistant',
      'Hi! I’m your AI scheduling assistant. I can inspect your calendar, find weather-aware times, and draft schedule changes for your approval.'
    ),
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [pendingOperations, setPendingOperations] = useState<PendingCalendarOperation[] | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isTyping])

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
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        events: state.events,
        windows,
        city,
        now: new Date().toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        pendingOperations: activePendingOperations,
      }

      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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

      setMessages((prev) => [...prev, assistantMessage])
      setPendingOperations(data.pendingOperations)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The assistant request failed.'
      setMessages((prev) => [
        ...prev,
        createMessage('assistant', message, {
          isError: true,
        }),
      ])
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
    await sendToAssistant(nextMessages, pendingOperations)
  }

  const handlePromptClick = (prompt: string) => {
    setInput(prompt)
    inputRef.current?.focus()
  }

  const hasActivePendingOperations = (message: ChatMessage) =>
    !!pendingOperations &&
    !!message.pendingOperations &&
    message.pendingOperations.length > 0 &&
    message.pendingOperations === pendingOperations

  return (
    <div className={cn('flex flex-col h-full', className)}>
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
          <h3 className="font-semibold">AI Scheduler</h3>
          <p className="text-xs text-muted-foreground">Weather-aware, calendar-aware, confirmation-gated</p>
        </div>
      </div>

      <ScrollArea ref={scrollRef} className="flex-1 p-4">
        <div className="space-y-4">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[88%] rounded-2xl px-4 py-3 text-sm',
                    message.role === 'user'
                      ? 'bg-foreground text-background rounded-br-md'
                      : message.isError
                      ? 'bg-red-500/10 text-red-700 dark:text-red-300 rounded-bl-md'
                      : 'bg-muted rounded-bl-md'
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
      </ScrollArea>

      <div className="px-4 py-2 flex gap-2 flex-wrap">
        {suggestedPrompts.map((prompt) => (
          <Badge
            key={prompt}
            variant="outline"
            className="cursor-pointer hover:bg-muted transition-colors px-3 py-1"
            onClick={() => handlePromptClick(prompt)}
          >
            {prompt}
          </Badge>
        ))}
      </div>

      <div className="p-4 border-t border-border/50">
        {pendingOperations && pendingOperations.length > 0 && (
          <p className="text-xs text-muted-foreground mb-2">
            A calendar change is waiting for confirmation. Reply with “yes” to apply it or “cancel” to discard it.
          </p>
        )}
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
            placeholder="Ask about your schedule, weather, or draft a change..."
            className="flex-1"
          />
          <Button data-chat-submit onClick={handleSend} disabled={!input.trim() || isTyping}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
