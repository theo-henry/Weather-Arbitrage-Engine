import { geminiProvider } from './providers/gemini'

export interface LLMTextPart {
  type: 'text'
  text: string
}

export interface LLMFunctionCallPart {
  type: 'functionCall'
  name: string
  args: Record<string, unknown>
  id?: string
}

export interface LLMFunctionResponsePart {
  type: 'functionResponse'
  name: string
  response: unknown
  id?: string
}

export type LLMPart = LLMTextPart | LLMFunctionCallPart | LLMFunctionResponsePart

export interface LLMContent {
  role: 'user' | 'model'
  parts: LLMPart[]
}

export interface LLMToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface LLMGenerateRequest {
  systemInstruction: string
  contents: LLMContent[]
  tools: LLMToolDefinition[]
}

export interface LLMGenerateResponse {
  message: LLMContent
  text: string
  functionCalls: LLMFunctionCallPart[]
}

export interface LLMProvider {
  generate(request: LLMGenerateRequest): Promise<LLMGenerateResponse>
}

export function getLLMProvider(): LLMProvider {
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase()

  switch (provider) {
    case 'gemini':
      return geminiProvider
    case 'openai':
      throw new Error('AI_PROVIDER=openai is not implemented yet.')
    default:
      throw new Error(`Unsupported AI provider: ${provider}`)
  }
}
