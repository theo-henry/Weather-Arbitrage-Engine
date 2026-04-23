import { NextResponse } from 'next/server'
import { getDefaultUserPreferences, normalizeUserPreferences } from '@/lib/preferences'
import { createClient } from '@/lib/supabase/server'
import { getSupabasePublicEnv, SUPABASE_PUBLIC_ENV_ERROR } from '@/lib/supabase/public-config'
import type { UserPreferences } from '@/lib/types'

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
    .from('user_preferences')
    .select('data')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    preferences: data?.data ? normalizeUserPreferences(data.data) : getDefaultUserPreferences(),
  })
}

export async function PUT(request: Request) {
  if (!getSupabasePublicEnv()) {
    return NextResponse.json({ error: SUPABASE_PUBLIC_ENV_ERROR }, { status: 503 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = (await request.json()) as { preferences: UserPreferences }
  if (!body?.preferences) {
    return NextResponse.json({ error: 'missing preferences' }, { status: 400 })
  }

  const normalizedPreferences = normalizeUserPreferences(body.preferences)

  const { error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: user.id, data: normalizedPreferences, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
