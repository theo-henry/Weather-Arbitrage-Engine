export const SUPABASE_PUBLIC_ENV_ERROR =
  'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'

export interface SupabasePublicEnv {
  url: string
  publishableKey: string
}

export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!url || !publishableKey) {
    return null
  }

  return { url, publishableKey }
}

export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv()

  if (!env) {
    throw new Error(SUPABASE_PUBLIC_ENV_ERROR)
  }

  return env
}

export function isSupabaseConfigured() {
  return getSupabasePublicEnv() !== null
}
