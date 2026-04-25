import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { buildDemoSeed } from '@/lib/demo-seed'
import { getSupabasePublicEnv, SUPABASE_PUBLIC_ENV_ERROR } from '@/lib/supabase/public-config'
import type { CalendarEvent } from '@/lib/types'

const DEMO_EMAIL = 'demo@weatherscheduler.com'
const DEMO_PASSWORD = 'demo2026'
const SUPABASE_SERVICE_ROLE_ERROR =
  'Demo login is not configured. Set SUPABASE_SERVICE_ROLE_KEY.'

function serializeEvents(userId: string, events: CalendarEvent[]) {
  return events.map((event) => {
    const { id, startTime, endTime, ...data } = event
    return {
      id,
      user_id: userId,
      start_time: startTime,
      end_time: endTime,
      data,
    }
  })
}

export async function POST() {
  const env = getSupabasePublicEnv()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!env) {
    return NextResponse.json(
      { error: SUPABASE_PUBLIC_ENV_ERROR },
      { status: 503 },
    )
  }

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: SUPABASE_SERVICE_ROLE_ERROR },
      { status: 503 },
    )
  }

  const supabaseAdmin = createClient(env.url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if demo user exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  let demoUser = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL)

  if (!demoUser) {
    // Create the demo user with email auto-confirmed
    const { data: createdUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }

    demoUser = createdUserData.user
  }

  if (!demoUser) {
    return NextResponse.json({ error: 'Failed to resolve demo user' }, { status: 500 })
  }

  const seed = buildDemoSeed()
  const serializedEvents = serializeEvents(demoUser.id, seed.events)

  const { error: preferencesError } = await supabaseAdmin
    .from('user_preferences')
    .upsert(
      {
        user_id: demoUser.id,
        data: seed.preferences,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (preferencesError) {
    return NextResponse.json({ error: preferencesError.message }, { status: 500 })
  }

  const { error: deleteEventsError } = await supabaseAdmin
    .from('scheduled_events')
    .delete()
    .eq('user_id', demoUser.id)

  if (deleteEventsError) {
    return NextResponse.json({ error: deleteEventsError.message }, { status: 500 })
  }

  if (serializedEvents.length > 0) {
    const { error: insertEventsError } = await supabaseAdmin
      .from('scheduled_events')
      .insert(serializedEvents)

    if (insertEventsError) {
      return NextResponse.json({ error: insertEventsError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true, seededEvents: serializedEvents.length })
}
