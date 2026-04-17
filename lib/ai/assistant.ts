import type { AssistantRequest, AssistantResponse, PendingCalendarOperation } from '@/lib/types'
import { buildAssistantTools } from './tools'
import { getLLMProvider, type LLMContent } from './provider'

function buildPendingSummary(pendingOperations: PendingCalendarOperation[] | null | undefined) {
  if (!pendingOperations || pendingOperations.length === 0) return 'There is no pending unconfirmed calendar proposal.'
  return `There is an unconfirmed proposal waiting for the user. Pending operations:\n${pendingOperations
    .map((operation, index) => `${index + 1}. ${operation.summary}`)
    .join('\n')}`
}

function buildSystemInstruction(request: AssistantRequest) {
  return [
    'You are the Weather Arbitrage Engine scheduling assistant.',
    'You help the user inspect their schedule, understand weather conditions, and draft calendar changes.',
    'Use the provided tools for any calendar lookup, weather reasoning, scoring, or draft write action.',
    'Never invent event ids, event times, scores, or weather details.',
    'Never claim that a create, update, or delete has already been applied. Draft changes only and ask for confirmation.',
    'If the user asks to modify or delete an event, use find_events or list_events first unless the reference is already unambiguous.',
    'If multiple events match, ask a brief clarification question instead of guessing.',
    'Default to conflict-free scheduling. If a tool reports a conflict, explain it and do not draft a conflicting write unless the user explicitly asks to replace something.',
    'Keep replies concise, helpful, and in plain text.',
    `Current city: ${request.city}.`,
    `Current time: ${request.now}.`,
    `User timezone: ${request.timezone}.`,
    buildPendingSummary(request.pendingOperations),
  ].join('\n')
}

function toLLMContents(messages: AssistantRequest['messages']): LLMContent[] {
  return messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ type: 'text', text: message.content }],
    }))
}

export async function runAssistant(request: AssistantRequest): Promise<AssistantResponse> {
  const provider = getLLMProvider()
  const tools = buildAssistantTools({
    city: request.city,
    events: request.events,
    windows: request.windows,
    now: new Date(request.now),
    timezone: request.timezone,
  })

  const contents = toLLMContents(request.messages)
  const referencedEventIds = new Set<string>()
  const pendingOperations: PendingCalendarOperation[] = []

  for (let step = 0; step < 6; step++) {
    const response = await provider.generate({
      systemInstruction: buildSystemInstruction(request),
      contents,
      tools: tools.declarations,
    })

    if (response.functionCalls.length === 0) {
      return {
        message: response.text || 'I’m sorry, but I could not generate a response just now.',
        pendingOperations: pendingOperations.length > 0 ? pendingOperations : null,
        requiresConfirmation: pendingOperations.length > 0,
        referencedEventIds: [...referencedEventIds],
      }
    }

    contents.push(response.message)

    for (const functionCall of response.functionCalls) {
      const result = tools.execute(functionCall.name, functionCall.args)
      if (result.pendingOperation) {
        pendingOperations.push(result.pendingOperation)
      }
      result.referencedEventIds?.forEach((id) => referencedEventIds.add(id))
      contents.push({
        role: 'user',
        parts: [
          {
            type: 'functionResponse',
            name: functionCall.name,
            response: result.response,
            ...(functionCall.id ? { id: functionCall.id } : {}),
          },
        ],
      })
    }
  }

  return {
    message: 'I hit an internal tool loop while working on that request. Please try rephrasing it.',
    pendingOperations: pendingOperations.length > 0 ? pendingOperations : null,
    requiresConfirmation: pendingOperations.length > 0,
    referencedEventIds: [...referencedEventIds],
  }
}
