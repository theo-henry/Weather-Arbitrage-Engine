import type { AssistantRequest, AssistantResponse, CompareRecommendation, PendingCalendarOperation } from '@/lib/types'
import { formatBlockedTimeRule, getActivityProfile } from '@/lib/preferences'
import { buildAssistantTools } from './tools'
import { getLLMProvider, type LLMContent } from './provider'

interface LatestUserMessageHints {
  text: string
  hasExplicitClockTime: boolean
  wantsOptimization: boolean
}

function buildPendingSummary(pendingOperations: PendingCalendarOperation[] | null | undefined) {
  if (!pendingOperations || pendingOperations.length === 0) return 'There is no pending unconfirmed calendar proposal.'
  return `There is an unconfirmed proposal waiting for the user. Pending operations:\n${pendingOperations
    .map((operation, index) => `${index + 1}. ${operation.summary}`)
    .join('\n')}`
}

function getLatestUserMessageHints(messages: AssistantRequest['messages']): LatestUserMessageHints | null {
  const latestUserMessage = [...messages].reverse().find((message) => message.role === 'user' && message.content.trim())
  if (!latestUserMessage) return null

  const text = latestUserMessage.content.trim()
  const hasExplicitClockTime =
    /\b(?:at\s+)?\d{1,2}(?::\d{2})?\s?(?:am|pm)\b/i.test(text) ||
    /\bat\s+\d{1,2}(?::\d{2})?\b/i.test(text) ||
    /\b\d{1,2}:\d{2}\b/.test(text)
  const wantsOptimization =
    /\b(best|optimal|optimize|better|ideal|good time|good slot|safest|weather-aware|weather aware)\b/i.test(
      text
    )

  return {
    text,
    hasExplicitClockTime,
    wantsOptimization,
  }
}

function buildExactTimeGuidance(hints: LatestUserMessageHints | null) {
  if (!hints?.hasExplicitClockTime || hints.wantsOptimization) {
    return 'If the user asks for the best or optimal time, you may propose a different slot based on weather and conflicts.'
  }

  return [
    `Latest user message: "${hints.text}"`,
    'The latest user message includes an explicit clock time. Treat that requested time as a hard user preference.',
    'Do not silently replace an explicitly requested time with a better-scoring slot.',
    'For an exact-time weather-sensitive request, score the requested time first with score_time_range.',
    'If the requested time is conflict-free, draft the event or update at that exact time.',
    'If weather is weak at that time, explain the risk briefly and optionally offer a better alternative, but keep the requested time as the draft unless the user asks you to move it.',
    'Only use find_optimal_slots to replace the requested time when the user explicitly asks for the best time or wants alternatives.',
  ].join('\n')
}

function buildPreferencesSummary(request: AssistantRequest) {
  const profile = getActivityProfile(request.preferences, request.preferences.activity)
  const blockedRules = request.preferences.blockedTimeRules[request.preferences.activity] ?? []

  const lines = [
    `Selected activity preference: ${request.preferences.activity}.`,
    `Preferred city: ${request.preferences.city}.`,
    `Usual time: ${request.preferences.usualTime}.`,
  ]

  if (profile.comfort) {
    lines.push(
      `Comfort envelope for ${request.preferences.activity}: ${profile.comfort.minTemperature}-${profile.comfort.maxTemperature}°C, max wind ${profile.comfort.maxWindSpeed} km/h, max rain chance ${profile.comfort.maxPrecipitationProbability}%.`,
    )
  }

  if (blockedRules.length > 0) {
    lines.push(
      `Blocked scheduling windows for ${request.preferences.activity}: ${blockedRules
        .slice(0, 4)
        .map((rule) => formatBlockedTimeRule(rule))
        .join('; ')}${blockedRules.length > 4 ? '; ...' : ''}.`,
    )
  } else {
    lines.push(`Blocked scheduling windows for ${request.preferences.activity}: none configured.`)
  }

  return lines.join('\n')
}

function buildCompareModeInstruction() {
  return [
    'COMPARE MODE: Your job is to understand the user’s activity request and recommend the best weather windows for comparison cards.',
    'For recommendation requests, call find_optimal_slots and include requested_activity_label when the user names an activity.',
    'Map general activities to the closest scored activity: outdoor exercise, tennis, hiking, cycling, walking, or workouts -> run; outdoor meals, drinks, dates, picnics, markets, parks, or social plans -> social; photography, video, sightseeing, sunrise, or sunset -> photo; flights, airport, aviation, or travel weather risk -> flight; study, reading, focus, writing, or laptop work -> study.',
    'When duration is not specified, use sensible defaults: run/exercise 45 minutes, photo 60 minutes, social 120 minutes, study 90 minutes, flight 30 minutes.',
    'If you map a user activity to a scored profile, briefly explain the mapping in natural language.',
    'Prefer returning 3 options unless the user asks for fewer. Mention the top option and the weather reason behind it.',
    'Do not draft a calendar event in compare mode unless the user explicitly asks you to add or schedule something. The UI lets the user choose a card.',
  ].join('\n')
}

function buildSystemInstruction(request: AssistantRequest) {
  const latestUserMessageHints = getLatestUserMessageHints(request.messages)
  const schedulerInstruction = [
    'You are the Weather Arbitrage Engine quick-scheduling assistant.',
    'Your primary job is to help the user schedule outdoor activities quickly and conversationally.',
    'When the user says "I want to do X at Y time", your goal is to confirm the details and add it to their calendar.',
    'Use the provided tools for any calendar lookup, weather reasoning, scoring, or draft write action.',
    'Never invent event ids, event times, scores, or weather details.',
    'Never claim that a create, update, or delete has already been applied. Draft changes only and ask for confirmation.',
    'QUICK SCHEDULING FLOW: When the user states an activity and time, ask one clarifying question if needed (e.g., how long?), then draft the event and ask for confirmation. Keep the conversation short — 1-2 turns max before drafting.',
    'IMPORTANT: Never schedule activities between 1:00 AM and 6:00 AM. If a user requests a time in that range, politely note it is an unusual hour and suggest a more appropriate time.',
    'Time-of-day interpretation: "morning" = 7:00–12:00, "afternoon" = 12:00–18:00, "evening" = 18:00–21:00, "night" = 20:00–23:00. For "morning" without a specific time, default to 8:00 AM. For "afternoon", default to 3:00 PM. For "evening", default to 7:00 PM.',
    'Always use the user timezone when creating or referencing event times. The user sees local times on their calendar — make sure start and end times match what you say in the chat.',
    'If the user asks to modify or delete an event, use find_events or list_events first unless the reference is already unambiguous.',
    'If multiple events match, ask a brief clarification question instead of guessing.',
    'Default to conflict-free scheduling. If a tool reports a conflict, explain it and do not draft a conflicting write unless the user explicitly asks to replace something.',
    'Blocked scheduling windows in account settings are hard constraints for assistant recommendations and draft scheduling actions.',
    'Weather comfort settings must influence any recommended time blocks.',
    'If the user asks about settings or wants to change them, use the account settings tools instead of describing imaginary settings.',
    'Preference changes apply immediately and are not confirmation-gated like calendar drafts.',
    'Keep replies concise, helpful, and in plain text.',
    buildExactTimeGuidance(latestUserMessageHints),
    buildPreferencesSummary(request),
    `Current city: ${request.city}.`,
    `Current time: ${request.now}.`,
    `User timezone: ${request.timezone}.`,
    buildPendingSummary(request.pendingOperations),
  ].join('\n')

  if (request.mode !== 'compare') {
    return schedulerInstruction
  }

  return [
    'You are the Weather Arbitrage Engine compare-tab assistant.',
    'Your primary job is to feel like a smart chatbot for weather-aware activity planning.',
    'Use the provided tools for any weather reasoning, scoring, calendar lookup, or settings inspection.',
    'Never invent event ids, event times, scores, or weather details.',
    'Always use the user timezone when referencing times.',
    'Default to conflict-free recommendations and respect blocked scheduling windows.',
    'Weather comfort settings must influence any recommended time blocks.',
    'Keep replies concise, helpful, and in plain text.',
    buildCompareModeInstruction(),
    buildExactTimeGuidance(latestUserMessageHints),
    buildPreferencesSummary(request),
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
    preferences: request.preferences,
    now: new Date(request.now),
    timezone: request.timezone,
  })

  const contents = toLLMContents(request.messages)
  const referencedEventIds = new Set<string>()
  const pendingOperations: PendingCalendarOperation[] = []
  let compareRecommendation: CompareRecommendation | null = null

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
        updatedPreferences: tools.hasPreferenceUpdates() ? tools.getCurrentPreferences() : null,
        compareRecommendation,
      }
    }

    contents.push(response.message)

    for (const functionCall of response.functionCalls) {
      const result = tools.execute(functionCall.name, functionCall.args)
      if (request.mode === 'compare' && functionCall.name === 'find_optimal_slots') {
        const toolResponse = result.response as {
          requestedActivityLabel?: unknown
          scoredActivity?: unknown
          slots?: unknown
        }
        const scoredActivity =
          typeof toolResponse.scoredActivity === 'string' &&
          ['run', 'study', 'social', 'flight', 'photo'].includes(toolResponse.scoredActivity)
            ? (toolResponse.scoredActivity as CompareRecommendation['scoredActivity'])
            : null
        const slots = Array.isArray(toolResponse.slots) ? toolResponse.slots : []
        compareRecommendation = {
          requestedActivityLabel:
            typeof toolResponse.requestedActivityLabel === 'string' ? toolResponse.requestedActivityLabel : null,
          scoredActivity,
          slots: slots
            .map((slot) => {
              if (!slot || typeof slot !== 'object') return null
              const item = slot as Record<string, unknown>
              if (
                !Array.isArray(item.windowIds) ||
                typeof item.startTime !== 'string' ||
                typeof item.endTime !== 'string' ||
                typeof item.score !== 'number' ||
                typeof item.location !== 'string' ||
                typeof item.weatherSummary !== 'string'
              ) {
                return null
              }

              return {
                windowIds: item.windowIds.filter((id): id is string => typeof id === 'string'),
                startTime: item.startTime,
                endTime: item.endTime,
                score: item.score,
                location: item.location,
                weatherSummary: item.weatherSummary,
                ...(typeof item.displayTime === 'string' ? { displayTime: item.displayTime } : {}),
              }
            })
            .filter((slot): slot is NonNullable<typeof slot> => !!slot),
        }
      }
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
    updatedPreferences: tools.hasPreferenceUpdates() ? tools.getCurrentPreferences() : null,
    compareRecommendation,
  }
}
