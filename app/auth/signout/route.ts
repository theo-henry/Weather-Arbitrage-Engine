import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSupabasePublicEnv } from '@/lib/supabase/public-config'

export async function POST(request: NextRequest) {
  if (getSupabasePublicEnv()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  }

  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}
