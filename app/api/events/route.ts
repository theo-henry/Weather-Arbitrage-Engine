import { NextResponse } from 'next/server'
import { normalizeCalendarEvent } from '@/lib/calendar-events'
import { createClient } from '@/lib/supabase/server'
import { getSupabasePublicEnv, SUPABASE_PUBLIC_ENV_ERROR } from '@/lib/supabase/public-config'
import type { CalendarEvent } from '@/lib/types'

export async function GET() {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_PUBLIC_ENV_ERROR }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('scheduled_events')
    .select('id, start_time, end_time, data')
    .eq('user_id', user.id)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const events: CalendarEvent[] = (data ?? []).map((row) =>
    normalizeCalendarEvent({
      ...(row.data as Omit<CalendarEvent, 'id' | 'startTime' | 'endTime'>),
      id: row.id,
      startTime: row.start_time,
      endTime: row.end_time,
    } as CalendarEvent),
  )

  return NextResponse.json({ events })
}

export async function POST(request: Request) {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_PUBLIC_ENV_ERROR }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const event = normalizeCalendarEvent((await request.json()) as CalendarEvent)
  if (!event?.id || !event.startTime || !event.endTime) {
    return NextResponse.json({ error: 'invalid event' }, { status: 400 })
  }

  const { id, startTime, endTime, ...rest } = event
  const { error } = await supabase.from('scheduled_events').insert({
    id,
    user_id: user.id,
    start_time: startTime,
    end_time: endTime,
    data: rest,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
