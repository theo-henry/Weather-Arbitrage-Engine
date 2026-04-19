import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserPreferences } from '@/lib/types'

const DEFAULT_PREFERENCES: UserPreferences = {
  activity: 'run',
  city: 'Madrid',
  usualTime: '17:00',
  performanceVsComfort: 75,
  windSensitivity: 'high',
  rainAvoidance: 'medium',
  timeBias: 'evening',
  sunsetBonus: true,
  goldenHourPriority: true,
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_preferences')
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    preferences: (data?.data as UserPreferences) ?? DEFAULT_PREFERENCES,
  })
}

export async function PUT(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json()) as { preferences: UserPreferences }
  if (!body?.preferences) {
    return NextResponse.json({ error: 'missing preferences' }, { status: 400 })
  }

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, data: body.preferences, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
