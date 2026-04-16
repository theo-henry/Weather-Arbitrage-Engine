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
  TrendingUp
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
    title: 'Choose activity + preferences', 
    description: 'Select what you want to do and set your sensitivity levels',
    icon: Settings,
  },
  { 
    step: 2, 
    title: 'We score every 30-min window', 
    description: 'Our engine analyzes 96 time slots over the next 48 hours',
    icon: TrendingUp,
  },
  { 
    step: 3, 
    title: 'Get your optimal window', 
    description: 'See your best time and auto-schedule it to your calendar',
    icon: Calendar,
  },
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
                {"Why we're different"}
              </h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Traditional weather apps tell you what. We tell you when.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Traditional app */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <Card className="border-border/50 bg-muted/30 h-full">
                  <CardContent className="p-6 sm:p-8">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                      Traditional Weather App
                    </div>
                    <p className="text-xl sm:text-2xl font-medium text-muted-foreground mb-6">
                      {"\"Rain at 6pm. 18°C.\""}
                    </p>
                    <div className="text-sm text-muted-foreground">
                      Just data. No actionable insight.
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
                <Card className="relative overflow-hidden border-transparent h-full bg-gradient-to-br from-blue-500/15 via-violet-500/15 to-amber-500/15">
                  <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-blue-500/50 via-violet-500/50 to-amber-500/50" />
                  <CardContent className="relative p-6 sm:p-8">
                    <div className="text-xs font-semibold uppercase tracking-wider text-foreground/70 mb-4 flex items-center gap-2">
                      <Zap className="h-3 w-3 text-amber-500" />
                      Weather Arbitrage Engine
                    </div>
                    <p className="text-xl sm:text-2xl font-medium mb-6 text-foreground">
                      {"\"6pm scores 71. 8pm scores "}
                      <span className="text-green-400">89</span>
                      {". Shift your run +2h for a "}
                      <span className="text-green-400">+18pt edge</span>
                      {".\""}
                    </p>
                    <div className="text-sm text-foreground/70">
                      Actionable intelligence for decision-makers.
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
