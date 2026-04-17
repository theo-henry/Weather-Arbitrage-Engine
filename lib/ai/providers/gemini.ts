import type { LLMContent, LLMFunctionCallPart, LLMGenerateRequest, LLMGenerateResponse, LLMPart, LLMProvider } from '../provider'

interface GeminiCandidate {
  content?: {
    role?: 'user' | 'model'
    parts?: GeminiPart[]
  }
}

interface GeminiPart {
  text?: string
  functionCall?: {
    name?: string
    args?: Record<string, unknown>
    id?: string
  }
}

interface GeminiResponse {
  candidates?: GeminiCandidate[]
  error?: {
    message?: string
  }
}

class GeminiApiError extends Error {
  status: number
  model: string
  constructor(message: string, status: number, model: string) {
    super(message)
    this.name = 'GeminiApiError'
    this.status = status
    this.model = model
  }
}

function partToGemini(part: LLMPart) {
  switch (part.type) {
    case 'text':
      return { text: part.text }
    case 'functionCall':
      return {
        functionCall: {
          name: part.name,
          args: part.args,
          ...(part.id ? { id: part.id } : {}),
        },
      }
    case 'functionResponse':
      return {
        functionResponse: {
          name: part.name,
          response: part.response,
          ...(part.id ? { id: part.id } : {}),
        },
      }
  }
}

function contentToGemini(content: LLMContent) {
  return {
    role: content.role,
    parts: content.parts.map(partToGemini),
  }
}

function geminiPartToNormalized(part: GeminiPart): LLMPart | null {
  if (part.text) {
    return { type: 'text', text: part.text }
  }

  if (part.functionCall?.name) {
    return {
      type: 'functionCall',
      name: part.functionCall.name,
      args: part.functionCall.args || {},
      ...(part.functionCall.id ? { id: part.functionCall.id } : {}),
    }
  }

  return null
}

function getGeminiModelsToTry() {
  const primary = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  const fallbackRaw = process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash-lite'

  return [primary, ...fallbackRaw.split(',').map((item) => item.trim()).filter(Boolean)].filter(
    (model, index, models) => models.indexOf(model) === index
  )
}

function shouldTryFallback(error: GeminiApiError) {
  const lower = error.message.toLowerCase()
  return (
    error.status === 429 ||
    error.status === 503 ||
    lower.includes('high demand') ||
    lower.includes('resource exhausted') ||
    lower.includes('unavailable') ||
    lower.includes('rate limit')
  )
}

function getFriendlyGeminiError(error: Error) {
  if (error instanceof GeminiApiError) {
    const lower = error.message.toLowerCase()

    if (error.status === 401 || error.status === 403 || lower.includes('api key')) {
      return 'The AI assistant is not configured correctly right now. Please check the Gemini API key and project permissions.'
    }

    if (error.status === 429 || error.status === 503 || lower.includes('high demand') || lower.includes('resource exhausted')) {
      return 'The AI assistant is temporarily busy right now. Please try again in a moment.'
    }

    if (lower.includes('safety')) {
      return 'The AI assistant could not answer that request because of provider safety restrictions.'
    }
  }

  if (error.message === 'GEMINI_API_KEY is missing.') {
    return 'The AI assistant is not configured yet because the Gemini API key is missing.'
  }

  return 'The AI assistant is unavailable right now. Please try again in a moment.'
}

async function generateWithModel(model: string, request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing.')
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: request.systemInstruction }],
        },
        contents: request.contents.map(contentToGemini),
        tools: [
          {
            functionDeclarations: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parameters: tool.parameters,
            })),
          },
        ],
      }),
      cache: 'no-store',
    }
  )

  const data = (await response.json()) as GeminiResponse
  if (!response.ok) {
    throw new GeminiApiError(data.error?.message || `Gemini API error: ${response.status}`, response.status, model)
  }

  const candidate = data.candidates?.[0]
  const parts = candidate?.content?.parts?.map(geminiPartToNormalized).filter(Boolean) as LLMPart[] | undefined
  if (!candidate?.content || !parts || parts.length === 0) {
    throw new Error('Gemini returned an empty response.')
  }

  const functionCalls = parts.filter((part): part is LLMFunctionCallPart => part.type === 'functionCall')
  const text = parts
    .filter((part): part is Extract<LLMPart, { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim()

  return {
    message: {
      role: candidate.content.role === 'user' ? 'user' : 'model',
      parts,
    },
    text,
    functionCalls,
  }
}

async function generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
  const models = getGeminiModelsToTry()
  let lastError: Error | null = null

  for (let index = 0; index < models.length; index++) {
    const model = models[index]

    try {
      return await generateWithModel(model, request)
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Gemini request failed.')
      lastError = normalized

      if (!(normalized instanceof GeminiApiError) || !shouldTryFallback(normalized) || index === models.length - 1) {
        throw new Error(getFriendlyGeminiError(normalized))
      }
    }
  }

  throw new Error(getFriendlyGeminiError(lastError || new Error('Gemini request failed.')))
}

export const geminiProvider: LLMProvider = {
  generate,
}
