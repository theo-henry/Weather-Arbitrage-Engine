import { NextRequest, NextResponse } from 'next/server'
import type { AssistantRequest } from '@/lib/types'
import { runAssistant } from '@/lib/ai/assistant'

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AssistantRequest

    if (
      !body ||
      !Array.isArray(body.messages) ||
      !Array.isArray(body.events) ||
      !Array.isArray(body.windows) ||
      !body.preferences
    ) {
      return NextResponse.json({ error: 'Invalid assistant request payload.' }, { status: 400 })
    }

    const response = await runAssistant(body)
    return NextResponse.json(response)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Assistant request failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
