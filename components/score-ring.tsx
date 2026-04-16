"use client"

import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

interface ScoreRingProps {
  score: number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  animated?: boolean
  className?: string
}

const sizeConfig = {
  sm: { size: 48, strokeWidth: 4, fontSize: 'text-sm' },
  md: { size: 72, strokeWidth: 5, fontSize: 'text-xl' },
  lg: { size: 96, strokeWidth: 6, fontSize: 'text-2xl' },
  xl: { size: 120, strokeWidth: 7, fontSize: 'text-4xl' },
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E' // green
  if (score >= 60) return '#84CC16' // lime
  if (score >= 40) return '#F59E0B' // amber
  return '#EF4444' // red
}

function getScoreGradient(score: number): { start: string; end: string } {
  if (score >= 80) return { start: '#22C55E', end: '#4ADE80' }
  if (score >= 60) return { start: '#84CC16', end: '#A3E635' }
  if (score >= 40) return { start: '#F59E0B', end: '#FBBF24' }
  return { start: '#EF4444', end: '#F87171' }
}

export function ScoreRing({ 
  score, 
  size = 'md', 
  showLabel = true,
  animated = true,
  className 
}: ScoreRingProps) {
  const config = sizeConfig[size]
  const radius = (config.size - config.strokeWidth) / 2
  const circumference = radius * 2 * Math.PI
  const gradientId = `score-gradient-${Math.random().toString(36).substr(2, 9)}`
  
  const [displayScore, setDisplayScore] = useState(animated ? 0 : score)
  const spring = useSpring(0, { stiffness: 50, damping: 15 })
  const displayValue = useTransform(spring, (val) => Math.round(val))
  
  useEffect(() => {
    if (animated) {
      spring.set(score)
      const unsubscribe = displayValue.on('change', (val) => setDisplayScore(val))
      return unsubscribe
    } else {
      setDisplayScore(score)
    }
  }, [score, animated, spring, displayValue])
  
  const progress = (displayScore / 100) * circumference
  const strokeDashoffset = circumference - progress
  const gradient = getScoreGradient(score)

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg 
        width={config.size} 
        height={config.size} 
        className="transform -rotate-90"
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradient.start} />
            <stop offset="100%" stopColor={gradient.end} />
          </linearGradient>
        </defs>
        
        {/* Background circle */}
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={config.strokeWidth}
          className="text-muted/30"
        />
        
        {/* Progress circle */}
        <motion.circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={config.strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: animated ? 1 : 0, ease: 'easeOut' }}
        />
      </svg>
      
      {showLabel && (
        <motion.div 
          className={cn(
            'absolute inset-0 flex items-center justify-center font-semibold tabular-nums',
            config.fontSize
          )}
          initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          style={{ color: getScoreColor(score) }}
        >
          {displayScore}
        </motion.div>
      )}
    </div>
  )
}
