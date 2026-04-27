'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Zap } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured, SUPABASE_PUBLIC_ENV_ERROR } from '@/lib/supabase/public-config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const DEMO_EMAIL = 'demo@weatherscheduler.com'
const DEMO_PASSWORD = 'demo2026'

function LoginForm() {
  const searchParams = useSearchParams()
  const nextParam = searchParams.get('next')
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/dashboard'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  async function handleLogin(
    loginEmail: string,
    loginPassword: string,
    { showError = true }: { showError?: boolean } = {},
  ) {
    if (!isSupabaseConfigured()) {
      if (showError) setError(SUPABASE_PUBLIC_ENV_ERROR)
      return false
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPassword })

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

  async function handleDemoCredentialsLogin() {
    if (await handleLogin(DEMO_EMAIL, DEMO_PASSWORD, { showError: false })) {
      return true
    }

    if (!(await ensureDemoAccount())) {
      return false
    }

    return handleLogin(DEMO_EMAIL, DEMO_PASSWORD)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
      await handleDemoCredentialsLogin()
      setLoading(false)
      return
    }

    await handleLogin(email, password)
    setLoading(false)
  }

  async function handleDemoLogin() {
    setError(null)
    setDemoLoading(true)
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)

    await handleDemoCredentialsLogin()
    setDemoLoading(false)
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

        <div className="rounded-2xl border border-border/50 bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-semibold mb-1">Welcome back</h1>
          <p className="text-sm text-muted-foreground mb-6">
            Log in to access your saved schedule and preferences.
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
                autoComplete="current-password"
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
              {loading ? 'Logging in…' : 'Log in'}
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
            New here?{' '}
            <Link
              href={`/signup?next=${encodeURIComponent(next)}`}
              className="font-medium text-foreground hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
