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

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const forceReseed = (body as Record<string, unknown>)?.reset === true

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
  } else if (forceReseed) {
    // Update the demo user's password if reset is requested
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(demoUser.id, {
      password: DEMO_PASSWORD,
      email_confirm: true,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }
  }

  if (!demoUser) {
    return NextResponse.json({ error: 'Failed to resolve demo user' }, { status: 500 })
  }

  // Always upsert preferences (idempotent)
  const seed = buildDemoSeed()

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

  // Only seed events if the user has none, data is stale, or a reset was requested
  const { count, data: latestEvent } = await supabaseAdmin
    .from('scheduled_events')
    .select('id, end_time', { count: 'exact' })
    .eq('user_id', demoUser.id)
    .order('end_time', { ascending: false })
    .limit(1)

  // Reseed when all existing events have ended (stale demo data from a previous session)
  const isStale =
    count !== null &&
    count > 0 &&
    latestEvent?.[0]?.end_time &&
    new Date(latestEvent[0].end_time) < new Date()

  const shouldSeed = forceReseed || count === null || count === 0 || isStale

  if (shouldSeed) {
    // Clear existing events before reseeding
    if ((forceReseed || isStale) && count && count > 0) {
      const { error: deleteEventsError } = await supabaseAdmin
        .from('scheduled_events')
        .delete()
        .eq('user_id', demoUser.id)

      if (deleteEventsError) {
        return NextResponse.json({ error: deleteEventsError.message }, { status: 500 })
      }
    }

    const serializedEvents = serializeEvents(demoUser.id, seed.events)

    if (serializedEvents.length > 0) {
      const { error: insertEventsError } = await supabaseAdmin
        .from('scheduled_events')
        .insert(serializedEvents)

      if (insertEventsError) {
        return NextResponse.json({ error: insertEventsError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ ok: true, seededEvents: serializedEvents.length, reset: forceReseed })
  }

  return NextResponse.json({ ok: true, seededEvents: 0, existing: true })
}
