"use client"

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface WeatherEffectsProps {
  type: 'rain' | 'hot' | 'cold' | 'none'
  intensity?: 'low' | 'medium' | 'high'
  className?: string
}

// Rain drops animation
function RainEffect({ intensity = 'medium' }: { intensity?: 'low' | 'medium' | 'high' }) {
  const dropCount = intensity === 'high' ? 12 : intensity === 'medium' ? 8 : 5
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: dropCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-0.5 h-2 bg-blue-400/60 rounded-full"
          style={{
            left: `${10 + (i * (80 / dropCount))}%`,
            top: '-8px',
          }}
          animate={{
            y: ['0%', '500%'],
            opacity: [0.7, 0.3],
          }}
          transition={{
            duration: 0.6 + Math.random() * 0.3,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'linear',
          }}
        />
      ))}
      {/* Rain splash effect at bottom */}
      {Array.from({ length: Math.floor(dropCount / 2) }).map((_, i) => (
        <motion.div
          key={`splash-${i}`}
          className="absolute bottom-1 w-1 h-1 bg-blue-400/40 rounded-full"
          style={{
            left: `${15 + (i * (70 / Math.floor(dropCount / 2)))}%`,
          }}
          animate={{
            scale: [0, 1.5, 0],
            opacity: [0, 0.6, 0],
          }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            delay: i * 0.2 + 0.5,
          }}
        />
      ))}
    </div>
  )
}

// Heat waves / scorching effect
function HeatEffect({ intensity = 'medium' }: { intensity?: 'low' | 'medium' | 'high' }) {
  const waveCount = intensity === 'high' ? 5 : intensity === 'medium' ? 3 : 2
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Heat shimmer waves */}
      {Array.from({ length: waveCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0 left-0 right-0 h-full"
          style={{
            background: `linear-gradient(to top, transparent 0%, rgba(251, 146, 60, ${0.08 + i * 0.03}) 50%, transparent 100%)`,
          }}
          animate={{
            y: [0, -4, 0],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 1.5 + i * 0.3,
            repeat: Infinity,
            delay: i * 0.4,
            ease: 'easeInOut',
          }}
        />
      ))}
      {/* Rising heat particles */}
      {Array.from({ length: waveCount + 2 }).map((_, i) => (
        <motion.div
          key={`particle-${i}`}
          className="absolute w-1 h-1 rounded-full bg-orange-400/50"
          style={{
            left: `${20 + i * 15}%`,
            bottom: '10%',
          }}
          animate={{
            y: [0, -30, -50],
            x: [0, Math.sin(i) * 5, Math.sin(i) * 8],
            opacity: [0.6, 0.4, 0],
            scale: [1, 0.8, 0.4],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'easeOut',
          }}
        />
      ))}
      {/* Wavy distortion lines */}
      <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
        {Array.from({ length: 3 }).map((_, i) => (
          <motion.path
            key={`wave-${i}`}
            d={`M 0 ${30 + i * 15} Q 25 ${25 + i * 15} 50 ${30 + i * 15} T 100 ${30 + i * 15}`}
            fill="none"
            stroke={`rgba(251, 146, 60, ${0.15 - i * 0.03})`}
            strokeWidth="1"
            animate={{
              d: [
                `M 0 ${30 + i * 15} Q 25 ${25 + i * 15} 50 ${30 + i * 15} T 100 ${30 + i * 15}`,
                `M 0 ${30 + i * 15} Q 25 ${35 + i * 15} 50 ${30 + i * 15} T 100 ${30 + i * 15}`,
                `M 0 ${30 + i * 15} Q 25 ${25 + i * 15} 50 ${30 + i * 15} T 100 ${30 + i * 15}`,
              ],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </svg>
    </div>
  )
}

// Freezing / cold effect
function ColdEffect({ intensity = 'medium' }: { intensity?: 'low' | 'medium' | 'high' }) {
  const flakeCount = intensity === 'high' ? 10 : intensity === 'medium' ? 6 : 4
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Frost overlay */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-b from-cyan-400/5 via-transparent to-cyan-400/10"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
      {/* Falling snowflakes / ice particles */}
      {Array.from({ length: flakeCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${10 + (i * (80 / flakeCount))}%`,
            top: '-4px',
          }}
          animate={{
            y: ['0%', '400%'],
            x: [0, Math.sin(i * 2) * 10, Math.sin(i * 2) * -5, 0],
            rotate: [0, 180, 360],
            opacity: [0.8, 0.6, 0.3],
          }}
          transition={{
            duration: 2.5 + Math.random() * 1,
            repeat: Infinity,
            delay: i * 0.3,
            ease: 'linear',
          }}
        >
          <svg width="6" height="6" viewBox="0 0 6 6" className="text-cyan-300/70">
            <path
              d="M3 0L3 6M0 3L6 3M0.9 0.9L5.1 5.1M5.1 0.9L0.9 5.1"
              stroke="currentColor"
              strokeWidth="0.5"
              fill="none"
            />
          </svg>
        </motion.div>
      ))}
      {/* Frost crystals on edges */}
      <div className="absolute top-0 left-0 w-4 h-4">
        <motion.div
          className="w-full h-full border-t border-l border-cyan-400/30 rounded-tl-sm"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>
      <div className="absolute top-0 right-0 w-4 h-4">
        <motion.div
          className="w-full h-full border-t border-r border-cyan-400/30 rounded-tr-sm"
          animate={{ opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
        />
      </div>
      <div className="absolute bottom-0 left-0 w-4 h-4">
        <motion.div
          className="w-full h-full border-b border-l border-cyan-400/30 rounded-bl-sm"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1 }}
        />
      </div>
      <div className="absolute bottom-0 right-0 w-4 h-4">
        <motion.div
          className="w-full h-full border-b border-r border-cyan-400/30 rounded-br-sm"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
        />
      </div>
    </div>
  )
}

export function WeatherEffects({ type, intensity = 'medium', className }: WeatherEffectsProps) {
  if (type === 'none') return null

  return (
    <div className={cn('absolute inset-0 rounded-lg overflow-hidden pointer-events-none', className)}>
      {type === 'rain' && <RainEffect intensity={intensity} />}
      {type === 'hot' && <HeatEffect intensity={intensity} />}
      {type === 'cold' && <ColdEffect intensity={intensity} />}
    </div>
  )
}

// Helper to determine weather effect type from conditions
export function getWeatherEffectType(
  condition: string,
  temperature: number,
  precipitationProbability: number
): { type: 'rain' | 'hot' | 'cold' | 'none'; intensity: 'low' | 'medium' | 'high' } {
  // Rain check
  if (condition === 'rain' || precipitationProbability > 60) {
    return { 
      type: 'rain', 
      intensity: precipitationProbability > 80 ? 'high' : precipitationProbability > 60 ? 'medium' : 'low' 
    }
  }
  if (condition === 'drizzle' || precipitationProbability > 40) {
    return { type: 'rain', intensity: 'low' }
  }
  
  // Heat check (above 32°C is hot)
  if (temperature >= 35) {
    return { type: 'hot', intensity: 'high' }
  }
  if (temperature >= 32) {
    return { type: 'hot', intensity: 'medium' }
  }
  if (temperature >= 30) {
    return { type: 'hot', intensity: 'low' }
  }
  
  // Cold check (below 5°C is cold)
  if (temperature <= 0) {
    return { type: 'cold', intensity: 'high' }
  }
  if (temperature <= 3) {
    return { type: 'cold', intensity: 'medium' }
  }
  if (temperature <= 5) {
    return { type: 'cold', intensity: 'low' }
  }
  
  return { type: 'none', intensity: 'medium' }
}
