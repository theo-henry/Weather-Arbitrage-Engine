import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const DEMO_EMAIL = 'demo@weatherarbitrage.com'
const DEMO_PASSWORD = 'demo2026'

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: 'Service role key not configured' },
      { status: 500 },
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Check if demo user exists
  const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
  const demoUser = existingUsers?.users?.find((u) => u.email === DEMO_EMAIL)

  if (!demoUser) {
    // Create the demo user with email auto-confirmed
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
    })

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
