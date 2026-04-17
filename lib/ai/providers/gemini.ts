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

async function generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing.')
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
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
    throw new Error(data.error?.message || `Gemini API error: ${response.status}`)
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

export const geminiProvider: LLMProvider = {
  generate,
}
