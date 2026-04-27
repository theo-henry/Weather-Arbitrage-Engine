'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { MailCheck, Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured, SUPABASE_PUBLIC_ENV_ERROR } from '@/lib/supabase/public-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEMO_EMAIL = 'demo@weatherscheduler.com'
const DEMO_PASSWORD = 'demo2026'

function SignupForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)

  async function handleDemoCredentialsLogin({ showError = true }: { showError?: boolean } = {}) {
    if (!isSupabaseConfigured()) {
      if (showError) setError(SUPABASE_PUBLIC_ENV_ERROR)
      return false
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    })

    if (error) {
      if (showError) setError(error.message)
      return false
    }

    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      if (showError) setError('Login succeeded, but the session was not saved. Please try again.')
      return false
    }

    window.location.assign(next)
    return true
  }

  async function ensureDemoAccount() {
    const res = await fetch('/api/demo-login', { method: 'POST' })
    if (res.ok) return true

    const data = await res.json().catch(() => ({}))
    setError(data.error || 'Failed to set up demo account')
    return false
  }

  async function handleDemoLogin() {
    setError(null)
    setDemoLoading(true)
    setConfirmationEmail(null)
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)

    if (await handleDemoCredentialsLogin({ showError: false })) {
      return
    }

    if (await ensureDemoAccount()) {
      await handleDemoCredentialsLogin()
    }

    setDemoLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (!isSupabaseConfigured()) {
      setError(SUPABASE_PUBLIC_ENV_ERROR)
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (!data.session) {
      setConfirmationEmail(email)
      setLoading(false)
      return
    }

    router.push(next)
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 justify-center mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 rounded-lg blur-sm opacity-75" />
            <div className="relative bg-background rounded-lg p-1.5">
              <Zap className="h-5 w-5 text-foreground" />
            </div>
          </div>
          <span className="font-semibold text-lg">
            Weather <span className="edge-gradient-text">Scheduler</span>
          </span>
        </Link>

        {confirmationEmail ? (
          <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-sm text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/20 via-violet-500/20 to-amber-500/20">
              <MailCheck className="h-6 w-6 text-foreground" />
            </div>
            <h1 className="text-2xl font-semibold mb-2">Check your inbox</h1>
            <p className="text-sm text-muted-foreground mb-1">
              We sent a confirmation link to
            </p>
            <p className="text-sm font-medium mb-6 break-all">{confirmationEmail}</p>
            <p className="text-sm text-muted-foreground mb-6">
              Click the link in the email to activate your account. The link will
              bring you back here signed in.
            </p>
            <p className="text-xs text-muted-foreground">
              Didn&apos;t get it? Check your spam folder, or{' '}
              <button
                type="button"
                onClick={() => setConfirmationEmail(null)}
                className="font-medium text-foreground underline"
              >
                try a different email
              </button>
              .
            </p>
          </div>
        ) : (
        <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold mb-1">Create your account</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Save your preferences and schedule across devices.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={loading || demoLoading}>
              {loading ? 'Creating account…' : 'Sign up'}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/50" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={loading || demoLoading}
            onClick={handleDemoLogin}
          >
            {demoLoading ? 'Logging in…' : 'Log in with Demo Account'}
          </Button>

          <p className="mt-6 text-sm text-muted-foreground text-center">
            Already have an account?{' '}
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="font-medium text-foreground hover:underline"
            >
              Log in
            </Link>
          </p>
        </div>
        )}
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  )
}
