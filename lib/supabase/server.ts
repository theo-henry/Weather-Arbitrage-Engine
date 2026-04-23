import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { requireSupabasePublicEnv } from './public-config'

export const createClient = async () => {
  const cookieStore = await cookies()
  const { url, publishableKey } = requireSupabasePublicEnv()

  return createServerClient(
    url,
    publishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Called from a Server Component; middleware refreshes sessions.
          }
        },
      },
    },
  )
}
