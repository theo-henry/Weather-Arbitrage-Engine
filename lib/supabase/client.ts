import { createBrowserClient } from '@supabase/ssr'
import { requireSupabasePublicEnv } from './public-config'

export const createClient = () => {
  const { url, publishableKey } = requireSupabasePublicEnv()

  return createBrowserClient(url, publishableKey)
}
