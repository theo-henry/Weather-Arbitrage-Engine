"use client"

import { motion } from 'framer-motion'
import Link from 'next/link'
import { 
  Dumbbell, 
  BookOpen, 
  Wine, 
  Plane, 
  Camera, 
  Settings,
  ArrowRight,
  Zap,
  Calendar,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  SlidersHorizontal,
  CloudSun
} from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { HeroSection } from '@/components/hero-section'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const activities = [
  { id: 'run', label: 'Run / Workout', icon: Dumbbell, description: 'Optimize pace and comfort' },
  { id: 'study', label: 'Deep Work / Study', icon: BookOpen, description: 'Peak focus conditions' },
  { id: 'social', label: 'Outdoor Social', icon: Wine, description: 'Perfect terrasse weather' },
  { id: 'flight', label: 'Flights', icon: Plane, description: 'Lowest turbulence windows' },
  { id: 'photo', label: 'Photography', icon: Camera, description: 'Best lighting conditions' },
  { id: 'custom', label: 'Custom', icon: Settings, description: 'Your own parameters' },
]

const steps = [
  { 
    step: 1, 
    title: 'Tell the scheduler your plan', 
    description: 'Ask in plain language, set your city and preferences, and block times you never want suggested',
    icon: Settings,
  },
  { 
    step: 2, 
    title: 'We score safe weather windows', 
    description: 'The engine checks forecast slots, your calendar, comfort settings, and weather-sensitive activity rules',
    icon: TrendingUp,
  },
  { 
    step: 3, 
    title: 'Confirm and stay protected', 
    description: 'Approve calendar changes before they apply, then let Auto-Protect flag risky events and suggest better same-day moves',
    icon: Calendar,
  },
]

const schedulerAdvantages = [
  { label: 'Natural-language planning', icon: MessageSquare },
  { label: 'Calendar and blocked-time checks', icon: Calendar },
  { label: 'Personal comfort settings', icon: SlidersHorizontal },
  { label: 'Auto-Protect risk alerts', icon: ShieldCheck },
]

const scoreRows = [
  { time: '18:00', label: 'Current plan', score: 62, tone: 'bg-amber-500' },
  { time: '19:30', label: 'Best move', score: 88, tone: 'bg-green-500' },
  { time: '20:30', label: 'Backup', score: 81, tone: 'bg-blue-500' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="pt-16">
        {/* Hero */}
        <HeroSection />

        {/* Why we're different */}
        <section className="py-24 px-4">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Built for decisions, not forecasts
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Weather Scheduler turns live conditions, your calendar, and your preferences into schedule changes you approve.
              </p>
            </motion.div>

            <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6 items-stretch">
              {/* Traditional app */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card className="border-border/50 bg-muted/25 h-full overflow-hidden">
                  <CardContent className="p-6 sm:p-8 h-full">
                    <div className="mb-8 flex items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Regular weather app
                      </div>
                      <CloudSun className="h-5 w-5 text-muted-foreground" />
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-lg border border-border/60 bg-background/60 p-4">
                        <div className="mb-3 flex items-center justify-between text-sm">
                          <span className="font-medium">Friday 6:00 PM</span>
                          <span className="text-muted-foreground">18°C</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
                          <div className="rounded-md bg-muted px-2 py-3">Rain 45%</div>
                          <div className="rounded-md bg-muted px-2 py-3">Wind 22 km/h</div>
                          <div className="rounded-md bg-muted px-2 py-3">Cloudy</div>
                        </div>
                      </div>

                      <div className="space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          No calendar conflict check
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          No personal comfort rules
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                          No safer move ready
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Our app */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card className="relative h-full overflow-hidden border-transparent bg-gradient-to-br from-blue-500/15 via-violet-500/12 to-amber-500/15">
                  <motion.div
                    className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-400 via-violet-400 to-amber-400"
                    animate={{ x: ['-100%', '100%'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                  <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-blue-500/45 via-violet-500/45 to-amber-500/45" />
                  <CardContent className="relative p-6 sm:p-8">
                    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70 flex items-center gap-2">
                        <Zap className="h-3 w-3 text-amber-500" />
                        Weather Scheduler
                      </div>
                      <motion.div
                        className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 dark:text-green-300"
                        animate={{ y: [0, -3, 0] }}
                        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                      >
                        <ShieldCheck className="h-3 w-3" />
                        Auto-Protect clear
                      </motion.div>
                    </div>

                    <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
                      <div className="space-y-4">
                        <motion.div
                          className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur"
                          initial={{ opacity: 0, y: 12 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.15 }}
                        >
                          <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                            <MessageSquare className="h-4 w-4 text-blue-500" />
                            Quick Scheduler
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {"\"Schedule a 45-min walk Saturday afternoon.\""}
                          </p>
                        </motion.div>

                        <div className="grid grid-cols-2 gap-2">
                          {schedulerAdvantages.map((item, index) => {
                            const Icon = item.icon
                            return (
                              <motion.div
                                key={item.label}
                                className="rounded-lg border border-border/60 bg-background/55 p-3 text-xs text-muted-foreground"
                                initial={{ opacity: 0, y: 12 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.2 + index * 0.08 }}
                              >
                                <Icon className="mb-2 h-4 w-4 text-foreground" />
                                {item.label}
                              </motion.div>
                            )
                          })}
                        </div>
                      </div>

                      <div className="rounded-lg border border-border/60 bg-background/70 p-4 shadow-sm backdrop-blur">
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">Ranked safe windows</div>
                            <div className="text-xs text-muted-foreground">Weather, calendar, preferences</div>
                          </div>
                          <TrendingUp className="h-5 w-5 text-green-500" />
                        </div>

                        <div className="space-y-4">
                          {scoreRows.map((row, index) => (
                            <div key={row.time} className="space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium">{row.time}</span>
                                <span className="text-muted-foreground">{row.label}</span>
                                <span className="font-semibold">{row.score}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-muted">
                                <motion.div
                                  className={`h-full rounded-full ${row.tone}`}
                                  initial={{ width: 0 }}
                                  whileInView={{ width: `${row.score}%` }}
                                  viewport={{ once: true }}
                                  transition={{ delay: 0.25 + index * 0.15, duration: 0.9, ease: 'easeOut' }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <motion.div
                          className="mt-5 rounded-lg border border-green-500/25 bg-green-500/10 px-3 py-3 text-sm"
                          initial={{ opacity: 0, scale: 0.96 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          transition={{ delay: 0.75 }}
                        >
                          <span className="font-medium text-green-600 dark:text-green-300">Ready to confirm:</span>{' '}
                          move to 19:30 for a +26 point improvement.
                        </motion.div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Activity Modes */}
        <section className="py-24 px-4 bg-muted/30">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Optimized for your activity
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Each mode uses a custom scoring algorithm tuned for what matters most.
              </p>
            </motion.div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {activities.map((activity, index) => {
                const Icon = activity.icon
                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link href="/dashboard">
                      <Card className="group border-border/50 hover:border-border transition-all cursor-pointer card-hover">
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-amber-500/10 group-hover:from-blue-500/20 group-hover:via-violet-500/20 group-hover:to-amber-500/20 transition-colors">
                              <Icon className="h-6 w-6 text-foreground" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold mb-1">{activity.label}</h3>
                              <p className="text-sm text-muted-foreground">
                                {activity.description}
                              </p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="py-24 px-4">
          <div className="mx-auto max-w-6xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                How it works
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Three simple steps to find your edge.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((item, index) => {
                const Icon = item.icon
                return (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.15 }}
                    className="relative"
                  >
                    {/* Connector line */}
                    {index < steps.length - 1 && (
                      <div className="hidden md:block absolute top-12 left-[calc(50%+60px)] w-[calc(100%-120px)] h-[2px] bg-gradient-to-r from-border to-border/0" />
                    )}
                    
                    <div className="text-center">
                      <div className="relative inline-flex items-center justify-center w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-amber-500/10 mb-6">
                        <Icon className="h-10 w-10 text-foreground" />
                        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold">
                          {item.step}
                        </div>
                      </div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </section>

        {/* Pull Quote */}
        <section className="py-24 px-4 bg-muted/30">
          <div className="mx-auto max-w-4xl text-center">
            <motion.blockquote
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="text-2xl sm:text-3xl md:text-4xl font-medium italic text-balance"
            >
              {"\"Don't ask what the weather is. Ask when it gives you an "}
              <span className="edge-gradient-text not-italic font-bold">advantage</span>
              {".\""}
            </motion.blockquote>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 px-4">
          <div className="mx-auto max-w-4xl text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Ready to find your edge?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
                Start optimizing your schedule based on real weather intelligence.
              </p>
              <Link href="/dashboard">
                <Button size="lg" className="group">
                  Launch the Engine
                  <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
