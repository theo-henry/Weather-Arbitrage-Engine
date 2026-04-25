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
  Sparkles
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
    content: `Weather Scheduler helps you use temporal variations in weather conditions to optimize outcomes for specific activities. Instead of asking "What's the weather?" we ask "When does the weather give me an advantage?"

Traditional weather apps provide data: temperature, humidity, wind speed. But raw data doesn't tell you when to run, when to study outdoors, or when to plan that perfect sunset dinner. Weather Scheduler transforms weather data into actionable intelligence — scoring every 30-minute window across the next 48 hours to find your optimal moment.`,
  },
  {
    icon: BarChart3,
    title: 'How Scoring Works',
    content: `Each activity has a custom scoring algorithm that weighs weather factors differently based on what matters most:

**Running**: We prioritize temperature (ideal: 12-18°C for performance), penalize high humidity and wind based on your sensitivity settings, heavily penalize rain probability, and account for UV exposure and your time-of-day preferences.

**Deep Work**: Thermal comfort (19-23°C) promotes focus. We factor in daylight preferences and minimize ambient distractions from weather events.

**Outdoor Social**: We reward comfortable warmth (20-26°C), heavily penalize rain risk, prefer calm winds, and can boost scores during sunset hours.

**Photography**: Golden hour gets maximum weight, with cloud coverage preferences for either clear skies or dramatic compositions.

All weights are configurable through your preference settings, letting you tune the algorithm to your personal thresholds.`,
  },
  {
    icon: Brain,
    title: 'Personalization (Coming Soon)',
    content: `The next evolution of Weather Scheduler will learn from your patterns:

• **Activity correlation**: If you consistently feel better running at certain temperatures, we'll adjust your personal comfort curves.

• **Schedule learning**: We'll understand when you're typically free and prioritize windows that fit your routine.

• **Feedback loops**: Rate your experiences and we'll continuously improve recommendations.

• **Cross-activity optimization**: Learn that you prefer morning runs followed by afternoon study sessions and optimize both together.`,
  },
  {
    icon: Heart,
    title: 'Why This Matters',
    content: `Weather affects more than we realize:

• **Productivity**: Studies show cognitive performance varies with temperature and lighting conditions.

• **Physical performance**: Running in optimal conditions can improve pace by 5-10%.

• **Mental health**: Outdoor activities in good weather correlate with better mood and reduced stress.

• **Plans saved**: No more rained-out picnics or windswept photos. Plan with confidence.

Weather Scheduler isn't just about avoiding bad weather — it's about finding the moments where conditions actively work in your favor. It's the difference between surviving the weather and leveraging it.`,
  },
]

const features = [
  { icon: Clock, label: '48-Hour Analysis', description: '96 time windows scored in real-time' },
  { icon: Target, label: 'Activity-Specific', description: 'Custom algorithms for each use case' },
  { icon: TrendingUp, label: 'Score Comparison', description: 'See your edge vs. usual times' },
  { icon: Sparkles, label: 'Smart Scheduling', description: 'AI assistant to book your optimal window' },
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
              The science and philosophy behind finding your weather edge.
            </p>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16"
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
