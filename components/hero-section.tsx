"use client"

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { WeatherIcon } from '@/components/weather-icon'

export function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      {/* Sky background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: 'url(https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-ZQOKTsQMpOUFWKnWCEWGsTBEiZqElF.jpg)' }}
      />
      {/* Dark overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-background/40 to-background" />
      
      {/* Floating weather icons */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-20 left-[10%]"
          animate={{ y: [0, -20, 0], x: [0, 10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <WeatherIcon condition="clear" size="xl" />
        </motion.div>
        <motion.div
          className="absolute top-40 right-[15%]"
          animate={{ y: [0, 15, 0], x: [0, -15, 0] }}
          transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        >
          <WeatherIcon condition="partly-cloudy" size="lg" />
        </motion.div>
        <motion.div
          className="absolute bottom-40 left-[20%]"
          animate={{ y: [0, 20, 0] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        >
          <WeatherIcon condition="cloudy" size="lg" />
        </motion.div>
        <motion.div
          className="absolute bottom-32 right-[25%]"
          animate={{ y: [0, -15, 0], x: [0, 10, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        >
          <WeatherIcon condition="rain" size="md" />
        </motion.div>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-4xl px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6"
        >
          Weather{' '}
          <span className="edge-gradient-text">Scheduler</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="text-lg sm:text-xl text-white/90 mb-4 max-w-2xl mx-auto text-balance"
        >
          Ask for a plan, get the best weather-aware time.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="text-base text-white/80 mb-10 max-w-xl mx-auto text-pretty"
        >
          Chat with the scheduler, compare forecast windows against your calendar and preferences, then confirm changes before they apply. Auto-Protect keeps watching for risky weather and suggests safer moves.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link href="/dashboard">
            <Button size="lg" className="group relative overflow-hidden w-full sm:w-auto">
              <span className="relative z-10 flex items-center gap-2">
                Open Dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-violet-500 to-amber-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Button>
          </Link>
          <Link href="/compare">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Compare Times
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  )
}
