"use client"

import { motion } from 'framer-motion'
import { 
  Zap, 
  TrendingUp, 
  Brain, 
  Heart,
  BarChart3,
  Clock,
  Target,
  Sparkles,
  ShieldCheck,
  CalendarCheck,
  CloudSun,
} from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Footer } from '@/components/footer'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const sections = [
  {
    icon: Zap,
    title: 'What is Weather Scheduler?',
    content: `Weather Scheduler is a weather-aware calendar assistant. Instead of stopping at "What's the weather?", it helps answer "When should I do this?"

The app combines forecast data, personal comfort settings, blocked scheduling windows, and existing calendar events. It scores upcoming 30-minute windows, filters out times you cannot use, and ranks the options that make sense for the activity you are planning.`,
  },
  {
    icon: BarChart3,
    title: 'How Scoring Works',
    content: `Each activity has its own scoring profile because good weather means different things for different plans:

**Running**: We prioritize temperature (ideal: 12-18°C for performance), penalize high humidity and wind based on your sensitivity settings, heavily penalize rain probability, and account for UV exposure and your time-of-day preferences.

**Deep Work**: Thermal comfort (19-23°C) promotes focus. We factor in daylight preferences and minimize ambient distractions from weather events.

**Outdoor Social**: We reward comfortable warmth (20-26°C), heavily penalize rain risk, prefer calm winds, and can boost scores during sunset hours.

**Commute**: Rain, wind, daylight, safety, temperature, and commute mode all matter. A good car commute, bike commute, and walking commute can be different recommendations.

**Photography**: Golden hour gets high weight, with cloud coverage preferences for either clear skies or dramatic compositions.

**Custom**: You can set your own temperature, wind, rain, and timing comfort thresholds.

After scoring, the dashboard and assistant remove windows that overlap your blocked rules or saved calendar events before showing recommendations.`,
  },
  {
    icon: Brain,
    title: 'Personalization and Saved State',
    content: `Personalization is already part of the app. Your preferences can change how the same forecast is ranked:

- **Comfort rules**: Set temperature, wind, and rain thresholds per activity.

- **Sensitivity settings**: Tune wind sensitivity, rain avoidance, daylight preference, warmth preference, and time-of-day bias.

- **Commute mode**: Optimize differently for driving, biking, or walking.

- **Blocked windows**: Mark times that should never be suggested for an activity.

Signed-in users keep their preferences and calendar events through Supabase. The demo account is seeded with preferences and sample events so Auto-Protect and the Scheduler have realistic data to analyze.`,
  },
  {
    icon: ShieldCheck,
    title: 'Scheduling and Auto-Protect',
    content: `Weather Scheduler is not just a recommendation page. It also helps manage the calendar around those recommendations.

The Compare page lets you ask natural-language planning questions, such as "Best time for tennis tomorrow afternoon", then schedule one of the recommended cards.

The Scheduler page includes a weekly calendar, manual event editing, and a chat assistant that can draft event creates, moves, and deletes. Assistant writes are confirmation-gated: the app shows the proposed operation first, and nothing is applied until you confirm.

Auto-Protect scans saved weather-sensitive events. If a plan has weak weather, violates a blocked rule, or has a better same-day option, it flags the risk and suggests a safer move. For commute events, it can also suggest keeping the time but switching commute mode.`,
  },
  {
    icon: CloudSun,
    title: 'Weather Data Sources',
    content: `Weather calls run through server-side API routes so keys stay protected.

Google Weather provides current conditions and the first 48 hours of hourly forecast data. Open-Meteo extends the hourly forecast beyond that range. City search and custom city lookup use Nominatim geocoding.

When Google Weather quota is exhausted, the app can fall back to the most recent saved Supabase weather snapshot for that city. If no live data or snapshot is available, the app shows an error state instead of pretending to have reliable recommendations.`,
  },
  {
    icon: Heart,
    title: 'Why This Matters',
    content: `Weather affects more than we realize:

- **Productivity**: Focus can change with temperature, daylight, and weather distractions.

- **Physical performance**: Heat, humidity, wind, rain, and UV can make the same workout feel very different.

- **Plans saved**: Outdoor dinners, walks, commutes, and photo sessions are easier to protect when the calendar understands weather risk.

Weather Scheduler is not just about avoiding bad weather. It is about finding the moments where conditions actively support the thing you want to do.`,
  },
]

const features = [
  { icon: Clock, label: '30-Minute Windows', description: 'Upcoming forecast slots scored by activity' },
  { icon: Target, label: 'Personal Rules', description: 'Comfort thresholds and blocked times' },
  { icon: TrendingUp, label: 'Ranked Alternatives', description: 'Best, usual, and backup options' },
  { icon: CalendarCheck, label: 'Conflict-Aware', description: 'Calendar events filter suggestions' },
  { icon: ShieldCheck, label: 'Auto-Protect', description: 'Risk alerts and safer moves' },
  { icon: Sparkles, label: 'Assistant Drafts', description: 'AI scheduling with confirmation' },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="pt-24 pb-16 px-4">
        <div className="mx-auto max-w-4xl">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-3xl sm:text-4xl font-bold mb-4">
              How It Works
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto text-balance">
              How the app turns forecasts, preferences, and calendar context into better timing decisions.
            </p>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-16"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon
              return (
                <Card key={feature.label} className="border-border/50">
                  <CardContent className="p-4 text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-amber-500/10 mb-3">
                      <Icon className="h-6 w-6 text-foreground" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1">{feature.label}</h3>
                    <p className="text-xs text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              )
            })}
          </motion.div>

          {/* Content sections */}
          <div className="space-y-12">
            {sections.map((section, index) => {
              const Icon = section.icon
              return (
                <motion.section
                  key={section.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + index * 0.1 }}
                >
                  <Card className="border-border/50 overflow-hidden">
                    <CardContent className="p-6 sm:p-8">
                      <div className="flex items-start gap-4 mb-6">
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/10 via-violet-500/10 to-amber-500/10 flex-shrink-0">
                          <Icon className="h-6 w-6 text-foreground" />
                        </div>
                        <h2 className="text-xl sm:text-2xl font-bold pt-2">
                          {section.title}
                        </h2>
                      </div>
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        {section.content.split('\n\n').map((paragraph, i) => (
                          <p key={i} className="text-muted-foreground leading-relaxed mb-4 last:mb-0">
                            {paragraph.split('**').map((part, j) => 
                              j % 2 === 1 ? <strong key={j} className="text-foreground">{part}</strong> : part
                            )}
                          </p>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.section>
              )
            })}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-16 text-center"
          >
            <Card className="border-transparent bg-gradient-to-r from-blue-500/10 via-violet-500/10 to-amber-500/10">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold mb-4">Ready to find your edge?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                  Stop letting weather happen to you. Start making it work for you.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/dashboard">
                    <Button size="lg">Try the Dashboard</Button>
                  </Link>
                  <Link href="/scheduler">
                    <Button variant="outline" size="lg">Open Scheduler</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
